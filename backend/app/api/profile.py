"""Profile API — 学生画像构建与查询"""

import uuid
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.student import Student
from app.models.student_profile import StudentProfile
from app.agents.profile_agent import profile_agent

router = APIRouter()


class BuildProfileRequest(BaseModel):
    student_id: str
    messages: list[dict]  # [{"role": "user", "content": "..."}, ...]


class ProfileResponse(BaseModel):
    student_id: str
    dimensions: dict
    version: int
    completeness_score: float


@router.post("/build")
async def build_profile(req: BuildProfileRequest, db: AsyncSession = Depends(get_db)):
    """根据对话内容构建/更新学生画像"""
    # 1. 查找或创建学生
    result = await db.execute(
        select(Student).where(Student.id == uuid.UUID(req.student_id))
    )
    student = result.scalar_one_or_none()

    if not student:
        # 自动创建学生记录
        student = Student(id=uuid.UUID(req.student_id), name="未命名")
        db.add(student)
        await db.flush()

    # 2. 获取当前画像（如有）
    result = await db.execute(
        select(StudentProfile)
        .where(StudentProfile.student_id == student.id)
        .where(StudentProfile.is_current == True)
        .order_by(StudentProfile.version.desc())
        .limit(1)
    )
    current_profile = result.scalar_one_or_none()
    current_dimensions = current_profile.dimensions if current_profile else None
    new_version = (current_profile.version + 1) if current_profile else 1

    # 3. 调用 Profile Agent 分析对话
    dimensions = await profile_agent.analyze(
        messages=req.messages,
        current_profile=current_dimensions,
    )

    # 4. 计算完整度分数
    completeness = _calc_completeness(dimensions)

    # 5. 旧画像标记为非当前
    if current_profile:
        current_profile.is_current = False

    # 6. 保存新画像
    new_profile = StudentProfile(
        student_id=student.id,
        dimensions=dimensions,
        version=new_version,
        is_current=True,
        completeness_score=completeness,
    )
    db.add(new_profile)
    await db.commit()

    return {
        "student_id": str(student.id),
        "dimensions": dimensions,
        "version": new_version,
        "completeness_score": completeness,
    }


@router.get("/{student_id}")
async def get_profile(student_id: str, db: AsyncSession = Depends(get_db)):
    """获取学生当前画像"""
    result = await db.execute(
        select(Student).where(Student.id == uuid.UUID(student_id))
    )
    student = result.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=404, detail="学生不存在")

    result = await db.execute(
        select(StudentProfile)
        .where(StudentProfile.student_id == student.id)
        .where(StudentProfile.is_current == True)
    )
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="画像不存在")

    return {
        "student_id": str(student.id),
        "dimensions": profile.dimensions,
        "version": profile.version,
        "completeness_score": profile.completeness_score,
    }


def _calc_completeness(dimensions: dict) -> float:
    """计算画像完整度 (0-100)"""
    score = 0.0
    total = 0

    # 知识掌握度
    km = dimensions.get("knowledge_mastery", {})
    if km:
        non_zero = sum(1 for v in km.values() if v > 0)
        score += (non_zero / len(km)) * 30 if km else 0
    total += 30

    # 学习风格
    ls = dimensions.get("learning_style", {})
    if ls:
        non_zero = sum(1 for v in ls.values() if v != 50)
        score += (non_zero / len(ls)) * 20 if ls else 0
    total += 20

    # 认知水平
    cl = dimensions.get("cognitive_level", {})
    if cl:
        non_zero = sum(1 for v in cl.values() if v != 50)
        score += (non_zero / len(cl)) * 20 if cl else 0
    total += 20

    # 兴趣
    interest = dimensions.get("interest", {})
    if interest:
        score += min(len(interest) / 5, 1) * 10
    total += 10

    # 薄弱点
    wt = dimensions.get("weak_topics", [])
    if wt:
        score += min(len(wt) / 3, 1) * 10
    total += 10

    # 学习节奏
    lp = dimensions.get("learning_pace", {})
    if lp and lp.get("daily_hours", 0) > 0:
        score += 10
    total += 10

    return round(score / total * 100, 1)
