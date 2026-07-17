"""Scoring Agent — AI 智能评分

专门用于评估简答题、论述题等主观题目的答案。
通过语义分析判断答案的正确性，返回分数和反馈。
"""

import json
import logging
from app.services.llm_factory import get_llm_client

logger = logging.getLogger(__name__)


class ScoringAgent:
    """AI 智能评分 Agent"""

    SYSTEM_PROMPT = """你是一位专业的评分专家。你的任务是评估学生答案的正确性。

## 评分标准
1. **完全正确** (90-100分): 答案核心概念完整，表述准确，逻辑清晰
2. **基本正确** (70-89分): 答案包含主要概念，但表述不够完整或精确
3. **部分正确** (50-69分): 答案包含部分正确概念，但有明显遗漏或错误
4. **基本错误** (30-49分): 答案大部分错误，但包含少量正确内容
5. **完全错误** (0-29分): 答案完全错误或无关

## 评估维度
- **概念准确性**: 核心概念是否正确
- **完整性**: 是否涵盖关键要点
- **逻辑性**: 表述是否逻辑清晰
- **相关性**: 是否切题

## 输出格式（严格JSON）
{
  "score": 85,
  "correct": true,
  "feedback": "详细反馈，说明答案的优点和不足",
  "key_points_covered": ["已涵盖的要点1", "已涵盖的要点2"],
  "key_points_missing": ["缺失的要点1", "缺失的要点2"],
  "suggestion": "改进建议"
}

## 注意事项
- 只返回JSON，不要其他文字
- 评分要客观公正，基于语义理解而非字面匹配
- 考虑答案的同义表达和不同表述方式
- 给出具体、有建设性的反馈"""

    async def score_answer(
        self,
        question: str,
        correct_answer: str,
        student_answer: str,
        knowledge_point: str = "",
    ) -> dict:
        """评估学生答案
        
        Args:
            question: 题目内容
            correct_answer: 参考答案
            student_answer: 学生答案
            knowledge_point: 知识点（可选）
            
        Returns:
            评分结果字典
        """
        try:
            # 构建用户提示
            user_prompt = f"""请评估以下学生答案的正确性。

## 题目
{question}

## 参考答案
{correct_answer}

## 学生答案
{student_answer}"""

            if knowledge_point:
                user_prompt += f"\n\n## 知识点\n{knowledge_point}"

            user_prompt += "\n\n请根据评分标准进行评估，返回JSON格式的评分结果。"

            messages = [{"role": "user", "content": user_prompt}]

            # 调用LLM进行评分
            response = await get_llm_client().chat(
                messages=messages,
                system=self.SYSTEM_PROMPT,
                max_tokens=1024,
                temperature=0.3,  # 低温度确保评分稳定性
            )

            # 解析响应
            result = self._parse_response(response["content"])
            
            # 验证和规范化结果
            return self._validate_result(result)

        except Exception as e:
            logger.error("AI评分失败: %s", e)
            # 降级到基础评分
            return self._fallback_score(correct_answer, student_answer)

    def _parse_response(self, content: str) -> dict:
        """解析LLM响应"""
        try:
            # 尝试提取JSON
            json_start = content.find("{")
            json_end = content.rfind("}") + 1
            if json_start >= 0 and json_end > json_start:
                json_str = content[json_start:json_end]
                return json.loads(json_str)
        except json.JSONDecodeError as e:
            logger.warning("JSON解析失败: %s", e)
        
        return {}

    def _validate_result(self, result: dict) -> dict:
        """验证和规范化评分结果"""
        # 确保必要的字段存在
        score = result.get("score", 0)
        if not isinstance(score, (int, float)):
            score = 0
        score = max(0, min(100, int(score)))  # 限制在0-100之间

        correct = result.get("correct", score >= 60)
        if not isinstance(correct, bool):
            correct = score >= 60

        return {
            "score": score,
            "correct": correct,
            "feedback": str(result.get("feedback", "")),
            "key_points_covered": result.get("key_points_covered", []),
            "key_points_missing": result.get("key_points_missing", []),
            "suggestion": str(result.get("suggestion", "")),
        }

    def _fallback_score(self, correct_answer: str, student_answer: str) -> dict:
        """降级评分逻辑（当AI评分失败时使用）"""
        # 简单的关键词匹配
        correct_keywords = set(correct_answer.lower().split())
        student_keywords = set(student_answer.lower().split())
        
        if not correct_keywords:
            return {
                "score": 50,
                "correct": False,
                "feedback": "无法评估答案，参考答案为空",
                "key_points_covered": [],
                "key_points_missing": [],
                "suggestion": "请提供更详细的答案",
            }

        # 计算关键词匹配率
        overlap = len(correct_keywords.intersection(student_keywords))
        match_ratio = overlap / len(correct_keywords)
        
        # 根据匹配率评分
        if match_ratio >= 0.8:
            score = 90
        elif match_ratio >= 0.6:
            score = 75
        elif match_ratio >= 0.4:
            score = 60
        elif match_ratio >= 0.2:
            score = 40
        else:
            score = 20

        return {
            "score": score,
            "correct": score >= 60,
            "feedback": f"基于关键词匹配评估，匹配度: {match_ratio:.1%}",
            "key_points_covered": [],
            "key_points_missing": [],
            "suggestion": "建议更全面地回答问题",
        }


# 创建全局实例
scoring_agent = ScoringAgent()