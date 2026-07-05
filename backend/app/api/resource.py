"""资源生成 API — AI 辅助创建 / 手动创建 / 审核 / 列表 / 收藏 / 删除"""

import uuid
import json
import logging
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, field_validator
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.dependencies import get_current_user, valid_student_id
from app.models.student import Student
from app.models.resource import Resource
from app.models.student_profile import StudentProfile
from app.agents.resource_creator_agent import resource_creator_agent
from app.agents.review_agent import review_agent

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
