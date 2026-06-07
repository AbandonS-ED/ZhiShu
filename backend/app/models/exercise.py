import uuid
from sqlalchemy import Column, String, DateTime, Integer, Float, func
from sqlalchemy.dialects.postgresql import UUID, JSONB
from app.core.database import Base


class Exercise(Base):
    """练习题表"""
    __tablename__ = "exercises"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_id = Column(UUID(as_uuid=True), nullable=False)
    resource_id = Column(UUID(as_uuid=True), nullable=True)
    exercise_type = Column(String(50), nullable=False)  # choice/judge/short_answer/coding
    question = Column(String(2000), nullable=False)
    options = Column(JSONB, nullable=True)  # 选择题选项
    answer = Column(String(2000), nullable=False)
    explanation = Column(String(2000), nullable=True)
    difficulty = Column(Integer, default=50)
    knowledge_point = Column(String(200), nullable=True)
    student_answer = Column(String(2000), nullable=True)
    is_correct = Column(Float, nullable=True)  # 0-1 score
    created_at = Column(DateTime(timezone=True), server_default=func.now())
