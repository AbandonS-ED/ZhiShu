"""Coordinator Agent — 多 Agent 协同编排器

职责：
1. 接收知识点和学习阶段，判断复杂度
2. 并行分发任务给专门的子 Agent
3. 汇总结果，过滤重复
4. 支持拓展：深化讲解、追问、多版本生成
"""

import asyncio
import json
import logging
from typing import Any

from app.services.llm_factory import get_llm_client
from app.services.anti_hallucination import anti_hallucination

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# 任务清单结构
# ─────────────────────────────────────────────────────────────────────────────

class AgentTask:
    """单个 Agent 任务"""
    def __init__(
        self,
        agent: str,          # "explanation" | "code" | "mindmap" | "exercise" | "audio"
        variant: str = "default",
        priority: int = 0,
    ):
        self.agent = agent
        self.variant = variant
        self.priority = priority

    def to_dict(self) -> dict:
        return {"agent": self.agent, "variant": self.variant, "priority": self.priority}


# ─────────────────────────────────────────────────────────────────────────────
# Coordinator Agent
# ─────────────────────────────────────────────────────────────────────────────

class CoordinatorAgent:
    """多 Agent 协同编排器"""

    SYSTEM_PROMPT = """你是一个学习资源编排专家。你的任务是根据学生的需求，决定如何生成最合适的学习资源。

## 你的能力
你负责协调以下专门 Agent：
- explanation_agent：生成知识点讲解（variant: deep=深度讲解 / concise=简洁速记）
- code_agent：生成代码示例（variant: basic=基础实现 / multi_impl=多实现对比）
- mindmap_agent：生成思维导图（variant: concept_map=概念图 / relation_graph=关系图）
- exercise_agent：生成练习题（variant: mixed=混合难度 / challenge=挑战难度）
- audio_agent：生成音频讲解稿（variant: standard=2分钟精讲 / concise=30秒极简）

## 判断逻辑
1. 知识点复杂度（根据名称判断）：
   - 包含"基础"/"入门"/"简介" → complexity=low，只生成简洁版
   - 包含"优化"/"原理"/"推导"/"证明" → complexity=high，生成深度版
   - 其他常见概念 → complexity=medium，混合生成

2. 学习阶段影响资源优先级：
   - learn（学习）阶段：explanation + mindmap + code 优先，audio 次之，exercise 放后面
   - practice（练习）阶段：exercise 最高优先级
   - review（复习）阶段：concise 版资源优先

3. 输出要求：
   你只返回一个 JSON 对象，不需要生成实际内容：
   {
     "complexity": "low" | "medium" | "high",
     "tasks": [
       {"agent": "explanation", "variant": "deep" | "concise", "priority": 1-5},
       {"agent": "code", "variant": "basic" | "multi_impl", "priority": 1-5},
       ...
     ],
     "focus_points": ["重点关注点1", "重点关注点2"],
     "estimated_time": "预估秒数"
   }

请直接返回 JSON，不要额外的解释文字。"""

    # 不同阶段优先级的默认值
    DEFAULT_TASKS = {
        "learn": [
            AgentTask("explanation", "deep", priority=1),
            AgentTask("mindmap", "concept_map", priority=2),
            AgentTask("code", "basic", priority=3),
            AgentTask("audio", "standard", priority=4),
            AgentTask("exercise", "mixed", priority=5),
        ],
        "practice": [
            AgentTask("exercise", "mixed", priority=1),
            AgentTask("explanation", "concise", priority=2),
            AgentTask("code", "basic", priority=3),
        ],
        "review": [
            AgentTask("explanation", "concise", priority=1),
            AgentTask("mindmap", "concept_map", priority=2),
            AgentTask("exercise", "challenge", priority=3),
            AgentTask("code", "multi_impl", priority=4),
        ],
    }

    async def plan(self, knowledge_point: str, phase: str = "learn") -> dict:
        """制定生成计划

        Args:
            knowledge_point: 知识点名称
            phase: learn | practice | review

        Returns:
            {
              "complexity": str,
              "tasks": [AgentTask, ...],
              "focus_points": [str, ...],
              "estimated_time": str
            }
        """
        user_prompt = (
            f"知识点：「{knowledge_point}」\n"
            f"学习阶段：{phase}\n\n"
            f"请分析并返回生成计划 JSON。"
        )

        try:
            response = await get_llm_client().chat(
                messages=[{"role": "user", "content": user_prompt}],
                system=self.SYSTEM_PROMPT,
                max_tokens=1024,
                temperature=0.3,
            )
            plan_data = self._parse_plan_response(response["content"])
            # 验证格式
            if "tasks" in plan_data and isinstance(plan_data["tasks"], list):
                tasks = [AgentTask(**t) for t in plan_data["tasks"]]
                return {
                    "complexity": plan_data.get("complexity", "medium"),
                    "tasks": tasks,
                    "focus_points": plan_data.get("focus_points", []),
                    "estimated_time": plan_data.get("estimated_time", "30s"),
                }
        except Exception as e:
            logger.warning(f"[Coordinator] 计划生成失败，使用默认计划: {e}")

        # 降级：使用默认计划
        default_task_list = self.DEFAULT_TASKS.get(phase, self.DEFAULT_TASKS["learn"])
        return {
            "complexity": "medium",
            "tasks": default_task_list,
            "focus_points": [],
            "estimated_time": "30s",
        }

    def _parse_plan_response(self, content: str) -> dict:
        """解析 LLM 返回的计划 JSON"""
        content = content.strip()
        # 去掉可能的 markdown 包裹
        if content.startswith("```"):
            lines = content.split("\n")
            content = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
        try:
            return json.loads(content)
        except json.JSONDecodeError:
            import re
            m = re.search(r"\{.*\}", content, re.DOTALL)
            if m:
                try:
                    return json.loads(m.group(0))
                except json.JSONDecodeError:
                    pass
            return {}


# ─────────────────────────────────────────────────────────────────────────────
# 单例
# ─────────────────────────────────────────────────────────────────────────────

coordinator_agent = CoordinatorAgent()
