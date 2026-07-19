"""Tutor Agent — RAG 智能问答辅导

基于 RAG (检索增强生成) 回答学生问题，支持知识问答和学习辅导。
检索相关文档片段作为上下文，生成带来源引用的回答。
"""

from app.services.llm_factory import get_llm_client
from app.services.anti_hallucination import anti_hallucination
from app.services.json_parser import parse_json_response


class TutorAgent:
    """RAG 智能辅导 Agent"""

    SYSTEM_PROMPT = """你是一位耐心、专业的 AI 学习辅导老师。你的任务是回答学生的学习问题，并提供详细、准确的解答。

## 回答原则
1. 基于提供的参考资料回答问题
2. 如果参考资料不足以回答，坦诚说明并给出建议
3. 回答要循序渐进，符合学生的认知水平
4. 适当举例子帮助理解
5. 在回答末尾标注参考来源（如果有）

## 回答格式
请用以下 JSON 格式回答：
{
  "answer": "详细回答内容 (Markdown 格式)",
  "confidence": 0.85,
  "sources": ["来源1", "来源2"],
  "related_topics": ["相关知识点1", "相关知识点2"],
  "suggestion": "给学生的学习建议"
}

只返回 JSON，不要其他文字。"""

    STREAM_PROMPT = """你是一位耐心、专业的 AI 学习辅导老师。你的任务是回答学生的学习问题，并提供详细、准确的解答。

## 回答原则
1. 基于提供的参考资料回答问题
2. 如果参考资料不足以回答，坦诚说明并给出建议
3. 回答要循序渐进，符合学生的认知水平
4. 适当举例子帮助理解
5. 在回答末尾标注参考来源（如果有）

## 回答格式
请用 Markdown 格式回答，适当使用标题、表格、列表等格式使回答结构清晰。
直接输出回答内容，不要使用 JSON 格式。"""

    async def answer(
        self,
        question: str,
        context_chunks: list[dict] | None = None,
        student_profile: dict | None = None,
        history: list[dict] | None = None,
    ) -> dict:
        """回答学生问题

        Args:
            question: 学生提问
            context_chunks: RAG 检索到的相关文档片段 [{content, source, score}]
            student_profile: 学生画像
            history: 对话历史 [{"role": "user"/"assistant", "content": "..."}]

        Returns:
            {answer, confidence, sources, related_topics, suggestion}
        """
        user_prompt = self._build_prompt(question, context_chunks, student_profile)

        # 构建多轮对话：历史 + 当前问题
        messages = []
        if history:
            for msg in history[-10:]:  # 最近 10 条，防止 token 超限
                role = msg.get("role", "")
                content = msg.get("content", "")
                if role in ("user", "assistant") and content:
                    messages.append({"role": role, "content": content})
        messages.append({"role": "user", "content": user_prompt})

        response = await get_llm_client().chat(
            messages=messages,
            system=self.SYSTEM_PROMPT,
            max_tokens=4096,
            temperature=0.5,
        )

        result = self._parse_response(response["content"])

        validation = await anti_hallucination.validate(
            content=result.get("answer", ""),
            context_chunks=context_chunks,
            knowledge_point=question[:50],
        )
        result["validation"] = {
            "passed": validation.passed,
            "issues": validation.issues,
            "confidence": validation.confidence,
        }
        return result

    async def execute(self, state: dict) -> dict:
        """从 AgentState 解包参数，调用 answer()"""
        return await self.answer(
            question=state.get("user_message", ""),
            context_chunks=state.get("intent_params", {}).get("context_chunks"),
            student_profile=state.get("student_profile"),
        )

    def _build_prompt(
        self,
        question: str,
        context_chunks: list[dict] | None,
        student_profile: dict | None,
        output_format: str = "json",
    ) -> str:
        parts = []

        if context_chunks:
            parts.append("## 参考资料")
            for i, chunk in enumerate(context_chunks, 1):
                source = chunk.get("source", "未知来源")
                content = chunk.get("content", "")
                parts.append(f"\n[{i}] 来源: {source}")
                parts.append(content)
            parts.append("")

        if student_profile:
            # 根据学生画像调整辅导风格
            dims = student_profile.get("dimensions", {})

            # 理解力影响解释方式
            comprehension = dims.get("comprehension", {})
            comp_score = comprehension.get("score", 50)
            if comp_score < 50:
                parts.append("## 辅导要求\n学生理解力一般，请用简单易懂的语言解释，多用类比和例子，避免专业术语堆砌。")
            elif comp_score >= 70:
                parts.append("## 辅导要求\n学生理解力较好，可以深入讲解原理，适当使用专业术语。")

            # 知识基础影响回答深度
            knowledge_base = dims.get("knowledge_base", {})
            kb_score = knowledge_base.get("score", 50)
            if kb_score < 50:
                parts.append("学生基础较弱，请从基础概念开始解释，确保学生能跟上。")

            # 记忆力影响复习建议
            memory = dims.get("memory", {})
            mem_score = memory.get("score", 50)
            if mem_score < 50:
                parts.append("学生记忆力一般，回答末尾请添加复习建议。")

        parts.append(f"## 学生提问\n{question}")
        if output_format == "json":
            parts.append("\n请根据以上信息回答学生的问题。返回 JSON 格式。只返回 JSON。")
        else:
            parts.append("\n请根据以上信息回答学生的问题。直接输出回答内容，不要使用 JSON 格式。")

        return "\n".join(parts)

    def _parse_response(self, content: str) -> dict:
        return parse_json_response(content, {
            "answer": content,
            "confidence": 0.5,
            "sources": [],
            "related_topics": [],
            "suggestion": "",
        })


tutor_agent = TutorAgent()
