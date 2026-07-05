"""Review Agent — 四维度智能审核系统

对生成的学习资源进行四维度质量审核：
1. content_quality: 逻辑性、完整性、可读性
2. knowledge_accuracy: 错误检测、过时信息、夸大表述（调用防幻觉服务）
3. format_check: Markdown 格式、代码可运行性、结构清晰度
4. learning_suggestions: 难度匹配、知识缺口、学习路径建议
"""

import logging
from app.services.llm_factory import get_llm_client
from app.services.anti_hallucination import anti_hallucination
from app.services.json_parser import parse_json_response

logger = logging.getLogger(__name__)


REVIEW_SYSTEM_PROMPT = """你是一个专业的学习资源质量审核专家。请对以下学习材料进行**四维度**审核评估。

## 审核维度

### 1. content_quality（内容质量）
- 逻辑性：论述是否连贯、推理是否正确
- 完整性：是否覆盖了知识点的核心内容
- 可读性：表述是否清晰、易于理解

### 2. knowledge_accuracy（知识准确性）
- 是否存在事实错误
- 是否包含过时信息
- 是否有夸大或不准确的表述
（此维度会结合防幻觉检测结果进行综合评估）

### 3. format_check（格式规范）
- Markdown 格式是否正确
- 代码块是否有正确的语言标注
- 结构层次是否清晰

### 4. learning_suggestions（学习建议）
- 内容难度是否适合目标学生
- 是否存在知识缺口
- 学习路径建议

## 输出格式（严格按此格式输出，只返回 JSON）
{
  "content_quality": {
    "score": 85,
    "issues": ["问题1", "问题2"],
    "suggestions": ["建议1", "建议2"]
  },
  "knowledge_accuracy": {
    "score": 90,
    "issues": ["问题1"],
    "suggestions": ["建议1"]
  },
  "format_check": {
    "score": 80,
    "issues": ["问题1"],
    "suggestions": ["建议1"]
  },
  "learning_suggestions": {
    "score": 82,
    "issues": ["问题1"],
    "suggestions": ["建议1"]
  },
  "summary": "整体质量良好，建议..."
}

## 评分标准
- 90-100: 优秀，可直接使用
- 75-89: 良好，有少量可改进处
- 60-74: 合格，需要一定修改
- 0-59: 不合格，需要大幅修改或重新生成

## 注意事项
- score 为 0-100 的整数
- issues 列出发现的具体问题（无问题则为空列表）
- suggestions 列出具体的改进建议
- summary 为整体评价（30-80字）
- 只返回 JSON，不要其他文字"""


class ReviewAgent:
    """四维度智能审核 Agent"""

    async def review(
        self,
        content: dict,
        knowledge_point: str,
        student_profile: dict | None = None,
    ) -> dict:
        """对学习资源进行四维度审核

        Args:
            content: 待审核内容，包含 knowledge/code/mermaid_code/exercises 等字段
            knowledge_point: 知识点名称
            student_profile: 学生画像（可选，用于评估难度匹配）

        Returns:
            {
                "overall_score": int,
                "passed": bool,
                "dimensions": {4个维度的详细评分},
                "summary": str,
            }
        """
        # ① 先运行防幻觉验证（knowledge_accuracy 维度的数据来源）
        validation_text = self._extract_validation_text(content)
        hallucination_result = None
        if validation_text:
            hallucination_result = await anti_hallucination.validate(
                content=validation_text,
                knowledge_point=knowledge_point,
            )

        # ② 构建 LLM 审核 prompt
        user_prompt = self._build_prompt(content, knowledge_point, student_profile)

        # ③ 调用 LLM 获取四维度审核结果
        response = await get_llm_client().chat(
            messages=[{"role": "user", "content": user_prompt}],
            system=REVIEW_SYSTEM_PROMPT,
            max_tokens=2048,
            temperature=0.3,
        )

        # ④ 解析 LLM 返回
        llm_review = self._parse_response(response["content"])

        # ⑤ 合并防幻觉结果到 knowledge_accuracy 维度
        result = self._merge_hallucination(llm_review, hallucination_result)

        return result

    async def execute(self, state: dict) -> dict:
        """从 AgentState 解包参数，调用 review()"""
        content = state.get("content", {})
        kp = state.get("intent_params", {}).get("knowledge_point", "通用知识")
        return await self.review(
            content=content,
            knowledge_point=kp,
            student_profile=state.get("student_profile"),
        )

    def _extract_validation_text(self, content: dict) -> str:
        """从内容中提取用于防幻觉验证的文本"""
        parts = []
        for key in ("knowledge", "code", "mermaid_code", "exercises"):
            val = content.get(key)
            if val and isinstance(val, str):
                parts.append(val)
        return "\n\n".join(parts)

    def _build_prompt(
        self,
        content: dict,
        knowledge_point: str,
        student_profile: dict | None,
    ) -> str:
        parts = [f"请对「{knowledge_point}」知识点的学习材料进行四维度审核。"]

        # 附加学生画像信息
        if student_profile:
            dims = student_profile.get("dimensions", {})
            kb = dims.get("knowledge_base", {})
            score = kb.get("score", 50)
            if score < 50:
                parts.append("\n学生基础较弱，请重点关注内容是否过于晦涩。")
            elif score >= 70:
                parts.append("\n学生基础较好，请关注内容深度是否足够。")

        parts.append("\n## 待审核材料")
        for key in ("knowledge", "code", "mermaid_code", "exercises"):
            val = content.get(key)
            if val and isinstance(val, str):
                parts.append(f"\n### {key}\n{val[:3000]}")

        parts.append("\n请返回 JSON 格式的四维度审核结果。只返回 JSON。")
        return "\n".join(parts)

    def _parse_response(self, raw: str) -> dict:
        """解析 LLM 审核结果"""
        fallback = {
            "content_quality": {"score": 60, "issues": ["解析失败"], "suggestions": []},
            "knowledge_accuracy": {"score": 60, "issues": ["解析失败"], "suggestions": []},
            "format_check": {"score": 60, "issues": ["解析失败"], "suggestions": []},
            "learning_suggestions": {"score": 60, "issues": ["解析失败"], "suggestions": []},
            "summary": "审核结果解析失败，请重试。",
        }
        return parse_json_response(raw, fallback)

    def _merge_hallucination(
        self,
        llm_review: dict,
        hallucination_result,
    ) -> dict:
        """将防幻觉检测结果合并到 knowledge_accuracy 维度，并计算总分"""
        dimensions = {
            "content_quality": llm_review.get("content_quality", {"score": 60, "issues": [], "suggestions": []}),
            "knowledge_accuracy": llm_review.get("knowledge_accuracy", {"score": 60, "issues": [], "suggestions": []}),
            "format_check": llm_review.get("format_check", {"score": 60, "issues": [], "suggestions": []}),
            "learning_suggestions": llm_review.get("learning_suggestions", {"score": 60, "issues": [], "suggestions": []}),
        }

        # 合并防幻觉结果
        if hallucination_result is not None:
            ka = dimensions["knowledge_accuracy"]
            if not hallucination_result.passed:
                for issue in hallucination_result.issues:
                    prefixed = f"[防幻觉] {issue}"
                    if prefixed not in ka["issues"]:
                        ka["issues"].append(prefixed)
                # 根据 confidence 降低分数
                penalty = int((1.0 - hallucination_result.confidence) * 30)
                ka["score"] = max(0, ka["score"] - penalty)
            # 记录防幻觉置信度
            ka["hallucination_confidence"] = hallucination_result.confidence

        # 计算总分（四维度加权平均）
        weights = {
            "content_quality": 0.3,
            "knowledge_accuracy": 0.3,
            "format_check": 0.2,
            "learning_suggestions": 0.2,
        }
        overall_score = int(sum(
            dimensions[dim]["score"] * w
            for dim, w in weights.items()
        ))

        return {
            "overall_score": overall_score,
            "passed": overall_score >= 60,
            "dimensions": dimensions,
            "summary": llm_review.get("summary", "审核完成。"),
        }


review_agent = ReviewAgent()
