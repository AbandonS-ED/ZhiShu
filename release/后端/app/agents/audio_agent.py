"""Audio Agent — 音频讲解脚本生成

根据知识主题和 variant，生成口语化的音频讲解脚本：
- variant: standard=2分钟精讲版 / concise=30秒极简版

复用 document_agent 的 audio_script 字段，独立成 Agent 以体现角色分工。
"""

from app.services.llm_factory import get_llm_client
from app.services.json_parser import parse_json_response


class AudioAgent:
    """音频讲解脚本生成 Agent"""

    SYSTEM_PROMPT_STANDARD = """你是一个专业的音频讲解脚本生成器。根据知识主题，生成**2分钟精讲版**的音频讲解脚本。

## 输出格式（严格按此格式输出，只返回 JSON）
{
  "title": "音频标题",
  "audio_script": "完整的口语化讲解脚本（500-800字），包含：开场引入(30秒)→核心概念(60秒)→关键公式/原理(30秒)→生活类比(30秒)→总结回顾(30秒)",
  "duration_minutes": 2,
  "key_points": ["要点1", "要点2", "要点3", "要点4"]
}

## 要求
- 口语化，像老师在课堂上讲课一样自然，有"同学们好""我们来想想"等过渡语
- 有开场白（引入话题）和结尾（回顾总结）
- 逻辑清晰，每段之间有过渡语
- 适当使用类比和生活例子帮助理解
- 只返回 JSON，不要其他文字"""

    SYSTEM_PROMPT_CONCISE = """你是一个专业的音频讲解脚本生成器。根据知识主题，生成**30秒极简版**的音频讲解脚本。

## 输出格式（严格按此格式输出，只返回 JSON）
{
  "title": "音频标题",
  "audio_script": "极简口语化讲稿（150字以内），3-4句话覆盖最核心的要点，像速记口诀一样简洁有力",
  "duration_minutes": 0.5,
  "key_points": ["最核心要点1", "最核心要点2"]
}

## 要求
- 极简，口语化，适合快速回顾
- 直接切入重点，不废话
- 可以用口诀、顺口溜、关键公式总结形式
- 只返回 JSON，不要其他文字"""

    _VARIANT_PROMPTS = {
        "standard": SYSTEM_PROMPT_STANDARD,
        "concise": SYSTEM_PROMPT_CONCISE,
    }

    async def generate(
        self,
        knowledge_point: str,
        student_profile: dict | None = None,
        variant: str = "standard",
    ) -> dict:
        """生成音频讲解脚本

        Args:
            knowledge_point: 知识点名称
            student_profile: 学生画像（可选）
            variant: standard=2分钟精讲版 / concise=30秒极简版

        Returns:
            {title, audio_script, duration_minutes, key_points}
        """
        system_prompt = self._VARIANT_PROMPTS.get(variant, self.SYSTEM_PROMPT_STANDARD)
        user_prompt = self._build_prompt(knowledge_point, student_profile, variant)

        max_tokens = 512 if variant == "concise" else 1024

        response = await get_llm_client().chat(
            messages=[{"role": "user", "content": user_prompt}],
            system=system_prompt,
            max_tokens=max_tokens,
            temperature=0.7,
        )

        result = self._parse_response(response["content"])
        result["_variant"] = variant
        return result

    async def execute(self, state: dict) -> dict:
        """从 AgentState 解包参数，调用 generate()"""
        kp = state.get("intent_params", {}).get("knowledge_point", "通用知识")
        return await self.generate(
            knowledge_point=kp,
            student_profile=state.get("student_profile"),
            variant=state.get("intent_params", {}).get("variant", "standard"),
        )

    def _build_prompt(
        self,
        knowledge_point: str,
        student_profile: dict | None,
        variant: str,
    ) -> str:
        parts = [f"请为「{knowledge_point}」生成音频讲解脚本（variant={variant}）。"]

        if student_profile:
            dims = student_profile.get("dimensions", {})
            comprehension = dims.get("comprehension", {})
            if comprehension.get("score", 50) < 50:
                parts.append("\n学生理解力一般，讲解要更直白，多用生活类比。")

        parts.append("\n请返回 JSON 格式。只返回 JSON。")
        return "\n".join(parts)

    def _parse_response(self, content: str) -> dict:
        return parse_json_response(content, {
            "title": "音频讲解",
            "audio_script": content,
            "duration_minutes": 2,
            "key_points": [],
        })


audio_agent = AudioAgent()
