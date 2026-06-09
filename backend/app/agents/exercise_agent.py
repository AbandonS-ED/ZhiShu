"""Exercise Agent — 自适应练习题生成

根据学生画像和知识薄弱点，生成不同类型的练习题：
- choice: 选择题
- judge: 判断题
- short_answer: 简答题
- coding: 编程题

包含防幻觉验证（N3 评分项）。
"""

from app.services import minimax_client as mc_module
from app.services.anti_hallucination import anti_hallucination
from app.services.json_parser import parse_json_response


class ExerciseAgent:
    """自适应练习题生成 Agent"""

    SYSTEM_PROMPT = """你是一个专业的练习题生成器。根据学生的知识画像，为指定知识点生成个性化的练习题。

你的输出必须是一个 JSON 对象：
{
  "exercises": [
    {
      "type": "choice/judge/short_answer/coding",
      "question": "题目内容",
      "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
      "answer": "正确答案",
      "explanation": "详细解析",
      "difficulty": 50,
      "knowledge_point": "知识点"
    }
  ]
}

## 生成规则
- 根据学生的薄弱点重点出题
- 难度要匹配学生的当前水平
- 选择题 4 个选项，干扰项要有迷惑性
- 编程题要包含完整的题目描述和示例
- 每个知识点生成 3-5 道题
- 只返回 JSON，不要其他文字"""

    async def generate(
        self,
        knowledge_point: str,
        student_profile: dict | None = None,
        exercise_type: str = "all",
        count: int = 5,
    ) -> dict:
        """生成练习题

        Args:
            knowledge_point: 知识点
            student_profile: 学生画像
            exercise_type: all/choice/judge/short_answer/coding
            count: 生成数量

        Returns:
            {exercises: [...], validation: dict}
        """
        user_prompt = self._build_prompt(knowledge_point, student_profile, exercise_type, count)

        response = await mc_module.minimax_client.chat(
            messages=[{"role": "user", "content": user_prompt}],
            system=self.SYSTEM_PROMPT,
            max_tokens=4096,
            temperature=0.7,
        )

        result = self._parse_response(response["content"])

        # 防幻觉验证（检查题目内容）
        exercises_text = "\n".join(
            ex.get("question", "") + "\n" + ex.get("explanation", "")
            for ex in result.get("exercises", [])
        )
        if exercises_text:
            validation = await anti_hallucination.validate(
                content=exercises_text,
                knowledge_point=knowledge_point,
                skip_llm=True,  # 练习题跳过 LLM 校验
            )
            result["validation"] = {
                "passed": validation.passed,
                "issues": validation.issues,
                "confidence": validation.confidence,
            }

        return result

    def _build_prompt(
        self,
        knowledge_point: str,
        student_profile: dict | None,
        exercise_type: str,
        count: int,
    ) -> str:
        parts = [f"请为「{knowledge_point}」生成 {count} 道练习题。"]

        if student_profile:
            mastery = student_profile.get("knowledge_mastery", {})
            weak = student_profile.get("weak_topics", [])
            score = mastery.get(knowledge_point, 50)

            parts.append(f"\n学生画像：")
            parts.append(f"- 知识掌握度: {score}/100")
            if knowledge_point in weak:
                parts.append("- 该知识点是学生的薄弱点，请重点练习")
            if score < 30:
                parts.append("- 难度偏基础，侧重概念理解")
            elif score < 60:
                parts.append("- 难度适中，概念+应用并重")
            else:
                parts.append("- 难度可偏高，侧重综合应用")

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
