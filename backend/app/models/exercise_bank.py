import uuid
from sqlalchemy import Column, String, DateTime, Integer, Boolean, func
from sqlalchemy.dialects.postgresql import UUID, JSONB
from app.core.database import Base


class ExerciseBank(Base):
    """公共题库表 — 管理员录入的题目"""
    __tablename__ = "exercise_bank"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    question = Column(String(2000), nullable=False)
    exercise_type = Column(String(50), nullable=False)  # choice/judge/short_answer/coding
    options = Column(JSONB, nullable=True)
    answer = Column(String(2000), nullable=False)
    explanation = Column(String(2000), nullable=True)
    difficulty = Column(Integer, default=50)
    knowledge_point = Column(String(200), nullable=True)
    source = Column(String(20), default="admin")  # admin/ai
    is_active = Column(Boolean, default=True)
    created_by = Column(UUID(as_uuid=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=True)
