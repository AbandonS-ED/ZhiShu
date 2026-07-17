"""资源生成 API — AI 辅助创建 / 手动创建 / 审核 / 列表 / 收藏 / 删除"""

import uuid
import json
import logging
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, field_validator, Field
from typing import List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.dependencies import get_current_user, valid_student_id
from app.models.student import Student
from app.models.resource import Resource
from app.models.student_profile import StudentProfile
from app.agents.resource_creator_agent import resource_creator_agent
from app.agents.review_agent import review_agent
from app.agents.document_agent import document_agent
from app.agents.exercise_agent import exercise_agent
from app.services.anti_hallucination import anti_hallucination
from app.services.json_parser import parse_json_response
from app.core.sse_utils import sse_stream_response, sse_progress, sse_result, sse_done, sse_error
from app.models.exercise_bank import ExerciseBank

router = APIRouter()
logger = logging.getLogger(__name__)


# ====================================================================
# Pydantic 请求模型
# ====================================================================

class StreamCreateRequest(BaseModel):
    student_id: str
    message: str
    conversation_history: list[dict] | None = None

    @field_validator("student_id")
    @classmethod
    def _validate_uuid(cls, v: str) -> str:
        try:
            uuid.UUID(v)
            return v
        except (ValueError, AttributeError, TypeError):
            raise ValueError(f"无效的 UUID: {v}")


class ManualCreateRequest(BaseModel):
    student_id: str
    title: str
    resource_type: str
    content: dict
    knowledge_point: str | None = None

    @field_validator("student_id")
    @classmethod
    def _validate_uuid(cls, v: str) -> str:
        try:
            uuid.UUID(v)
            return v
        except (ValueError, AttributeError, TypeError):
            raise ValueError(f"无效的 UUID: {v}")


class ReviewRequest(BaseModel):
    content: dict
    knowledge_point: str


class LearningPackageRequest(BaseModel):
    student_id: str
    knowledge_point: str
    phase: str


class ExerciseGenerateRequest(BaseModel):
    student_id: str
    knowledge_point: str
    count: int = 5
    exercise_type: str = "all"
    types: List[str] = Field(default_factory=lambda: ["choice", "judge", "short_answer"])

    @field_validator("student_id")
    @classmethod
    def _validate_uuid(cls, v: str) -> str:
        try:
            uuid.UUID(v)
            return v
        except (ValueError, AttributeError, TypeError):
            raise ValueError(f"无效的 UUID: {v}")


# ====================================================================
# 1. POST /create/stream — AI 辅助创建（SSE 流式）
# ====================================================================

@router.post("/create/stream")
async def create_resource_stream(
    req: StreamCreateRequest,
    db: AsyncSession = Depends(get_db),
    user: Student = Depends(get_current_user),
):
    """AI 辅助创建学习资源（SSE 流式返回）"""
    if str(user.id) != req.student_id:
        raise HTTPException(status_code=403, detail="只能操作自己的学习数据")

    student_id_uuid = uuid.UUID(req.student_id)

    # 获取学生画像
    profile_result = await db.execute(
        select(StudentProfile)
        .where(StudentProfile.student_id == student_id_uuid)
        .limit(1)
    )
    profile = profile_result.scalar_one_or_none()
    student_profile = profile.dimensions if profile else None

    def _sse(event_type: str, **kwargs) -> str:
        return f"data: {json.dumps({'type': event_type, **kwargs}, ensure_ascii=False)}\n\n"

    async def event_generator():
        try:
            yield _sse("progress", progress=0.1, step="generating", message="正在调用大模型生成学习资源...")

            stream_text = ""
            async for chunk in resource_creator_agent.stream_generate(
                user_message=req.message,
                conversation_history=req.conversation_history,
                student_profile=student_profile,
            ):
                stream_text += chunk
                yield _sse("token", content=chunk)

            yield _sse("progress", progress=0.5, step="parsing", message="正在解析生成结果...")

            generated = resource_creator_agent._parse_response(stream_text)

            yield _sse("progress", progress=0.6, step="reviewing", message="正在进行四维度质量审核...")

            knowledge_point = req.message[:50]
            review_result = await review_agent.review(
                content=generated,
                knowledge_point=knowledge_point,
                student_profile=student_profile,
            )

            yield _sse("progress", progress=1.0, step="completed", message="生成完成")

            yield _sse("result", data={
                "title": req.message[:200],
                "resource_type": "ai_generated",
                "knowledge_point": knowledge_point,
                "content": {
                    "knowledge": generated.get("knowledge", ""),
                    "code": generated.get("code", ""),
                    "mermaid_code": generated.get("mermaid_code", ""),
                    "exercises": generated.get("exercises", []),
                    "message": generated.get("message", ""),
                },
                "difficulty": 50,
                "review": review_result,
            })

            yield _sse("done")

        except Exception as e:
            logger.exception("[resource/create/stream] 异常")
            yield _sse("error", message=f"生成失败: {str(e)}")
            yield _sse("done")

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


# ====================================================================
# 2. POST /create/manual — 手动创建保存
# ====================================================================

@router.post("/create/manual")
async def create_resource_manual(
    req: ManualCreateRequest,
    db: AsyncSession = Depends(get_db),
    user: Student = Depends(get_current_user),
):
    """手动创建学习资源"""
    if str(user.id) != req.student_id:
        raise HTTPException(status_code=403, detail="只能操作自己的学习数据")

    resource = Resource(
        id=uuid.uuid4(),
        student_id=uuid.UUID(req.student_id),
        title=req.title[:200],
        resource_type=req.resource_type,
        content=req.content,
        knowledge_point=req.knowledge_point,
        difficulty=50,
        is_favorited=False,
        is_preset=False,
    )
    db.add(resource)
    await db.commit()

    return {
        "resource_id": str(resource.id),
        "message": "资源创建成功",
    }


# ====================================================================
# 2.5 POST /save — 保存 AI 生成的资源
# ====================================================================

class SaveResourceRequest(BaseModel):
    student_id: str
    title: str
    resource_type: str
    content: dict
    knowledge_point: str | None = None
    difficulty: int = 50

    @field_validator("student_id")
    @classmethod
    def _validate_uuid(cls, v: str) -> str:
        try:
            uuid.UUID(v)
            return v
        except (ValueError, AttributeError, TypeError):
            raise ValueError(f"无效的 UUID: {v}")


@router.post("/save")
async def save_resource(
    req: SaveResourceRequest,
    db: AsyncSession = Depends(get_db),
    user: Student = Depends(get_current_user),
):
    """保存 AI 生成的学习资源"""
    if str(user.id) != req.student_id:
        raise HTTPException(status_code=403, detail="只能操作自己的学习数据")

    resource = Resource(
        id=uuid.uuid4(),
        student_id=uuid.UUID(req.student_id),
        title=req.title[:200],
        resource_type=req.resource_type,
        content=req.content,
        knowledge_point=req.knowledge_point,
        difficulty=req.difficulty,
        is_favorited=False,
        is_preset=False,
    )
    db.add(resource)
    await db.commit()

    return {
        "resource_id": str(resource.id),
        "title": resource.title,
        "resource_type": resource.resource_type,
        "knowledge_point": resource.knowledge_point,
        "content": resource.content,
        "difficulty": resource.difficulty,
        "is_favorited": resource.is_favorited,
        "created_at": resource.created_at.isoformat() if resource.created_at else None,
        "message": "资源保存成功",
    }


# ====================================================================
# 3. POST /review — 智能审核
# ====================================================================

@router.post("/review")
async def review_resource(
    req: ReviewRequest,
    user: Student = Depends(get_current_user),
):
    """对学习资源内容进行四维度智能审核"""
    result = await review_agent.review(
        content=req.content,
        knowledge_point=req.knowledge_point,
    )
    return result


# ====================================================================
# 4. GET /list — 资源列表
# ====================================================================

@router.get("/list")
async def list_resources(
    student_id: uuid.UUID = Depends(valid_student_id),
    db: AsyncSession = Depends(get_db),
    user: Student = Depends(get_current_user),
):
    """获取资源列表（用户自己的 + 预设资源）"""
    if user.id != student_id:
        raise HTTPException(status_code=403, detail="只能查看自己的数据")

    result = await db.execute(
        select(Resource)
        .where(
            (Resource.student_id == student_id) | (Resource.is_preset == True)
        )
        .order_by(Resource.created_at.desc())
    )
    resources = result.scalars().all()

    return [
        {
            "resource_id": str(r.id),
            "title": r.title,
            "resource_type": r.resource_type,
            "content": r.content,
            "knowledge_point": r.knowledge_point,
            "difficulty": r.difficulty,
            "is_favorited": r.is_favorited,
            "is_preset": r.is_preset,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in resources
    ]


# ====================================================================
# 5. POST /{resource_id}/favorite — 切换收藏
# ====================================================================

@router.post("/{resource_id}/favorite")
async def toggle_favorite(
    resource_id: str,
    db: AsyncSession = Depends(get_db),
    user: Student = Depends(get_current_user),
):
    """切换资源收藏状态"""
    try:
        rid = uuid.UUID(resource_id)
    except (ValueError, AttributeError, TypeError):
        raise HTTPException(status_code=422, detail=f"无效的 resource_id: {resource_id}")

    result = await db.execute(select(Resource).where(Resource.id == rid))
    resource = result.scalar_one_or_none()

    if not resource:
        raise HTTPException(status_code=404, detail="资源不存在")

    if resource.student_id != user.id:
        raise HTTPException(status_code=403, detail="只能操作自己的资源")

    resource.is_favorited = not resource.is_favorited
    await db.commit()

    return {
        "resource_id": str(resource.id),
        "is_favorited": resource.is_favorited,
    }


# ====================================================================
# 6. DELETE /{resource_id} — 删除资源
# ====================================================================

@router.delete("/{resource_id}")
async def delete_resource(
    resource_id: str,
    db: AsyncSession = Depends(get_db),
    user: Student = Depends(get_current_user),
):
    """删除资源（仅限自己的资源）"""
    try:
        rid = uuid.UUID(resource_id)
    except (ValueError, AttributeError, TypeError):
        raise HTTPException(status_code=422, detail=f"无效的 resource_id: {resource_id}")

    result = await db.execute(select(Resource).where(Resource.id == rid))
    resource = result.scalar_one_or_none()

    if not resource:
        raise HTTPException(status_code=404, detail="资源不存在")

    if resource.student_id != user.id:
        raise HTTPException(status_code=403, detail="只能删除自己的资源")

    await db.delete(resource)
    await db.commit()

    return {"status": "ok", "message": "资源已删除"}


# ====================================================================
# 7. GET /learning-package — 获取学习包（按阶段）
# ====================================================================

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
        "learn": any(t in all_types for t in ["knowledge", "mindmap", "audio"]),
        "practice": "exercise" in all_types,
        "review": any(t in all_types for t in ["code", "knowledge"]),
    }

    next_phase = None
    if phase == "learn" and progress["learn"]:
        next_phase = "practice"
    elif phase == "practice" and progress["practice"]:
        next_phase = "review"

    return {
        "knowledge_point": knowledge_point,
        "phase": phase,
        "resources": [
            {
                "resource_id": str(r.id),
                "type": r.resource_type,
                "title": r.title,
                "content": r.content,
                "difficulty": r.difficulty,
            }
            for r in resources
        ],
        "next_phase": next_phase,
        "progress": progress,
    }


# ====================================================================
# 8. POST /learning-package/generate/stream — 生成学习包
# ====================================================================

@router.post("/learning-package/generate/stream")
async def generate_learning_package_stream(
    req: LearningPackageRequest,
    db: AsyncSession = Depends(get_db),
    user: Student = Depends(get_current_user),
):
    """生成某个 KP 某个阶段的学习包"""
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

    # 保存资源
    resource = Resource(
        id=uuid.uuid4(),
        student_id=uuid.UUID(req.student_id),
        title=f"{req.knowledge_point} - {phase}",
        resource_type=resource_type,
        content=content,
        knowledge_point=req.knowledge_point,
        difficulty=50,
    )
    db.add(resource)
    await db.commit()

    return {
        "resource_id": str(resource.id),
        "knowledge_point": req.knowledge_point,
        "phase": phase,
        "content": content,
    }


# ====================================================================
# 10. POST /exercises/generate/stream — AI 出题（SSE 流式）
# ====================================================================

@router.post("/exercises/generate/stream")
async def generate_exercises_stream(
    req: ExerciseGenerateRequest,
    user: Student = Depends(get_current_user),
):
    async def event_generator():
        try:
            yield sse_progress(0.2, "正在分析知识点...")

            result = await exercise_agent.generate(
                knowledge_point=req.knowledge_point,
                student_profile=None,
                exercise_type=req.exercise_type,
                count=req.count,
                variant="mixed",
            )

            exercises = result.get("exercises", [])
            yield sse_progress(0.7, "正在防幻觉验证...")

            # 保存到题库（flush 生成 UUID 后回填给前端）
            from app.core.database import async_session
            saved_count = 0
            async with async_session() as save_db:
                for ex in exercises:
                    bank_item = ExerciseBank(
                        question=ex.get("question", ""),
                        exercise_type=ex.get("type", "choice"),
                        options=ex.get("options"),
                        answer=ex.get("answer", ""),
                        explanation=ex.get("explanation", ""),
                        difficulty=ex.get("difficulty", 50),
                        knowledge_point=req.knowledge_point,
                        source="ai",
                        created_by=uuid.UUID(req.student_id),
                    )
                    save_db.add(bank_item)
                    # flush 生成 UUID 并回填到原 dict（前端靠这个 ID 加入错题本）
                    await save_db.flush()
                    ex["exercise_id"] = str(bank_item.id)
                    saved_count += 1
                if saved_count > 0:
                    await save_db.commit()

            yield sse_progress(1.0, "生成完成")
            yield sse_result({
                "knowledge_point": req.knowledge_point,
                "count": len(exercises),
                "exercises": exercises,
            })
            yield sse_done()

        except Exception as e:
            logger.exception("[exercises/generate/stream] 异常")
            yield sse_error(str(e))

    return sse_stream_response(event_generator())


# ====================================================================
# 10b. POST /exercises/generate — AI 出题（非流式）
# ====================================================================

@router.post("/exercises/generate")
async def generate_exercises(
    req: ExerciseGenerateRequest,
    user: Student = Depends(get_current_user),
):
    """非流式生成练习题"""
    import time
    start_time = time.time()
    
    try:
        # 确定题型
        exercise_types = req.types if req.types else ["choice", "judge", "short_answer"]
        
        # 调用 agent 生成题目
        result = await exercise_agent.generate(
            knowledge_point=req.knowledge_point,
            student_profile=None,
            exercise_type=req.exercise_type,
            count=req.count,
            variant="mixed",
        )

        exercises = result.get("exercises", [])
        
        # 根据 types 过滤题目
        if exercise_types and "all" not in exercise_types:
            exercises = [ex for ex in exercises if ex.get("type") in exercise_types]
        
        # 如果过滤后题目不够，补充生成
        if len(exercises) < req.count:
            additional_result = await exercise_agent.generate(
                knowledge_point=req.knowledge_point,
                student_profile=None,
                exercise_type="all",
                count=req.count - len(exercises),
                variant="mixed",
            )
            additional_exercises = additional_result.get("exercises", [])
            exercises.extend(additional_exercises)

        # 保存到题库（flush 生成 UUID 后回填给前端）
        from app.core.database import async_session
        async with async_session() as save_db:
            for ex in exercises:
                bank_item = ExerciseBank(
                    question=ex.get("question", ""),
                    exercise_type=ex.get("type", "choice"),
                    options=ex.get("options"),
                    answer=ex.get("answer", ""),
                    explanation=ex.get("explanation", ""),
                    difficulty=ex.get("difficulty", 50),
                    knowledge_point=req.knowledge_point,
                    source="ai",
                    created_by=uuid.UUID(req.student_id),
                )
                save_db.add(bank_item)
                await save_db.flush()
                ex["exercise_id"] = str(bank_item.id)
            await save_db.commit()

        generation_time = round(time.time() - start_time, 2)
        
        return {
            "knowledge_point": req.knowledge_point,
            "count": len(exercises),
            "exercises": exercises,
            "generation_time": generation_time,
        }

    except Exception as e:
        logger.exception("[exercises/generate] 异常")
        raise HTTPException(status_code=500, detail=f"生成练习题失败: {str(e)}")


# ====================================================================
# 11. GET /exercises/pool — 获取题池（供题库页加载）
# ====================================================================

@router.get("/exercises/pool")
async def get_exercise_pool(
    student_id: str,
    count: int = 30,
    user: Student = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ExerciseBank)
        .where(ExerciseBank.is_active == True)
        .order_by(ExerciseBank.created_at.desc())
        .limit(count)
    )
    exercises = result.scalars().all()

    return {
        "exercises": [
            {
                "exercise_id": str(ex.id),
                "type": ex.exercise_type,
                "question": ex.question,
                "options": ex.options,
                "answer": ex.answer,
                "explanation": ex.explanation,
                "difficulty": ex.difficulty,
                "knowledge_point": ex.knowledge_point,
                "source": ex.source,
            }
            for ex in exercises
        ]
    }
