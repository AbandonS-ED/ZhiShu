"""资源 API — 资源生成 + 练习题生成"""

import uuid
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.models.student_profile import StudentProfile
from app.models.resource import Resource
from app.models.exercise import Exercise
from app.agents.document_agent import document_agent
from app.agents.exercise_agent import exercise_agent

router = APIRouter()


class ResourceGenRequest(BaseModel):
    student_id: str
    knowledge_point: str
    resource_type: str = "all"
    course_id: str | None = None


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


@router.get("/list")
async def list_resources(student_id: str, db: AsyncSession = Depends(get_db)):
    """获取学生的所有资源"""
    result = await db.execute(
        select(Resource)
        .where(Resource.student_id == uuid.UUID(student_id))
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


class ExerciseGenRequest(BaseModel):
    student_id: str
    knowledge_point: str
    exercise_type: str = "all"
    count: int = 5
    course_id: str | None = None


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
            "difficulty": exercise.difficulty,
        })

    await db.commit()

    return {
        "knowledge_point": req.knowledge_point,
        "exercises": saved_exercises,
        "count": len(saved_exercises),
    }


@router.get("/exercises/{student_id}")
async def list_exercises(student_id: str, db: AsyncSession = Depends(get_db)):
    """获取学生的练习题列表"""
    result = await db.execute(
        select(Exercise)
        .where(Exercise.student_id == uuid.UUID(student_id))
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
