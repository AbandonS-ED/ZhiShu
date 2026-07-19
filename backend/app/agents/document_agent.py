"""Document Agent — 知识讲解/代码/音频脚本 综合生成

根据学生画像、知识点和 variant，生成结构化的学习材料：
- variant: deep=深度全面讲解 / concise=三句话速记 / multi_impl=多实现对比

包含防幻觉验证（N3 评分项）。
"""

import re
import logging
from app.services.llm_factory import get_llm_client
from app.services.anti_hallucination import anti_hallucination
from app.services.json_parser import parse_json_response

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# System Prompts — 按 variant 细分
# ─────────────────────────────────────────────────────────────────────────────

SYSTEM_PROMPT_DEEP = """你是一个专业的学习材料生成器。根据学生的知识画像，为指定知识点生成**深度全面**的学习材料。

## 输出格式（严格按此格式输出，只返回 JSON）
{
  "knowledge": "深度讲解内容（500-800字）：【概念定义】→【核心原理】→【生活类比】→【典型例题】→【记忆口诀】",
  "code": "代码实现：展示最核心的1-2种实现，包含关键注释，说明时间/空间复杂度",
  "audio_script": "2分钟精讲版音频讲稿：开场引入→核心概念→关键公式→生活类比→总结回顾"
}

## 质量要求
- knowledge 字段必须包含：概念定义、核心原理、至少一个生活类比、一个典型例题（带解析）、一个记忆口诀
- code 字段用 ---CODE_SEP--- 分隔多个实现，每个实现前注明语言/框架
- audio_script 口语化，像老师上课讲解，有过渡语
- 只返回 JSON，不要其他文字"""

SYSTEM_PROMPT_CONCISE = """你是一个专业的学习材料生成器。根据学生的知识画像，为指定知识点生成**简洁精炼**的学习速览材料。

## 输出格式（严格按此格式输出，只返回 JSON）
{
  "knowledge": "三句话速记（每句不超过20字）：第一句核心定义/第二句关键公式或原理/第三句核心记忆点或易错提醒",
  "code": "最核心的一种实现，10行以内，保留关键注释",
  "audio_script": "30秒极简版讲稿，口语化，3-4句话覆盖最核心的要点"
}

## 质量要求
- knowledge 字段：3句话，清晰准确，适合快速回顾
- audio_script：口语化，极简，不超过150字
- 只返回 JSON，不要其他文字"""

SYSTEM_PROMPT_MULTI_CODE = """你是一个专业的学习材料生成器。根据学生的知识画像，为指定知识点生成**多实现对比**的代码示例。

## 输出格式（严格按此格式输出，只返回 JSON）
{
  "knowledge": "多实现对比讲解（200-300字）：说明不同实现的适用场景和优劣对比",
  "code": "用 ---CODE_SEP--- 分隔3种不同实现，每种实现前注明：【实现名称】语言/框架\n代码...\n说明：时间复杂度/空间复杂度/适用场景",
  "audio_script": "1分钟版音频讲稿，口语化，介绍为什么需要多种实现"
}

## 质量要求
- code 字段必须包含3种实现：基础实现 / 向量化实现 / 最优实现（或其他有意义的变化）
- 每种实现必须说明时间复杂度、空间复杂度、适用场景
- 三种实现用 ---CODE_SEP--- 分隔，前端按分隔符分栏展示
- 只返回 JSON，不要其他文字"""

_VARIANT_PROMPTS = {
    "deep": SYSTEM_PROMPT_DEEP,
    "concise": SYSTEM_PROMPT_CONCISE,
    "multi_impl": SYSTEM_PROMPT_MULTI_CODE,
}

_VARIANT_MAX_TOKENS = {
    "deep": 4096,
    "concise": 1024,
    "multi_impl": 3072,
}

_VARIANT_DEFAULTS = {
    "deep": SYSTEM_PROMPT_DEEP,
    "concise": SYSTEM_PROMPT_CONCISE,
    "multi_impl": SYSTEM_PROMPT_MULTI_CODE,
}


class DocumentAgent:
    """综合学习资源生成 Agent"""

    async def generate(
        self,
        knowledge_point: str,
        student_profile: dict | None = None,
        resource_type: str = "all",
        variant: str = "deep",
    ) -> dict:
        """生成学习内容

        Args:
            knowledge_point: 知识点名称
            student_profile: 学生画像（可选，用于调整难度）
            resource_type: all/knowledge/code/audio（向后兼容）
            variant: deep=深度讲解 / concise=简洁速记 / multi_impl=多实现对比

        Returns:
            {knowledge: str, code: str, audio_script: str, validation: dict}
        """
        system_prompt = _VARIANT_PROMPTS.get(variant, SYSTEM_PROMPT_DEEP)
        user_prompt = self._build_prompt(knowledge_point, student_profile, resource_type, variant)

        max_tokens = _VARIANT_MAX_TOKENS.get(variant, 4096)

        response = await get_llm_client().chat(
            messages=[{"role": "user", "content": user_prompt}],
            system=system_prompt,
            max_tokens=max_tokens,
            temperature=0.7,
        )

        result = self._parse_response(response["content"])

        # 防幻觉验证
        text_to_validate = result.get("knowledge", "") or result.get("code", "") or str(result)
        if text_to_validate:
            validation = await anti_hallucination.validate(
                content=text_to_validate,
                knowledge_point=knowledge_point,
            )
            result["validation"] = {
                "passed": validation.passed,
                "issues": validation.issues,
                "confidence": validation.confidence,
            }

        result["_variant"] = variant
        return result

    async def execute(self, state: dict) -> dict:
        """从 AgentState 解包参数，调用 generate()"""
        kp = state.get("intent_params", {}).get("knowledge_point", "通用知识")
        return await self.generate(
            knowledge_point=kp,
            student_profile=state.get("student_profile"),
            resource_type=state.get("intent_params", {}).get("resource_type", "all"),
            variant=state.get("intent_params", {}).get("variant", "deep"),
        )

    def _build_prompt(
        self,
        knowledge_point: str,
        student_profile: dict | None,
        resource_type: str,
        variant: str,
    ) -> str:
        parts = [f"请为「{knowledge_point}」生成学习材料。"]

        if student_profile:
            dims = student_profile.get("dimensions", {})

            # 知识基础影响内容深度
            knowledge_base = dims.get("knowledge_base", {})
            kb_score = knowledge_base.get("score", 50)
            if kb_score < 50:
                parts.append("\n学生基础较弱，讲解要更细致，多用生活类比。")
            elif kb_score >= 70:
                parts.append("\n学生基础较好，可以适当加入进阶内容。")

            # 理解力影响表述难度
            comprehension = dims.get("comprehension", {})
            if comprehension.get("score", 50) < 50:
                parts.append("\n学生理解力一般，语言要直白清晰，避免复杂表述。")

            # 想象力影响示例多样性
            imagination = dims.get("imagination", {})
            if imagination.get("score", 50) >= 70:
                parts.append("\n学生想象力丰富，可以多用跨领域类比。")

        if variant == "concise":
            parts.append("\n请生成简洁版，三句话概括核心即可。")
        elif variant == "multi_impl":
            parts.append("\n请生成多实现对比版，重点展示3种不同的代码实现方案。")

        parts.append("\n请返回 JSON 格式。只返回 JSON。")
        return "\n".join(parts)

    def _parse_response(self, content: str) -> dict:
        """解析 LLM 返回的 JSON 内容"""
        return parse_json_response(content, {
            "knowledge": "",
            "code": "",
            "audio_script": "",
})


document_agent = DocumentAgent()