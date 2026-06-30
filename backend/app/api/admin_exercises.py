"""Admin Exercise Bank API — 公共题库管理"""
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, func as sa_func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user, require_admin
from app.models.student import Student
from app.models.exercise_bank import ExerciseBank

router = APIRouter()


class ExerciseBankCreate(BaseModel):
    question: str
    exercise_type: str  # choice/judge/short_answer/coding
    options: list[str] | None = None
    answer: str
    explanation: str | None = None
    difficulty: int = 50
    knowledge_point: str | None = None


class ExerciseBankBatchCreate(BaseModel):
    exercises: list[ExerciseBankCreate]


class ExerciseBankUpdate(BaseModel):
    question: str | None = None
    exercise_type: str | None = None
    options: list[str] | None = None
    answer: str | None = None
    explanation: str | None = None
    difficulty: int | None = None
    knowledge_point: str | None = None
    is_active: bool | None = None


def _row_to_dict(row: ExerciseBank) -> dict:
    return {
        "id": str(row.id),
        "question": row.question,
        "exercise_type": row.exercise_type,
        "options": row.options,
        "answer": row.answer,
        "explanation": row.explanation,
        "difficulty": row.difficulty,
        "knowledge_point": row.knowledge_point,
        "source": row.source,
        "is_active": row.is_active,
        "created_by": str(row.created_by) if row.created_by else None,
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
    }


@router.get("")
async def list_exercises(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    knowledge_point: str | None = None,
    exercise_type: str | None = None,
    difficulty_min: int | None = None,
    difficulty_max: int | None = None,
    source: str | None = None,
    search: str | None = None,
    db: AsyncSession = Depends(get_db),
    user: Student = Depends(get_current_user),
):
    require_admin(user)

    q = select(ExerciseBank)
    count_q = select(sa_func.count()).select_from(ExerciseBank)

    filters = []
    if knowledge_point:
        filters.append(ExerciseBank.knowledge_point == knowledge_point)
    if exercise_type:
        filters.append(ExerciseBank.exercise_type == exercise_type)
    if difficulty_min is not None:
        filters.append(ExerciseBank.difficulty >= difficulty_min)
    if difficulty_max is not None:
        filters.append(ExerciseBank.difficulty <= difficulty_max)
    if source:
        filters.append(ExerciseBank.source == source)
    if search:
        filters.append(ExerciseBank.question.ilike(f"%{search}%"))

    for f in filters:
        q = q.where(f)
        count_q = count_q.where(f)

    total_result = await db.execute(count_q)
    total = total_result.scalar() or 0

    q = q.order_by(ExerciseBank.created_at.desc())
    q = q.offset((page - 1) * page_size).limit(page_size)

    result = await db.execute(q)
    rows = result.scalars().all()

    return {
        "items": [_row_to_dict(r) for r in rows],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.post("")
async def create_exercise(
    req: ExerciseBankCreate,
    db: AsyncSession = Depends(get_db),
    user: Student = Depends(get_current_user),
):
    require_admin(user)

    if req.exercise_type == "choice" and (not req.options or len(req.options) < 2):
        raise HTTPException(status_code=400, detail="选择题至少需要 2 个选项")

    ex = ExerciseBank(
        id=uuid.uuid4(),
        question=req.question,
        exercise_type=req.exercise_type,
        options=req.options,
        answer=req.answer,
        explanation=req.explanation,
        difficulty=req.difficulty,
        knowledge_point=req.knowledge_point,
        source="admin",
        is_active=True,
        created_by=user.id,
    )
    db.add(ex)
    await db.commit()
    return _row_to_dict(ex)


@router.post("/batch")
async def batch_create_exercises(
    req: ExerciseBankBatchCreate,
    db: AsyncSession = Depends(get_db),
    user: Student = Depends(get_current_user),
):
    require_admin(user)

    if not req.exercises:
        raise HTTPException(status_code=400, detail="题目列表不能为空")
    if len(req.exercises) > 200:
        raise HTTPException(status_code=400, detail="单次最多导入 200 题")

    created = []
    for item in req.exercises:
        ex = ExerciseBank(
            id=uuid.uuid4(),
            question=item.question,
            exercise_type=item.exercise_type,
            options=item.options,
            answer=item.answer,
            explanation=item.explanation,
            difficulty=item.difficulty,
            knowledge_point=item.knowledge_point,
            source="admin",
            is_active=True,
            created_by=user.id,
        )
        db.add(ex)
        created.append(ex)

    await db.commit()
    return {"count": len(created), "message": f"成功导入 {len(created)} 道题目"}


@router.put("/{exercise_id}")
async def update_exercise(
    exercise_id: uuid.UUID,
    req: ExerciseBankUpdate,
    db: AsyncSession = Depends(get_db),
    user: Student = Depends(get_current_user),
):
    require_admin(user)

    result = await db.execute(select(ExerciseBank).where(ExerciseBank.id == exercise_id))
    ex = result.scalar_one_or_none()
    if not ex:
        raise HTTPException(status_code=404, detail="题目不存在")

    update_data = req.model_dump(exclude_unset=True)
    for key, val in update_data.items():
        setattr(ex, key, val)
    ex.updated_at = datetime.now(timezone.utc)

    await db.commit()
    return _row_to_dict(ex)


@router.delete("/{exercise_id}")
async def delete_exercise(
    exercise_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: Student = Depends(get_current_user),
):
    require_admin(user)

    result = await db.execute(select(ExerciseBank).where(ExerciseBank.id == exercise_id))
    ex = result.scalar_one_or_none()
    if not ex:
        raise HTTPException(status_code=404, detail="题目不存在")

    await db.delete(ex)
    await db.commit()
    return {"message": "已删除"}


@router.get("/knowledge-points")
async def list_knowledge_points(
    db: AsyncSession = Depends(get_db),
    user: Student = Depends(get_current_user),
):
    """获取题库中所有知识点列表（用于前端筛选下拉）"""
    require_admin(user)

    result = await db.execute(
        select(ExerciseBank.knowledge_point, sa_func.count())
        .where(ExerciseBank.is_active == True)
        .where(ExerciseBank.knowledge_point.isnot(None))
        .group_by(ExerciseBank.knowledge_point)
        .order_by(sa_func.count().desc())
    )
    return [{"name": row[0], "count": row[1]} for row in result.all()]
