"""评估报告模型 — 定时生成的评估报告缓存"""

import uuid
from sqlalchemy import Column, String, Float, Date, DateTime, func
from sqlalchemy.dialects.postgresql import UUID, JSONB
from app.core.database import Base


class EvaluationReport(Base):
    """评估报告表（定时生成缓存）"""
    __tablename__ = "evaluation_reports"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    report_date = Column(Date, nullable=False)
    report_data = Column(JSONB, nullable=False)
    overall_score = Column(Float, nullable=True)
    generated_at = Column(DateTime(timezone=True), server_default=func.now())
