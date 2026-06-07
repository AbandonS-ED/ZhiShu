"""Master Agent — 多智能体编排器 (LangGraph StateGraph)

接收用户请求，路由到对应子 Agent，编排执行流程。
State 字段在节点间传递数据。
"""

import json
from typing import TypedDict, Annotated, Literal
from app.services import minimax_client as mc_module
from app.agents.profile_agent import profile_agent
from app.agents.document_agent import document_agent
from app.agents.exercise_agent import exercise_agent
from app.agents.path_agent import path_agent
from app.agents.tutor_agent import tutor_agent


class MasterState(TypedDict):
    """Master Agent 的状态定义"""
    request_type: str  # profile/document/exercise/path/tutor/chat
    student_id: str
    messages: list[dict]  # 对话历史
    student_profile: dict | None
    knowledge_point: str | None
    course_topics: list[str] | None
    context_chunks: list[dict] | None
    result: dict | None
    error: str | None


class MasterAgent:
    """多智能体编排器"""

    ROUTER_PROMPT = """你是一个请求路由器。根据用户的消息，判断应该调用哪个 Agent。

可选 Agent:
- profile: 了解学生学习情况、构建画像（关键词：了解、画像、分析、评估、学习情况）
- document: 生成知识讲解、代码示例（关键词：讲解、生成、学习材料、知识）
- exercise: 生成练习题（关键词：练习、题目、测试、考核）
- path: 规划学习路径（关键词：路径、规划、计划、学习安排）
- tutor: 回答学习问题（关键词：为什么、怎么、是什么、解释、问题）
- chat: 普通对话

返回 JSON: {"agent": "agent_name", "knowledge_point": "提取到的知识点或null"}

只返回 JSON。"""

    async def route(self, state: MasterState) -> MasterState:
        """路由请求到对应 Agent"""
        messages = state.get("messages", [])
        if not messages:
            state["error"] = "没有消息内容"
            return state

        last_msg = messages[-1].get("content", "")

        # 用 LLM 路由
        response = await mc_module.minimax_client.chat(
            messages=[{"role": "user", "content": f"用户消息: {last_msg}"}],
            system=self.ROUTER_PROMPT,
            max_tokens=256,
            temperature=0.1,
        )

        route_info = self._parse_route(response["content"])
        state["request_type"] = route_info.get("agent", "chat")
        if route_info.get("knowledge_point"):
            state["knowledge_point"] = route_info["knowledge_point"]

        return state

    async def execute(self, state: MasterState) -> MasterState:
        """根据路由结果执行对应 Agent"""
        request_type = state.get("request_type", "chat")

        try:
            if request_type == "profile":
                result = await profile_agent.analyze(
                    messages=state["messages"],
                    current_profile=state.get("student_profile"),
                )
                state["result"] = {"type": "profile", "data": result}

            elif request_type == "document":
                kp = state.get("knowledge_point", "通用知识")
                result = await document_agent.generate(
                    knowledge_point=kp,
                    student_profile=state.get("student_profile"),
                )
                state["result"] = {"type": "document", "data": result}

            elif request_type == "exercise":
                kp = state.get("knowledge_point", "通用知识")
                result = await exercise_agent.generate(
                    knowledge_point=kp,
                    student_profile=state.get("student_profile"),
                )
                state["result"] = {"type": "exercise", "data": result}

            elif request_type == "path":
                topics = state.get("course_topics", ["基础知识"])
                result = await path_agent.generate(
                    course_topics=topics,
                    student_profile=state.get("student_profile"),
                )
                state["result"] = {"type": "path", "data": result}

            elif request_type == "tutor":
                last_msg = state["messages"][-1].get("content", "")
                result = await tutor_agent.answer(
                    question=last_msg,
                    context_chunks=state.get("context_chunks"),
                    student_profile=state.get("student_profile"),
                )
                state["result"] = {"type": "tutor", "data": result}

            else:
                # 普通对话，直接回复
                response = await mc_module.minimax_client.chat(
                    messages=state["messages"],
                    system="你是一个友好的 AI 学习助手。用简洁清晰的中文回答。",
                    max_tokens=1024,
                    temperature=0.7,
                )
                state["result"] = {"type": "chat", "data": {"answer": response["content"]}}

        except Exception as e:
            state["error"] = str(e)

        return state

    async def run(self, state: MasterState) -> MasterState:
        """完整执行流程：路由 → 执行"""
        state = await self.route(state)
        state = await self.execute(state)
        return state

    def _parse_route(self, content: str) -> dict:
        try:
            return json.loads(content)
        except json.JSONDecodeError:
            pass

        for marker in ["```json", "```"]:
            if marker in content:
                start = content.index(marker) + len(marker)
                end = content.index("```", start)
                try:
                    return json.loads(content[start:end].strip())
                except (json.JSONDecodeError, ValueError):
                    continue

        start = content.find("{")
        end = content.rfind("}") + 1
        if start != -1 and end > start:
            try:
                return json.loads(content[start:end])
            except json.JSONDecodeError:
                pass

        return {"agent": "chat"}


master_agent = MasterAgent()
