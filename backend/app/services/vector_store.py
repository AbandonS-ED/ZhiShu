"""向量存储服务 — pgvector 检索

支持向量存储和相似度检索。
pgvector 扩展不可用时，降级为 JSONB 存储 + Python 计算余弦相似度。
"""

import uuid
import json
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text
from app.models.document_chunk import DocumentChunk
from app.services.embedding_service import embedding_service


class VectorStore:
    """向量存储与检索"""

    def __init__(self):
        self._pgvector_available: bool | None = None

    async def check_pgvector(self, db: AsyncSession) -> bool:
        """检查 pgvector 扩展是否可用"""
        if self._pgvector_available is not None:
            return self._pgvector_available

        try:
            result = await db.execute(text("SELECT 1 FROM pg_extension WHERE extname = 'vector'"))
            self._pgvector_available = result.scalar_one_or_none() is not None
        except Exception:
            self._pgvector_available = False

        return self._pgvector_available

    async def add_chunks(
        self,
        db: AsyncSession,
        chunks: list,
        embeddings: list[list[float]],
        course_id: str | None = None,
    ) -> list[DocumentChunk]:
        """将文档分块和对应的向量存入数据库

        Args:
            db: 数据库 session
            chunks: TextChunk 列表
            embeddings: 对应的向量列表
            course_id: 课程 ID

        Returns:
            保存的 DocumentChunk 列表
        """
        saved_chunks = []

        for chunk, embedding in zip(chunks, embeddings):
            doc_chunk = DocumentChunk(
                id=uuid.uuid4(),
                course_id=uuid.UUID(course_id) if course_id else None,
                content=chunk.content,
                embedding=json.dumps(embedding),
                page_number=chunk.metadata.get("page_number"),
                metadata_={
                    "section_title": chunk.section_title,
                    "token_count": chunk.token_count,
                    "chunk_index": chunk.chunk_index,
                    **chunk.metadata,
                },
            )
            db.add(doc_chunk)
            saved_chunks.append(doc_chunk)

        await db.commit()
        return saved_chunks

    async def search(
        self,
        db: AsyncSession,
        query_embedding: list[float],
        top_k: int = 5,
        course_id: str | None = None,
    ) -> list[dict]:
        """相似度检索

        Args:
            db: 数据库 session
            query_embedding: 查询向量
            top_k: 返回最相似的 K 个结果
            course_id: 限定课程 ID

        Returns:
            检索结果列表 [{id, content, score, metadata}, ...]
        """
        pgvector_available = await self.check_pgvector(db)

        if pgvector_available:
            return await self._search_pgvector(db, query_embedding, top_k, course_id)
        else:
            return await self._search_fallback(db, query_embedding, top_k, course_id)

    async def _search_pgvector(
        self,
        db: AsyncSession,
        query_embedding: list[float],
        top_k: int,
        course_id: str | None,
    ) -> list[dict]:
        """pgvector 原生向量检索"""
        embedding_str = json.dumps(query_embedding)

        where_clause = ""
        params = {"embedding": embedding_str, "top_k": top_k}

        if course_id:
            where_clause = "WHERE course_id = :course_id"
            params["course_id"] = course_id

        query = text(f"""
            SELECT id, content, embedding, metadata,
                   1 - (embedding <=> :embedding::vector) as score
            FROM document_chunks
            {where_clause}
            ORDER BY embedding <=> :embedding::vector
            LIMIT :top_k
        """)

        result = await db.execute(query, params)
        rows = result.fetchall()

        return [
            {
                "id": str(row.id),
                "content": row.content,
                "score": float(row.score),
                "metadata": row.metadata or {},
            }
            for row in rows
        ]

    async def _search_fallback(
        self,
        db: AsyncSession,
        query_embedding: list[float],
        top_k: int,
        course_id: str | None,
    ) -> list[dict]:
        """降级方案：JSONB 存储 + Python 余弦相似度计算"""
        stmt = select(DocumentChunk)
        if course_id:
            stmt = stmt.where(DocumentChunk.course_id == uuid.UUID(course_id))

        result = await db.execute(stmt)
        chunks = result.scalars().all()

        scored_chunks = []
        for chunk in chunks:
            if not chunk.embedding:
                continue

            try:
                chunk_embedding = json.loads(chunk.embedding) if isinstance(chunk.embedding, str) else chunk.embedding
            except (json.JSONDecodeError, TypeError):
                continue

            score = self._cosine_similarity(query_embedding, chunk_embedding)
            scored_chunks.append({
                "id": str(chunk.id),
                "content": chunk.content,
                "score": score,
                "metadata": chunk.metadata_ or {},
            })

        scored_chunks.sort(key=lambda x: x["score"], reverse=True)
        return scored_chunks[:top_k]

    def _cosine_similarity(self, vec1: list[float], vec2: list[float]) -> float:
        """计算余弦相似度"""
        if len(vec1) != len(vec2):
            min_len = min(len(vec1), len(vec2))
            vec1 = vec1[:min_len]
            vec2 = vec2[:min_len]

        dot_product = sum(a * b for a, b in zip(vec1, vec2))
        norm1 = sum(a * a for a in vec1) ** 0.5
        norm2 = sum(b * b for b in vec2) ** 0.5

        if norm1 == 0 or norm2 == 0:
            return 0.0

        return dot_product / (norm1 * norm2)


vector_store = VectorStore()
