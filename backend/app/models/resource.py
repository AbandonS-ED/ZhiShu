import uuid
from sqlalchemy import Column, String, DateTime, Integer, func
from sqlalchemy.dialects.postgresql import UUID, JSONB
from app.core.database import Base


class Resource(Base):
    """学习资源表"""
    __tablename__ = "resources"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_id = Column(UUID(as_uuid=True), nullable=False)
    course_id = Column(UUID(as_uuid=True), nullable=True)
    title = Column(String(500), nullable=False)
    resource_type = Column(String(50), nullable=False)  # knowledge/exercise/audio/video
    content = Column(JSONB, nullable=False)  # 结构化内容 (知识讲解/题目列表/音频脚本)
    knowledge_point = Column(String(200), nullable=True)
    difficulty = Column(Integer, default=50)  # 0-100
    metadata_ = Column("metadata", JSONB, default={})
    created_at = Column(DateTime(timezone=True), server_default=func.now())
