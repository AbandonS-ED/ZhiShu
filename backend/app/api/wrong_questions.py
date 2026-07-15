"""错题本 API — 传统错题集 + AI 错因分析 + 同类题推荐"""
import json
import uuid
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, field_validator
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from app.core.database import get_db
from app.core.dependencies import valid_student_id, get_current_user
from app.models.student import Student
from app.models.exercise import Exercise
from app.models.wrong_question import WrongQuestion
from app.services.llm_factory import get_llm_client
from app.services.json_parser import parse_json_response

router = APIRouter()


# ===== Request/Response Models =====

class AddWrongQuestionRequest(BaseModel):
    student_id: str
    exercise_id: str
    wrong_answer: str

    @field_validator("student_id", "exercise_id")
    @classmethod
    def _validate_uuid(cls, v: str) -> str:
        try:
            uuid.UUID(v)
            return v
        except (ValueError, AttributeError, TypeError):
            raise ValueError(f"无效的 UUID: {v}")


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


def _to_dto(wq: WrongQuestion, exercise: Optional[Exercise] = None) -> dict:
    """转为前端需要的 DTO"""
    result = {
        "id": str(wq.id),
        "exercise_id": str(wq.exercise_id),
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
    if exercise:
        result["exercise"] = {
            "id": str(exercise.id),
            "type": exercise.exercise_type,
            "question": exercise.question,
            "options": exercise.options,
            "answer": exercise.answer,
            "explanation": exercise.explanation,
            "knowledge_point": exercise.knowledge_point,
            "difficulty": exercise.difficulty,
        }
    return result


# ===== Endpoints =====

@router.post("")
async def add_wrong_question(
    req: AddWrongQuestionRequest,
    db: AsyncSession = Depends(get_db),
    user: Student = Depends(get_current_user),
):
    """添加错题（手动/自动）"""
    if str(user.id) != req.student_id:
        raise HTTPException(status_code=403, detail="只能添加自己的错题")

    exercise_uuid = uuid.UUID(req.exercise_id)
    ex_result = await db.execute(select(Exercise).where(Exercise.id == exercise_uuid))
    exercise = ex_result.scalar_one_or_none()
    if not exercise:
        raise HTTPException(status_code=404, detail="题目不存在")

    # 查重：同一题未掌握时不重复添加
    existing = await db.execute(
        select(WrongQuestion).where(
            WrongQuestion.student_id == user.id,
            WrongQuestion.exercise_id == exercise_uuid,
            WrongQuestion.is_mastered == False,
        )
    )
    old = existing.scalar_one_or_none()
    if old:
        return {"id": str(old.id), "status": "exists", "message": "该题已在错题本中"}

    wq = WrongQuestion(
        student_id=user.id,
        exercise_id=exercise_uuid,
        wrong_answer=req.wrong_answer,
        correct_answer=exercise.answer,
        error_type="unknown",
    )
    db.add(wq)
    await db.commit()
    await db.refresh(wq)
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

    # === 分页数据 ===
    query = select(WrongQuestion, Exercise).join(
        Exercise, WrongQuestion.exercise_id == Exercise.id
    ).where(WrongQuestion.student_id == student_id)

    if filter_type == "unmastered":
        query = query.where(WrongQuestion.is_mastered == False)
    elif filter_type == "mastered":
        query = query.where(WrongQuestion.is_mastered == True)
    if error_type:
        query = query.where(WrongQuestion.error_type == error_type)
    if keyword:
        query = query.where(Exercise.question.ilike(f"%{keyword}%"))

    page_query = query.order_by(desc(WrongQuestion.created_at)).limit(page_size).offset((page - 1) * page_size)
    page_count_q = await db.execute(
        query.with_only_columns(func.count(WrongQuestion.id)).order_by(None)
    )
    total = page_count_q.scalar() or 0

    page_result = await db.execute(page_query)
    rows = page_result.all()
    items = [_to_dto(wq, ex) for wq, ex in rows]

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
    result = await db.execute(
        select(WrongQuestion, Exercise)
        .join(Exercise, WrongQuestion.exercise_id == Exercise.id)
        .where(WrongQuestion.id == wrong_id)
    )
    row = result.first()
    if not row:
        raise HTTPException(status_code=404, detail="错题不存在")

    wq, exercise = row
    if wq.student_id != user.id:
        raise HTTPException(status_code=403, detail="只能查看自己的错题")

    return _to_dto(wq, exercise)


@router.post("/{wrong_id}/analyze")
async def analyze_wrong_question(
    wrong_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: Student = Depends(get_current_user),
):
    """AI 错因分析（一步到位：错因 + 讲解 + 同类题）"""
    result = await db.execute(
        select(WrongQuestion, Exercise)
        .join(Exercise, WrongQuestion.exercise_id == Exercise.id)
        .where(WrongQuestion.id == wrong_id)
    )
    row = result.first()
    if not row:
        raise HTTPException(status_code=404, detail="错题不存在")

    wq, exercise = row
    if wq.student_id != user.id:
        raise HTTPException(status_code=403, detail="只能分析自己的错题")

    # 1. AI 错因分析 + 讲解
    analysis = await _call_llm_for_analysis(exercise, wq.wrong_answer)

    # 2. AI 生成同类题
    similar = await _call_llm_for_similar(exercise, count=3)

    # 3. 保存到数据库
    wq.error_type = analysis.get("error_type", "unknown")
    wq.error_analysis = analysis.get("error_analysis", "")
    wq.ai_explanation = analysis.get("ai_explanation", "")
    wq.similar_exercises = similar
    wq.updated_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(wq)

    return _to_dto(wq, exercise)


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
