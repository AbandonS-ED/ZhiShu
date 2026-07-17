"""Wrong Question Agent — 错题分析 4 步思考链

Step 1: 错因分类（5 类）
Step 2: 根据错因决定讲解策略 + 生成讲解
Step 3: 根据错因生成针对性同类题
Step 4: 反思同类题是否真的能考察该错因
"""

import logging
from typing import AsyncGenerator

from app.services.llm_factory import get_llm_client
from app.services.json_parser import parse_json_response

logger = logging.getLogger(__name__)

ERROR_TYPE_LABELS = {
    "calculation": "计算失误",
    "concept": "概念理解不清",
    "reading": "审题错误",
    "carelessness": "粗心大意",
    "unknown": "其他",
}

STRATEGY_MAP = {
    "calculation": "show_step_by_step",
    "concept": "use_analogy",
    "reading": "highlight_keywords",
    "carelessness": "warn_common_traps",
    "unknown": "general_review",
}

STRATEGY_DESC = {
    "show_step_by_step": "请逐步展示正确解题过程，每步标号，并对比学生的错误步骤，指出哪一步算错了。",
    "use_analogy": "请用一个生活类比或具体例子解释这个概念，再回到原题分析。",
    "highlight_keywords": "请圈出题目中的关键限制条件和关键词，对比学生漏看或误解的部分。",
    "warn_common_traps": "请列出此类题的 3 个常见易错点和陷阱，警示学生下次注意。",
    "general_review": "请给出清晰完整的解题思路和正确答案。",
}


def _format_options(options) -> str:
    if not options:
        return ""
    if isinstance(options, list):
        return "\n".join(f"{chr(65 + i)}. {opt}" for i, opt in enumerate(options))
    return str(options)


class WrongQuestionAgent:
    """错题分析 Agent — 4 步思考链"""

    async def analyze(
        self,
        question: str,
        options: list[str] | None,
        answer: str,
        wrong_answer: str,
        knowledge_point: str = "",
        difficulty: int = 50,
        exercise_type: str = "unknown",
    ) -> AsyncGenerator[dict, None]:
        """主流程：4 步思考链，逐步 yield 事件

        Yields:
            {"event": "thinking", "step": int, "text": str}
            {"event": "analysis", "data": {...}}
            {"event": "similar", "data": [...]}
            {"event": "done"}
            {"event": "error", "message": str}
        """
        # Step 1: 错因分类
        yield {"event": "thinking", "step": 1, "text": "分析错误类型..."}
        error_type_data = await self._classify_error(question, options, answer, wrong_answer, knowledge_point)
        error_type = error_type_data.get("error_type", "unknown")
        error_analysis = error_type_data.get("error_analysis", "无法确定具体错误原因")

        # Step 2: 选择策略 + 生成讲解
        strategy = STRATEGY_MAP.get(error_type, "general_review")
        strategy_text = f"识别为「{ERROR_TYPE_LABELS.get(error_type, '其他')}」，采用 {strategy} 策略"
        yield {"event": "thinking", "step": 2, "text": strategy_text}

        explanation_data = await self._generate_explanation(
            question, options, answer, wrong_answer,
            knowledge_point, error_type, strategy, error_analysis,
        )
        ai_explanation = explanation_data.get("ai_explanation", "")

        # Step 3: 生成针对性同类题
        yield {"event": "thinking", "step": 3, "text": f"根据错因「{ERROR_TYPE_LABELS.get(error_type, '其他')}」生成针对性同类题..."}
        similar = await self._generate_similar(
            question, options, answer, knowledge_point,
            difficulty, exercise_type, error_type,
        )

        # Step 4: 反思同类题质量，不合格则重生成一次
        yield {"event": "thinking", "step": 4, "text": "反思同类题质量..."}
        similar, qualified = await self._reflect(question, answer, knowledge_point, error_type, similar)
        if not qualified and similar:
            yield {"event": "thinking", "step": 5, "text": "同类题未能针对性考察该错因，重新生成..."}
            similar = await self._generate_similar(
                question, options, answer, knowledge_point,
                difficulty, exercise_type, error_type,
            )

        # 输出最终结果
        yield {
            "event": "analysis",
            "data": {
                "error_type": error_type,
                "error_analysis": error_analysis,
                "ai_explanation": ai_explanation,
            },
        }
        yield {"event": "similar", "data": similar}
        yield {"event": "done"}

    async def _classify_error(
        self, question: str, options, answer: str,
        wrong_answer: str, knowledge_point: str,
    ) -> dict:
        """Step 1: 5 类错误分类"""
        options_text = _format_options(options)
        prompt = f"""分析以下错题的错误原因：

题目：{question}
选项：
{options_text}
正确答案：{answer}
学生答案：{wrong_answer}
知识点：{knowledge_point or '通用知识'}

请按以下 JSON 格式输出（不要使用 markdown 代码块包裹）：
{{
  "error_type": "calculation|concept|reading|carelessness|unknown",
  "error_analysis": "简要分析错误原因（30-50字）"
}}

error_type 说明：
- calculation: 计算失误（公式用错、计算过程出错）
- concept: 概念理解不清（对核心概念理解有偏差）
- reading: 审题错误（漏看条件、理解错题意）
- carelessness: 粗心大意（会做但不小心选错/写错）
- unknown: 其他或无法确定
"""
        try:
            response = await get_llm_client().chat(
                messages=[{"role": "user", "content": prompt}],
                system="你是一位严谨的 AI 教师，请用 JSON 格式输出错因分析。",
                max_tokens=500,
                temperature=0.3,
            )
            content = response.get("content", "")
            return parse_json_response(content, fallback={
                "error_type": "unknown",
                "error_analysis": "AI 分析暂时不可用",
            })
        except Exception as e:
            logger.error("错因分类失败: %s", e)
            return {"error_type": "unknown", "error_analysis": "AI 分析暂时不可用"}

    async def _generate_explanation(
        self, question: str, options, answer: str,
        wrong_answer: str, knowledge_point: str,
        error_type: str, strategy: str, error_analysis: str,
    ) -> dict:
        """Step 2: 根据策略生成针对性讲解"""
        strategy_instruction = STRATEGY_DESC.get(strategy, STRATEGY_DESC["general_review"])
        options_text = _format_options(options)

        prompt = f"""请为学生讲解这道错题：

题目：{question}
选项：
{options_text}
正确答案：{answer}
学生答案：{wrong_answer}
知识点：{knowledge_point or '通用知识'}
错因：{ERROR_TYPE_LABELS.get(error_type, '其他')}
错因分析：{error_analysis}

讲解策略：{strategy_instruction}

请按以下 JSON 格式输出（200 字内，不要使用 markdown 代码块）：
{{
  "ai_explanation": "详细讲解内容"
}}
"""
        try:
            response = await get_llm_client().chat(
                messages=[{"role": "user", "content": prompt}],
                system="你是一位耐心细致的 AI 教师，请根据学生的具体错因进行针对性讲解。",
                max_tokens=1000,
                temperature=0.5,
            )
            content = response.get("content", "")
            return parse_json_response(content, fallback={"ai_explanation": content[:500] if content else ""})
        except Exception as e:
            logger.error("生成讲解失败: %s", e)
            return {"ai_explanation": "AI 讲解暂时不可用"}

    async def _generate_similar(
        self, question: str, options, answer: str,
        knowledge_point: str, difficulty: int,
        exercise_type: str, error_type: str,
    ) -> list:
        """Step 3: 根据错因生成针对性同类题"""
        options_text = ""
        if options and isinstance(options, list):
            options_text = "选项格式：" + "; ".join(
                f"{chr(65 + i)}.{opt[:40]}" for i, opt in enumerate(options)
            )

        error_instruction = self._get_similar_instruction(error_type)
        prompt = f"""基于以下错题，生成 3 道针对性同类练习题：

原题：{question}
正确答案：{answer}
题目类型：{exercise_type}
难度：{difficulty}
知识点：{knowledge_point or '通用知识'}
{options_text}
学生错因：{ERROR_TYPE_LABELS.get(error_type, '其他')}

{error_instruction}

请按以下 JSON 格式输出（直接 JSON，不要 markdown 代码块）：
{{
  "exercises": [
    {{
      "type": "{exercise_type}",
      "question": "题目内容",
      "options": ["A选项", "B选项", "C选项", "D选项"],
      "answer": "B",
      "explanation": "解题思路",
      "difficulty": {difficulty}
    }}
  ]
}}

注意：如果原题是选择题，输出选择题；如果原题是填空题，输出填空题。
"""
        try:
            response = await get_llm_client().chat(
                messages=[{"role": "user", "content": prompt}],
                system="你是一位严谨的 AI 教师，请根据学生的具体错因生成针对性同类练习题。",
                max_tokens=2500,
                temperature=0.7,
            )
            content = response.get("content", "")
            parsed = parse_json_response(content, fallback={"exercises": []})
            return parsed.get("exercises", [])[:3]
        except Exception as e:
            logger.error("生成同类题失败: %s", e)
            return []

    def _get_similar_instruction(self, error_type: str) -> str:
        """根据错因返回同类题生成指令"""
        instructions = {
            "calculation": (
                "【针对性要求】学生这道题是计算失误，所以同类题要：\n"
                "1. 使用相同的公式和概念\n"
                "2. 换不同的数字和参数\n"
                "3. 数字要简单一些，降低计算负担\n"
                "4. 重点考察学生对公式的理解和应用"
            ),
            "concept": (
                "【针对性要求】学生这道题是概念理解不清，所以同类题要：\n"
                "1. 考察相同的核心概念\n"
                "2. 变换情境和表述方式\n"
                "3. 设计 1-2 个有迷惑性的干扰项\n"
                "4. 从不同角度测试概念理解"
            ),
            "reading": (
                "【针对性要求】学生这道题是审题错误，所以同类题要：\n"
                "1. 题型和原题类似\n"
                "2. 增加 1-2 个关键限制条件\n"
                "3. 选项中的数字/条件要仔细对比才能区分\n"
                "4. 考验学生仔细审题的能力"
            ),
            "carelessness": (
                "【针对性要求】学生这道题是粗心大意，所以同类题要：\n"
                "1. 知识点和原题相同\n"
                "2. 设置 1-2 个常见陷阱选项（如近似的数字、易混概念）\n"
                "3. 让学生必须仔细计算或对比才能答对\n"
                "4. 提醒学生注意易错点"
            ),
        }
        return instructions.get(error_type, (
            "1. 相同知识点、相近难度\n"
            "2. 不同的具体情境和数字\n"
            "3. 干扰项设计合理"
        ))

    async def _reflect(self, question: str, answer: str, knowledge_point: str, error_type: str, similar: list) -> tuple[list, bool]:
        """Step 4: 反思同类题是否真的能考察该错因

        Returns:
            (similar_list, qualified) — qualified=False 时调用方应重新生成
        """
        if not similar:
            return similar, True

        similar_text = "\n".join(
            f"第{i + 1}题：{ex.get('question', '')[:80]} 答案：{ex.get('answer', '')}"
            for i, ex in enumerate(similar)
        )

        prompt = f"""检查以下同类题是否合格：

原题（完整）：{question[:200]}
原题答案：{answer}
知识点：{knowledge_point or '通用知识'}
学生错因：{ERROR_TYPE_LABELS.get(error_type, '其他')}
错因说明：
- calculation: 计算失误
- concept: 概念理解不清
- reading: 审题错误
- carelessness: 粗心大意

生成的同类题：
{similar_text}

请判断：这些同类题是否真的能让学生暴露该错因、从而检验学生是否已改正？
如果合格：{{"qualified": true, "reason": "合格原因（一句话）"}}
如果不合格：{{"qualified": false, "reason": "为什么不合适（一句话）"}}

只返回 JSON，不要其他文字。
"""
        try:
            response = await get_llm_client().chat(
                messages=[{"role": "user", "content": prompt}],
                system="你是一位严格的出题教师，负责检查同类题是否针对错因设计。",
                max_tokens=500,
                temperature=0.3,
            )
            content = response.get("content", "")
            result = parse_json_response(content, fallback={"qualified": True})
            qualified = result.get("qualified", True)
            if not qualified:
                logger.warning("同类题反思不合格: %s", result.get("reason", ""))
            return similar, qualified
        except Exception as e:
            logger.error("反思步骤失败: %s，直接接受同类题", e)
            return similar, True


    async def classify_error_only(
        self,
        question: str,
        options: list[str] | None,
        answer: str,
        wrong_answer: str,
        knowledge_point: str = "",
    ) -> dict:
        """轻量错因分类（仅 step 1），用于入库时自动调用

        Returns:
            {"error_type": str, "error_analysis": str}
        """
        return await self._classify_error(question, options, answer, wrong_answer, knowledge_point)


wrong_question_agent = WrongQuestionAgent()
