"""错题本 API — 传统错题集 + AI 错因分析 + 同类题推荐"""
import asyncio
import json
import logging
import time
import uuid
from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, field_validator
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
from sqlalchemy import select, func, desc
from app.core.database import get_db, async_session
from app.core.dependencies import valid_student_id, get_current_user
from app.core.validators import _validate_uuid
from app.core.agent_metrics import agent_metrics
from app.models.student import Student
from app.models.exercise import Exercise
from app.models.exercise_bank import ExerciseBank
from app.models.wrong_question import WrongQuestion
from app.services.llm_factory import get_llm_client
from app.services.json_parser import parse_json_response
from app.agents.wrong_question_agent import wrong_question_agent, ERROR_TYPE_LABELS
from app.core.sse_utils import sse_event, sse_done, sse_error, sse_stream_response
from fastapi.responses import StreamingResponse

logger = logging.getLogger(__name__)

router = APIRouter()


@dataclass
class QuestionSnapshot:
    """从 snapshot 构建的题目对象，供 LLM 分析使用"""
    question: str = ""
    options: Optional[list] = None
    answer: str = ""
    explanation: str = ""
    knowledge_point: str = ""
    difficulty: int = 50
    exercise_type: str = "unknown"


# ===== Request/Response Models =====

class AddWrongQuestionRequest(BaseModel):
    student_id: str
    exercise_id: str
    wrong_answer: str

    @field_validator("student_id", "exercise_id")
    @classmethod
    def _validate_uuid(cls, v: str) -> str:
        return _validate_uuid(v)


class ReviewWrongQuestionRequest(BaseModel):
    is_correct: bool  # 本次复习是否答对


# ===== Helpers =====

async def _call_llm_for_analysis(
    exercise: Exercise,
    student_answer: str,
) -> dict:
    """调用 LLM 分析错题（错因+讲解）"""
    options_text = ""
    if exercise.options:
        if isinstance(exercise.options, list):
            options_text = "\n".join(
                f"{chr(65 + i)}. {opt}" for i, opt in enumerate(exercise.options)
            )
        else:
            options_text = str(exercise.options)

    system_prompt = "你是一位严谨的 AI 教师，请用 JSON 格式输出错因分析和讲解。"
    user_prompt = f"""分析以下错题的错误原因：

题目：{exercise.question}
选项：
{options_text}

正确答案：{exercise.answer}
学生答案：{student_answer}
知识点：{exercise.knowledge_point or '通用知识'}

请按以下 JSON 格式输出（不要使用 markdown 代码块包裹）：
{{
  "error_type": "calculation|concept|reading|carelessness|unknown",
  "error_analysis": "简要分析错误原因（50字内）",
  "ai_explanation": "详细讲解正确解法（200字内）"
}}

error_type 说明：
- calculation: 计算失误
- concept: 概念理解不清
- reading: 审题错误
- carelessness: 粗心大意
- unknown: 其他
"""
    try:
        response = await get_llm_client().chat(
            messages=[{"role": "user", "content": user_prompt}],
            system=system_prompt,
            max_tokens=800,
            temperature=0.3,
        )
        content = response.get("content", "")
        parsed = parse_json_response(content, fallback={
            "error_type": "unknown",
            "error_analysis": "无法分析",
            "ai_explanation": content[:500] if content else "",
        })
        return parsed
    except Exception as e:
        return {
            "error_type": "unknown",
            "error_analysis": "AI 分析暂时不可用",
            "ai_explanation": str(e)[:500],
        }


async def _call_llm_for_similar(exercise: Exercise, count: int = 3) -> list:
    """调用 LLM 生成同类题"""
    options_text = ""
    if exercise.options and isinstance(exercise.options, list):
        options_text = "选项格式：" + "; ".join(
            f"{chr(65 + i)}.{opt[:30]}" for i, opt in enumerate(exercise.options)
        )

    system_prompt = "你是一位严谨的 AI 教师，请用 JSON 格式输出练习题。"
    user_prompt = f"""基于以下题目生成 {count} 道同类练习题：

原题：{exercise.question}
正确答案：{exercise.answer}
题目类型：{exercise.exercise_type}
难度：{exercise.difficulty}
知识点：{exercise.knowledge_point or '通用知识'}
{options_text}

要求：
1. 相同知识点、相近难度
2. 不同的具体情境和数字
3. 干扰项设计合理

请按以下 JSON 格式输出（直接 JSON，不要 markdown 代码块）：
{{
  "exercises": [
    {{
      "type": "{exercise.exercise_type}",
      "question": "题目内容",
      "options": ["A选项", "B选项", "C选项", "D选项"],
      "answer": "B",
      "explanation": "解题思路",
      "difficulty": {exercise.difficulty}
    }}
  ]
}}

注意：如果原题是选择题，输出选择题；如果原题是填空题，输出填空题。
"""
    try:
        response = await get_llm_client().chat(
            messages=[{"role": "user", "content": user_prompt}],
            system=system_prompt,
            max_tokens=2000,
            temperature=0.7,
        )
        content = response.get("content", "")
        parsed = parse_json_response(content, fallback={"exercises": []})
        return parsed.get("exercises", [])[:count]
    except Exception:
        return []


async def _resolve_question_source(db, wq: WrongQuestion):
    """根据 source_type 自动从对应表查题目对象"""
    exercise = None
    bank_item = None
    if wq.source_type == "exercise" and wq.exercise_id:
        result = await db.execute(select(Exercise).where(Exercise.id == wq.exercise_id))
        exercise = result.scalar_one_or_none()
    elif wq.source_type == "bank" and wq.exercise_bank_id:
        result = await db.execute(select(ExerciseBank).where(ExerciseBank.id == wq.exercise_bank_id))
        bank_item = result.scalar_one_or_none()
    return exercise, bank_item


def _to_dto(wq: WrongQuestion, exercise: Optional[Exercise] = None, bank_item: Optional[ExerciseBank] = None) -> dict:
    """转为前端需要的 DTO"""
    # 优先用 question_snapshot（防止源表删数据后无法显示）
    if wq.question_snapshot:
        source = wq.question_snapshot
        question_data = {
            "question": source.get("question", ""),
            "options": source.get("options"),
            "answer": source.get("answer", ""),
            "explanation": source.get("explanation", ""),
            "knowledge_point": source.get("knowledge_point", ""),
            "difficulty": source.get("difficulty", 50),
        }
    elif exercise:
        question_data = {
            "question": exercise.question,
            "options": exercise.options,
            "answer": exercise.answer,
            "explanation": exercise.explanation,
            "knowledge_point": exercise.knowledge_point,
            "difficulty": exercise.difficulty,
        }
    elif bank_item:
        question_data = {
            "question": bank_item.question,
            "options": bank_item.options,
            "answer": bank_item.answer,
            "explanation": bank_item.explanation,
            "knowledge_point": bank_item.knowledge_point,
            "difficulty": bank_item.difficulty,
        }
    else:
        question_data = {}

    result = {
        "id": str(wq.id),
        "exercise_id": str(wq.exercise_id or wq.exercise_bank_id),
        "source_type": wq.source_type,
        "wrong_answer": wq.wrong_answer,
        "correct_answer": wq.correct_answer,
        "error_type": wq.error_type,
        "error_analysis": wq.error_analysis,
        "ai_explanation": wq.ai_explanation,
        "similar_exercises": wq.similar_exercises or [],
        "mastery_level": wq.mastery_level,
        "review_count": wq.review_count,
        "correct_count": wq.correct_count,
        "is_mastered": wq.is_mastered,
        "last_reviewed_at": wq.last_reviewed_at.isoformat() if wq.last_reviewed_at else None,
        "created_at": wq.created_at.isoformat() if wq.created_at else None,
    }
    if question_data:
        # exercise_type: 优先从 snapshot 取，其次 exercise，再次 bank_item
        ex_type = "unknown"
        if wq.question_snapshot and wq.question_snapshot.get("exercise_type"):
            ex_type = wq.question_snapshot["exercise_type"]
        elif exercise:
            ex_type = exercise.exercise_type
        elif bank_item:
            ex_type = bank_item.exercise_type

        result["exercise"] = {
            "id": str(wq.exercise_id or wq.exercise_bank_id),
            "type": ex_type,
            **question_data,
        }
    return result


async def _background_classify_error(wq_id: str, snapshot: dict, wrong_answer: str):
    """后台轻量错因分类 — 入库后异步触发，不阻塞响应"""
    t0 = time.time()
    try:
        async with async_session() as session:
            data = await wrong_question_agent.classify_error_only(
                question=snapshot.get("question", ""),
                options=snapshot.get("options"),
                answer=snapshot.get("answer", ""),
                wrong_answer=wrong_answer,
                knowledge_point=snapshot.get("knowledge_point", ""),
            )

            result = await session.execute(
                select(WrongQuestion).where(WrongQuestion.id == uuid.UUID(wq_id))
            )
            wq = result.scalar_one_or_none()
            if not wq:
                return

            wq.error_type = data.get("error_type", "unknown")
            wq.error_analysis = data.get("error_analysis", "")
            await session.commit()
            agent_metrics.record("wrong_question", True, (time.time() - t0) * 1000)
            logger.info("错因分类完成: %s -> %s", wq_id, wq.error_type)
    except Exception as e:
        agent_metrics.record("wrong_question", False, (time.time() - t0) * 1000)
        logger.error("后台错因分类失败: %s — %s", wq_id, e)


# ===== Endpoints =====

@router.post("")
async def add_wrong_question(
    req: AddWrongQuestionRequest,
    db: AsyncSession = Depends(get_db),
    user: Student = Depends(get_current_user),
):
    """添加错题（手动/自动）— 同时支持 Exercise 和 ExerciseBank 表"""
    if str(user.id) != req.student_id:
        raise HTTPException(status_code=403, detail="只能添加自己的错题")

    exercise_uuid = uuid.UUID(req.exercise_id)
    source_type = "exercise"
    correct_answer = ""
    question_snapshot = None

    # 先查 Exercise 表（学生专属练习）
    ex_result = await db.execute(select(Exercise).where(Exercise.id == exercise_uuid))
    exercise = ex_result.scalar_one_or_none()
    if exercise:
        source_type = "exercise"
        correct_answer = exercise.answer
        question_snapshot = {
            "question": exercise.question,
            "options": exercise.options,
            "answer": exercise.answer,
            "explanation": exercise.explanation,
            "difficulty": exercise.difficulty,
            "knowledge_point": exercise.knowledge_point,
            "exercise_type": exercise.exercise_type,
            "source": "exercise",
        }
    else:
        # 再查 ExerciseBank 表（公共题库 / AI 生成）
        bank_result = await db.execute(select(ExerciseBank).where(ExerciseBank.id == exercise_uuid))
        bank_item = bank_result.scalar_one_or_none()
        if bank_item:
            source_type = "bank"
            correct_answer = bank_item.answer
            question_snapshot = {
                "question": bank_item.question,
                "options": bank_item.options,
                "answer": bank_item.answer,
                "explanation": bank_item.explanation,
                "difficulty": bank_item.difficulty,
                "knowledge_point": bank_item.knowledge_point,
                "exercise_type": bank_item.exercise_type,
                "source": bank_item.source,
            }
        else:
            raise HTTPException(status_code=404, detail="题目不存在")

    # 查重：同一题未掌握时不重复添加（同时支持两种 source）
    if source_type == "exercise":
        existing = await db.execute(
            select(WrongQuestion).where(
                WrongQuestion.student_id == user.id,
                WrongQuestion.exercise_id == exercise_uuid,
                WrongQuestion.is_mastered == False,
            )
        )
    else:
        existing = await db.execute(
            select(WrongQuestion).where(
                WrongQuestion.student_id == user.id,
                WrongQuestion.exercise_bank_id == exercise_uuid,
                WrongQuestion.is_mastered == False,
            )
        )
    old = existing.scalar_one_or_none()
    if old:
        return {"id": str(old.id), "status": "exists", "message": "该题已在错题本中"}

    # 创建错题记录
    wq_data = {
        "student_id": user.id,
        "wrong_answer": req.wrong_answer,
        "correct_answer": correct_answer,
        "error_type": "unknown",
        "source_type": source_type,
        "question_snapshot": question_snapshot,
    }
    if source_type == "exercise":
        wq_data["exercise_id"] = exercise_uuid
    else:
        wq_data["exercise_bank_id"] = exercise_uuid

    wq = WrongQuestion(**wq_data)
    db.add(wq)
    await db.commit()
    await db.refresh(wq)

    # 异步轻量错因分类（不阻塞响应）
    if question_snapshot:
        asyncio.create_task(_background_classify_error(str(wq.id), question_snapshot, req.wrong_answer))

    return {"id": str(wq.id), "status": "created"}


@router.get("")
async def list_wrong_questions(
    student_id: uuid.UUID = Depends(valid_student_id),
    filter_type: str = Query("all", pattern="^(all|unmastered|mastered)$"),
    error_type: Optional[str] = Query(None),
    keyword: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    user: Student = Depends(get_current_user),
):
    """错题列表 + 统计"""
    if user.id != student_id:
        raise HTTPException(status_code=403, detail="只能查看自己的错题")

    # === 全局统计（不受分页/筛选影响）===
    mastered_count_q = await db.execute(
        select(func.count(WrongQuestion.id)).where(
            WrongQuestion.student_id == student_id,
            WrongQuestion.is_mastered == True,
        )
    )
    mastered = mastered_count_q.scalar() or 0

    total_count_q = await db.execute(
        select(func.count(WrongQuestion.id)).where(
            WrongQuestion.student_id == student_id,
        )
    )
    overall_total = total_count_q.scalar() or 0
    unmastered = overall_total - mastered

    avg_mastery_q = await db.execute(
        select(func.avg(WrongQuestion.mastery_level)).where(
            WrongQuestion.student_id == student_id,
        )
    )
    avg_mastery_level = round(float(avg_mastery_q.scalar() or 0))

    type_q = await db.execute(
        select(WrongQuestion.error_type, func.count(WrongQuestion.id))
        .where(WrongQuestion.student_id == student_id)
        .group_by(WrongQuestion.error_type)
    )
    by_error_type = {row[0]: row[1] for row in type_q.all()}

    # === 分页数据（单表查询，快照已含完整题目）===
    query = select(WrongQuestion).where(WrongQuestion.student_id == student_id)

    if filter_type == "unmastered":
        query = query.where(WrongQuestion.is_mastered == False)
    elif filter_type == "mastered":
        query = query.where(WrongQuestion.is_mastered == True)
    if error_type:
        query = query.where(WrongQuestion.error_type == error_type)
    if keyword:
        # keyword 搜索从 snapshot 取 question（兼容两种 source）
        query = query.where(
            WrongQuestion.question_snapshot["question"].astext.ilike(f"%{keyword}%")
        )

    page_query = query.order_by(desc(WrongQuestion.created_at)).limit(page_size).offset((page - 1) * page_size)
    page_count_q = await db.execute(
        query.with_only_columns(func.count(WrongQuestion.id)).order_by(None)
    )
    total = page_count_q.scalar() or 0

    page_result = await db.execute(page_query)
    rows = page_result.scalars().all()
    items = [_to_dto(wq) for wq in rows]

    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "stats": {
            "total": overall_total,
            "mastered": mastered,
            "unmastered": unmastered,
            "by_error_type": by_error_type,
            "avg_mastery_level": avg_mastery_level,
        },
    }


@router.get("/stats")
async def get_wrong_question_stats(
    db: AsyncSession = Depends(get_db),
    user: Student = Depends(get_current_user),
):
    """错题统计汇总"""
    sid = user.id

    total_q = await db.execute(
        select(func.count(WrongQuestion.id)).where(WrongQuestion.student_id == sid)
    )
    total = total_q.scalar() or 0

    if total == 0:
        return {
            "total": 0,
            "mastered": 0,
            "mastery_rate": 0,
            "by_error_type": {},
            "review_streak": 0,
            "weakest_kp": [],
        }

    mastered_q = await db.execute(
        select(func.count(WrongQuestion.id)).where(
            WrongQuestion.student_id == sid,
            WrongQuestion.is_mastered == True,
        )
    )
    mastered = mastered_q.scalar() or 0

    # 按错误类型
    type_q = await db.execute(
        select(WrongQuestion.error_type, func.count(WrongQuestion.id))
        .where(WrongQuestion.student_id == sid)
        .group_by(WrongQuestion.error_type)
    )
    by_error_type = {row[0]: row[1] for row in type_q.all()}

    # 最薄弱知识点（错题最多的前 5 个）
    kp_q = await db.execute(
        select(Exercise.knowledge_point, func.count(WrongQuestion.id).label("count"))
        .join(WrongQuestion, WrongQuestion.exercise_id == Exercise.id)
        .where(WrongQuestion.student_id == sid)
        .group_by(Exercise.knowledge_point)
        .order_by(desc("count"))
        .limit(5)
    )
    weakest_kp = [
        {"knowledge_point": row[0] or "未分类", "count": row[1]}
        for row in kp_q.all()
    ]

    return {
        "total": total,
        "mastered": mastered,
        "mastery_rate": round(mastered / total * 100, 1) if total > 0 else 0,
        "by_error_type": by_error_type,
        "weakest_kp": weakest_kp,
    }


@router.get("/{wrong_id}")
async def get_wrong_question_detail(
    wrong_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: Student = Depends(get_current_user),
):
    """错题详情"""
    # 先查 WrongQuestion
    wq_result = await db.execute(select(WrongQuestion).where(WrongQuestion.id == wrong_id))
    wq = wq_result.scalar_one_or_none()
    if not wq:
        raise HTTPException(status_code=404, detail="错题不存在")
    if wq.student_id != user.id:
        raise HTTPException(status_code=403, detail="只能查看自己的错题")

    exercise, bank_item = await _resolve_question_source(db, wq)
    return _to_dto(wq, exercise, bank_item)


@router.post("/{wrong_id}/analyze")
async def analyze_wrong_question(
    wrong_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: Student = Depends(get_current_user),
):
    """AI 错因分析（一步到位：错因 + 讲解 + 同类题）"""
    wq_result = await db.execute(select(WrongQuestion).where(WrongQuestion.id == wrong_id))
    wq = wq_result.scalar_one_or_none()
    if not wq:
        raise HTTPException(status_code=404, detail="错题不存在")
    if wq.student_id != user.id:
        raise HTTPException(status_code=403, detail="只能分析自己的错题")

    exercise, bank_item = await _resolve_question_source(db, wq)

    # 用 snapshot 或查到的对象来调用分析
    source_obj = exercise if exercise else bank_item
    if not source_obj:
        # 从 snapshot 构建 QuestionSnapshot 对象
        if wq.question_snapshot:
            source_obj = QuestionSnapshot(
                question=wq.question_snapshot.get("question", ""),
                options=wq.question_snapshot.get("options"),
                answer=wq.question_snapshot.get("answer", ""),
                explanation=wq.question_snapshot.get("explanation", ""),
                knowledge_point=wq.question_snapshot.get("knowledge_point", ""),
                difficulty=wq.question_snapshot.get("difficulty", 50),
                exercise_type=wq.question_snapshot.get("exercise_type", "unknown"),
            )
        else:
            raise HTTPException(status_code=404, detail="题目不存在")

    # 1. AI 错因分析 + 讲解
    analysis = await _call_llm_for_analysis(source_obj, wq.wrong_answer)

    # 2. AI 生成同类题
    similar = await _call_llm_for_similar(source_obj, count=3)

    # 3. 保存到数据库
    wq.error_type = analysis.get("error_type", "unknown")
    wq.error_analysis = analysis.get("error_analysis", "")
    wq.ai_explanation = analysis.get("ai_explanation", "")
    wq.similar_exercises = similar
    wq.updated_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(wq)

    return _to_dto(wq, exercise, bank_item)


@router.post("/{wrong_id}/analyze/stream")
async def analyze_wrong_question_stream(
    wrong_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: Student = Depends(get_current_user),
):
    """AI 错因分析（Agent 流式版）— 4 步思考链 SSE 流式返回"""
    wq_result = await db.execute(select(WrongQuestion).where(WrongQuestion.id == wrong_id))
    wq = wq_result.scalar_one_or_none()
    if not wq:
        raise HTTPException(status_code=404, detail="错题不存在")
    if wq.student_id != user.id:
        raise HTTPException(status_code=403, detail="只能分析自己的错题")

    exercise, bank_item = await _resolve_question_source(db, wq)

    source_obj = exercise if exercise else bank_item
    if not source_obj:
        if wq.question_snapshot:
            source_obj = QuestionSnapshot(
                question=wq.question_snapshot.get("question", ""),
                options=wq.question_snapshot.get("options"),
                answer=wq.question_snapshot.get("answer", ""),
                explanation=wq.question_snapshot.get("explanation", ""),
                knowledge_point=wq.question_snapshot.get("knowledge_point", ""),
                difficulty=wq.question_snapshot.get("difficulty", 50),
                exercise_type=wq.question_snapshot.get("exercise_type", "unknown"),
            )
        else:
            raise HTTPException(status_code=404, detail="题目不存在")

    options = source_obj.options if hasattr(source_obj, "options") else None
    if options and isinstance(options, str):
        options = [options]

    async def event_generator():
        analysis_data = None
        similar_data = None
        try:
            async for event in wrong_question_agent.analyze(
                question=source_obj.question or "",
                options=options,
                answer=source_obj.answer or "",
                wrong_answer=wq.wrong_answer,
                knowledge_point=source_obj.knowledge_point or "",
                difficulty=getattr(source_obj, "difficulty", 50) or 50,
                exercise_type=getattr(source_obj, "exercise_type", "unknown") or "unknown",
            ):
                if event["event"] == "thinking":
                    yield sse_event("thinking", step=event["step"], text=event["text"])
                elif event["event"] == "analysis":
                    analysis_data = event["data"]
                    yield sse_event("analysis", data=event["data"])
                elif event["event"] == "similar":
                    similar_data = event["data"]
                    yield sse_event("similar", data=event["data"])
                elif event["event"] == "done":
                    if analysis_data:
                        wq.error_type = analysis_data.get("error_type", "unknown")
                        wq.error_analysis = analysis_data.get("error_analysis", "")
                        wq.ai_explanation = analysis_data.get("ai_explanation", "")
                    if similar_data is not None:
                        wq.similar_exercises = similar_data
                    wq.updated_at = datetime.now(timezone.utc)
                    await db.commit()
                    yield sse_done()
                elif event["event"] == "error":
                    yield sse_error(event.get("message", "分析过程出错"))
        except Exception as e:
            logger.error("错题 Agent 分析异常: %s", e)
            yield sse_error(f"分析异常: {str(e)[:200]}")

    return StreamingResponse(event_generator(), media_type="text/event-stream", headers={
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
    })


@router.post("/{wrong_id}/review")
async def review_wrong_question(
    wrong_id: uuid.UUID,
    req: ReviewWrongQuestionRequest,
    db: AsyncSession = Depends(get_db),
    user: Student = Depends(get_current_user),
):
    """标记复习（答对/答错）"""
    result = await db.execute(
        select(WrongQuestion).where(WrongQuestion.id == wrong_id)
    )
    wq = result.scalar_one_or_none()
    if not wq:
        raise HTTPException(status_code=404, detail="错题不存在")

    if wq.student_id != user.id:
        raise HTTPException(status_code=403, detail="只能复习自己的错题")

    wq.review_count = (wq.review_count or 0) + 1
    if req.is_correct:
        wq.correct_count = (wq.correct_count or 0) + 1

    # 掌握度：每次答对 +20，上限 100
    wq.mastery_level = min(100, (wq.correct_count or 0) * 20)

    # 答对 3 次自动掌握
    if wq.correct_count >= 3:
        wq.is_mastered = True

    wq.last_reviewed_at = datetime.now(timezone.utc)
    wq.updated_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(wq)

    # 画像联动：错题回顾 → memory 维度
    try:
        from app.services.profile_service import apply_rule_updates
        rule_updates = []
        if req.is_correct:
            rule_updates.append({
                "dimension": "memory",
                "score_change": 3 if wq.is_mastered else 1,
                "reason": f"错题回顾正确（掌握度{wq.mastery_level}%）" + ("，已掌握" if wq.is_mastered else ""),
            })
        else:
            rule_updates.append({
                "dimension": "memory",
                "score_change": -1,
                "reason": "错题回顾仍需加强",
            })
        await apply_rule_updates(
            db=db,
            student_id=str(user.id),
            rule_updates=rule_updates,
        )
    except Exception as e:
        logger.warning(f"[wrong_questions] 画像更新失败: {e}")

    return _to_dto(wq)


@router.delete("/{wrong_id}")
async def delete_wrong_question(
    wrong_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: Student = Depends(get_current_user),
):
    """删除错题"""
    result = await db.execute(
        select(WrongQuestion).where(WrongQuestion.id == wrong_id)
    )
    wq = result.scalar_one_or_none()
    if not wq:
        raise HTTPException(status_code=404, detail="错题不存在")
    if wq.student_id != user.id:
        raise HTTPException(status_code=403, detail="只能删除自己的错题")

    await db.delete(wq)
    await db.commit()
    return {"status": "deleted", "id": str(wrong_id)}
