"""Path Agent — 个性化学习路径规划

根据学生画像、课程知识点和掌握情况，生成有向无环图 (DAG) 结构的学习路径。
"""

import json
from app.services import minimax_client as mc_module
from app.services.anti_hallucination import anti_hallucination


class PathAgent:
    """学习路径规划 Agent"""

    SYSTEM_PROMPT = """你是一个专业的学习路径规划师。根据学生的知识画像，为课程设计个性化的学习路径。

你的输出必须是一个 JSON 对象：
{
  "title": "学习路径标题",
  "description": "路径描述",
  "total_days": 30,
  "nodes": [
    {
      "id": "node_1",
      "label": "知识点名称",
      "type": "core/elective/review",
      "difficulty": 50,
      "estimated_hours": 4
    }
  ],
  "edges": [
    {
      "source": "node_1",
      "target": "node_2",
      "relation": "prerequisite/related"
    }
  ],
  "daily_plan": [
    {
      "day": 1,
      "topics": ["node_1"],
      "duration_hours": 2,
      "activities": ["学习基础概念", "完成练习题"]
    }
  ]
}

## 规划原则
- 先修关系必须满足（A 是 B 的前置，则 A 在 B 之前）
- 每天学习量匹配学生的 daily_hours 和 focus_duration
- 薄弱知识点安排更多时间和复习
- 先核心后扩展，先易后难
- 只返回 JSON，不要其他文字"""

    async def generate(
        self,
        course_topics: list[str],
        student_profile: dict | None = None,
        total_days: int = 30,
        daily_topics: int = 3,
    ) -> dict:
        """生成学习路径

        Args:
            course_topics: 课程所有知识点列表
            student_profile: 学生画像
            total_days: 路径总天数
            daily_topics: 每天学习的知识点数量

        Returns:
            {title, description, total_days, nodes, edges, daily_plan}
        """
        user_prompt = self._build_prompt(course_topics, student_profile, total_days, daily_topics)

        response = await mc_module.minimax_client.chat(
            messages=[{"role": "user", "content": user_prompt}],
            system=self.SYSTEM_PROMPT,
            max_tokens=8192,
            temperature=0.7,
        )

        result = self._parse_response(response["content"])

        validation = await anti_hallucination.validate(
            content=result.get("description", "") + "\n" + " ".join(n.get("label", "") for n in result.get("nodes", [])),
            skip_llm=True,
        )
        result["validation"] = {
            "passed": validation.passed,
            "issues": validation.issues,
            "confidence": validation.confidence,
        }
        return result

    async def execute(self, state: dict) -> dict:
        """从 AgentState 解包参数，调用 generate()"""
        kp = state.get("intent_params", {}).get("knowledge_point", "")
        topics = state.get("intent_params", {}).get("course_topics", ["基础知识"])
        if isinstance(topics, str):
            topics = [topics]
        if kp and kp not in topics:
            topics = [kp] + topics
        return await self.generate(
            course_topics=topics,
            student_profile=state.get("student_profile"),
            total_days=state.get("intent_params", {}).get("total_days", 14),
        )

    def _build_prompt(
        self,
        course_topics: list[str],
        student_profile: dict | None,
        total_days: int,
        daily_topics: int = 3,
    ) -> str:
        parts = [f"请为以下课程知识点设计 {total_days} 天的学习计划："]
        parts.append(f"\n知识点列表：{', '.join(course_topics)}")
        parts.append(f"共 {len(course_topics)} 个知识点")

        if student_profile:
            # 根据学生画像调整学习路径
            dims = student_profile.get("dimensions", {})

            # 专注力影响每日学习时长
            focus = dims.get("focus", {})
            focus_score = focus.get("score", 50)
            if focus_score < 50:
                parts.append("\n学生专注力一般，每天安排2-3个知识点，每个知识点学习时间不宜过长。")
            elif focus_score >= 70:
                parts.append("\n学生专注力较好，每天可以安排4-5个知识点，适当增加深度。")

            # 知识基础影响学习起点
            knowledge_base = dims.get("knowledge_base", {})
            kb_score = knowledge_base.get("score", 50)
            if kb_score < 50:
                parts.append("\n学生基础较弱，请从基础内容开始，循序渐进。")
            elif kb_score >= 70:
                parts.append("\n学生基础较好，可以跳过基础内容，直接进入进阶主题。")

            # 记忆力影响复习安排
            memory = dims.get("memory", {})
            mem_score = memory.get("score", 50)
            if mem_score < 50:
                parts.append("\n学生记忆力一般，请在路径中安排更多的复习环节。")

            # 学习目标影响路径方向
            learning_goal = dims.get("learning_goal", {})
            goal_score = learning_goal.get("score", 50)
            if goal_score < 50:
                parts.append("\n学生学习目标不明确，请在路径开头说明学习价值和应用场景。")

        parts.append(f"\n总天数: {total_days}")
        parts.append(f"每天学习 {daily_topics} 个知识点")
        parts.append("\n请返回 JSON 格式。只返回 JSON。")

        return "\n".join(parts)

    def _parse_response(self, content: str) -> dict:
        from app.services.json_parser import parse_json_response
        return parse_json_response(content, {"title": "", "nodes": [], "edges": [], "daily_plan": []})


path_agent = PathAgent()
