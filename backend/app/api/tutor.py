"""智能辅导 API — RAG 问答"""

import uuid
from fastapi import APIRouter, Depends
from pydantic import BaseModel, field_validator
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.models.student_profile import StudentProfile
from app.agents.tutor_agent import tutor_agent
from app.services.embedding_service import embedding_service
from app.services.vector_store import vector_store
from app.services.reranker import reranker
from app.services.anti_hallucination import anti_hallucination

router = APIRouter()


class AskRequest(BaseModel):
    student_id: str
    question: str
    course_id: str | None = None
    use_rag: bool = True

    @field_validator("student_id", "course_id")
    @classmethod
    def _validate_uuid(cls, v: str | None) -> str | None:
        if v is None:
            return v
        try:
            uuid.UUID(v)
            return v
        except (ValueError, AttributeError, TypeError):
            raise ValueError(f"无效的 UUID: {v}")


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

    # RAG 检索
    context_chunks = None
    if req.use_rag and req.question.strip():
        try:
            # 1. 向量化查询
            query_embedding = await embedding_service.embed_single(req.question)

            # 2. 向量检索
            search_results = await vector_store.search(
                db=db,
                query_embedding=query_embedding,
                top_k=5,
                course_id=req.course_id,
            )

            # 3. 重排（如果结果超过 top_k）
            if len(search_results) > 3:
                search_results = await reranker.rerank(
                    query=req.question,
                    candidates=search_results,
                    top_k=3,
                )

            context_chunks = search_results if search_results else None
        except Exception:
            # RAG 检索失败时降级为无检索
            context_chunks = None

    # 生成回答
    result = await tutor_agent.answer(
        question=req.question,
        context_chunks=context_chunks,
        student_profile=student_profile,
    )

    # 防幻觉验证
    validation = await anti_hallucination.validate(
        content=result.get("answer", ""),
        context_chunks=context_chunks,
        knowledge_point=req.question,
    )

    return {
        "student_id": req.student_id,
        "question": req.question,
        "answer": result.get("answer", ""),
        "confidence": result.get("confidence", 0),
        "sources": result.get("sources", []),
        "related_topics": result.get("related_topics", []),
        "suggestion": result.get("suggestion", ""),
        "rag_used": context_chunks is not None,
        "validation_passed": validation.passed,
        "validation_issues": validation.issues if not validation.passed else [],
    }
