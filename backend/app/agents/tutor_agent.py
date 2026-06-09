"""Tutor Agent — RAG 智能问答辅导

基于 RAG (检索增强生成) 回答学生问题，支持知识问答和学习辅导。
检索相关文档片段作为上下文，生成带来源引用的回答。
"""

import json
from app.services import minimax_client as mc_module
from app.services.anti_hallucination import anti_hallucination


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
    ) -> dict:
        """回答学生问题

        Args:
            question: 学生提问
            context_chunks: RAG 检索到的相关文档片段 [{content, source, score}]
            student_profile: 学生画像

        Returns:
            {answer, confidence, sources, related_topics, suggestion}
        """
        user_prompt = self._build_prompt(question, context_chunks, student_profile)

        response = await mc_module.minimax_client.chat(
            messages=[{"role": "user", "content": user_prompt}],
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
            mastery = student_profile.get("knowledge_mastery", {})
            parts.append(f"## 学生知识掌握度")
            parts.append(json.dumps(mastery, ensure_ascii=False, indent=2))
            parts.append("")

        parts.append(f"## 学生提问\n{question}")
        if output_format == "json":
            parts.append("\n请根据以上信息回答学生的问题。返回 JSON 格式。只返回 JSON。")
        else:
            parts.append("\n请根据以上信息回答学生的问题。直接输出回答内容，不要使用 JSON 格式。")

        return "\n".join(parts)

    def _parse_response(self, content: str) -> dict:
        from app.services.json_parser import parse_json_response
        return parse_json_response(content, {
            "answer": content,
            "confidence": 0.5,
            "sources": [],
            "related_topics": [],
            "suggestion": "",
        })


tutor_agent = TutorAgent()
