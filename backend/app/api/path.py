"""学习路径 API"""

import uuid
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.models.student_profile import StudentProfile
from app.models.learning_path import LearningPath
from app.agents.path_agent import path_agent

router = APIRouter()


class PathGenerateRequest(BaseModel):
    student_id: str
    course_id: str | None = None
    course_topics: list[str]
    total_days: int = 30


@router.post("/generate")
async def generate_path(req: PathGenerateRequest, db: AsyncSession = Depends(get_db)):
    """生成个性化学习路径"""

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


@router.get("/{student_id}")
async def get_paths(student_id: str, db: AsyncSession = Depends(get_db)):
    """获取学生的所有学习路径"""
    result = await db.execute(
        select(LearningPath)
        .where(LearningPath.student_id == uuid.UUID(student_id))
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
async def get_path_detail(student_id: str, path_id: str, db: AsyncSession = Depends(get_db)):
    """获取学习路径详情"""
    result = await db.execute(
        select(LearningPath)
        .where(LearningPath.id == uuid.UUID(path_id))
        .where(LearningPath.student_id == uuid.UUID(student_id))
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
