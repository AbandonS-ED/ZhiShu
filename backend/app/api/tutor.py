"""智能辅导 API — RAG 问答"""

import uuid
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.models.student_profile import StudentProfile
from app.agents.tutor_agent import tutor_agent

router = APIRouter()


class AskRequest(BaseModel):
    student_id: str
    question: str
    course_id: str | None = None


@router.post("/ask")
async def ask_tutor(req: AskRequest, db: AsyncSession = Depends(get_db)):
    """RAG 问答 — 基于知识库回答学生问题"""

    # 获取学生画像
    profile_result = await db.execute(
        select(StudentProfile)
        .where(StudentProfile.student_id == uuid.UUID(req.student_id))
        .where(StudentProfile.is_current == True)
        .order_by(StudentProfile.version.desc())
        .limit(1)
    )
    profile = profile_result.scalar_one_or_none()
    student_profile = profile.dimensions if profile else None

    # TODO: RAG 检索 — 从 document_chunks 中检索相关片段
    # 目前先不检索，直接让 LLM 回答
    context_chunks = None

    result = await tutor_agent.answer(
        question=req.question,
        context_chunks=context_chunks,
        student_profile=student_profile,
    )

    return {
        "student_id": req.student_id,
        "question": req.question,
        "answer": result.get("answer", ""),
        "confidence": result.get("confidence", 0),
        "sources": result.get("sources", []),
        "related_topics": result.get("related_topics", []),
        "suggestion": result.get("suggestion", ""),
    }


class ResourceGenerateRequest(BaseModel):
    student_id: str
    knowledge_point: str
    resource_type: str = "all"  # all/knowledge/code/audio
    course_id: str | None = None


@router.post("/generate")
async def generate_resource(req: ResourceGenerateRequest, db: AsyncSession = Depends(get_db)):
    """生成学习资源（知识讲解 + 代码示例 + 音频脚本）"""
    from app.agents.document_agent import document_agent
    from app.models.resource import Resource

    # 获取学生画像
    profile_result = await db.execute(
        select(StudentProfile)
        .where(StudentProfile.student_id == uuid.UUID(req.student_id))
        .where(StudentProfile.is_current == True)
        .order_by(StudentProfile.version.desc())
        .limit(1)
    )
    profile = profile_result.scalar_one_or_none()
    student_profile = profile.dimensions if profile else None

    # 生成内容
    content = await document_agent.generate(
        knowledge_point=req.knowledge_point,
        student_profile=student_profile,
        resource_type=req.resource_type,
    )

    # 保存到数据库
    resource = Resource(
        id=uuid.uuid4(),
        student_id=uuid.UUID(req.student_id),
        course_id=uuid.UUID(req.course_id) if req.course_id else None,
        title=f"{req.knowledge_point} 学习材料",
        resource_type="knowledge",
        content=content,
        knowledge_point=req.knowledge_point,
    )
    db.add(resource)
    await db.commit()

    return {
        "resource_id": str(resource.id),
        "knowledge_point": req.knowledge_point,
        "content": content,
    }
