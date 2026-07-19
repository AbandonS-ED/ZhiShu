"""评分Agent — 专精于评估学生答案的正确性"""

import logging
from app.services.llm_factory import get_llm_client
from app.services.json_parser import parse_json_response

logger = logging.getLogger(__name__)


class ScoringAgent:
    """评分Agent — 使用AI评估简答题答案"""

    SYSTEM_PROMPT = """你是一个专业的评分专家。你的任务是评估学生答案的正确性。

评分规则：
1. 语义匹配：不要求答案与标准答案完全一致，只要核心意思正确即可
2. 关键点检查：答案必须包含关键知识点
3. 部分正确：如果答案部分正确，给予部分分数
4. 严格但公平：不要因为表述方式不同就判错

输出格式（严格JSON）:
{
  "correct": true/false,
  "score": 0-100,
  "feedback": "详细的反馈说明",
  "key_points_found": ["学生提到的关键点1", "学生提到的关键点2"],
  "key_points_missed": ["学生遗漏的关键点1", "学生遗漏的关键点2"],
  "correct_answer": "标准答案的简洁版本"
}

要求：
- correct：答案是否基本正确（60分以上算正确）
- score：0-100的分数
- feedback：给学生的具体反馈，说明对在哪里、错在哪里
- correct_answer：如果学生答错，给出标准答案
- 只返回JSON，不要其他文字"""

    async def score(
        self,
        question: str,
        correct_answer: str,
        student_answer: str,
        knowledge_point: str = "",
    ) -> dict:
        """评估学生答案"""
        llm = get_llm_client()

        user_prompt = f"""请评估以下答案：

题目：{question}
标准答案：{correct_answer}
学生答案：{student_answer}
{f"知识点：{knowledge_point}" if knowledge_point else ""}

请严格按照JSON格式返回评分结果。"""

        messages = [
            {"role": "system", "content": self.SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt}
        ]

        try:
            response = await llm.chat(messages, max_tokens=1024, temperature=0.3)
            content = response.get("content", "")
            result = parse_json_response(content, {})

            return {
                "correct": result.get("correct", False),
                "score": result.get("score", 0),
                "feedback": result.get("feedback", "评分失败，请重试"),
                "key_points_found": result.get("key_points_found", []),
                "key_points_missed": result.get("key_points_missed", []),
                "correct_answer": result.get("correct_answer", correct_answer)
            }
        except Exception as e:
            logger.error("评分失败: %s", e)
            return {
                "correct": False,
                "score": 0,
                "feedback": f"评分服务异常: {str(e)}",
                "key_points_found": [],
                "key_points_missed": [],
                "correct_answer": correct_answer
            }

    async def score_answer(
        self,
        question: str,
        correct_answer: str,
        student_answer: str,
        knowledge_point: str = "",
    ) -> dict:
        """评估学生答案（API兼容方法）"""
        return await self.score(question, correct_answer, student_answer, knowledge_point)


scoring_agent = ScoringAgent()
