"""Audio Agent — 音频讲解脚本生成

根据知识主题和学生画像，生成口语化的音频讲解脚本。
赛题要求 ≥5 种资源类型，audio 是其中之一。
复用 document_agent 的 audio_script 字段，独立成 Agent 以体现角色分工。
"""

import json
from app.services.llm_factory import get_llm_client
from app.services.json_parser import parse_json_response


class AudioAgent:
    """音频讲解脚本生成 Agent"""

    SYSTEM_PROMPT = """你是一个专业的音频讲解脚本生成器。根据知识主题和学生画像，生成口语化的音频讲解脚本。

你的输出必须是一个 JSON 对象：
{
  "title": "音频标题",
  "audio_script": "完整的口语化讲解脚本...",
  "duration_minutes": 5,
  "key_points": ["要点1", "要点2", "要点3"]
}

## 要求
- 口语化，像老师在课堂上讲课一样自然
- 有开场白（引入话题）和总结（回顾要点）
- 逻辑清晰，每段之间有过渡
- 适当使用类比和生活例子帮助理解
- 根据学生掌握程度调整深度
- 只返回 JSON，不要其他文字"""

    async def generate(
        self,
        knowledge_point: str,
        student_profile: dict | None = None,
    ) -> dict:
        """生成音频讲解脚本

        Args:
            knowledge_point: 知识点名称
            student_profile: 学生画像（可选）

        Returns:
            {title, audio_script, duration_minutes, key_points}
        """
        user_prompt = self._build_prompt(knowledge_point, student_profile)

        response = await get_llm_client().chat(
            messages=[{"role": "user", "content": user_prompt}],
            system=self.SYSTEM_PROMPT,
            max_tokens=4096,
            temperature=0.7,
        )

        result = self._parse_response(response["content"])
        return result

    async def execute(self, state: dict) -> dict:
        """从 AgentState 解包参数，调用 generate()"""
        kp = state.get("intent_params", {}).get("knowledge_point", "通用知识")
        return await self.generate(
            knowledge_point=kp,
            student_profile=state.get("student_profile"),
        )

    def _build_prompt(
        self,
        knowledge_point: str,
        student_profile: dict | None,
    ) -> str:
        parts = [f"请为「{knowledge_point}」生成一个音频讲解脚本。"]

        if student_profile:
            pass

        parts.append("\n请返回 JSON 格式。只返回 JSON。")

        return "\n".join(parts)

    def _parse_response(self, content: str) -> dict:
        return parse_json_response(content, {
            "title": "音频讲解",
            "audio_script": content,
            "duration_minutes": 5,
            "key_points": [],
        })


audio_agent = AudioAgent()
