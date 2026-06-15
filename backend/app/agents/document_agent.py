"""Document Agent — 知识讲解 + 代码示例 + 音频脚本生成

根据知识主题和学生画像，生成三种格式的学习内容：
1. knowledge: 结构化知识讲解 (Markdown)
2. code: 代码示例 + 逐行注释
3. audio_script: 口语化音频脚本

包含防幻觉验证（N3 评分项）。
"""

import json
from app.services import minimax_client as mc_module
from app.services.anti_hallucination import anti_hallucination
from app.services.json_parser import parse_json_response


class DocumentAgent:
    """文档/知识内容生成 Agent"""

    SYSTEM_PROMPT = """你是一个专业的知识内容生成器。根据学生的知识画像，为指定知识点生成三种格式的学习材料。

你的输出必须是一个 JSON 对象：
{
  "knowledge": "Markdown 格式的知识讲解，包含标题、要点、示例",
  "code": "带详细注释的代码示例",
  "audio_script": "口语化的讲解脚本，适合学生听音频学习"
}

## 要求
- 知识讲解要结构清晰，用 Markdown 格式
- 代码示例要包含逐行中文注释
- 音频脚本要口语化，像老师讲课一样自然
- 根据学生的知识掌握程度调整深度
- 只返回 JSON，不要其他文字"""

    async def generate(
        self,
        knowledge_point: str,
        student_profile: dict | None = None,
        resource_type: str = "all",
    ) -> dict:
        """生成学习内容

        Args:
            knowledge_point: 知识点名称
            student_profile: 学生画像（可选，用于调整难度）
            resource_type: all/knowledge/code/audio

        Returns:
            {knowledge: str, code: str, audio_script: str, validation: dict}
        """
        user_prompt = self._build_prompt(knowledge_point, student_profile, resource_type)

        response = await mc_module.minimax_client.chat(
            messages=[{"role": "user", "content": user_prompt}],
            system=self.SYSTEM_PROMPT,
            max_tokens=4096,
            temperature=0.7,
        )

        result = self._parse_response(response["content"])

        # 防幻觉验证
        validation = await anti_hallucination.validate(
            content=result.get("knowledge", ""),
            knowledge_point=knowledge_point,
        )
        result["validation"] = {
            "passed": validation.passed,
            "issues": validation.issues,
            "confidence": validation.confidence,
        }

        return result

    async def execute(self, state: dict) -> dict:
        """从 AgentState 解包参数，调用 generate()"""
        kp = state.get("intent_params", {}).get("knowledge_point", "通用知识")
        return await self.generate(
            knowledge_point=kp,
            student_profile=state.get("student_profile"),
            resource_type=state.get("intent_params", {}).get("resource_type", "all"),
        )

    def _build_prompt(
        self,
        knowledge_point: str,
        student_profile: dict | None,
        resource_type: str,
    ) -> str:
        parts = [f"请为「{knowledge_point}」生成学习材料。"]

        if student_profile:
            # 根据学生画像调整内容难度和风格
            dims = student_profile.get("dimensions", {})

            # 知识基础影响内容深度
            knowledge_base = dims.get("knowledge_base", {})
            if knowledge_base.get("score", 50) < 50:
                parts.append("\n学生基础较弱，请从基础概念开始讲解，多用生活化的例子。")
            elif knowledge_base.get("score", 50) >= 70:
                parts.append("\n学生基础较好，可以讲得深入一些，包含进阶内容。")

            # 理解力影响讲解方式
            comprehension = dims.get("comprehension", {})
            if comprehension.get("score", 50) < 50:
                parts.append("\n学生理解力一般，请多用类比和图解，把复杂概念简单化。")

            # 学习目标影响内容侧重点
            learning_goal = dims.get("learning_goal", {})
            goal_score = learning_goal.get("score", 50)
            if goal_score < 50:
                parts.append("\n学生学习目标不明确，请在内容开头说明学习这个知识的价值和应用场景。")

        type_map = {
            "all": "知识讲解 + 代码示例 + 音频脚本",
            "knowledge": "仅知识讲解",
            "code": "仅代码示例",
            "audio": "仅音频脚本",
        }
        parts.append(f"\n生成类型: {type_map.get(resource_type, 'all')}")
        parts.append("\n请返回 JSON 格式。只返回 JSON。")

        return "\n".join(parts)

    def _parse_response(self, content: str) -> dict:
        return parse_json_response(content, {"knowledge": content, "code": "", "audio_script": ""})


document_agent = DocumentAgent()
