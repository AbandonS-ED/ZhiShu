"""Exercise Agent — 自适应练习题生成

根据学生画像和 variant，生成不同类型的练习题：
- variant: mixed=混合难度（入门+进阶）/ challenge=挑战难度

包含防幻觉验证（N3 评分项）。
"""

from app.services.llm_factory import get_llm_client
from app.services.anti_hallucination import anti_hallucination
from app.services.json_parser import parse_json_response


class ExerciseAgent:
    """自适应练习题生成 Agent"""

    SYSTEM_PROMPT_MIXED = """你是一个专业的练习题生成器。根据学生的知识画像，为指定知识点生成**混合难度**的练习题。

你的输出必须是一个 JSON 对象，type 字段必须使用英文值：
{
  "exercises": [
    {
      "type": "choice",
      "question": "题目内容",
      "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
      "answer": "B",
      "explanation": "详细解析",
      "difficulty": 50,
      "knowledge_point": "知识点"
    }
  ]
}

## 难度分布（本题为混合难度）
- 生成 2 道基础题（difficulty=30-50）：考察核心概念和基本公式
- 生成 1 道进阶题（difficulty=60-75）：需要综合应用或略微转弯
- 选择题 4 个选项，干扰项要有迷惑性且基于真实错误设计
- 只返回 JSON，不要其他文字"""

    SYSTEM_PROMPT_CHALLENGE = """你是一个专业的练习题生成器。根据学生的知识画像，为指定知识点生成**挑战难度**的练习题。

你的输出必须是一个 JSON 对象，type 字段必须使用英文值：
{
  "exercises": [
    {
      "type": "choice",
      "question": "题目内容",
      "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
      "answer": "B",
      "explanation": "详细解析",
      "difficulty": 85,
      "knowledge_point": "知识点"
    }
  ]
}

## 难度分布（本题为挑战难度）
- 生成 2 道高难度题（difficulty=80-90）：考察深度理解、推导能力
- 生成 1 道竞赛/面试级别题（difficulty=90-100）：考察综合应用、创新思路
- 题目设计要巧妙，干扰项要基于真实错误经验
- 考察方式：概念辨析/错例分析/多步推导/反例构造
- 只返回 JSON，不要其他文字"""

    SYSTEM_PROMPT_BASIC = """你是一个专业的练习题生成器。根据学生的知识画像，为指定知识点生成**基础入门**的练习题。

你的输出必须是一个 JSON 对象：
{
  "exercises": [
    {
      "type": "choice",
      "question": "题目内容",
      "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
      "answer": "B",
      "explanation": "详细解析",
      "difficulty": 30,
      "knowledge_point": "知识点"
    }
  ]
}

## 难度分布（本题为基础入门）
- 全部为基础题（difficulty=20-40）
- 重点考察：概念辨析、公式回忆、直接应用
- 表述要直白，避免歧义陷阱
- 只返回 JSON，不要其他文字"""

    _VARIANT_PROMPTS = {
        "mixed": SYSTEM_PROMPT_MIXED,
        "challenge": SYSTEM_PROMPT_CHALLENGE,
        "basic": SYSTEM_PROMPT_BASIC,
    }

    async def generate(
        self,
        knowledge_point: str,
        student_profile: dict | None = None,
        exercise_type: str = "all",
        count: int = 5,
        variant: str = "mixed",
    ) -> dict:
        """生成练习题

        Args:
            knowledge_point: 知识点
            student_profile: 学生画像
            exercise_type: all/choice/judge/short_answer/coding
            count: 生成数量
            variant: mixed=混合难度 / challenge=挑战难度 / basic=基础入门

        Returns:
            {exercises: [...], validation: dict}
        """
        system_prompt = self._VARIANT_PROMPTS.get(variant, self.SYSTEM_PROMPT_MIXED)
        user_prompt = self._build_prompt(knowledge_point, student_profile, exercise_type, count, variant)

        # challenge 模式需要更多 token
        max_tokens = 4096 if variant == "challenge" else 2560

        response = await get_llm_client().chat(
            messages=[{"role": "user", "content": user_prompt}],
            system=system_prompt,
            max_tokens=max_tokens,
            temperature=0.7,
        )

        result = self._parse_response(response["content"])

        # 防幻觉验证
        exercises_text = "\n".join(
            ex.get("question", "") + "\n" + ex.get("explanation", "")
            for ex in result.get("exercises", [])
        )
        if exercises_text:
            validation = await anti_hallucination.validate(
                content=exercises_text,
                knowledge_point=knowledge_point,
                skip_llm=True,
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
            exercise_type=state.get("intent_params", {}).get("exercise_type", "all"),
            count=state.get("intent_params", {}).get("exercise_count", 5),
            variant=state.get("intent_params", {}).get("variant", "mixed"),
        )

    def _build_prompt(
        self,
        knowledge_point: str,
        student_profile: dict | None,
        exercise_type: str,
        count: int,
        variant: str,
    ) -> str:
        parts = [f"请为「{knowledge_point}」生成 {count} 道练习题（variant={variant}）。"]

        if student_profile:
            dims = student_profile.get("dimensions", {})
            application = dims.get("application", {})
            if application.get("score", 50) >= 70:
                parts.append("\n学生应用能力强，可以出一些实践应用题。")

        type_map = {
            "all": "混合题型 (选择+判断+简答+编程)",
            "choice": "选择题",
            "judge": "判断题",
            "short_answer": "简答题",
            "coding": "编程题",
        }
        parts.append(f"\n题型: {type_map.get(exercise_type, '混合')}")
        parts.append(f"数量: {count} 道")
        parts.append("\n请返回 JSON 格式。只返回 JSON。")

        return "\n".join(parts)

    def _parse_response(self, content: str) -> dict:
        return parse_json_response(content, {"exercises": []})


exercise_agent = ExerciseAgent()
