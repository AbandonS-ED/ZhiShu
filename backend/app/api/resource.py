"""资源 API — 资源生成 + 练习题生成 + SSE 流式"""

import json
import re
import uuid
import difflib
import logging
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, field_validator
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from fastapi import HTTPException
from app.core.database import get_db, async_session
from app.core.dependencies import valid_student_id, get_current_user
from app.models.student import Student
from app.models.student_profile import StudentProfile
from app.models.resource import Resource
from app.models.exercise import Exercise
from app.models.exercise_bank import ExerciseBank
from app.models.learning_path import LearningPath
from app.agents.document_agent import document_agent
from app.agents.exercise_agent import exercise_agent
from app.services import minimax_client as mc_module
from app.services.anti_hallucination import anti_hallucination
from app.services.json_parser import parse_json_response
from app.services.recommendation_service import recommendation_service

# 流式专用 system prompt — 让 LLM 先输出人类可读文本，末尾跟 JSON
STREAM_EXERCISE_SYSTEM = """你是一个练习题生成器。请按以下两部分输出：

前半部分：markdown 格式的人类可读内容（用户直接阅读）
📝 为你生成了 N 道关于「知识点」的练习题：

**1.** 【题型】题目内容
（含选项、答案、解析、难度）

...

---JSON_DATA---
后半部分：与前半部分内容一致的 JSON 数据
{"exercises": [{"type":"choice","question":"...","options":["A. ...","B. ..."],"answer":"B","explanation":"...","difficulty":50,"knowledge_point":"..."}]}

规则：
- 前半部分是 markdown 格式的人类可读内容（包含完整题目、选项、答案、解析）
- 后半部分是 JSON，用于结构化存储（与前半部分内容完全一致）
- 两部分中间必须有单独一行 ---JSON_DATA---
- type 字段只能是以下英文值之一：choice（选择题）、judge（判断题）、short_answer（简答题）、coding（编程题）。禁止输出中文。
- 答案格式：选择题 answer 必须是选项字母 A/B/C/D；判断题 answer 必须是 "正确" 或 "错误"
- 只输出以上内容，不要额外文字"""


TYPE_NORMALIZE = {
    "选择题": "choice", "选择": "choice",
    "判断题": "judge", "判断": "judge",
    "简答题": "short_answer", "简答": "short_answer",
    "编程题": "coding", "编程": "coding",
}


def normalize_exercise_type(raw: str) -> str:
    """将 LLM 可能输出的中文题型名映射回英文"""
    if not raw:
        return "short_answer"
    val = raw.strip().lower()
    if val in ("choice", "judge", "short_answer", "coding"):
        return val
    for cn, en in TYPE_NORMALIZE.items():
        if cn in raw:
            return en
    return "short_answer"


def normalize_answer(ex_type: str, answer: str) -> str:
    """统一答案格式：将 LLM 各种变体映射为标准机器可读格式"""
    if not answer:
        return ""
    v = answer.strip()
    if ex_type == "choice":
        # 取首字母大写，如 "B."/"B)"/"B 选项"/"选项B" → "B"
        for ch in v:
            if "A" <= ch <= "Z":
                return ch
        # 数字索引 → 转为字母 (0→A, 1→B, ...)
        try:
            idx = int(v)
            if 0 <= idx <= 25:
                return chr(65 + idx)
        except ValueError:
            pass
        return v[0].upper()
    if ex_type == "judge":
        # 所有"正确"变体 → "正确"
        if v.lower() in ("正确", "对", "true", "t", "✔", "√", "是", "yes", "y", "1"):
            return "正确"
        # 所有"错误"变体 → "错误"
        if v.lower() in ("错误", "错", "false", "f", "✗", "✘", "否", "no", "n", "0"):
            return "错误"
        return v
    return v


def _normalize_question(q: str) -> str:
    """归一化题目文本：去除非中英文数字和语气词，用于相似度比较"""
    q = re.sub(r'[^\u4e00-\u9fa5a-zA-Z0-9]', '', q)
    q = re.sub(r'[的是了吗呢吧啊呀哦哈]', '', q)
    return q.strip().lower()


def _is_duplicate_question(question: str, existing_questions: list[str], threshold: float = 0.85) -> bool:
    """检查新题目是否与已有题目重复（基于文本相似度）"""
    q_norm = _normalize_question(question)
    if not q_norm or len(q_norm) < 4:
        return False
    for eq in existing_questions:
        eq_norm = _normalize_question(eq)
        if not eq_norm or len(eq_norm) < 4:
            continue
        ratio = difflib.SequenceMatcher(None, q_norm, eq_norm).ratio()
        if ratio >= threshold:
            return True
    return False


async def _cap_exercises(db: AsyncSession, student_id: uuid.UUID, knowledge_point: str, max_per_kp: int = 20):
    """每个知识点最多保留 max_per_kp 道 AI 题，超限删最旧的"""
    from sqlalchemy import func, delete as sql_delete
    count_result = await db.execute(
        select(func.count()).select_from(Exercise)
        .where(Exercise.student_id == student_id)
        .where(Exercise.knowledge_point == knowledge_point)
    )
    total = count_result.scalar() or 0
    if total <= max_per_kp:
        return
    # 查出要保留的最新 max_per_kp 条的 id
    keep_result = await db.execute(
        select(Exercise.id)
        .where(Exercise.student_id == student_id)
        .where(Exercise.knowledge_point == knowledge_point)
        .order_by(Exercise.created_at.desc())
        .limit(max_per_kp)
    )
    keep_ids = {row[0] for row in keep_result.all()}
    # 删除不在保留列表中的
    await db.execute(
        sql_delete(Exercise)
        .where(Exercise.student_id == student_id)
        .where(Exercise.knowledge_point == knowledge_point)
        .where(Exercise.id.notin_(keep_ids))
    )
    await db.commit()


router = APIRouter()
logger = logging.getLogger(__name__)

def _strip_think(text: str) -> str:
    """去掉 <think>...</think> 标签及其内容（支持嵌套和未闭合标签）

    流中断在 <think> 内时，只截断到最后一个未闭合的 <think> 之前，
    而不是删掉 rfind 之后的所有内容（包括合法文本）。
    """
    result = ""
    depth = 0
    open_tag = "<think>"
    close_tag = "</think>"
    open_len = len(open_tag)
    close_len = len(close_tag)
    last_open_in_result = -1
    i = 0
    n = len(text)
    while i < n:
        if depth == 0 and text[i:i + open_len] == open_tag:
            last_open_in_result = len(result)
            depth = 1
            i += open_len
        elif depth > 0 and text[i:i + close_len] == close_tag:
            depth = 0
            i += close_len
        elif depth == 0:
            result += text[i]
            i += 1
        else:
            i += 1
    if depth > 0 and last_open_in_result >= 0:
        result = result[:last_open_in_result]
    return result


class ResourceGenRequest(BaseModel):
    student_id: str
    knowledge_point: str
    resource_type: str = "all"
    course_id: str | None = None

    @field_validator("student_id", "course_id")
    @classmethod
    def _validate_uuid(cls, v: str | None) -> str | None:
        if v is None:
            return v
        try:
            uuid.UUID(v)
            return v
        except (ValueError, AttributeError, TypeError):
            raise ValueError(f"无效的 UUID: {v}")


class ExerciseGenRequest(BaseModel):
    student_id: str
    knowledge_point: str
    exercise_type: str = "all"
    count: int = 5
    course_id: str | None = None

    @field_validator("student_id", "course_id")
    @classmethod
    def _validate_uuid(cls, v: str | None) -> str | None:
        if v is None:
            return v
        try:
            uuid.UUID(v)
            return v
        except (ValueError, AttributeError, TypeError):
            raise ValueError(f"无效的 UUID: {v}")


@router.post("/generate")
async def generate_resource(req: ResourceGenRequest, db: AsyncSession = Depends(get_db), user: Student = Depends(get_current_user)):
    """生成学习资源"""
    if str(user.id) != req.student_id:
        raise HTTPException(status_code=403, detail="只能操作自己的学习数据")

    # 获取学生画像
    profile_result = await db.execute(
        select(StudentProfile)
        .where(StudentProfile.student_id == uuid.UUID(req.student_id))
        .limit(1)
    )
    profile = profile_result.scalar_one_or_none()
    student_profile = profile.dimensions if profile else None

    # 生成内容
    content = await document_agent.generate(
        knowledge_point=req.knowledge_point,
        student_profile=student_profile,
        resource_type=req.resource_type,
    )

    # 根据请求的 resource_type 确定实际存储类型
    resource_type = "knowledge"  # 默认
    if req.resource_type == "code":
        resource_type = "code"
    elif req.resource_type == "audio":
        resource_type = "audio"

    # 保存到数据库
    resource = Resource(
        id=uuid.uuid4(),
        student_id=uuid.UUID(req.student_id),
        course_id=uuid.UUID(req.course_id) if req.course_id else None,
        title=f"{req.knowledge_point} 学习材料",
        resource_type=resource_type,
        content=content,
        knowledge_point=req.knowledge_point,
    )
    db.add(resource)
    await db.commit()

    return {
        "resource_id": str(resource.id),
        "knowledge_point": req.knowledge_point,
        "content": content,
    }


@router.post("/generate/stream")
async def generate_resource_stream(req: ResourceGenRequest, db: AsyncSession = Depends(get_db), user: Student = Depends(get_current_user)):
    """SSE 流式生成学习资源"""
    if str(user.id) != req.student_id:
        raise HTTPException(status_code=403, detail="只能操作自己的学习数据")

    # 获取学生画像（在主 session 中完成）
    profile_result = await db.execute(
        select(StudentProfile)
        .where(StudentProfile.student_id == uuid.UUID(req.student_id))
        .limit(1)
    )
    profile = profile_result.scalar_one_or_none()
    student_profile = profile.dimensions if profile else None

    async def event_generator():
        async with async_session() as session:
            try:
                yield f"data: {json.dumps({'type': 'progress', 'progress': 0.1, 'message': '正在分析知识点...'}, ensure_ascii=False)}\n\n"

                prompt = document_agent._build_prompt(
                    req.knowledge_point, student_profile, req.resource_type
                )

                yield f"data: {json.dumps({'type': 'progress', 'progress': 0.3, 'message': '正在生成学习内容...'}, ensure_ascii=False)}\n\n"

                stream_text = ""
                async for token in mc_module.minimax_client.chat_stream(
                    messages=[{"role": "user", "content": prompt}],
                    system=document_agent.SYSTEM_PROMPT,
                    max_tokens=4096,
                    temperature=0.7,
                ):
                    stream_text += token
                    if token:
                        yield f"data: {json.dumps({'type': 'token', 'content': token}, ensure_ascii=False)}\n\n"

                result = document_agent._parse_response(stream_text)

                yield f"data: {json.dumps({'type': 'progress', 'progress': 0.7, 'message': '正在防幻觉验证...'}, ensure_ascii=False)}\n\n"
                validation = await anti_hallucination.validate(
                    content=result.get("knowledge", ""),
                    knowledge_point=req.knowledge_point,
                )
                result["validation"] = {
                    "passed": validation.passed,
                    "issues": validation.issues,
                    "confidence": validation.confidence,
                }

                yield f"data: {json.dumps({'type': 'progress', 'progress': 0.8, 'message': '正在保存...'}, ensure_ascii=False)}\n\n"

                # 根据请求的 resource_type 确定实际存储类型
                resource_type = "knowledge"  # 默认
                if req.resource_type == "code":
                    resource_type = "code"
                elif req.resource_type == "audio":
                    resource_type = "audio"

                resource = Resource(
                    id=uuid.uuid4(),
                    student_id=uuid.UUID(req.student_id),
                    course_id=uuid.UUID(req.course_id) if req.course_id else None,
                    title=f"{req.knowledge_point} 学习材料",
                    resource_type=resource_type,
                    content=result,
                    knowledge_point=req.knowledge_point,
                )
                session.add(resource)
                await session.commit()

                yield f"data: {json.dumps({'type': 'result', 'data': {'resource_id': str(resource.id), 'knowledge_point': req.knowledge_point, 'content': result}}, ensure_ascii=False)}\n\n"
                yield f"data: {json.dumps({'type': 'done'}, ensure_ascii=False)}\n\n"

            except Exception as e:
                import traceback
                yield f"data: {json.dumps({'type': 'error', 'message': str(e)}, ensure_ascii=False)}\n\n"
                yield f"data: {json.dumps({'type': 'done'}, ensure_ascii=False)}\n\n"
                logger.exception("[resource/stream] 异常")

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/list")
async def list_resources(
    student_id: uuid.UUID = Depends(valid_student_id),
    db: AsyncSession = Depends(get_db),
    user: Student = Depends(get_current_user),
):
    """获取资源列表（包含用户资源和系统预置资源）"""
    # 查询用户的资源 + 系统预置资源
    result = await db.execute(
        select(Resource)
        .where((Resource.student_id == student_id) | (Resource.is_preset == True))
        .order_by(Resource.is_preset.desc(), Resource.created_at.desc())
    )
    resources = result.scalars().all()
    return [
        {
            "resource_id": str(r.id),
            "title": r.title,
            "resource_type": r.resource_type,
            "knowledge_point": r.knowledge_point,
            "content": r.content,
            "difficulty": r.difficulty,
            "is_favorited": r.is_favorited or False,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in resources
    ]


@router.post("/exercises/generate")
async def generate_exercises(req: ExerciseGenRequest, db: AsyncSession = Depends(get_db), user: Student = Depends(get_current_user)):
    """生成练习题"""
    if str(user.id) != req.student_id:
        raise HTTPException(status_code=403, detail="只能操作自己的学习数据")

    # 获取学生画像
    profile_result = await db.execute(
        select(StudentProfile)
        .where(StudentProfile.student_id == uuid.UUID(req.student_id))
        .limit(1)
    )
    profile = profile_result.scalar_one_or_none()
    student_profile = profile.dimensions if profile else None

    # 生成题目
    result = await exercise_agent.generate(
        knowledge_point=req.knowledge_point,
        student_profile=student_profile,
        exercise_type=req.exercise_type,
        count=req.count,
    )

    # 保存到数据库（含去重 + 限容）
    exercises_data = result.get("exercises", [])
    saved_exercises = []

    # 加载该学生该知识点的已有题目，用于去重
    existing_result = await db.execute(
        select(Exercise.question)
        .where(Exercise.student_id == uuid.UUID(req.student_id))
        .where(Exercise.knowledge_point == req.knowledge_point)
    )
    existing_questions = [row[0] for row in existing_result.all() if row[0]]

    for ex_data in exercises_data:
        question = ex_data.get("question", "")
        if _is_duplicate_question(question, existing_questions):
            continue
        exercise = Exercise(
            id=uuid.uuid4(),
            student_id=uuid.UUID(req.student_id),
            exercise_type=normalize_exercise_type(ex_data.get("type", "")),
            question=question,
            options=ex_data.get("options"),
            answer=normalize_answer(ex_data.get("type", ""), ex_data.get("answer", "")),
            explanation=ex_data.get("explanation", ""),
            difficulty=ex_data.get("difficulty", 50),
            knowledge_point=req.knowledge_point,
        )
        db.add(exercise)
        saved_exercises.append({
            "exercise_id": str(exercise.id),
            "type": exercise.exercise_type,
            "question": exercise.question,
            "options": exercise.options,
            "answer": exercise.answer,
            "explanation": exercise.explanation,
            "difficulty": exercise.difficulty,
        })
        existing_questions.append(question)

    await db.commit()

    # 每个知识点最多保留 20 道 AI 题
    await _cap_exercises(db, uuid.UUID(req.student_id), req.knowledge_point)

    return {
        "knowledge_point": req.knowledge_point,
        "exercises": saved_exercises,
        "count": len(saved_exercises),
    }


@router.post("/exercises/generate/stream")
async def generate_exercises_stream(req: ExerciseGenRequest, db: AsyncSession = Depends(get_db), user: Student = Depends(get_current_user)):
    """SSE 流式生成练习题"""
    if str(user.id) != req.student_id:
        raise HTTPException(status_code=403, detail="只能操作自己的学习数据")

    # 获取学生画像（在主 session 中完成）
    profile_result = await db.execute(
        select(StudentProfile)
        .where(StudentProfile.student_id == uuid.UUID(req.student_id))
        .limit(1)
    )
    profile = profile_result.scalar_one_or_none()
    student_profile = profile.dimensions if profile else None

    async def event_generator():
        async with async_session() as session:
            try:
                yield f"data: {json.dumps({'type': 'progress', 'progress': 0.1, 'message': '正在分析知识点...'}, ensure_ascii=False)}\n\n"

                prompt = exercise_agent._build_prompt(
                    req.knowledge_point, student_profile, req.exercise_type, req.count
                ).replace("请返回 JSON 格式。只返回 JSON。", "请先输出人类可读的完整题目内容，末尾再输出 JSON 数据。")

                yield f"data: {json.dumps({'type': 'progress', 'progress': 0.3, 'message': '正在生成练习题...'}, ensure_ascii=False)}\n\n"

                stream_text = ""
                sep = "---JSON_DATA---"
                sep_found = False
                prev_display_len = 0
                stream_token_count = 0
                async for token in mc_module.minimax_client.chat_stream(
                    messages=[{"role": "user", "content": prompt}],
                    system=STREAM_EXERCISE_SYSTEM,
                    max_tokens=4096,
                    temperature=0.7,
                ):
                    stream_text += token
                    stream_token_count += 1
                    if sep in stream_text:
                        sep_found = True
                    if not sep_found:
                        # 去掉 <think>...</think> 得到纯显示文本，再取增量
                        display = _strip_think(stream_text)
                        new_content = display[prev_display_len:]
                        prev_display_len = len(display)
                        if new_content:
                            yield f"data: {json.dumps({'type': 'token', 'content': new_content}, ensure_ascii=False)}\n\n"
                    # 每 30 个 token 发一次进度
                    if stream_token_count % 30 == 0:
                        dots = '.' * ((stream_token_count // 30) % 4)
                        yield f"data: {json.dumps({'type': 'progress', 'progress': 0.5, 'message': f'正在生成练习题{dots}'}, ensure_ascii=False)}\n\n"

                # 解析 JSON（从 ---JSON_DATA--- 之后提取，失败则回退到原 parser）
                if sep in stream_text:
                    json_part = stream_text.split(sep, 1)[1].strip()
                    result = parse_json_response(json_part, {"exercises": []})
                else:
                    result = exercise_agent._parse_response(stream_text)

                exs = result.get("exercises", [])

                yield f"data: {json.dumps({'type': 'progress', 'progress': 0.7, 'message': '正在防幻觉验证...'}, ensure_ascii=False)}\n\n"
                exercises_text = "\n".join(
                    ex.get("question", "") + "\n" + ex.get("explanation", "")
                    for ex in exs
                )
                if exercises_text:
                    validation = await anti_hallucination.validate(
                        content=exercises_text,
                        knowledge_point=req.knowledge_point,
                        skip_llm=True,
                    )
                    result["validation"] = {
                        "passed": validation.passed,
                        "issues": validation.issues,
                        "confidence": validation.confidence,
                    }

                yield f"data: {json.dumps({'type': 'progress', 'progress': 0.8, 'message': '正在保存...'}, ensure_ascii=False)}\n\n"

                exercises_data = result.get("exercises", [])
                saved_exercises = []

                # 加载该学生该知识点的已有题目，用于去重
                existing_result = await session.execute(
                    select(Exercise.question)
                    .where(Exercise.student_id == uuid.UUID(req.student_id))
                    .where(Exercise.knowledge_point == req.knowledge_point)
                )
                existing_questions = [row[0] for row in existing_result.all() if row[0]]

                for ex_data in exercises_data:
                    question = ex_data.get("question", "")
                    if _is_duplicate_question(question, existing_questions):
                        continue
                    exercise = Exercise(
                        id=uuid.uuid4(),
                        student_id=uuid.UUID(req.student_id),
                        exercise_type=normalize_exercise_type(ex_data.get("type", "")),
                        question=question,
                        options=ex_data.get("options"),
                        answer=normalize_answer(ex_data.get("type", ""), ex_data.get("answer", "")),
                        explanation=ex_data.get("explanation", ""),
                        difficulty=ex_data.get("difficulty", 50),
                        knowledge_point=req.knowledge_point,
                    )
                    session.add(exercise)
                    saved_exercises.append({
                        "exercise_id": str(exercise.id),
                        "type": exercise.exercise_type,
                        "question": exercise.question,
                        "options": exercise.options,
                        "answer": exercise.answer,
                        "explanation": exercise.explanation,
                        "difficulty": exercise.difficulty,
                    })
                    existing_questions.append(question)

                await session.commit()

                # 每个知识点最多保留 20 道 AI 题
                await _cap_exercises(session, uuid.UUID(req.student_id), req.knowledge_point)

                yield f"data: {json.dumps({'type': 'result', 'data': {'knowledge_point': req.knowledge_point, 'exercises': saved_exercises, 'count': len(saved_exercises)}}, ensure_ascii=False)}\n\n"
                yield f"data: {json.dumps({'type': 'done'}, ensure_ascii=False)}\n\n"

            except Exception as e:
                import traceback
                yield f"data: {json.dumps({'type': 'error', 'message': str(e)}, ensure_ascii=False)}\n\n"
                yield f"data: {json.dumps({'type': 'done'}, ensure_ascii=False)}\n\n"
                logger.exception("[exercises/stream] 异常")

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/exercises/pool")
async def get_exercise_pool(
    student_id: uuid.UUID = Depends(valid_student_id),
    knowledge_point: str | None = None,
    exercise_type: str | None = None,
    difficulty_min: int | None = None,
    difficulty_max: int | None = None,
    count: int = 10,
    db: AsyncSession = Depends(get_db),
    user: Student = Depends(get_current_user),
):
    """获取题池：公共题库 + 该学生的 AI 生成题合并"""
    if user.id != student_id:
        raise HTTPException(status_code=403, detail="只能查看自己的数据")

    import random

    # 1. 公共题库（exercise_bank, is_active=true）
    bank_q = select(ExerciseBank).where(ExerciseBank.is_active == True)
    if knowledge_point:
        bank_q = bank_q.where(ExerciseBank.knowledge_point == knowledge_point)
    if exercise_type:
        bank_q = bank_q.where(ExerciseBank.exercise_type == exercise_type)
    if difficulty_min is not None:
        bank_q = bank_q.where(ExerciseBank.difficulty >= difficulty_min)
    if difficulty_max is not None:
        bank_q = bank_q.where(ExerciseBank.difficulty <= difficulty_max)

    bank_result = await db.execute(bank_q)
    bank_rows = bank_result.scalars().all()

    bank_items = [
        {
            "exercise_id": str(r.id),
            "type": normalize_exercise_type(r.exercise_type),
            "question": r.question,
            "options": r.options,
            "answer": normalize_answer(r.exercise_type, r.answer),
            "explanation": r.explanation,
            "difficulty": r.difficulty,
            "knowledge_point": r.knowledge_point,
            "source": "bank",
        }
        for r in bank_rows
    ]

    # 2. 学生自己的 AI 生成题
    ai_q = select(Exercise).where(Exercise.student_id == student_id)
    if knowledge_point:
        ai_q = ai_q.where(Exercise.knowledge_point == knowledge_point)
    if exercise_type:
        ai_q = ai_q.where(Exercise.exercise_type == exercise_type)
    if difficulty_min is not None:
        ai_q = ai_q.where(Exercise.difficulty >= difficulty_min)
    if difficulty_max is not None:
        ai_q = ai_q.where(Exercise.difficulty <= difficulty_max)

    ai_result = await db.execute(ai_q)
    ai_rows = ai_result.scalars().all()

    ai_items = [
        {
            "exercise_id": str(r.id),
            "type": normalize_exercise_type(r.exercise_type),
            "question": r.question,
            "options": r.options,
            "answer": normalize_answer(r.exercise_type, r.answer),
            "explanation": r.explanation,
            "difficulty": r.difficulty,
            "knowledge_point": r.knowledge_point,
            "source": "ai",
        }
        for r in ai_rows
    ]

    # 3. 合并 + 随机抽题
    all_items = bank_items + ai_items
    random.shuffle(all_items)
    selected = all_items[:count]

    return {
        "total": len(all_items),
        "count": len(selected),
        "exercises": selected,
    }


@router.get("/exercises/{student_id}")
async def list_exercises(
    student_id: uuid.UUID = Depends(valid_student_id),
    db: AsyncSession = Depends(get_db),
    user: Student = Depends(get_current_user),
):
    """获取学生的练习题列表"""
    if user.id != student_id:
        raise HTTPException(status_code=403, detail="只能查看自己的数据")
    result = await db.execute(
        select(Exercise)
        .where(Exercise.student_id == student_id)
        .order_by(Exercise.created_at.desc())
    )
    exercises = result.scalars().all()
    return [
        {
            "exercise_id": str(e.id),
            "type": e.exercise_type,
            "question": e.question,
            "knowledge_point": e.knowledge_point,
            "difficulty": e.difficulty,
            "is_correct": e.is_correct,
            "created_at": e.created_at.isoformat() if e.created_at else None,
        }
        for e in exercises
    ]


@router.post("/{resource_id}/favorite")
async def toggle_favorite(
    resource_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: Student = Depends(get_current_user),
):
    """切换资源收藏状态"""
    result = await db.execute(
        select(Resource).where(Resource.id == resource_id)
    )
    resource = result.scalar_one_or_none()
    if not resource:
        raise HTTPException(status_code=404, detail="资源不存在")
    if resource.student_id != user.id:
        raise HTTPException(status_code=403, detail="只能操作自己的资源")

    resource.is_favorited = not (resource.is_favorited or False)
    await db.commit()

    return {
        "resource_id": str(resource.id),
        "is_favorited": resource.is_favorited,
    }


class BatchGenRequest(BaseModel):
    student_id: str
    knowledge_points: list[str]  # 多个知识点
    resource_type: str = "all"

    @field_validator("student_id")
    @classmethod
    def _validate_uuid(cls, v: str) -> str:
        try:
            uuid.UUID(v)
            return v
        except (ValueError, AttributeError, TypeError):
            raise ValueError(f"无效的 UUID: {v}")


@router.post("/batch-generate")
async def batch_generate_resources(req: BatchGenRequest, db: AsyncSession = Depends(get_db), user: Student = Depends(get_current_user)):
    """批量生成多个知识点的资源"""
    if str(user.id) != req.student_id:
        raise HTTPException(status_code=403, detail="只能操作自己的学习数据")

    # 获取学生画像
    profile_result = await db.execute(
        select(StudentProfile)
        .where(StudentProfile.student_id == uuid.UUID(req.student_id))
        .limit(1)
    )
    profile = profile_result.scalar_one_or_none()
    student_profile = profile.dimensions if profile else None

    results = []
    for kp in req.knowledge_points[:10]:  # 最多10个知识点
        try:
            content = await document_agent.generate(
                knowledge_point=kp,
                student_profile=student_profile,
                resource_type=req.resource_type,
            )

            # 根据请求的 resource_type 确定实际存储类型
            resource_type = "knowledge"
            if req.resource_type == "code":
                resource_type = "code"
            elif req.resource_type == "audio":
                resource_type = "audio"

            resource = Resource(
                id=uuid.uuid4(),
                student_id=uuid.UUID(req.student_id),
                title=f"{kp} 学习材料",
                resource_type=resource_type,
                content=content,
                knowledge_point=kp,
            )
            db.add(resource)
            results.append({
                "resource_id": str(resource.id),
                "knowledge_point": kp,
                "status": "success",
            })
        except Exception as e:
            results.append({
                "knowledge_point": kp,
                "status": "error",
                "message": str(e),
            })

    await db.commit()

    return {
        "total": len(req.knowledge_points),
        "success": sum(1 for r in results if r["status"] == "success"),
        "results": results,
    }


class SaveFromChatRequest(BaseModel):
    student_id: str
    title: str
    resource_type: str  # knowledge/mindmap/exercise/code/audio
    content: dict
    knowledge_point: str

    @field_validator("student_id")
    @classmethod
    def _validate_uuid(cls, v: str) -> str:
        try:
            uuid.UUID(v)
            return v
        except (ValueError, AttributeError, TypeError):
            raise ValueError(f"无效的 UUID: {v}")


@router.post("/save-from-chat")
async def save_from_chat(req: SaveFromChatRequest, db: AsyncSession = Depends(get_db), user: Student = Depends(get_current_user)):
    """从对话页保存资源到资源中心"""
    if str(user.id) != req.student_id:
        raise HTTPException(status_code=403, detail="只能操作自己的学习数据")

    resource = Resource(
        id=uuid.uuid4(),
        student_id=uuid.UUID(req.student_id),
        title=req.title,
        resource_type=req.resource_type,
        content=req.content,
        knowledge_point=req.knowledge_point,
    )
    db.add(resource)
    await db.commit()

    return {
        "resource_id": str(resource.id),
        "title": req.title,
        "message": "资源已保存到资源中心",
    }


# ══════════════════════════════════════════════════════════════
# 推荐 + 学习包（新功能）
# ══════════════════════════════════════════════════════════════


class RecommendationsRequest(BaseModel):
    student_id: str
    limit: int = 10

    @field_validator("student_id")
    @classmethod
    def _validate_uuid(cls, v: str) -> str:
        try:
            uuid.UUID(v)
            return v
        except (ValueError, AttributeError, TypeError):
            raise ValueError(f"无效的 UUID: {v}")


@router.post("/recommendations")
async def get_recommendations(
    req: RecommendationsRequest,
    db: AsyncSession = Depends(get_db),
    user: Student = Depends(get_current_user),
):
    """获取个性化推荐知识点列表"""
    if str(user.id) != req.student_id:
        raise HTTPException(status_code=403, detail="只能操作自己的学习数据")

    recommendations = await recommendation_service.get_recommendations(
        db=db,
        student_id=req.student_id,
        limit=req.limit,
    )
    return {"recommendations": recommendations}


class LearningPackageRequest(BaseModel):
    student_id: str
    knowledge_point: str
    phase: str  # "learn" | "practice" | "review"

    @field_validator("student_id")
    @classmethod
    def _validate_uuid(cls, v: str) -> str:
        try:
            uuid.UUID(v)
            return v
        except (ValueError, AttributeError, TypeError):
            raise ValueError(f"无效的 UUID: {v}")


@router.get("/learning-package")
async def get_learning_package(
    student_id: uuid.UUID = Depends(valid_student_id),
    knowledge_point: str = "",
    phase: str = "learn",
    db: AsyncSession = Depends(get_db),
    user: Student = Depends(get_current_user),
):
    """获取某个知识点的学习包（按阶段）"""
    if user.id != student_id:
        raise HTTPException(status_code=403, detail="只能查看自己的数据")

    if not knowledge_point:
        raise HTTPException(status_code=400, detail="knowledge_point 不能为空")

    # 查询该学生该 KP 该阶段的资源
    type_map = {
        "learn": ["knowledge", "mindmap", "audio"],
        "practice": ["exercise"],
        "review": ["code", "knowledge"],
    }
    allowed_types = type_map.get(phase, ["knowledge"])

    result = await db.execute(
        select(Resource)
        .where(
            Resource.student_id == student_id,
            Resource.knowledge_point == knowledge_point,
            Resource.resource_type.in_(allowed_types),
        )
        .order_by(Resource.created_at.desc())
    )
    resources = result.scalars().all()

    # 各阶段完成状态
    all_types_result = await db.execute(
        select(Resource.resource_type)
        .where(
            Resource.student_id == student_id,
            Resource.knowledge_point == knowledge_point,
        )
    )
    all_types = [r for (r,) in all_types_result.all()]
    progress = {
        "learn": any(t in type_map["learn"] for t in all_types),
        "practice": any(t in type_map["practice"] for t in all_types),
        "review": any(t in type_map["review"] for t in all_types),
    }

    # 构建资源项（兼容旧数据：content 可能是 dict 也可能是 str）
    def _strip_think(val: str) -> str:
        """去掉 JSON 字符串值内残留的 <think>...</think> 标签和代码块标记"""
        if not isinstance(val, str):
            return val
        while "<think>" in val and "</think>" in val:
            s, e = val.find("<think>"), val.find("</think>") + len("</think>")
            val = val[:s] + val[e:]
        # 去掉 ```json ... ``` 包裹
        val = val.strip()
        if val.startswith("```"):
            end = val.rfind("```")
            if end > 0:
                val = val[val.find("\n") + 1:end].strip()
        return val

    def _extract_json_block(val: str) -> str:
        """从 ```json ... ``` 包裹中提取内层 JSON，兼容 Markdown 转义"""
        val = val.strip()
        if not val.startswith("```"):
            return val
        start = val.find("\n")
        if start == -1:
            return val
        start += 1
        end = val.rfind("```")
        if end <= start:
            return val
        inner = val[start:end].strip()
        if inner.startswith("```"):
            return _extract_json_block(inner)
        return inner

    def _deep_parse_field(val: str) -> str:
        """递归清理并展开 JSON 字符串值"""
        # 1. 去掉 think-tag（状态机）
        val = _strip_think(val)
        if not isinstance(val, str):
            return val
        val = val.strip()
        # 2. 去掉 ```json ... ``` 包裹
        val = _extract_json_block(val)
        # 3. 尝试解析为 JSON
        if val.startswith("{"):
            try:
                parsed = json.loads(val)
                if isinstance(parsed, dict):
                    for k, v in parsed.items():
                        if isinstance(v, str):
                            parsed[k] = _deep_parse_field(v)
                    if "knowledge" in parsed:
                        return _deep_parse_field(parsed["knowledge"])
                    if "code" in parsed:
                        return _deep_parse_field(parsed["code"])
                    if "audio_script" in parsed:
                        return _deep_parse_field(parsed["audio_script"])
                    return json.dumps(parsed, ensure_ascii=False)
            except json.JSONDecodeError:
                # JSON 解析失败（因中文引号等未转义字符），用正则提取降级
                import re
                m = re.search(r'"knowledge"\s*:\s*"(.*?)"(?=,\s*"|\s*$)', val, re.DOTALL)
                if m:
                    decoded = m.group(1).encode().decode("utf-8", errors="replace")
                    return decoded
        return val

    def _parse_content(raw):
        if isinstance(raw, dict):
            cleaned = {}
            for k, v in raw.items():
                if isinstance(v, str):
                    # 先清理 think-tag 和代码块，再尝试深度 JSON 解析
                    cleaned[k] = _deep_parse_field(v)
                else:
                    cleaned[k] = v
            return cleaned
        if isinstance(raw, str):
            parsed = parse_json_response(raw, fallback={"_raw": raw})
            # 对 fallback 结果也做清理
            for k, v in parsed.items():
                if isinstance(v, str):
                    parsed[k] = _deep_parse_field(v)
            return parsed
        return {"_raw": str(raw)}

    items = []
    for r in resources:
        content = _parse_content(r.content)
        item: dict = {
            "resource_id": str(r.id),
            "type": r.resource_type,
            "title": r.title,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        if r.resource_type in ("knowledge", "audio"):
            item["content"] = content.get("knowledge", "") or content.get("audio_script", "") or content.get("_raw", "")
            if content.get("validation"):
                item["validation"] = content["validation"]
        elif r.resource_type == "mindmap":
            item["mermaid"] = content.get("mermaid_code", "") or content.get("mermaid", "") or content.get("_raw", "")
        elif r.resource_type == "exercise":
            item["exercises"] = content.get("exercises", [])
        elif r.resource_type == "code":
            item["code"] = content.get("code", "") or content.get("_raw", "")
        items.append(item)

    # 下一个阶段
    phase_order = ["learn", "practice", "review"]
    current_idx = phase_order.index(phase) if phase in phase_order else 0
    next_phase = phase_order[current_idx + 1] if current_idx < len(phase_order) - 1 else None

    return {
        "knowledge_point": knowledge_point,
        "phase": phase,
        "resources": items,
        "next_phase": next_phase,
        "progress": progress,
    }


@router.post("/learning-package/generate/stream")
async def generate_learning_package_stream(
    req: LearningPackageRequest,
    db: AsyncSession = Depends(get_db),
    user: Student = Depends(get_current_user),
):
    """生成某个 KP 某个阶段的学习包（完整返回，前端自行处理加载状态）"""
    if str(user.id) != req.student_id:
        raise HTTPException(status_code=403, detail="只能操作自己的学习数据")

    # 获取画像
    profile_result = await db.execute(
        select(StudentProfile)
        .where(StudentProfile.student_id == uuid.UUID(req.student_id))
        .limit(1)
    )
    profile = profile_result.scalar_one_or_none()
    student_profile = profile.dimensions if profile else None

    phase = req.phase
    type_map = {"learn": "knowledge", "practice": "exercise", "review": "code"}
    resource_type = type_map.get(phase, "knowledge")

    # 生成内容
    content = {}
    if phase == "learn":
        content = await document_agent.generate(
            knowledge_point=req.knowledge_point,
            student_profile=student_profile,
            resource_type="all",
        )
    elif phase == "practice":
        content = await exercise_agent.generate(
            knowledge_point=req.knowledge_point,
            student_profile=student_profile,
            exercise_type="all",
            count=5,
        )
    elif phase == "review":
        content = await document_agent.generate(
            knowledge_point=req.knowledge_point,
            student_profile=student_profile,
            resource_type="code",
        )

    # 防幻觉验证
    text_to_validate = content.get("knowledge", "") or content.get("code", "") or str(content)
    if text_to_validate:
        validation = await anti_hallucination.validate(
            content=text_to_validate,
            knowledge_point=req.knowledge_point,
        )
        content["validation"] = {
            "passed": validation.passed,
            "issues": validation.issues,
            "confidence": validation.confidence,
        }

    # 保存（learn 阶段拆分为 3 个独立资源）
    if phase == "learn":
        # knowledge
        if content.get("knowledge"):
            r_knowledge = Resource(
                id=uuid.uuid4(),
                student_id=uuid.UUID(req.student_id),
                title=f"{req.knowledge_point} - 知识讲解",
                resource_type="knowledge",
                content={"knowledge": content["knowledge"], "validation": content.get("validation")},
                knowledge_point=req.knowledge_point,
            )
            db.add(r_knowledge)
        # code
        if content.get("code"):
            r_code = Resource(
                id=uuid.uuid4(),
                student_id=uuid.UUID(req.student_id),
                title=f"{req.knowledge_point} - 代码示例",
                resource_type="code",
                content={"code": content["code"]},
                knowledge_point=req.knowledge_point,
            )
            db.add(r_code)
        # audio_script
        if content.get("audio_script"):
            r_audio = Resource(
                id=uuid.uuid4(),
                student_id=uuid.UUID(req.student_id),
                title=f"{req.knowledge_point} - 音频讲解",
                resource_type="audio",
                content={"audio_script": content["audio_script"]},
                knowledge_point=req.knowledge_point,
            )
            db.add(r_audio)
        await db.commit()
    else:
        resource = Resource(
            id=uuid.uuid4(),
            student_id=uuid.UUID(req.student_id),
            title=f"{req.knowledge_point} - {phase}阶段",
            resource_type=resource_type,
            content=content,
            knowledge_point=req.knowledge_point,
        )
        db.add(resource)
        await db.commit()

    # 返回值（learn 阶段返回主资源 ID，其他阶段返回单个资源）
    if phase == "learn":
        # 返回 knowledge 资源的 ID（如果有的话）
        rid = str(r_knowledge.id) if content.get("knowledge") else (str(r_code.id) if content.get("code") else str(r_audio.id) if content.get("audio_script") else req.knowledge_point)
        return {
            "resource_id": rid,
            "knowledge_point": req.knowledge_point,
            "phase": phase,
            "content": content,
        }
    return {
        "resource_id": str(resource.id),
        "knowledge_point": req.knowledge_point,
        "phase": phase,
        "content": content,
    }


# ── SSE 工具函数 ──────────────────────────────────────────────
def _sse_progress(progress: float, message: str, current_agent: str) -> str:
    return f"data: {json.dumps({'type': 'progress', 'progress': progress, 'message': message, 'current_agent': current_agent}, ensure_ascii=False)}\n\n"


def _sse_event(event_type: str, **kwargs) -> str:
    return f"data: {json.dumps({'type': event_type, **kwargs}, ensure_ascii=False)}\n\n"


def _sse_result(data: dict) -> str:
    return f"data: {json.dumps({'type': 'result', 'data': data}, ensure_ascii=False)}\n\n"


def _sse_error(message: str) -> str:
    return f"data: {json.dumps({'type': 'error', 'message': message}, ensure_ascii=False)}\n\n"


def _sse_done() -> str:
    return f"data: {json.dumps({'type': 'done'}, ensure_ascii=False)}\n\n"
