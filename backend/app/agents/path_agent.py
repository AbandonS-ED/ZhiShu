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
    ) -> dict:
        """生成学习路径

        Args:
            course_topics: 课程所有知识点列表
            student_profile: 学生画像
            total_days: 路径总天数

        Returns:
            {title, description, total_days, nodes, edges, daily_plan}
        """
        user_prompt = self._build_prompt(course_topics, student_profile, total_days)

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
    ) -> str:
        parts = [f"请为以下课程知识点设计 {total_days} 天的学习路径："]
        parts.append(f"\n知识点列表：{', '.join(course_topics)}")

        if student_profile:
            mastery = student_profile.get("knowledge_mastery", {})
            weak = student_profile.get("weak_topics", [])
            pace = student_profile.get("learning_pace", {})

            parts.append(f"\n学生画像：")
            parts.append(f"- 知识掌握度: {json.dumps(mastery, ensure_ascii=False)}")
            if weak:
                parts.append(f"- 薄弱点: {', '.join(weak)}")
            parts.append(f"- 每日可用时间: {pace.get('daily_hours', 2)} 小时")
            parts.append(f"- 专注时长: {pace.get('focus_duration', 45)} 分钟")

        parts.append(f"\n总天数: {total_days}")
        parts.append("\n请返回 JSON 格式。只返回 JSON。")

        return "\n".join(parts)

    def _parse_response(self, content: str) -> dict:
        from app.services.json_parser import parse_json_response
        return parse_json_response(content, {"title": "", "nodes": [], "edges": [], "daily_plan": []})


path_agent = PathAgent()
