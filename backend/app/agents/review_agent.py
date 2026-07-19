"""Review Agent — 多学科智能审核系统

对生成的学习资源进行五维度质量审核：
1. content_quality: 逻辑性、完整性、可读性
2. knowledge_accuracy: 错误检测、过时信息、夸大表述
3. format_check: Markdown 格式、结构清晰度
4. subject_match: 学科类型匹配度（是否符合学科特点）
5. learning_suggestions: 难度匹配、知识缺口、学习路径建议
"""

import logging
from app.services.llm_factory import get_llm_client
from app.services.anti_hallucination import anti_hallucination
from app.services.json_parser import parse_json_response

logger = logging.getLogger(__name__)

# 学科分类
PROGRAMMING_KEYWORDS = [
    'python', 'java', 'c++', 'javascript', '编程', '程序', '代码', '算法',
    '数据结构', '开发', '软件', '前端', '后端', '数据库', 'sql'
]

MATH_KEYWORDS = [
    '数学', '微积分', '线性代数', '概率', '统计', '方程', '函数', '极限',
    '导数', '积分', '矩阵', '向量', '几何', '代数', '高等数学'
]

SCIENCE_KEYWORDS = [
    '物理', '化学', '生物', '天文', '地理', '科学', '实验', '力学',
    '电磁', '光学', '热学', '量子'
]


def detect_subject_type(knowledge_point: str) -> str:
    """检测学科类型"""
    kp_lower = knowledge_point.lower()
    
    for keyword in PROGRAMMING_KEYWORDS:
        if keyword in kp_lower:
            return "programming"
    
    for keyword in MATH_KEYWORDS:
        if keyword in kp_lower:
            return "math"
    
    for keyword in SCIENCE_KEYWORDS:
        if keyword in kp_lower:
            return "science"
    
    return "theory"


REVIEW_SYSTEM_PROMPT = """你是一个专业的学习资源质量审核专家。请对学习材料进行**五维度**审核评估。

## 审核维度

### 1. content_quality（内容质量）
- 逻辑性：论述是否连贯、推理是否正确
- 完整性：是否覆盖了知识点的核心内容
- 可读性：表述是否清晰、易于理解

### 2. knowledge_accuracy（知识准确性）
- 是否存在事实错误
- 是否包含过时信息
- 是否有夸大或不准确的表述

### 3. format_check（格式规范）
- Markdown 格式是否正确
- 结构层次是否清晰
- 公式/图表是否规范

### 4. subject_match（学科匹配）
- 内容是否符合该学科的特点
- 编程类：是否包含代码示例
- 数学类：是否包含公式推导、例题解析
- 理论类：是否包含知识框架、要点归纳
- 是否存在学科类型错误（如数学题生成了代码）

### 5. learning_suggestions（学习建议）
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
    "issues": [],
    "suggestions": []
  },
  "format_check": {
    "score": 80,
    "issues": [],
    "suggestions": []
  },
  "subject_match": {
    "score": 95,
    "issues": [],
    "suggestions": []
  },
  "learning_suggestions": {
    "score": 82,
    "issues": [],
    "suggestions": []
  },
  "summary": "整体质量良好，建议..."
}

## 评分标准
- 90-100: 优秀，可直接使用
- 75-89: 良好，有少量可改进处
- 60-74: 合格，需要一定修改
- 0-59: 不合格，需要大幅修改或重新生成

## 特别注意
- 如果是数学/物理等学科却生成了代码，subject_match 给低分
- 如果是编程学科却没有代码示例，subject_match 给低分
- exercises 的难度要与知识点匹配
- 只返回 JSON，不要其他文字"""


class ReviewAgent:
    """五维度智能审核 Agent"""

    async def review(
        self,
        content: dict,
        knowledge_point: str,
        student_profile: dict | None = None,
    ) -> dict:
        """对学习资源进行五维度审核

        Args:
            content: 待审核内容
            knowledge_point: 知识点名称
            student_profile: 学生画像（可选）

        Returns:
            {
                "overall_score": int,
                "passed": bool,
                "dimensions": {5个维度的详细评分},
                "summary": str,
            }
        """
        # ① 先运行防幻觉验证
        validation_text = self._extract_validation_text(content)
        hallucination_result = None
        if validation_text:
            hallucination_result = await anti_hallucination.validate(
                content=validation_text,
                knowledge_point=knowledge_point,
            )

        # ② 构建 LLM 审核 prompt
        user_prompt = self._build_prompt(content, knowledge_point, student_profile)

        # ③ 调用 LLM 获取五维度审核结果
        response = await get_llm_client().chat(
            messages=[{"role": "user", "content": user_prompt}],
            system=REVIEW_SYSTEM_PROMPT,
            max_tokens=2048,
            temperature=0.3,
        )

        # ④ 解析 LLM 返回
        llm_review = self._parse_response(response["content"])

        # ⑤ 合并防幻觉结果并计算总分
        result = self._merge_results(llm_review, hallucination_result, content, knowledge_point)

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
        for key in ("knowledge", "code", "mermaid_code"):
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
        """构建审核提示"""
        subject_type = detect_subject_type(knowledge_point)
        
        parts = [f"请对「{knowledge_point}」知识点的学习材料进行五维度审核。"]
        parts.append(f"\n学科类型：{subject_type}")

        # 附加学生画像信息
        if student_profile:
            dims = student_profile.get("dimensions", {})
            if dims:
                weak_points = [k for k, v in dims.items() if v < 50]
                if weak_points:
                    parts.append(f"\n学生薄弱点：{', '.join(weak_points)}")

        parts.append("\n## 待审核材料")
        for key in ("knowledge", "code", "mermaid_code", "exercises"):
            val = content.get(key)
            if val:
                if isinstance(val, str):
                    parts.append(f"\n### {key}\n{val[:3000]}")
                elif isinstance(val, list):
                    parts.append(f"\n### {key}\n{str(val)[:3000]}")

        parts.append("\n请返回 JSON 格式的五维度审核结果。只返回 JSON。")
        return "\n".join(parts)

    def _parse_response(self, raw: str) -> dict:
        """解析 LLM 审核结果"""
        fallback = {
            "content_quality": {"score": 60, "issues": ["解析失败"], "suggestions": []},
            "knowledge_accuracy": {"score": 60, "issues": ["解析失败"], "suggestions": []},
            "format_check": {"score": 60, "issues": ["解析失败"], "suggestions": []},
            "subject_match": {"score": 60, "issues": ["解析失败"], "suggestions": []},
            "learning_suggestions": {"score": 60, "issues": ["解析失败"], "suggestions": []},
            "summary": "审核结果解析失败，请重试。",
        }
        return parse_json_response(raw, fallback)

    def _merge_results(
        self,
        llm_review: dict,
        hallucination_result,
        content: dict,
        knowledge_point: str,
    ) -> dict:
        """合并审核结果并计算总分"""
        dimensions = {
            "content_quality": llm_review.get("content_quality", {"score": 60, "issues": [], "suggestions": []}),
            "knowledge_accuracy": llm_review.get("knowledge_accuracy", {"score": 60, "issues": [], "suggestions": []}),
            "format_check": llm_review.get("format_check", {"score": 60, "issues": [], "suggestions": []}),
            "subject_match": llm_review.get("subject_match", {"score": 60, "issues": [], "suggestions": []}),
            "learning_suggestions": llm_review.get("learning_suggestions", {"score": 60, "issues": [], "suggestions": []}),
        }

        # 合并防幻觉结果到 knowledge_accuracy
        if hallucination_result is not None:
            ka = dimensions["knowledge_accuracy"]
            if not hallucination_result.passed:
                for issue in hallucination_result.issues:
                    prefixed = f"[防幻觉] {issue}"
                    if prefixed not in ka["issues"]:
                        ka["issues"].append(prefixed)
                penalty = int((1.0 - hallucination_result.confidence) * 30)
                ka["score"] = max(0, ka["score"] - penalty)
            ka["hallucination_confidence"] = hallucination_result.confidence

        # 自动检测学科匹配问题
        subject_type = detect_subject_type(knowledge_point)
        sm = dimensions["subject_match"]
        
        # 检查代码字段
        code = content.get("code", "")
        if subject_type == "programming" and not code:
            if "编程类内容缺少代码示例" not in sm["issues"]:
                sm["issues"].append("编程类内容缺少代码示例")
                sm["score"] = max(0, sm["score"] - 20)
        elif subject_type in ["math", "science", "theory"] and code:
            if "非编程类内容不应包含代码" not in sm["issues"]:
                sm["issues"].append("非编程类内容不应包含代码")
                sm["score"] = max(0, sm["score"] - 15)

        # 计算总分（五维度加权平均）
        weights = {
            "content_quality": 0.25,
            "knowledge_accuracy": 0.25,
            "format_check": 0.15,
            "subject_match": 0.20,
            "learning_suggestions": 0.15,
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
