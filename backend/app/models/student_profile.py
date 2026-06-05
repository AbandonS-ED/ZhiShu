import uuid
from sqlalchemy import Column, String, DateTime, Float, Boolean, Integer, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID, JSONB
from app.core.database import Base

class StudentProfile(Base):
    __tablename__ = "student_profiles"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id"), nullable=False)
    dimensions = Column(JSONB, nullable=False, default={})
    version = Column(Integer, default=1)
    is_current = Column(Boolean, default=True)
    completeness_score = Column(Float, default=0.0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
