"""学习路径 API — 含 SSE 流式"""

import json
import uuid
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, field_validator
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from fastapi import HTTPException
from app.core.database import get_db, async_session
from app.core.dependencies import valid_student_id, valid_path_id, get_current_user
from app.models.student import Student
from app.models.student_profile import StudentProfile
from app.models.learning_path import LearningPath
from app.agents.path_agent import path_agent
from app.services import minimax_client as mc_module

router = APIRouter()


class PathGenerateRequest(BaseModel):
    student_id: str
    course_id: str | None = None
    course_topics: list[str]
    total_days: int = 30

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
async def generate_path(req: PathGenerateRequest, db: AsyncSession = Depends(get_db), user: Student = Depends(get_current_user)):
    """生成个性化学习路径"""
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

    # 生成路径
    path_data = await path_agent.generate(
        course_topics=req.course_topics,
        student_profile=student_profile,
        total_days=req.total_days,
    )

    # 保存到数据库
    learning_path = LearningPath(
        id=uuid.uuid4(),
        student_id=uuid.UUID(req.student_id),
        course_id=uuid.UUID(req.course_id) if req.course_id else None,
        title=path_data.get("title", f"{req.total_days}天学习路径"),
        description=path_data.get("description", ""),
        total_days=req.total_days,
        daily_plan=path_data.get("daily_plan", []),
        metadata_={
            "nodes": path_data.get("nodes", []),
            "edges": path_data.get("edges", []),
        },
    )
    db.add(learning_path)
    await db.commit()

    return {
        "path_id": str(learning_path.id),
        "title": learning_path.title,
        "description": learning_path.description,
        "total_days": learning_path.total_days,
        "nodes": path_data.get("nodes", []),
        "edges": path_data.get("edges", []),
        "daily_plan": learning_path.daily_plan,
    }


@router.post("/generate/stream")
async def generate_path_stream(req: PathGenerateRequest, db: AsyncSession = Depends(get_db), user: Student = Depends(get_current_user)):
    """SSE 流式生成学习路径"""
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
                yield f"data: {json.dumps({'type': 'progress', 'progress': 0.1, 'message': '正在分析课程内容...'}, ensure_ascii=False)}\n\n"

                yield f"data: {json.dumps({'type': 'progress', 'progress': 0.3, 'message': '正在生成学习路径...'}, ensure_ascii=False)}\n\n"

                path_data = await path_agent.generate(
                    req.course_topics, student_profile, req.total_days
                )

                yield f"data: {json.dumps({'type': 'progress', 'progress': 0.8, 'message': '正在保存路径...'}, ensure_ascii=False)}\n\n"

                learning_path = LearningPath(
                    id=uuid.uuid4(),
                    student_id=uuid.UUID(req.student_id),
                    course_id=uuid.UUID(req.course_id) if req.course_id else None,
                    title=path_data.get("title", f"{req.total_days}天学习路径"),
                    description=path_data.get("description", ""),
                    total_days=req.total_days,
                    daily_plan=path_data.get("daily_plan", []),
                    metadata_={
                        "nodes": path_data.get("nodes", []),
                        "edges": path_data.get("edges", []),
                    },
                )
                session.add(learning_path)
                await session.commit()

                yield f"data: {json.dumps({'type': 'result', 'data': {'path_id': str(learning_path.id), 'title': learning_path.title, 'description': learning_path.description, 'total_days': learning_path.total_days, 'nodes': path_data.get('nodes', []), 'edges': path_data.get('edges', []), 'daily_plan': learning_path.daily_plan}}, ensure_ascii=False)}\n\n"
                yield f"data: {json.dumps({'type': 'done'}, ensure_ascii=False)}\n\n"

            except Exception as e:
                import traceback
                yield f"data: {json.dumps({'type': 'error', 'message': str(e)}, ensure_ascii=False)}\n\n"
                yield f"data: {json.dumps({'type': 'done'}, ensure_ascii=False)}\n\n"
                print(f"[path/stream] 异常: {traceback.format_exc()}")

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/{student_id}")
async def get_paths(
    student_id: uuid.UUID = Depends(valid_student_id),
    db: AsyncSession = Depends(get_db),
    user: Student = Depends(get_current_user),
):
    """获取学生的所有学习路径"""
    if user.id != student_id:
        raise HTTPException(status_code=403, detail="只能查看自己的数据")
    result = await db.execute(
        select(LearningPath)
        .where(LearningPath.student_id == student_id)
        .order_by(LearningPath.created_at.desc())
    )
    paths = result.scalars().all()
    return [
        {
            "path_id": str(p.id),
            "title": p.title,
            "description": p.description,
            "total_days": p.total_days,
            "created_at": p.created_at.isoformat() if p.created_at else None,
        }
        for p in paths
    ]


@router.get("/{student_id}/{path_id}")
async def get_path_detail(
    student_id: uuid.UUID = Depends(valid_student_id),
    path_id: uuid.UUID = Depends(valid_path_id),
    db: AsyncSession = Depends(get_db),
    user: Student = Depends(get_current_user),
):
    """获取学习路径详情"""
    if user.id != student_id:
        raise HTTPException(status_code=403, detail="只能查看自己的数据")
    result = await db.execute(
        select(LearningPath)
        .where(LearningPath.id == path_id)
        .where(LearningPath.student_id == student_id)
    )
    path = result.scalar_one_or_none()
    if not path:
        return {"error": "路径不存在"}

    return {
        "path_id": str(path.id),
        "title": path.title,
        "description": path.description,
        "total_days": path.total_days,
        "daily_plan": path.daily_plan,
        "nodes": path.metadata_.get("nodes", []),
        "edges": path.metadata_.get("edges", []),
    }
