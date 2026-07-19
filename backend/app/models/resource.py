import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Boolean, Integer, DateTime
from sqlalchemy.dialects.postgresql import UUID, JSONB
from app.core.database import Base

class Resource(Base):
    __tablename__ = "resources"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    course_id = Column(UUID(as_uuid=True), nullable=True)
    title = Column(String(200), nullable=False)
    resource_type = Column(String(20), nullable=False)
    content = Column(JSONB, nullable=False, default=dict)
    knowledge_point = Column(String(200), nullable=True, index=True)
    difficulty = Column(Integer, default=50)
    resource_metadata = Column("metadata", JSONB, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    is_favorited = Column(Boolean, default=False)
    is_preset = Column(Boolean, default=False)
    parent_id = Column(UUID(as_uuid=True), nullable=True)
    generation_variant = Column(String(20), nullable=True)
    is_extended = Column(Boolean, default=False)