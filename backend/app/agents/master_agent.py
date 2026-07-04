"""Master Agent — 多智能体编排器 (LangGraph StateGraph)

基于 LangGraph StateGraph 实现真多智能体协同：
意图识别 → 任务规划 → 条件路由 → Agent执行 → 结果聚合 → 响应生成

兼容旧的 route()/execute() 接口（chat.py Phase 4 改造前使用）。
"""

import re
import uuid
import json
import time
from typing import Any
from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver

from app.agents.state import AgentState, default_state, IntentType
from app.agents.communicator import message_bus, MessageType
from app.services.llm_factory import get_llm_client
from app.services.json_parser import parse_json_response
from app.core.agent_metrics import agent_metrics

# 子 Agent 导入
from app.agents.document_agent import document_agent
from app.agents.exercise_agent import exercise_agent
from app.agents.path_agent import path_agent
from app.agents.tutor_agent import tutor_agent
from app.agents.mindmap_agent import mindmap_agent
from app.agents.audio_agent import audio_agent


# ====================================================================
# 意图识别 Prompt
# ====================================================================

INTENT_PROMPT = """你是一个学习平台的意图识别助手。根据用户消息判断意图，返回 JSON。

意图类型:
- profile: 构建/更新学习画像（如：了解我的学习情况、分析画像）
- document: 生成知识讲解/学习材料（如：讲解xx、生成学习材料）
- exercise: 生成练习题（如：出题、练习、测试）
- path: 规划学习路径（如：学习计划、路径规划）
- tutor: 回答学习问题（如：什么是xx、为什么xx、怎么理解xx）
- mindmap: 生成思维导图（如：画思维导图、知识结构图）
- audio: 生成音频讲解（如：音频讲解、语音讲解）
- learn_and_practice: 学习+练习（如：讲解xx并出几道题）
- full_course: 完整课程规划（如：帮我制定完整学习计划）
- multi_chat: 一般闲聊

返回格式:
{
  "intent": "意图类型",
  "confidence": 0.95,
  "params": {
    "knowledge_point": "提取的知识点（如有）",
    "resource_type": "all",
    "exercise_count": 5,
    "total_days": 14
  }
}

只返回 JSON。"""


# ====================================================================
# 关键词快速路由（性能优化，避免每次都调 LLM）
# ====================================================================

_QUICK_ROUTE_MAP = {
    "tutor": ["为什么", "怎么", "是什么", "什么是", "原理", "区别", "对比", "比较", " vs ", "vs"],
    "profile": ["画像", "分析我的", "了解我", "学习情况"],
    "mindmap": ["思维导图", "脑图", "知识结构", "导图", "结构图"],
    "exercise": ["练习", "题目", "出题", "测试", "考核", "做题"],
    "path": ["路径", "规划", "计划", "学习安排", "路线"],
    "document": ["教程", "学习材料", "讲解", "解释", "介绍一下", "说明"],
    "audio": ["音频", "语音讲解"],
}

# 复合意图关键词（需要多 Agent 协同）
_COMPOUND_ROUTE_MAP = {
    "learn_and_practice": ["讲解.*并.*出", "学习.*练习", "讲解.*练习题"],
    "full_course": ["完整学习计划", "整体学习", "全套规划"],
}


def _quick_route(msg: str) -> str | None:
    """关键词快速路由，返回 intent 名或 None"""
    msg_lower = msg.lower()

    # 复合意图优先（必须在单一意图之前）
    for intent, patterns in _COMPOUND_ROUTE_MAP.items():
        for pattern in patterns:
            if re.search(pattern, msg_lower):
                return intent

    # 单一意图（tutor 的关键词需要排除已匹配复合意图的情况）
    # tutor 关键词较宽泛，放最后检查
    non_tutor_intents = ["profile", "mindmap", "exercise", "path", "document", "audio"]
    for intent in non_tutor_intents:
        keywords = _QUICK_ROUTE_MAP.get(intent, [])
        if any(w in msg_lower for w in keywords):
            return intent

    # tutor 最后检查（避免"讲解...并出题"被误判为 tutor）
    tutor_keywords = _QUICK_ROUTE_MAP.get("tutor", [])
    if any(w in msg_lower for w in tutor_keywords):
        return "tutor"

    return None


def _extract_intent_params(msg: str) -> dict:
    """从用户消息中提取意图参数"""
    kp = msg.strip()
    # 去掉常见前缀
    kp = re.sub(r"^(请|帮我|帮忙|给我想?|给我)?(讲解|解释|说明|介绍|生成|出|写|做|画|规划)?(一下|个|份)?\s*", "", kp)
    # 去掉尾部修饰
    kp = re.sub(r"(的原理|的代码|的练习|的思维导图|的学习路径|相关内容|相关知识)?\s*$", "", kp)
    kp = kp.strip()
    if len(kp) < 2:
        kp = msg[:50]
    return {"knowledge_point": kp}


# ====================================================================
# 任务模板
# ====================================================================

TASK_TEMPLATES: dict[str, list[dict[str, Any]]] = {
    "profile": [],
    "document": [
        {"agent": "document_agent", "action": "generate", "priority": "high", "status": "pending"}
    ],
    "exercise": [
        {"agent": "exercise_agent", "action": "generate", "priority": "high", "status": "pending"}
    ],
    "path": [
        {"agent": "path_agent", "action": "generate", "priority": "high", "status": "pending"}
    ],
    "tutor": [
        {"agent": "tutor_agent", "action": "answer", "priority": "high", "status": "pending"}
    ],
    "mindmap": [
        {"agent": "mindmap_agent", "action": "generate", "priority": "high", "status": "pending"}
    ],
    "audio": [
        {"agent": "audio_agent", "action": "generate", "priority": "high", "status": "pending"}
    ],
    # ⭐ 真协同：多 Agent 串行执行
    "learn_and_practice": [
        {"agent": "document_agent", "action": "generate", "priority": "high", "status": "pending"},
        {"agent": "exercise_agent", "action": "generate", "priority": "high", "status": "pending"},
    ],
    "full_course": [
        {"agent": "document_agent", "action": "generate", "priority": "high", "status": "pending"},
        {"agent": "mindmap_agent", "action": "generate", "priority": "medium", "status": "pending"},
        {"agent": "exercise_agent", "action": "generate", "priority": "medium", "status": "pending"},
        {"agent": "path_agent", "action": "generate", "priority": "medium", "status": "pending"},
    ],
    "multi_chat": [
        {"agent": "tutor_agent", "action": "answer", "priority": "low", "status": "pending"}
    ],
}

# 路由映射：agent名 → StateGraph 节点名
ROUTE_MAP = {
    "document_agent": "run_document_agent",
    "mindmap_agent": "run_mindmap_agent",
    "exercise_agent": "run_exercise_agent",
    "path_agent": "run_path_agent",
    "tutor_agent": "run_tutor_agent",
    "audio_agent": "run_audio_agent",
}


# ====================================================================
# MasterAgent 类
# ====================================================================

class MasterAgent:
    """多智能体编排器 — 基于 LangGraph StateGraph"""

    def __init__(self):
        self.graph = self._build_graph()

    # ------------------------------------------------------------------
    # 图构建
    # ------------------------------------------------------------------

    def _build_graph(self) -> StateGraph:
        """构建 LangGraph 状态图"""
        graph = StateGraph(AgentState)

        # 注册节点
        graph.add_node("intent_recognition", self._intent_recognition)
        graph.add_node("task_planning", self._task_planning)
        graph.add_node("run_document_agent", self._run_document_agent)
        graph.add_node("run_mindmap_agent", self._run_mindmap_agent)
        graph.add_node("run_exercise_agent", self._run_exercise_agent)
        graph.add_node("run_path_agent", self._run_path_agent)
        graph.add_node("run_tutor_agent", self._run_tutor_agent)
        graph.add_node("run_audio_agent", self._run_audio_agent)
        graph.add_node("result_aggregation", self._result_aggregation)
        graph.add_node("response_generation", self._response_generation)

        # 入口
        graph.set_entry_point("intent_recognition")

        # 意图识别 → 任务规划
        graph.add_edge("intent_recognition", "task_planning")

        # 任务规划 → 条件路由
        graph.add_conditional_edges(
            "task_planning",
            self._route_to_agents,
            {
                "run_document_agent": "run_document_agent",
                "run_mindmap_agent": "run_mindmap_agent",
                "run_exercise_agent": "run_exercise_agent",
                "run_path_agent": "run_path_agent",
                "run_tutor_agent": "run_tutor_agent",
                "run_audio_agent": "run_audio_agent",
                "aggregate": "result_aggregation",
            },
        )

        # 每个 Agent 完成后 → 检查是否有剩余任务
        agent_nodes = [
            "run_document_agent", "run_mindmap_agent",
            "run_exercise_agent", "run_path_agent", "run_tutor_agent",
            "run_audio_agent",
        ]
        for agent_node in agent_nodes:
            graph.add_conditional_edges(
                agent_node,
                self._check_more_tasks,
                {
                    "next_agent": "task_planning",  # 回到规划点取下个任务
                    "aggregate": "result_aggregation",
                },
            )

        # 结果聚合 → 响应生成 → END
        graph.add_edge("result_aggregation", "response_generation")
        graph.add_edge("response_generation", END)

        return graph.compile(checkpointer=MemorySaver())

    # ------------------------------------------------------------------
    # 节点：意图识别
    # ------------------------------------------------------------------

    async def _intent_recognition(self, state: AgentState) -> dict:
        """意图识别节点 — 关键词快速路由 + LLM 兜底"""
        msg = state.get("user_message", "")

        # 关键词快速路由
        quick = _quick_route(msg)
        if quick:
            params = _extract_intent_params(msg)
            return {
                "intent": quick,
                "intent_params": params,
                "progress": 0.15,
                "current_step": f"意图识别完成: {quick}",
            }

        # LLM 路由
        try:
            response = await get_llm_client().chat(
                messages=[{"role": "user", "content": f"用户消息: {msg}"}],
                system=INTENT_PROMPT,
                max_tokens=256,
                temperature=0.1,
            )
            intent_info = parse_json_response(
                response["content"],
                {"intent": "multi_chat", "params": {}},
            )
        except Exception:
            intent_info = {"intent": "multi_chat", "params": {}}

        intent = intent_info.get("intent", "multi_chat")
        params = intent_info.get("params", {})

        # 如果 LLM 没提取到 knowledge_point，用关键词提取兜底
        if not params.get("knowledge_point"):
            params.update(_extract_intent_params(msg))

        return {
            "intent": intent,
            "intent_params": params,
            "progress": 0.15,
            "current_step": f"意图识别完成: {intent}",
        }

    # ------------------------------------------------------------------
    # 节点：任务规划
    # ------------------------------------------------------------------

    async def _task_planning(self, state: AgentState) -> dict:
        """任务规划节点 — 根据意图生成任务列表（仅首次调用时生成）"""
        # 如果已有任务计划，说明是循环回来的，不重置 index
        existing_plan = state.get("task_plan")
        if existing_plan:
            return {
                "progress": 0.2 + 0.7 * (state.get("current_task_index", 0) / max(len(existing_plan), 1)),
                "current_step": f"继续执行第 {state.get('current_task_index', 0) + 1}/{len(existing_plan)} 个任务",
            }

        intent = state.get("intent", "multi_chat")
        # 深拷贝避免原地修改共享 TASK_TEMPLATES
        import copy
        tasks = copy.deepcopy(TASK_TEMPLATES.get(intent, TASK_TEMPLATES["multi_chat"]))

        # 注入 intent_params 到每个 task
        intent_params = state.get("intent_params", {})
        for task in tasks:
            task["params"] = dict(intent_params)

        return {
            "task_plan": tasks,
            "current_task_index": 0,
            "status": "executing",
            "progress": 0.2,
            "current_step": f"任务规划完成，{len(tasks)} 个子任务待执行",
        }

    # ------------------------------------------------------------------
    # 条件路由
    # ------------------------------------------------------------------

    def _route_to_agents(self, state: AgentState) -> str:
        """从 task_plan 取当前任务的 agent 名，返回 StateGraph 节点名"""
        tasks = state.get("task_plan", [])
        idx = state.get("current_task_index", 0)

        if idx >= len(tasks):
            return "aggregate"

        agent_name = tasks[idx].get("agent", "")
        return ROUTE_MAP.get(agent_name, "aggregate")

    def _check_more_tasks(self, state: AgentState) -> str:
        """检查是否还有待执行的任务"""
        tasks = state.get("task_plan", [])
        idx = state.get("current_task_index", 0)
        if idx < len(tasks):
            return "next_agent"
        return "aggregate"

    # ------------------------------------------------------------------
    # 统一任务完成处理
    # ------------------------------------------------------------------

    def _complete_task(self, state: AgentState, result_key: str, result: dict, step: str) -> dict:
        """标记当前任务完成 + 更新进度 + 写入结果"""
        tasks = list(state.get("task_plan", []))
        idx = state.get("current_task_index", 0)
        if idx < len(tasks):
            tasks[idx] = {**tasks[idx], "status": "completed"}

        total = len(tasks)
        progress = round(0.2 + 0.7 * ((idx + 1) / max(total, 1)), 2)

        return {
            result_key: result,
            "task_plan": tasks,
            "current_task_index": idx + 1,
            "progress": min(0.9, progress),
            "current_step": step,
        }

    # ------------------------------------------------------------------
    # Agent 执行节点
    # ------------------------------------------------------------------

    async def _run_document_agent(self, state: AgentState) -> dict:
        """执行 Document Agent"""
        kp = state.get("intent_params", {}).get("knowledge_point", "通用知识")
        t0 = time.time()
        try:
            result = await document_agent.generate(
                knowledge_point=kp,
                student_profile=state.get("student_profile"),
                resource_type=state.get("intent_params", {}).get("resource_type", "all"),
            )
            agent_metrics.record("document", True, (time.time() - t0) * 1000)
            return self._complete_task(state, "document_result", result, f"文档生成完成: {kp}")
        except Exception as e:
            agent_metrics.record("document", False, (time.time() - t0) * 1000)
            return self._fail_task(state, f"文档生成失败: {e}")

    async def _run_mindmap_agent(self, state: AgentState) -> dict:
        """执行 MindMap Agent"""
        kp = state.get("intent_params", {}).get("knowledge_point", "通用知识")
        t0 = time.time()
        try:
            result = await mindmap_agent.generate(
                knowledge_point=kp,
                student_profile=state.get("student_profile"),
            )
            agent_metrics.record("mindmap", True, (time.time() - t0) * 1000)
            return self._complete_task(state, "mindmap_result", result, f"思维导图生成完成: {kp}")
        except Exception as e:
            agent_metrics.record("mindmap", False, (time.time() - t0) * 1000)
            return self._fail_task(state, f"思维导图生成失败: {e}")

    async def _run_exercise_agent(self, state: AgentState) -> dict:
        """执行 Exercise Agent"""
        kp = state.get("intent_params", {}).get("knowledge_point", "通用知识")
        t0 = time.time()
        try:
            result = await exercise_agent.generate(
                knowledge_point=kp,
                student_profile=state.get("student_profile"),
                exercise_type=state.get("intent_params", {}).get("exercise_type", "all"),
                count=state.get("intent_params", {}).get("exercise_count", 5),
            )
            agent_metrics.record("exercise", True, (time.time() - t0) * 1000)
            return self._complete_task(state, "exercise_result", result, f"练习题生成完成: {kp}")
        except Exception as e:
            agent_metrics.record("exercise", False, (time.time() - t0) * 1000)
            return self._fail_task(state, f"练习题生成失败: {e}")

    async def _run_path_agent(self, state: AgentState) -> dict:
        """执行 Path Agent"""
        topics = state.get("intent_params", {}).get("course_topics", ["基础知识"])
        if isinstance(topics, str):
            topics = [topics]
        kp = state.get("intent_params", {}).get("knowledge_point", "")
        if kp and kp not in topics:
            topics = [kp] + topics
        t0 = time.time()
        try:
            result = await path_agent.generate(
                course_topics=topics,
                student_profile=state.get("student_profile"),
                total_days=state.get("intent_params", {}).get("total_days", 14),
            )
            agent_metrics.record("path", True, (time.time() - t0) * 1000)
            return self._complete_task(state, "path_result", result, "学习路径生成完成")
        except Exception as e:
            agent_metrics.record("path", False, (time.time() - t0) * 1000)
            return self._fail_task(state, f"学习路径生成失败: {e}")

    async def _run_tutor_agent(self, state: AgentState) -> dict:
        """执行 Tutor Agent"""
        t0 = time.time()
        try:
            result = await tutor_agent.answer(
                question=state.get("user_message", ""),
                history=state.get("messages", []),  # 多轮对话上下文
                context_chunks=state.get("intent_params", {}).get("context_chunks"),
                student_profile=state.get("student_profile"),
            )
            agent_metrics.record("tutor", True, (time.time() - t0) * 1000)
            return self._complete_task(state, "tutor_result", result, "问答完成")
        except Exception as e:
            agent_metrics.record("tutor", False, (time.time() - t0) * 1000)
            return self._fail_task(state, f"问答失败: {e}")

    async def _run_audio_agent(self, state: AgentState) -> dict:
        """执行 Audio Agent"""
        kp = state.get("intent_params", {}).get("knowledge_point", "通用知识")
        t0 = time.time()
        try:
            result = await audio_agent.generate(
                knowledge_point=kp,
                student_profile=state.get("student_profile"),
            )
            agent_metrics.record("audio", True, (time.time() - t0) * 1000)
            return self._complete_task(state, "audio_result", result, f"音频脚本生成完成: {kp}")
        except Exception as e:
            agent_metrics.record("audio", False, (time.time() - t0) * 1000)
            return self._fail_task(state, f"音频脚本生成失败: {e}")

    def _fail_task(self, state: AgentState, error_msg: str) -> dict:
        """单个 Agent 失败：跳过继续，不中断整个流程"""
        tasks = list(state.get("task_plan", []))
        idx = state.get("current_task_index", 0)
        if idx < len(tasks):
            tasks[idx] = {**tasks[idx], "status": "failed"}
        return {
            "task_plan": tasks,
            "current_task_index": idx + 1,
            "progress": state.get("progress", 0),
            "current_step": f"{error_msg}，跳过继续执行",
            "error": None,  # 不设 error，让流程继续
        }

    # ------------------------------------------------------------------
    # 结果聚合
    # ------------------------------------------------------------------

    async def _result_aggregation(self, state: AgentState) -> dict:
        """合并多个 Agent 的产出"""
        resources = []
        citations = []
        response_parts = []

        # 画像结果
        if state.get("profile_result"):
            pr = state["profile_result"]
            summary = pr.get("summary", json.dumps(pr, ensure_ascii=False)[:300])
            response_parts.append(f"**📊 学习画像分析完成**\n{summary}")
            resources.append({"type": "profile", "title": "学习画像", "data": pr})

        # 文档结果
        if state.get("document_result"):
            dr = state["document_result"]
            knowledge = dr.get("knowledge", "")
            if knowledge:
                response_parts.append(f"**📚 知识讲解**\n{knowledge}")
            code = dr.get("code", "")
            if code:
                response_parts.append(f"**💻 代码示例**\n```python\n{code}\n```")
            if dr.get("validation") and not dr["validation"].get("passed", True):
                citations.append(f"防幻觉验证: {dr['validation'].get('issues', [])}")
            resources.append({"type": "document", "title": "知识讲解", "data": dr})

        # 思维导图结果
        if state.get("mindmap_result"):
            mr = state["mindmap_result"]
            mermaid = mr.get("mermaid_code", "")
            if mermaid:
                response_parts.append(f"**🧠 思维导图**\n```mermaid\n{mermaid}\n```")
            resources.append({"type": "mindmap", "title": mr.get("title", "思维导图"), "data": mr})

        # 练习题结果
        if state.get("exercise_result"):
            er = state["exercise_result"]
            exercises = er.get("exercises", [])
            if exercises:
                response_parts.append(f"**📝 生成了 {len(exercises)} 道练习题**")
            resources.append({"type": "exercise", "title": "练习题", "data": er})

        # 学习路径
        if state.get("path_result"):
            pr = state["path_result"]
            nodes = pr.get("nodes", [])
            edges = pr.get("edges", [])
            if nodes:
                response_parts.append(f"**🛤️ 学习路径已生成**\n共 {len(nodes)} 个知识点，{len(edges)} 条依赖关系")
            resources.append({"type": "path", "title": pr.get("title", "学习路径"), "data": pr})

        # 问答结果
        if state.get("tutor_result"):
            tr = state["tutor_result"]
            answer = tr.get("answer", "")
            if answer:
                response_parts.append(f"**💬 回答**\n{answer}")
            if tr.get("citations"):
                citations.extend(tr["citations"])

        # 音频结果
        if state.get("audio_result"):
            ar = state["audio_result"]
            script = ar.get("audio_script", "")
            if script:
                response_parts.append(f"**🔊 音频讲解脚本**\n{script}")
            resources.append({"type": "audio", "title": ar.get("title", "音频讲解"), "data": ar})

        final_response = "\n\n---\n\n".join(response_parts) if response_parts else "任务处理完成。"

        return {
            "final_response": final_response,
            "resources": resources,
            "citations": citations,
            "status": "aggregating",
            "progress": 0.95,
            "current_step": "结果聚合完成",
        }

    # ------------------------------------------------------------------
    # 响应生成
    # ------------------------------------------------------------------

    async def _response_generation(self, state: AgentState) -> dict:
        """最终润色"""
        return {
            "status": "completed",
            "progress": 1.0,
            "current_step": "完成",
        }

    # ------------------------------------------------------------------
    # 公开入口
    # ------------------------------------------------------------------

    async def run(self, initial_state: dict) -> dict:
        """StateGraph 执行入口 — 传入初始状态，返回最终状态"""
        task_id = initial_state.get("task_id", str(uuid.uuid4()))
        full_state = default_state(task_id=task_id, **initial_state)

        try:
            config = {"configurable": {"thread_id": task_id}}
            result = await self.graph.ainvoke(full_state, config=config)
            return result
        except Exception as e:
            return {**full_state, "status": "failed", "error": str(e)}

    async def run_stream(self, initial_state: dict):
        """StateGraph 流式执行入口 — yield 每个节点的输出"""
        task_id = initial_state.get("task_id", str(uuid.uuid4()))
        full_state = default_state(task_id=task_id, **initial_state)

        try:
            config = {"configurable": {"thread_id": task_id}}
            async for event in self.graph.astream(full_state, config=config):
                yield event
        except Exception as e:
            yield {"error": {"status": "failed", "error": str(e)}}

    def build_initial_state(self, **kwargs) -> dict:
        """构建初始状态的便捷方法"""
        return default_state(**kwargs)

    # ------------------------------------------------------------------
    # 兼容旧接口（chat.py Phase 4 改造前使用）
    # ------------------------------------------------------------------

    async def route(self, state: dict) -> dict:
        """兼容旧接口：路由请求"""
        messages = state.get("messages", [])
        last_msg = messages[-1].get("content", "") if messages else ""

        quick = _quick_route(last_msg)
        if quick:
            state["request_type"] = quick
            kp = _extract_intent_params(last_msg).get("knowledge_point")
            if kp:
                state["knowledge_point"] = kp
            return state

        try:
            response = await get_llm_client().chat(
                messages=[{"role": "user", "content": f"用户消息: {last_msg}"}],
                system=INTENT_PROMPT,
                max_tokens=256,
                temperature=0.1,
            )
            route_info = parse_json_response(response["content"], {"intent": "chat"})
            state["request_type"] = route_info.get("intent", "chat")
            kp = route_info.get("params", {}).get("knowledge_point")
            if kp:
                state["knowledge_point"] = kp
        except Exception:
            state["request_type"] = "chat"

        return state

    async def execute(self, state: dict) -> dict:
        """兼容旧接口：执行 Agent"""
        request_type = state.get("request_type", "chat")
        try:
            if request_type == "document":
                kp = state.get("knowledge_point", "通用知识")
                result = await document_agent.generate(
                    knowledge_point=kp, student_profile=state.get("student_profile"),
                )
                state["result"] = {"type": "document", "data": result}
            elif request_type == "exercise":
                kp = state.get("knowledge_point", "通用知识")
                result = await exercise_agent.generate(
                    knowledge_point=kp, student_profile=state.get("student_profile"),
                )
                state["result"] = {"type": "exercise", "data": result}
            elif request_type == "path":
                topics = state.get("course_topics", ["基础知识"])
                result = await path_agent.generate(
                    course_topics=topics, student_profile=state.get("student_profile"),
                )
                state["result"] = {"type": "path", "data": result}
            elif request_type == "tutor":
                result = await tutor_agent.answer(
                    question=state.get("messages", [{}])[-1].get("content", ""),
                    context_chunks=state.get("context_chunks"),
                    student_profile=state.get("student_profile"),
                )
                state["result"] = {"type": "tutor", "data": result}
            elif request_type == "mindmap":
                kp = state.get("knowledge_point", "通用知识")
                result = await mindmap_agent.generate(
                    knowledge_point=kp, student_profile=state.get("student_profile"),
                )
                state["result"] = {"type": "mindmap", "data": result}
            else:
                response = await get_llm_client().chat(
                    messages=state.get("messages", []),
                    system="你是一个友好的 AI 学习助手。用简洁清晰的中文回答。",
                    max_tokens=1024, temperature=0.7,
                )
                state["result"] = {"type": "chat", "data": {"answer": response["content"]}}
        except Exception as e:
            state["error"] = str(e)
        return state


# 全局实例
master_agent = MasterAgent()
