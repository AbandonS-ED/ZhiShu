"""向量化服务 — Embedding 生成

开发阶段用 MiniMax-M3 的 embeddings API（OpenAI 兼容格式）。
上线前切换为讯飞星火 Embedding。
"""

import httpx
from app.core.config import settings


class EmbeddingService:
    """Embedding 向量化服务"""

    def __init__(self, api_key: str = "", base_url: str = "", model: str = ""):
        self.api_key = api_key or settings.MINIMAX_API_KEY
        self.base_url = (base_url or settings.MINIMAX_BASE_URL).rstrip("/")
        self.model = model or "embedding-01"
        self._client: httpx.AsyncClient | None = None

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(timeout=60.0)
        return self._client

    async def embed(self, texts: list[str]) -> list[list[float]]:
        """将文本列表转换为向量列表

        Args:
            texts: 待向量化的文本列表

        Returns:
            向量列表，每个向量为 list[float]
        """
        client = await self._get_client()

        payload = {
            "model": self.model,
            "input": texts,
        }

        resp = await client.post(
            f"{self.base_url}/embeddings",
            json=payload,
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
            },
        )
        resp.raise_for_status()
        data = resp.json()

        embeddings = [item["embedding"] for item in data.get("data", [])]

        if len(embeddings) != len(texts):
            raise ValueError(f"期望 {len(texts)} 个向量，实际返回 {len(embeddings)} 个")

        return embeddings

    async def embed_single(self, text: str) -> list[float]:
        """单文本向量化"""
        results = await self.embed([text])
        return results[0]

    async def close(self):
        if self._client and not self._client.is_closed:
            await self._client.aclose()


embedding_service = EmbeddingService()
