import uuid
from sqlalchemy import Column, String, Text, Integer, DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID, JSONB
from app.core.database import Base


class DocumentChunk(Base):
    """文档分块表

    embedding 字段说明:
    - pgvector 扩展可用时: 应改为 Vector(1024)
    - 当前: 用 JSONB 存储向量列表 (开发阶段占位)
    """
    __tablename__ = "document_chunks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    course_id = Column(UUID(as_uuid=True), nullable=True)
    content = Column(Text, nullable=False)
    embedding = Column(JSONB, nullable=True)  # TODO: pgvector 装好后改为 Vector(1024)
    source_file = Column(String(500), nullable=True)
    page_number = Column(Integer, nullable=True)
    metadata_ = Column("metadata", JSONB, default={})
    created_at = Column(DateTime(timezone=True), server_default=func.now())
