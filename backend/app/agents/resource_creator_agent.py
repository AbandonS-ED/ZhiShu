"""Resource Creator Agent — 多轮对话式资源生成

支持两种模式：
- generate(): 根据用户需求生成完整学习资源（知识讲解 + 代码 + 思维导图 + 练习题）
- modify(): 根据用户反馈修改特定部分（如"代码更简单些"、"多加几个例子"）

输出 JSON 含 knowledge / code / mermaid_code / exercises / message 五个字段。
"""

import logging
from typing import AsyncGenerator

from app.services.llm_factory import get_llm_client
from app.services.json_parser import parse_json_response

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """你是一个专业的学习资源生成器。你需要根据用户的需求，生成完整的学习资源包。

## 输出格式（严格按此格式输出，只返回 JSON）
{
  "knowledge": "知识讲解（Markdown 格式，300-600字）：包含概念定义、核心原理、生活类比、典型例题",
  "code": "代码示例（含关键注释，说明时间/空间复杂度）",
  "mermaid_code": "思维导图的 Mermaid mindmap 代码，第一行必须是 mindmap",
  "exercises": [
    {
      "type": "choice",
      "question": "题目内容",
      "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
      "answer": "A",
      "explanation": "详细解析",
      "difficulty": 50
    }
  ],
  "message": "给用户的回复消息，简要说明你生成了什么内容"
}

## 质量要求
- knowledge：结构清晰，有层次，适合目标学生水平
- code：可运行，有注释，展示核心实现
- mermaid_code：节点 8-15 个，层次分明，不要包含特殊字符（冒号、引号、花括号）
- exercises：生成 3-5 道混合难度练习题（difficulty 30-80），选择题 4 个选项
- message：友好自然，像老师给学生讲解前的引导语
- 只返回 JSON，不要其他文字"""

MODIFY_SYSTEM_PROMPT = """你是一个学习资源编辑助手。用户对已有的学习资源提出了修改意见，你需要根据意见修改对应部分，保持其他部分不变。

## 修改规则
1. 分析用户的修改请求，判断要修改哪个部分（knowledge / code / mermaid_code / exercises）
2. 只重新生成用户要求修改的部分，其他部分保持原样
3. 如果用户的要求不明确，默认修改 knowledge 部分
4. 修改后更新 message 字段，说明做了什么修改

## 输出格式（严格按此格式输出，只返回 JSON）
{
  "knowledge": "修改后的知识讲解（如果未修改则保持原样）",
  "code": "修改后的代码（如果未修改则保持原样）",
  "mermaid_code": "修改后的思维导图（如果未修改则保持原样）",
  "exercises": [...],
  "message": "说明做了哪些修改"
}

- 只返回 JSON，不要其他文字"""


class ResourceCreatorAgent:
    """多轮对话式资源生成 Agent"""

    async def generate(
        self,
        user_message: str,
        conversation_history: list[dict] | None = None,
        student_profile: dict | None = None,
    ) -> dict:
        """根据用户需求生成完整学习资源

        Args:
            user_message: 用户当前消息（如"帮我生成关于二叉树的学习资源"）
            conversation_history: 多轮对话历史 [{role: "user"|"assistant", content: "..."}]
            student_profile: 学生画像（可选）

        Returns:
            {knowledge, code, mermaid_code, exercises, message}
        """
        user_prompt = self._build_generate_prompt(user_message, student_profile)

        messages = self._build_messages(conversation_history, user_prompt)

        response = await get_llm_client().chat(
            messages=messages,
            system=SYSTEM_PROMPT,
            max_tokens=6144,
            temperature=0.7,
        )

        return self._parse_response(response["content"])

    async def modify(
        self,
        current_content: dict,
        modification_request: str,
        knowledge_point: str = "",
        student_profile: dict | None = None,
    ) -> dict:
        """根据用户反馈修改资源的特定部分

        Args:
            current_content: 当前资源内容 {knowledge, code, mermaid_code, exercises, message}
            modification_request: 用户修改请求（如"代码更简单些"）
            knowledge_point: 知识点名称（可选，提供上下文）
            student_profile: 学生画像（可选）

        Returns:
            修改后的完整资源 {knowledge, code, mermaid_code, exercises, message}
        """
        user_prompt = self._build_modify_prompt(
            current_content, modification_request, knowledge_point
        )

        response = await get_llm_client().chat(
            messages=[{"role": "user", "content": user_prompt}],
            system=MODIFY_SYSTEM_PROMPT,
            max_tokens=6144,
            temperature=0.5,
        )

        result = self._parse_response(response["content"])

        # 确保所有字段都存在（LLM 可能漏掉未修改的字段）
        for key in ("knowledge", "code", "mermaid_code", "exercises"):
            if key not in result or not result[key]:
                result[key] = current_content.get(key, result.get(key, ""))

        return result

    async def stream_generate(
        self,
        user_message: str,
        conversation_history: list[dict] | None = None,
        student_profile: dict | None = None,
    ) -> AsyncGenerator[str, None]:
        """流式生成资源（用于 SSE 推送）

        Args:
            user_message: 用户当前消息
            conversation_history: 多轮对话历史
            student_profile: 学生画像

        Yields:
            LLM 输出的 token 片段
        """
        user_prompt = self._build_generate_prompt(user_message, student_profile)
        messages = self._build_messages(conversation_history, user_prompt)

        async for chunk in get_llm_client().chat_stream(
            messages=messages,
            system=SYSTEM_PROMPT,
            max_tokens=6144,
            temperature=0.7,
        ):
            yield chunk

    async def execute(self, state: dict) -> dict:
        """从 AgentState 解包参数，调用 generate()"""
        params = state.get("intent_params", {})
        user_message = params.get("user_message", params.get("knowledge_point", "通用知识"))
        return await self.generate(
            user_message=user_message,
            conversation_history=params.get("conversation_history"),
            student_profile=state.get("student_profile"),
        )

    def _build_generate_prompt(self, user_message: str, student_profile: dict | None) -> str:
        parts = [f"用户需求：{user_message}"]

        if student_profile:
            dims = student_profile.get("dimensions", {})
            kb_score = dims.get("knowledge_base", {}).get("score", 50)
            if kb_score < 50:
                parts.append("\n学生基础较弱，讲解要细致，多用生活类比，代码注释详细。")
            elif kb_score >= 70:
                parts.append("\n学生基础较好，可以适当加入进阶内容。")

            comprehension = dims.get("comprehension", {})
            if comprehension.get("score", 50) < 50:
                parts.append("\n学生理解力一般，语言要直白清晰。")

        parts.append("\n请返回 JSON 格式。只返回 JSON。")
        return "\n".join(parts)

    def _build_modify_prompt(
        self,
        current_content: dict,
        modification_request: str,
        knowledge_point: str,
    ) -> str:
        parts = []
        if knowledge_point:
            parts.append(f"知识点：{knowledge_point}")
        parts.append(f"当前资源内容：\n{self._serialize_content(current_content)}")
        parts.append(f"\n用户修改请求：{modification_request}")
        parts.append("\n请根据修改请求更新对应部分，保持其他部分不变。返回 JSON 格式。只返回 JSON。")
        return "\n".join(parts)

    def _build_messages(
        self,
        conversation_history: list[dict] | None,
        current_prompt: str,
    ) -> list[dict]:
        messages = []
        if conversation_history:
            for msg in conversation_history[-10:]:
                role = msg.get("role", "user")
                if role in ("user", "assistant"):
                    messages.append({"role": role, "content": msg.get("content", "")})
        messages.append({"role": "user", "content": current_prompt})
        return messages

    @staticmethod
    def _serialize_content(content: dict) -> str:
        """将资源内容序列化为可读文本（放入 prompt）"""
        lines = []
        if content.get("knowledge"):
            lines.append(f"[知识讲解]\n{content['knowledge']}")
        if content.get("code"):
            lines.append(f"[代码示例]\n{content['code']}")
        if content.get("mermaid_code"):
            lines.append(f"[思维导图]\n{content['mermaid_code']}")
        if content.get("exercises"):
            lines.append(f"[练习题] 共 {len(content['exercises'])} 道")
        return "\n\n".join(lines) if lines else "（暂无内容）"

    def _parse_response(self, content: str) -> dict:
        fallback = {
            "knowledge": "",
            "code": "",
            "mermaid_code": "",
            "exercises": [],
            "message": "资源生成完成",
        }
        result = parse_json_response(content, fallback)

        # 确保必要字段存在
        for key, default in fallback.items():
            if key not in result:
                result[key] = default

        return result


resource_creator_agent = ResourceCreatorAgent()
