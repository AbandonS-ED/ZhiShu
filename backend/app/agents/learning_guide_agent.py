"""学习指引Agent — 专门分析知识点，生成结构化学习指引"""

import logging
from typing import Dict, Any, Optional
from app.services.llm_factory import get_llm_client
from app.services.json_parser import parse_json_response

logger = logging.getLogger(__name__)


class LearningGuideAgent:
    """学习指引Agent — 专精于分析知识点，生成学习目标、重点难点、前置知识等"""

    SYSTEM_PROMPT = """你是一个专业的学习规划师。你的任务是为一个具体的知识点生成结构化的学习指引。

你需要：
1. 分析这个知识点的核心内容和学习价值
2. 明确列出学习后应该达到的具体目标
3. 找出关键的重点和难点，解释为什么重要
4. 说明需要哪些前置知识才能学好这个点
5. 给出合理的学习时间预估

输出格式（严格JSON）:
{
  "what_to_learn": "这个知识点的核心内容概述（2-3句话，说明要学什么、为什么重要）",
  "learning_goals": [
    "目标1：具体、可衡量的学习成果",
    "目标2：...",
    "目标3：..."
  ],
  "key_points": [
    {
      "title": "重点名称",
      "description": "为什么这是重点，学好它的关键是什么"
    }
  ],
  "prerequisites": ["前置知识1", "前置知识2"],
  "estimated_time": "X-Y小时"
}

要求：
- learning_goals：3-5个，必须具体可衡量，不要笼统的"了解xxx"
- key_points：3-5个，每个都要说明为什么重要
- prerequisites：列出真正需要的前置知识，没有就写"无特殊前置要求"
- estimated_time：根据知识点复杂度合理预估
- 只返回JSON，不要其他文字"""

    async def generate(
        self,
        knowledge_point: str,
        path_context: str = "",
        student_profile: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """生成结构化学习指引"""
        llm = get_llm_client()

        profile_info = ""
        if student_profile:
            dims = student_profile.get("dimensions", {})
            if dims:
                weak = [k for k, v in dims.items() if isinstance(v, (int, float)) and v < 50]
                if weak:
                    profile_info = f"学生薄弱领域：{', '.join(weak)}，在相关知识点上可以多加注意。"

        user_prompt = f"""请为以下知识点生成学习指引：

知识点：{knowledge_point}
{f"所属路径：{path_context}" if path_context else ""}
{profile_info}

请分析这个知识点的核心内容，输出JSON格式的学习指引。"""

        messages = [
            {"role": "system", "content": self.SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt}
        ]

        response = await llm.chat(messages, max_tokens=2048, temperature=0.6)
        content = response.get("content", "")

        result = parse_json_response(content, {})

        # 验证并补全字段
        return {
            "what_to_learn": result.get("what_to_learn", f"本节将学习{knowledge_point}的核心概念和实践应用"),
            "learning_goals": result.get("learning_goals", [
                f"理解{knowledge_point}的基本概念",
                f"掌握{knowledge_point}的核心原理",
                f"能够应用{knowledge_point}解决实际问题"
            ]),
            "key_points": result.get("key_points", [
                {"title": "核心概念", "description": f"{knowledge_point}的定义和基本原理"},
                {"title": "实践应用", "description": f"如何在实际场景中运用{knowledge_point}"}
            ]),
            "prerequisites": result.get("prerequisites", ["无特殊前置要求"]),
            "estimated_time": result.get("estimated_time", "1-2小时")
        }


learning_guide_agent = LearningGuideAgent()
