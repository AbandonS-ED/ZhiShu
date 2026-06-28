"""效果评估 API — F5"""

import uuid
from datetime import date
from fastapi import APIRouter, Depends
from pydantic import BaseModel, field_validator
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from fastapi import HTTPException
from app.core.database import get_db
from app.core.dependencies import valid_student_id, get_current_user
from app.models.student import Student
from app.models.evaluation_report import EvaluationReport
from app.services.evaluation_service import evaluation_service

router = APIRouter()


class RecordActionRequest(BaseModel):
    student_id: str
    action: str  # view/complete/exercise/chat/generate
    resource_type: str | None = None
    resource_id: str | None = None
    knowledge_point: str | None = None
    score: float | None = None
    duration_seconds: int | None = None
    detail: dict | None = None
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


@router.post("/record")
async def record_action(req: RecordActionRequest, db: AsyncSession = Depends(get_db), user: Student = Depends(get_current_user)):
    """记录学习行为"""
    if str(user.id) != req.student_id:
        raise HTTPException(status_code=403, detail="只能操作自己的学习数据")
    record = await evaluation_service.record_action(
        db=db,
        student_id=req.student_id,
        action=req.action,
        resource_type=req.resource_type,
        resource_id=req.resource_id,
        knowledge_point=req.knowledge_point,
        score=req.score,
        duration_seconds=req.duration_seconds,
        detail=req.detail,
        course_id=req.course_id,
    )
    return {"record_id": str(record.id), "status": "recorded"}


@router.get("/stats/{student_id}")
async def get_statistics(
    student_id: uuid.UUID = Depends(valid_student_id),
    days: int = 30,
    db: AsyncSession = Depends(get_db),
    user: Student = Depends(get_current_user),
):
    """获取学习统计"""
    if user.id != student_id:
        raise HTTPException(status_code=403, detail="只能查看自己的数据")
    stats = await evaluation_service.get_statistics(db, str(student_id), days)
    return stats


@router.get("/report/{student_id}")
async def get_evaluation_report(
    student_id: uuid.UUID = Depends(valid_student_id),
    db: AsyncSession = Depends(get_db),
    user: Student = Depends(get_current_user),
):
    """获取学习评估报告"""
    if user.id != student_id:
        raise HTTPException(status_code=403, detail="只能查看自己的数据")
    report = await evaluation_service.get_evaluation_report(db, str(student_id))
    return report


@router.post("/report/{student_id}/regenerate")
async def regenerate_evaluation_report(
    student_id: uuid.UUID = Depends(valid_student_id),
    db: AsyncSession = Depends(get_db),
    user: Student = Depends(get_current_user),
):
    """重新生成学习评估报告"""
    if user.id != student_id:
        raise HTTPException(status_code=403, detail="只能操作自己的数据")

    # 删除今日旧缓存
    today = date.today()
    existing = await db.execute(
        select(EvaluationReport).where(
            EvaluationReport.student_id == student_id,
            EvaluationReport.report_date == today,
        ).limit(1)
    )
    old = existing.scalar_one_or_none()
    if old:
        await db.delete(old)
        await db.commit()

    # 重新生成
    report = await evaluation_service.get_evaluation_report(db, str(student_id))
    return report
