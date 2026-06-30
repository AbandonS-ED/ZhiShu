"""重排服务 — LLM 重排检索结果

对向量检索返回的候选结果进行语义重排，提升相关性。
"""

import json
from app.services.llm_factory import get_llm_client
from app.services.json_parser import parse_json_response


class Reranker:
    """LLM 重排器"""

    RERANK_PROMPT = """你是一个文档检索专家。请根据用户问题，对以下检索结果进行相关性评分和重排。

用户问题: {query}

检索结果:
{results}

请返回 JSON:
{{
  "reranked": [
    {{"index": 0, "relevance": 0.95, "reason": "高度相关的原因"}},
    {{"index": 1, "relevance": 0.80, "reason": "相关的原因"}}
  ]
}}

评分规则:
- relevance: 0.0-1.0，表示与问题的相关程度
- 按 relevance 从高到低排序
- 只返回 JSON"""

    async def rerank(
        self,
        query: str,
        candidates: list[dict],
        top_k: int = 3,
    ) -> list[dict]:
        """对检索结果进行重排

        Args:
            query: 用户查询
            candidates: 向量检索返回的候选结果
            top_k: 返回前 K 个最相关的结果

        Returns:
            重排后的结果列表
        """
        if not candidates:
            return []

        if len(candidates) <= top_k:
            return candidates

        results_text = "\n".join(
            f"[{i}] (score: {c.get('score', 0):.2f}) {c['content'][:300]}"
            for i, c in enumerate(candidates)
        )

        prompt = self.RERANK_PROMPT.format(query=query, results=results_text)

        try:
            response = await get_llm_client().chat(
                messages=[{"role": "user", "content": prompt}],
                system="你是文档检索专家。只返回 JSON。",
                max_tokens=1024,
                temperature=0.1,
            )

            rerank_result = parse_json_response(response["content"], {"reranked": []})
            reranked = rerank_result.get("reranked", [])

            if not reranked:
                return candidates[:top_k]

            result = []
            for item in reranked:
                idx = item.get("index", 0)
                if 0 <= idx < len(candidates):
                    candidate = candidates[idx].copy()
                    candidate["rerank_score"] = item.get("relevance", 0)
                    candidate["rerank_reason"] = item.get("reason", "")
                    result.append(candidate)

            return result[:top_k]

        except Exception:
            return candidates[:top_k]


reranker = Reranker()
