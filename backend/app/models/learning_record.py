"""学习记录模型 — F5 效果评估

记录学生的学习行为，用于:
1. 学习进度追踪
2. 画像自动更新触发
3. 学习效果统计分析
"""

import uuid
from sqlalchemy import Column, String, Text, Integer, Float, DateTime, JSON, func
from sqlalchemy.dialects.postgresql import UUID, JSONB
from app.core.database import Base


class LearningRecord(Base):
    """学习记录表"""
    __tablename__ = "learning_records"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    course_id = Column(UUID(as_uuid=True), nullable=True)
    action = Column(String(50), nullable=False)  # view/complete/exercise/chat/generate
    resource_type = Column(String(50), nullable=True)  # resource/exercise/path/chat
    resource_id = Column(UUID(as_uuid=True), nullable=True)
    knowledge_point = Column(String(200), nullable=True)
    score = Column(Float, nullable=True)  # 练习得分 0-100
    duration_seconds = Column(Integer, nullable=True)  # 学习时长（秒）
    detail = Column(JSONB, default={})  # 行为详情
    created_at = Column(DateTime(timezone=True), server_default=func.now())
