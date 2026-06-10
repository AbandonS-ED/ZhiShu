"""资源 API — 资源生成 + 练习题生成 + SSE 流式"""

import json
import uuid
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, field_validator
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db, async_session
from app.core.dependencies import valid_student_id
from app.models.student_profile import StudentProfile
from app.models.resource import Resource
from app.models.exercise import Exercise
from app.agents.document_agent import document_agent
from app.agents.exercise_agent import exercise_agent
from app.services import minimax_client as mc_module
from app.services.anti_hallucination import anti_hallucination
from app.services.json_parser import parse_json_response

# 流式专用 system prompt — 让 LLM 先输出人类可读文本，末尾跟 JSON
STREAM_EXERCISE_SYSTEM = """你是一个练习题生成器。请按以下两部分输出：

📝 为你生成了 N 道关于「知识点」的练习题：

**1.** 【题型】题目内容
（含选项、答案、解析、难度）

...

---JSON_DATA---
{"exercises": [{"type":"...","question":"...","options":[...],"answer":"...","explanation":"...","difficulty":50,"knowledge_point":"..."}]}

规则：
- 前半部分是 markdown 格式的人类可读内容（包含完整题目、选项、答案、解析）
- 后半部分是 JSON，用于结构化存储（与前半部分内容完全一致）
- 两部分中间必须有单独一行 ---JSON_DATA---
- 只输出以上内容，不要额外文字"""

router = APIRouter()


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
async def generate_resource(req: ResourceGenRequest, db: AsyncSession = Depends(get_db)):
    """生成学习资源"""

    # 获取学生画像
    profile_result = await db.execute(
        select(StudentProfile)
        .where(StudentProfile.student_id == uuid.UUID(req.student_id))
        .where(StudentProfile.is_current == True)
        .order_by(StudentProfile.version.desc())
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

    # 保存到数据库
    resource = Resource(
        id=uuid.uuid4(),
        student_id=uuid.UUID(req.student_id),
        course_id=uuid.UUID(req.course_id) if req.course_id else None,
        title=f"{req.knowledge_point} 学习材料",
        resource_type="knowledge",
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
async def generate_resource_stream(req: ResourceGenRequest, db: AsyncSession = Depends(get_db)):
    """SSE 流式生成学习资源"""

    # 获取学生画像（在主 session 中完成）
    profile_result = await db.execute(
        select(StudentProfile)
        .where(StudentProfile.student_id == uuid.UUID(req.student_id))
        .where(StudentProfile.is_current == True)
        .order_by(StudentProfile.version.desc())
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

                resource = Resource(
                    id=uuid.uuid4(),
                    student_id=uuid.UUID(req.student_id),
                    course_id=uuid.UUID(req.course_id) if req.course_id else None,
                    title=f"{req.knowledge_point} 学习材料",
                    resource_type="knowledge",
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
                print(f"[resource/stream] 异常: {traceback.format_exc()}")

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
):
    """获取学生的所有资源"""
    result = await db.execute(
        select(Resource)
        .where(Resource.student_id == student_id)
        .order_by(Resource.created_at.desc())
    )
    resources = result.scalars().all()
    return [
        {
            "resource_id": str(r.id),
            "title": r.title,
            "resource_type": r.resource_type,
            "knowledge_point": r.knowledge_point,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in resources
    ]


@router.post("/exercises/generate")
async def generate_exercises(req: ExerciseGenRequest, db: AsyncSession = Depends(get_db)):
    """生成练习题"""

    # 获取学生画像
    profile_result = await db.execute(
        select(StudentProfile)
        .where(StudentProfile.student_id == uuid.UUID(req.student_id))
        .where(StudentProfile.is_current == True)
        .order_by(StudentProfile.version.desc())
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

    # 保存到数据库
    exercises_data = result.get("exercises", [])
    saved_exercises = []
    for ex_data in exercises_data:
        exercise = Exercise(
            id=uuid.uuid4(),
            student_id=uuid.UUID(req.student_id),
            exercise_type=ex_data.get("type", "choice"),
            question=ex_data.get("question", ""),
            options=ex_data.get("options"),
            answer=ex_data.get("answer", ""),
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

    await db.commit()

    return {
        "knowledge_point": req.knowledge_point,
        "exercises": saved_exercises,
        "count": len(saved_exercises),
    }


@router.post("/exercises/generate/stream")
async def generate_exercises_stream(req: ExerciseGenRequest, db: AsyncSession = Depends(get_db)):
    """SSE 流式生成练习题"""

    # 获取学生画像（在主 session 中完成）
    profile_result = await db.execute(
        select(StudentProfile)
        .where(StudentProfile.student_id == uuid.UUID(req.student_id))
        .where(StudentProfile.is_current == True)
        .order_by(StudentProfile.version.desc())
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
                async for token in mc_module.minimax_client.chat_stream(
                    messages=[{"role": "user", "content": prompt}],
                    system=STREAM_EXERCISE_SYSTEM,
                    max_tokens=4096,
                    temperature=0.7,
                ):
                    stream_text += token
                    if sep in stream_text:
                        sep_found = True
                    if not sep_found:
                        # 去掉 <think>...</think> 得到纯显示文本，再取增量
                        display = _strip_think(stream_text)
                        new_content = display[prev_display_len:]
                        prev_display_len = len(display)
                        if new_content:
                            yield f"data: {json.dumps({'type': 'token', 'content': new_content}, ensure_ascii=False)}\n\n"

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
                for ex_data in exercises_data:
                    exercise = Exercise(
                        id=uuid.uuid4(),
                        student_id=uuid.UUID(req.student_id),
                        exercise_type=ex_data.get("type", "choice"),
                        question=ex_data.get("question", ""),
                        options=ex_data.get("options"),
                        answer=ex_data.get("answer", ""),
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

                await session.commit()

                yield f"data: {json.dumps({'type': 'result', 'data': {'knowledge_point': req.knowledge_point, 'exercises': saved_exercises, 'count': len(saved_exercises)}}, ensure_ascii=False)}\n\n"
                yield f"data: {json.dumps({'type': 'done'}, ensure_ascii=False)}\n\n"

            except Exception as e:
                import traceback
                yield f"data: {json.dumps({'type': 'error', 'message': str(e)}, ensure_ascii=False)}\n\n"
                yield f"data: {json.dumps({'type': 'done'}, ensure_ascii=False)}\n\n"
                print(f"[exercises/stream] 异常: {traceback.format_exc()}")

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/exercises/{student_id}")
async def list_exercises(
    student_id: uuid.UUID = Depends(valid_student_id),
    db: AsyncSession = Depends(get_db),
):
    """获取学生的练习题列表"""
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
