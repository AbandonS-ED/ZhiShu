"""学习活动记录表 — 存储学习行为用于画像更新"""

import uuid
from sqlalchemy import Column, String, DateTime, func, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from app.core.database import Base


class LearningActivityLog(Base):
    __tablename__ = "learning_activity_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    subject = Column(String(100), nullable=True)  # 可为空（跨学科活动）
    activity_type = Column(String(30), nullable=False)  # exercise_result / chat_summary / resource_view
    payload = Column(JSONB, nullable=False)
    triggered_at = Column(DateTime(timezone=True), server_default=func.now())