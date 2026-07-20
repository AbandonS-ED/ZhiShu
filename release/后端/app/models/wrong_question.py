import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, Boolean, Integer, ForeignKey, DateTime, CheckConstraint
from sqlalchemy.dialects.postgresql import UUID, JSONB
from app.core.database import Base


class WrongQuestion(Base):
    __tablename__ = "wrong_questions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id"), nullable=False, index=True)
    exercise_id = Column(UUID(as_uuid=True), ForeignKey("exercises.id"), nullable=True, index=True)
    exercise_bank_id = Column(UUID(as_uuid=True), ForeignKey("exercise_bank.id"), nullable=True, index=True)
    source_type = Column(String(20), default="exercise", nullable=False)  # exercise 或 bank
    question_snapshot = Column(JSONB, nullable=True)  # 题目快照（防止源表删数据后无法显示）

    wrong_answer = Column(Text, nullable=False)
    correct_answer = Column(Text, nullable=True)

    error_type = Column(String(50), default="unknown")
    error_analysis = Column(Text, nullable=True)
    ai_explanation = Column(Text, nullable=True)
    similar_exercises = Column(JSONB, default=list)

    mastery_level = Column(Integer, default=0)
    review_count = Column(Integer, default=0)
    correct_count = Column(Integer, default=0)
    is_mastered = Column(Boolean, default=False, index=True)

    last_reviewed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc),
                        onupdate=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        CheckConstraint('mastery_level >= 0 AND mastery_level <= 100', name='mastery_level_range'),
    )
