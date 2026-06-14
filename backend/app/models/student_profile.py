import uuid
from sqlalchemy import Column, String, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class StudentProfile(Base):
    __tablename__ = "student_profiles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id"), nullable=False, unique=True)
    dimensions = Column(JSONB, nullable=False, server_default='{"comprehension":{"score":0,"confidence":0},"memory":{"score":0,"confidence":0},"application":{"score":0,"confidence":0},"imagination":{"score":0,"confidence":0},"focus":{"score":0,"confidence":0}}')
    background = Column(JSONB, nullable=False, server_default='{}')
    assessment_status = Column(String(20), nullable=False, server_default="pending")
    assess_session_id = Column(UUID(as_uuid=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
