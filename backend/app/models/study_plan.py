"""学习计划模型

记录学生的学习计划，包括:
1. 学习路径（知识点依赖关系）
2. 学习步骤（每个知识点的详细计划）
3. 完成状态追踪
"""

import uuid
from sqlalchemy import Column, String, Text, Integer, Float, DateTime, JSON, func, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from app.core.database import Base


class StudyPlan(Base):
    """学习计划表"""
    __tablename__ = "study_plans"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    knowledge_point = Column(String(200), nullable=False)  # 知识点名称
    title = Column(String(300), nullable=True)  # 计划标题
    description = Column(Text, nullable=True)  # 计划描述
    status = Column(String(20), nullable=False, default='planning')  # planning/learning/completed/abandoned
    total_steps = Column(Integer, nullable=False, default=0)
    completed_steps = Column(Integer, nullable=False, default=0)
    estimated_minutes = Column(Integer, nullable=True)  # 预计总时长
    actual_minutes = Column(Integer, nullable=True)  # 实际用时
    difficulty = Column(String(20), nullable=True)  # beginner/intermediate/advanced
    prerequisites = Column(JSONB, default=[])  # 前置知识点列表
    ai_generated = Column(JSONB, default={})  # AI生成的元数据
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)


class StudyPlanStep(Base):
    """学习计划步骤表"""
    __tablename__ = "study_plan_steps"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    plan_id = Column(UUID(as_uuid=True), ForeignKey('study_plans.id', ondelete='CASCADE'), nullable=False, index=True)
    order = Column(Integer, nullable=False)  # 步骤顺序
    title = Column(String(200), nullable=False)  # 步骤标题
    description = Column(Text, nullable=True)  # 步骤描述
    estimated_minutes = Column(Integer, nullable=True)  # 预计时长
    status = Column(String(20), nullable=False, default='pending')  # pending/current/completed/skipped
    resource_id = Column(UUID(as_uuid=True), nullable=True)  # 关联的资源ID
    exercise_ids = Column(JSONB, default=[])  # 关联的练习题ID列表
    step_type = Column(String(30), nullable=True)  # learn/practice/review
    content_hint = Column(Text, nullable=True)  # 内容提示
    completed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class LearningPath(Base):
    """学习路径表 - 记录知识点之间的依赖关系"""
    __tablename__ = "learning_paths"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    name = Column(String(200), nullable=False)  # 路径名称
    title = Column(String(500), nullable=False, default='')  # 标题（兼容旧表）
    description = Column(Text, nullable=True)  # 路径描述
    nodes = Column(JSONB, default=[])  # 路径节点列表 [{id, knowledge_point, order, status, prerequisites}]
    status = Column(String(20), nullable=False, default='active')  # active/archived
    ai_generated = Column(JSONB, default={})  # AI生成的元数据
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
