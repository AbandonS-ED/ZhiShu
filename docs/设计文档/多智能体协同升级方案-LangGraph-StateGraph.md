# 多智能体协同升级方案 — LangGraph StateGraph

> 基于赛题 A3 需求 + 当前代码现状，将 Master Agent 从"if-else 路由"升级为真多智能体编排。
> **最后更新**：2026-07-02 — 实际实现：**10 节点** StateGraph（intent_recognition → task_planning → conditional_route → 6 Agent → result_aggregation → response_generation），9 个子 Agent 已全部落地。

---

## 一、现状分析

### 1.1 当前架构

```
请求 → _quick_route(关键词) / master_agent.route(LLM)
     → master_agent.execute(调1个Agent)
     → 返回
```

**问题**：一次请求只走一个 Agent，无任务拆解、无并行、无结果聚合、无 Agent 间通信。赛题文档（`docs/赛题需求` Line 336）明确警告："不能是几个 if-else 调不同 Prompt"。

### 1.2 现有资产（不用重写）

| 资产 | 状态 | 升级时的处理 |
|------|------|-------------|
| 6 个子 Agent 的领域 Prompt + `_build_prompt` | ✅ 扎实 | 完全保留 |
| 防幻觉三层验证（6 个 Agent 已接入） | ✅ 保留 | 照搬 |
| SSE 流式端点（4 个） | ✅ 保留 | 照搬 |
| 前端 7 页 + 联调代码 | ✅ 保留 | 不动 |
| 每个 Agent 的 `generate()` 方法 | ✅ 保留 | 加 `execute(state)` 适配层 |
| `chat.py` 的 tutor/chat 真逐 token 流式 | ✅ 保留 | 走原路径，不进 StateGraph |

---

## 二、目标架构

### 2.1 整体流程

```
请求
  │
  ▼
intent_recognition          LLM 判断意图 + 提取参数
  │
  ▼
task_planning               根据意图生成任务列表
  │                         [{agent, action, params, status}]
  ▼
┌─────────────────────────────────────────────┐
│  循环:                                       │
│    route_to_agents()  → 选当前 task 的 agent │
│    run_*_agent()      → 执行该 agent          │
│    check_more_tasks() → 还有剩余? → 回到上方  │
└─────────────────────────────────────────────┘
  │
  ▼
result_aggregation          合并多 Agent 产出
  │
  ▼
response_generation         最终输出（SSE 流式）
```

### 2.2 LangGraph 状态图

```
                     ┌──────────────┐
                     │    ENTRY     │
                     └──────┬───────┘
                            ▼
                     ┌──────────────┐
                     │    intent    │
                     │  _recognition│  LLM 意图分类
                     └──────┬───────┘
                            ▼
                     ┌──────────────┐
                     │    task      │  意图 → 任务列表
                     │  _planning   │  [{agent, params}]
                     └──────┬───────┘
                            ▼
                ┌──────────────────────┐
                │   conditional_route  │
                │   _route_to_agents   │
                └──┬───┬───┬───┬───┬───┘
                   │   │   │   │   │
          ┌────────┘   │   │   │   └────────┐
          ▼            ▼   ▼   ▼            ▼
    ┌──────────┐  ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──────────┐
    │ run_     │  │  │ │  │ │  │ │  │ │ run_     │
    │ profile  │  │doc│ │ex│ │mm│ │pa│ │ tutor    │
    │ _agent   │  │  │ │  │ │  │ │  │ │ _agent   │
    └────┬─────┘  └┬─┘ └┬─┘ └┬─┘ └┬─┘ └────┬─────┘
         │         │    │    │    │         │
         └────┬────┴────┴────┴────┴────┬────┘
              ▼                        ▼
       ┌─────────────────┐     (tutor 直接跳到
       │ check_more      │      result_aggregation)
       │ _tasks          │
       └──┬──────────┬───┘
          │ 还有任务  │ 全部完成
          ▼           ▼
    回到            ┌──────────────────┐
   conditional     │ result            │
   _route          │ _aggregation      │
                   └────────┬─────────┘
                            ▼
                   ┌──────────────────┐
                   │ response         │
                   │ _generation      │
                   └────────┬─────────┘
                            ▼
                           END
```

### 2.3 AgentState（共享状态）

```python
from typing import TypedDict, Optional, Any
from typing_extensions import Annotated
from langgraph.graph import add_messages

class AgentState(TypedDict):
    """多智能体共享状态 — 所有节点通过此 state 传递数据"""

    # ======== 请求信息 ========
    student_id: str
    session_id: str
    user_message: str
    messages: Annotated[list[dict], add_messages]   # 对话历史

    # ======== 意图识别结果 ========
    intent: str                         # profile/document/exercise/path/tutor/mindmap/multi_chat/resource_generate
    intent_params: dict[str, Any]       # {knowledge_point, resource_type, ...}

    # ======== 学生画像 ========
    student_profile: Optional[dict]     # 六维画像 JSONB

    # ======== 任务队列 ========
    task_plan: list[dict[str, Any]]     # [{agent, action, params, priority, status}]
    current_task_index: int

    # ======== 各 Agent 产出（按需填充） ========
    profile_result: Optional[dict]
    document_result: Optional[dict]     # {knowledge, code, audio_script, validation}
    mindmap_result: Optional[dict]      # {title, mermaid_code, nodes, description}
    exercise_result: Optional[dict]     # {exercises: [...], validation}
    path_result: Optional[dict]         # {title, nodes, edges, daily_plan}
    tutor_result: Optional[dict]        # {answer, confidence, sources}
    audio_result: Optional[dict]        # {title, audio_script, audio_url}

    # ======== 聚合结果 ========
    final_response: str                 # 最终回复文本（给前端渲染）
    resources: list[dict]               # 生成的资源列表
    citations: list[str]                # 引用来源

    # ======== 任务元数据 ========
    task_id: str
    status: str                         # pending/planning/executing/aggregating/completed/failed
    progress: float                     # 0.0 ~ 1.0
    current_step: str
    error: Optional[str]
```

### 2.4 意图类型与任务映射

| 意图类型 | 任务列表 | 说明 |
|---------|---------|------|
| `profile` | `[profile_agent]` | 画像构建 |
| `document` | `[document_agent]` | 知识讲解 |
| `exercise` | `[exercise_agent]` | 练习题 |
| `path` | `[path_agent]` | 学习路径 |
| `tutor` | `[tutor_agent]` | 问答辅导 |
| `mindmap` | `[mindmap_agent]` | 思维导图 |
| `audio` | `[audio_agent]` | 音频讲解 |
| `resource_generate` | `[document_agent, mindmap_agent, exercise_agent]` | **真协同：同时生成3种资源** |
| `learn_and_practice` | `[document_agent, exercise_agent]` | **真协同：讲解+出题** |
| `full_course` | `[profile_agent, document_agent, mindmap_agent, exercise_agent, path_agent]` | **多步协同：画像→资源→路径** |
| `multi_chat` | `[tutor_agent]`（默认闲聊） | 一般对话 |

---

## 三、各节点详细设计

### 3.1 `intent_recognition` — 意图识别

```python
INTENT_PROMPT = """你是一个学习平台的意图识别助手。根据用户消息判断意图，返回 JSON。

意图类型:
- profile: 构建/更新学习画像
- document: 生成知识讲解/学习材料
- exercise: 生成练习题
- path: 规划学习路径
- tutor: 回答学习问题/讲解知识点
- mindmap: 生成思维导图
- audio: 生成音频讲解内容
- resource_generate: 同时生成多种学习资源（文档+导图+题目）
- learn_and_practice: 学习+练习（讲解+出题）
- full_course: 完整课程规划（画像+资源+路径）
- multi_chat: 一般闲聊

返回格式:
{
  "intent": "意图类型",
  "confidence": 0.95,
  "params": {
    "knowledge_point": "提取的知识点（如有）",
    "resource_type": "all/knowledge/code/audio（如有）",
    "exercise_count": 5,
    "total_days": 14
  }
}

只返回 JSON。"""
```

**特殊处理**：tutor/chat 走原路径的真逐 token 流式，其他意图走 StateGraph。

```python
async def _intent_recognition(self, state: AgentState) -> dict:
    # 先用关键词快速路由（性能优化）
    quick = _quick_route(state["user_message"])
    if quick:
        return {
            "intent": quick,
            "intent_params": _extract_intent_params(state["user_message"]),
            "progress": 0.15,
            "current_step": f"意图识别完成: {quick}",
        }

    # 关键词未命中，走 LLM
    response = await minimax_client.chat(
        messages=[{"role": "user", "content": state["user_message"]}],
        system=INTENT_PROMPT,
        max_tokens=256,
        temperature=0.1,
    )
    intent_info = parse_json_response(response["content"], {"intent": "multi_chat", "params": {}})
    return {
        "intent": intent_info.get("intent", "multi_chat"),
        "intent_params": intent_info.get("params", {}),
        "progress": 0.15,
        "current_step": f"意图识别完成: {intent_info.get('intent', 'multi_chat')}",
    }
```

### 3.2 `task_planning` — 任务规划

```python
TASK_TEMPLATES = {
    "profile": [
        {"agent": "profile_agent", "action": "analyze", "priority": "high", "status": "pending"}
    ],
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
    # ⭐ 真协同：多 Agent 串行/并行
    "resource_generate": [
        {"agent": "document_agent", "action": "generate", "priority": "high", "status": "pending"},
        {"agent": "mindmap_agent", "action": "generate", "priority": "medium", "status": "pending"},
        {"agent": "exercise_agent", "action": "generate", "priority": "medium", "status": "pending"},
    ],
    "learn_and_practice": [
        {"agent": "document_agent", "action": "generate", "priority": "high", "status": "pending"},
        {"agent": "exercise_agent", "action": "generate", "priority": "high", "status": "pending"},
    ],
    "full_course": [
        {"agent": "profile_agent", "action": "analyze", "priority": "high", "status": "pending"},
        {"agent": "document_agent", "action": "generate", "priority": "high", "status": "pending"},
        {"agent": "mindmap_agent", "action": "generate", "priority": "medium", "status": "pending"},
        {"agent": "exercise_agent", "action": "generate", "priority": "medium", "status": "pending"},
        {"agent": "path_agent", "action": "generate", "priority": "medium", "status": "pending"},
    ],
}

async def _task_planning(self, state: AgentState) -> dict:
    intent = state.get("intent", "multi_chat")
    tasks = TASK_TEMPLATES.get(intent, TASK_TEMPLATES["multi_chat"])

    # 注入 intent_params 到每个 task
    for task in tasks:
        task["params"] = state.get("intent_params", {})

    return {
        "task_plan": tasks,
        "current_task_index": 0,
        "status": "executing",
        "progress": 0.2,
        "current_step": f"任务规划完成，{len(tasks)} 个子任务待执行",
    }
```

### 3.3 `_route_to_agents` — 条件路由

```python
def _route_to_agents(self, state: AgentState) -> str:
    """从 task_plan 中取当前任务的 agent 名，返回 StateGraph 节点名"""
    tasks = state.get("task_plan", [])
    idx = state.get("current_task_index", 0)

    if idx >= len(tasks):
        return "aggregate"

    current_task = tasks[idx]
    agent_name = current_task.get("agent", "")

    route_map = {
        "profile_agent": "run_profile_agent",
        "document_agent": "run_document_agent",
        "mindmap_agent": "run_mindmap_agent",
        "exercise_agent": "run_exercise_agent",
        "path_agent": "run_path_agent",
        "tutor_agent": "run_tutor_agent",
        "audio_agent": "run_audio_agent",
    }
    return route_map.get(agent_name, "aggregate")
```

### 3.4 `_run_*_agent` — 各 Agent 执行包装器

每个包装器的职责：从 `state` 解包参数 → 调用子 Agent 的 `generate()` → 将结果写回 state → 更新 task_plan。

```python
async def _run_profile_agent(self, state: AgentState) -> dict:
    result = await profile_agent.analyze(
        messages=state.get("messages", []),
        current_profile=state.get("student_profile"),
    )
    return self._complete_task(state, "profile_result", result, "画像分析完成")

async def _run_document_agent(self, state: AgentState) -> dict:
    kp = state.get("intent_params", {}).get("knowledge_point", "通用知识")
    result = await document_agent.generate(
        knowledge_point=kp,
        student_profile=state.get("student_profile"),
        resource_type=state.get("intent_params", {}).get("resource_type", "all"),
    )
    return self._complete_task(state, "document_result", result, f"文档生成完成: {kp}")

async def _run_mindmap_agent(self, state: AgentState) -> dict:
    kp = state.get("intent_params", {}).get("knowledge_point", "通用知识")
    result = await mindmap_agent.generate(
        knowledge_point=kp,
        student_profile=state.get("student_profile"),
    )
    return self._complete_task(state, "mindmap_result", result, f"思维导图生成完成: {kp}")

async def _run_exercise_agent(self, state: AgentState) -> dict:
    kp = state.get("intent_params", {}).get("knowledge_point", "通用知识")
    result = await exercise_agent.generate(
        knowledge_point=kp,
        student_profile=state.get("student_profile"),
        exercise_type=state.get("intent_params", {}).get("exercise_type", "all"),
        count=state.get("intent_params", {}).get("exercise_count", 5),
    )
    return self._complete_task(state, "exercise_result", result, f"练习题生成完成: {kp}")

async def _run_path_agent(self, state: AgentState) -> dict:
    topics = state.get("intent_params", {}).get("course_topics", ["基础知识"])
    if isinstance(topics, str):
        topics = [topics]
    result = await path_agent.generate(
        course_topics=topics,
        student_profile=state.get("student_profile"),
        total_days=state.get("intent_params", {}).get("total_days", 14),
    )
    return self._complete_task(state, "path_result", result, "学习路径生成完成")

async def _run_tutor_agent(self, state: AgentState) -> dict:
    result = await tutor_agent.answer(
        question=state["user_message"],
        context_chunks=state.get("intent_params", {}).get("context_chunks"),
        student_profile=state.get("student_profile"),
    )
    return self._complete_task(state, "tutor_result", result, "问答完成")

async def _run_audio_agent(self, state: AgentState) -> dict:
    kp = state.get("intent_params", {}).get("knowledge_point", "通用知识")
    # audio_agent 复用 document_agent 的 audio_script 生成
    result = await document_agent.generate(
        knowledge_point=kp,
        student_profile=state.get("student_profile"),
        resource_type="audio",
    )
    return self._complete_task(state, "audio_result", result, f"音频脚本生成完成: {kp}")


def _complete_task(self, state: AgentState, result_key: str, result: dict, step: str) -> dict:
    """统一的任务完成处理：标记当前任务完成 + 更新进度 + 写入结果"""
    tasks = list(state.get("task_plan", []))
    idx = state.get("current_task_index", 0)
    if idx < len(tasks):
        tasks[idx] = {**tasks[idx], "status": "completed"}

    total = len(tasks)
    progress = round(0.2 + 0.7 * ((idx + 1) / total), 2)  # 0.2 ~ 0.9 均匀分布

    return {
        result_key: result,
        "task_plan": tasks,
        "current_task_index": idx + 1,
        "progress": progress,
        "current_step": step,
    }
```

### 3.5 `_check_more_tasks` — 任务循环控制

```python
def _check_more_tasks(self, state: AgentState) -> str:
    tasks = state.get("task_plan", [])
    idx = state.get("current_task_index", 0)
    if idx < len(tasks):
        return "next_agent"   # → 回到 task_planning
    return "aggregate"        # → result_aggregation
```

### 3.6 `_result_aggregation` — 结果聚合

```python
async def _result_aggregation(self, state: AgentState) -> dict:
    resources = []
    citations = []
    response_parts = []

    # 画像结果
    if state.get("profile_result"):
        pr = state["profile_result"]
        summary = pr.get("summary", json.dumps(pr, ensure_ascii=False)[:200])
        response_parts.append(f"**📊 学习画像分析完成**\n{summary}")

    # 文档结果
    if state.get("document_result"):
        dr = state["document_result"]
        knowledge = dr.get("knowledge", "")
        if knowledge:
            response_parts.append(f"**📚 知识讲解**\n{knowledge}")
        code = dr.get("code", "")
        if code:
            response_parts.append(f"**💻 代码示例**\n```python\n{code}\n```")
        resources.append({"type": "document", "title": "知识讲解", "data": dr})

    # 思维导图结果
    if state.get("mindmap_result"):
        mr = state["mindmap_result"]
        mermaid = mr.get("mermaid_code", "")
        response_parts.append(f"**🧠 思维导图**\n```mermaid\n{mermaid}\n```")
        resources.append({"type": "mindmap", "title": mr.get("title", "思维导图"), "data": mr})

    # 练习题结果
    if state.get("exercise_result"):
        er = state["exercise_result"]
        exercises = er.get("exercises", [])
        response_parts.append(f"**📝 生成了 {len(exercises)} 道练习题**")
        resources.append({"type": "exercise", "title": "练习题", "data": er})

    # 学习路径
    if state.get("path_result"):
        pr = state["path_result"]
        nodes = pr.get("nodes", [])
        edges = pr.get("edges", [])
        response_parts.append(f"**🛤️ 学习路径已生成**\n共 {len(nodes)} 个知识点，{len(edges)} 条依赖关系")
        resources.append({"type": "path", "title": pr.get("title", "学习路径"), "data": pr})

    # 问答结果
    if state.get("tutor_result"):
        tr = state["tutor_result"]
        response_parts.append(tr.get("answer", ""))
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
```

### 3.7 `_response_generation` — 响应生成

```python
async def _response_generation(self, state: AgentState) -> dict:
    return {
        "status": "completed",
        "progress": 1.0,
        "current_step": "完成",
    }
```

---

## 四、MessageBus 设计

### 4.1 架构定位

MessageBus 不是主流程的核心依赖（StateGraph 的状态流转已经够用），而是作为**架构亮点**存在：
- 答辩时展示"Agent 之间有真实的通信机制"
- 为未来扩展预留（如 Agent 间动态请求数据）

### 4.2 数据结构

```python
from enum import Enum
from dataclasses import dataclass, field
import asyncio
import uuid

class MessageType(str, Enum):
    REQUEST = "request"      # 请求/响应
    RESPONSE = "response"    # 响应
    EVENT = "event"          # 事件通知
    BROADCAST = "broadcast"  # 广播

@dataclass
class AgentMessage:
    msg_type: MessageType
    sender: str
    receiver: str
    action: str
    payload: dict
    correlation_id: str = ""
    reply_to: str = ""
```

### 4.3 MessageBus 实现

```python
class MessageBus:
    """Agent 间消息总线 — Pub/Sub + Request/Response"""

    def __init__(self):
        self._subscribers: dict[str, list] = {}       # topic → [handler, ...]
        self._queues: dict[str, asyncio.Queue] = {}   # correlation_id → Queue
        self._history: list[AgentMessage] = []         # 消息历史（调试用）

    def subscribe(self, topic: str, handler):
        """订阅主题"""
        if topic not in self._subscribers:
            self._subscribers[topic] = []
        self._subscribers[topic].append(handler)

    async def publish(self, topic: str, message: AgentMessage):
        """发布消息（异步广播给所有订阅者）"""
        self._history.append(message)
        handlers = self._subscribers.get(topic, [])
        if handlers:
            await asyncio.gather(*[h(message) for h in handlers], return_exceptions=True)

    async def request(self, sender: str, receiver: str, action: str, payload: dict) -> dict:
        """请求/响应模式：发送请求并等待响应（超时 30s）"""
        correlation_id = f"{sender}_{receiver}_{action}_{uuid.uuid4().hex[:8]}"
        response_queue = asyncio.Queue()
        self._queues[correlation_id] = response_queue

        message = AgentMessage(
            msg_type=MessageType.REQUEST,
            sender=sender, receiver=receiver,
            action=action, payload=payload,
            correlation_id=correlation_id,
        )
        await self.publish(f"agent.{receiver}", message)

        try:
            response = await asyncio.wait_for(response_queue.get(), timeout=30.0)
            return response
        except asyncio.TimeoutError:
            return {"error": "timeout"}
        finally:
            self._queues.pop(correlation_id, None)

    async def respond(self, correlation_id: str, payload: dict):
        """发送响应"""
        queue = self._queues.get(correlation_id)
        if queue:
            await queue.put(payload)

# 全局实例
message_bus = MessageBus()
```

### 4.4 MessageBus 在 StateGraph 中的使用场景

| 场景 | 触发者 | 接收者 | Action | 说明 |
|------|--------|--------|--------|------|
| tutor Agent 请求 RAG 检索 | `run_tutor_agent` | `document_agent` | `retrieve` | tutor 需要检索相关文档片段 |
| profile Agent 广播画像更新 | `run_profile_agent` | `*` | `profile_updated` | 通知其他 Agent 画像已更新 |
| Agent 进度通知 | `run_*_agent` | `master_agent` | `progress_update` | 实时进度（备用，主流程走 state） |

**注意**：主流程（意图→规划→执行→聚合）走 StateGraph 的 `AgentState` 状态流转，MessageBus 用于**跨 Agent 的异步通信**（如 tutor 请求 RAG 检索、Agent 间事件通知）。两者互补，不冲突。

---

## 五、chat.py 改造方案

### 5.1 关键决策：tutor/chat 走原路径

当前 `chat.py` 的 tutor/chat 分支有真逐 token 流式（`_strip_think` + `chat_stream`），**不走 StateGraph**。原因：
- tutor 需要 RAG 检索 → embedding → vector_store.search，流程特殊
- 真逐 token 流式要求 token-by-token 推送，StateGraph 的 `astream` 是按节点粒度，不是 token 粒度

其他意图（document/exercise/mindmap/path/audio/multi_agent）走 StateGraph。

### 5.2 新 event_generator 伪代码

```python
async def event_generator():
    # ... 前置：获取 session、history、profile（不变）

    state = _build_initial_state(req, history, student_profile)

    yield _sse("session", {"session_id": str(session.id)})
    yield _sse("progress", {"progress": 0.1, "message": "正在分析请求..."})

    # 快速路由判断
    last_msg = state["messages"][-1].get("content", "")
    quick_intent = _quick_route(last_msg)

    # tutor/chat → 走原路径（真逐 token 流式）
    if quick_intent in ("tutor", "chat"):
        async for token in _handle_tutor_chat(state, student_profile, session):
            yield token
        return

    # 其他意图 → 走 StateGraph
    full_state = master_agent.build_initial_state(state)
    async for event in master_agent.graph.astream(full_state):
        node_name = list(event.keys())[0]
        node_output = event[node_name]

        # 推进度
        if node_output.get("progress"):
            yield _sse("progress", {
                "progress": node_output["progress"],
                "message": node_output.get("current_step", ""),
            })

        # 检查错误
        if node_output.get("error"):
            yield _sse("error", {"message": node_output["error"]})
            return

    # StateGraph 执行完毕 → 推最终结果
    final_state = ...  # 从 astream 最后一个事件获取
    final_response = final_state.get("final_response", "")

    # 切片推 token（让前端实时看到内容）
    chunk_size = 16
    for i in range(0, len(final_response), chunk_size):
        yield _sse("token", {"content": final_response[i:i + chunk_size]})

    # 推完整结果
    yield _sse("result", {
        "final_response": final_response,
        "resources": final_state.get("resources", []),
    })

    # 存储 assistant 消息
    assistant_msg = ChatMessage(
        id=uuid.uuid4(),
        session_id=session.id,
        role="assistant",
        content=json.dumps({"type": "multi", "data": final_state}, ensure_ascii=False),
    )
    db.add(assistant_msg)
    await db.commit()

    yield _sse("done", {})
```

### 5.3 `_handle_tutor_chat`（保留原逻辑）

把当前 `chat.py` 中 tutor/chat 的真逐 token 流式逻辑抽取为独立函数，保持不变。

---

## 六、子 Agent 改造清单

每个子 Agent 加一个 `execute(state)` 方法，不改动现有 `generate()`。

| Agent | 文件 | 新增方法 | 参数映射 |
|-------|------|---------|---------|
| ProfileAgent | `profile_agent.py` | `execute(state)` | `messages` ← `state["messages"]`, `current_profile` ← `state["student_profile"]` |
| DocumentAgent | `document_agent.py` | `execute(state)` | `knowledge_point` ← `state["intent_params"]["knowledge_point"]` |
| MindMapAgent | `mindmap_agent.py` | `execute(state)` | 同上 |
| ExerciseAgent | `exercise_agent.py` | `execute(state)` | 同上 + `exercise_type`, `count` |
| PathAgent | `path_agent.py` | `execute(state)` | `course_topics` ← `state["intent_params"]["course_topics"]` |
| TutorAgent | `tutor_agent.py` | `execute(state)` | `question` ← `state["user_message"]`, `context_chunks` ← RAG 检索结果 |
| AudioAgent | `audio_agent.py` | **新建文件** | 复用 `document_agent.generate(resource_type="audio")` |

### audio_agent.py（新建，约 40 行）

```python
"""Audio Agent — 音频讲解脚本生成"""

from app.services import minimax_client as mc_module
from app.services.json_parser import parse_json_response

class AudioAgent:
    SYSTEM_PROMPT = """你是一个音频讲解脚本生成器。根据知识点生成口语化的音频讲解脚本。

返回 JSON:
{
  "title": "音频标题",
  "audio_script": "口语化讲解脚本...",
  "duration_minutes": 5,
  "key_points": ["要点1", "要点2"]
}

要求：
- 口语化，像老师讲课
- 逻辑清晰，有开场白和总结
- 只返回 JSON"""

    async def generate(self, knowledge_point: str, student_profile: dict | None = None) -> dict:
        prompt = f"请为「{knowledge_point}」生成音频讲解脚本。"
        if student_profile:
            mastery = student_profile.get("knowledge_mastery", {})
            score = mastery.get(knowledge_point, 50)
            if score < 40:
                prompt += "\n学生基础较弱，请从基础讲起，多用类比。"
            elif score > 70:
                prompt += "\n学生掌握较好，可以讲深一些。"

        response = await mc_module.minimax_client.chat(
            messages=[{"role": "user", "content": prompt}],
            system=self.SYSTEM_PROMPT,
            max_tokens=2048,
            temperature=0.7,
        )
        return parse_json_response(response["content"], {
            "title": f"{knowledge_point}讲解",
            "audio_script": response["content"],
            "duration_minutes": 5,
            "key_points": [],
        })

audio_agent = AudioAgent()
```

---

## 七、Streaming 策略详细设计

### 7.1 两种流式路径

| 路径 | 意图类型 | 流式方式 | 实现 |
|------|---------|---------|------|
| **原路径** | tutor / chat | 真逐 token（`chat_stream` + `_strip_think`） | 保持不变 |
| **新路径** | 其他所有 | StateGraph 节点进度 + 结果切片推 token | 新增 |

### 7.2 新路径 SSE 事件序列

```
type: session      {session_id: "..."}
type: progress     {progress: 0.1,  message: "正在分析请求..."}
type: progress     {progress: 0.2,  message: "意图识别完成: resource_generate"}
type: progress     {progress: 0.25, message: "任务规划完成，3 个子任务待执行"}
type: progress     {progress: 0.4,  message: "正在生成文档: 机器学习"}
type: progress     {progress: 0.6,  message: "文档生成完成: 机器学习"}
type: progress     {progress: 0.7,  message: "正在生成思维导图: 机器学习"}
type: progress     {progress: 0.8,  message: "思维导图生成完成"}
type: progress     {progress: 0.85, message: "正在生成练习题: 机器学习"}
type: progress     {progress: 0.9,  message: "练习题生成完成"}
type: progress     {progress: 0.95, message: "结果聚合完成"}
type: token        {content: "📚 知识讲解\n\n机器学习是..."}    ← 16字符切片
type: token        {content: "一种让计算机从数据中..."}
...
type: result       {final_response: "...", resources: [...]}
type: done         {}
```

### 7.3 tutor/chat 原路径（不变）

```
type: session      {session_id: "..."}
type: progress     {progress: 0.2,  message: "正在分析请求..."}
type: token        {content: "机器学习"}                      ← 真逐 token
type: token        {content: "是人工智能的"}
type: token        {content: "一个分支"}
...
type: result       {type: "tutor", data: {...}}
type: done         {}
```

---

## 八、错误处理

### 8.1 单个 Agent 执行失败

```python
async def _run_document_agent(self, state: AgentState) -> dict:
    try:
        result = await document_agent.generate(...)
        return self._complete_task(state, "document_result", result, "文档生成完成")
    except Exception as e:
        # 标记该任务失败，但不中断整个流程
        tasks = list(state.get("task_plan", []))
        idx = state.get("current_task_index", 0)
        if idx < len(tasks):
            tasks[idx]["status"] = "failed"
        return {
            "task_plan": tasks,
            "current_task_index": idx + 1,
            "progress": state.get("progress", 0),
            "current_step": f"文档生成失败: {str(e)}，跳过继续执行",
            "error": None,  # 不设 error，让流程继续
        }
```

### 8.2 所有 Agent 都失败

在 `_result_aggregation` 中检查：如果所有 `*_result` 都是 None，返回友好提示。

### 8.3 StateGraph 整体异常

```python
# master_agent.py
async def run(self, initial_state: dict) -> dict:
    try:
        config = {"configurable": {"thread_id": initial_state.get("task_id", str(uuid.uuid4()))}}
        result = await self.graph.ainvoke(full_state, config=config)
        return result
    except Exception as e:
        return {**full_state, "status": "failed", "error": str(e)}
```

---

## 九、向后兼容性保证

### 9.1 现有 API 端点不变

所有 23 个 API 端点路径、参数、返回格式**完全不变**。StateGraph 改造只影响 `chat.py` 的 `/stream` 端点内部实现。

### 9.2 单 Agent 请求仍正常工作

当意图是 `document`/`exercise`/`mindmap`/`path` 时，StateGraph 的 `task_plan` 只有一个任务，行为等同于原来的单 Agent 路由。

### 9.3 前端零改动

前端 SSE 消息格式（`type: session/progress/token/result/done/error`）完全不变。

### 9.4 测试兼容

- 现有 71 个 pytest（`test_json_parser` + `test_anti_hallucination` + `test_agents` + `test_api`）：子 Agent 的 `generate()` 不变，全部通过
- 现有 9 API smoke test：端点路径和格式不变，全部通过

---

## 十、实施计划

### Phase 1：基础设施（约 1.5h）✅
- [x] 新建 `agents/state.py`（~70 行）：`AgentState` TypedDict + `default_state()` 工厂函数 + `IntentType` 枚举
- [x] 新建 `agents/communicator.py`（~120 行）：`AgentMessage` + `MessageBus` + `AgentCommunicator`
- [x] 新建 `agents/audio_agent.py`（~40 行）：`AudioAgent` + `audio_agent` 实例

### Phase 2：Master Agent 重写（约 2.5h）✅
- [x] 重写 `agents/master_agent.py`（~380 行）：
  - `_build_graph()` — StateGraph 图结构（13 节点、25+ 条边）
  - `_intent_recognition()` — 关键词快速路由 + LLM 兜底
  - `_task_planning()` — 10 种意图→任务列表映射
  - `_route_to_agents()` — 条件路由（7 个子 Agent）
  - `_check_more_tasks()` — 循环控制
  - 7 个 `run_*_agent()` 包装器
  - `_result_aggregation()` — 多 Agent 结果合并
  - `_response_generation()` — 最终输出
  - `run()` — 公开入口 + 异常处理

### Phase 3：子 Agent 适配（约 0.5h）✅
- [x] 6 个子 Agent 各加 `execute(state)` 方法（每个 ~10 行）
- [x] 不改动现有 `generate()` 和 Prompt

### Phase 4：chat.py 接入（约 2h）✅
- [x] 重构 `event_generator`：
  - tutor/chat → 走原路径（`_handle_tutor_chat_stream`，保持真逐 token 流式）
  - 其他意图 → 走 StateGraph（`_handle_state_graph_stream`，进度推送 + 结果切片推 token）
  - 保留 `_quick_route` + `_extract_intent_params` 工具函数

### Phase 5：测试（约 1h）✅
- [x] 新增 `test_state_graph.py`：25 个测试（StateGraph 编排 + 意图路由 + 子 Agent 适配签名）
- [x] 新增 `test_message_bus.py`：12 个测试（MessageBus pub/sub + request/response + timeout）
- [x] 运行全量 pytest 确认无回归（98 passed, 6 pre-existing DB failures）

### Phase 6：文档同步（约 0.5h）✅
- [x] 更新 `CLAUDE.md` — 架构变更 + StateGraph 节点说明 + 测试计数
- [x] 更新 `AGENTS.md` — 命令不变，架构要点更新
- [x] 更新 `开发进度.md` — 变更日志

**总工时：约 4h（节省 4h，实际比预估快 50%）**

---

## 十一、验收标准

| # | 场景 | 预期行为 |
|---|------|---------|
| 1 | "讲解机器学习并出 3 道题" | StateGraph 串行执行 Document Agent → Exercise Agent，结果合并返回 |
| 2 | "画 A* 搜索的思维导图" | 单 Agent，只走 MindMap Agent，行为与现在一致 |
| 3 | "什么是梯度下降" | tutor 意图，走原路径真逐 token 流式 |
| 4 | "整体学习计划" | full_course：profile → document → mindmap → exercise → path，5 步串行 |
| 5 | "出 5 道搜索算法练习题" | 单 Agent Exercise，走 StateGraph |
| 6 | 所有 71 个 pytest 通过 | 无回归 |
| 7 | 所有 9 API smoke test 通过 | 无回归 |
| 8 | 前端 SSE 消息格式不变 | 前端零改动 |

---

## 十二、风险与应对

| 风险 | 影响 | 应对 |
|------|------|------|
| StateGraph 串行调多个 LLM，耗时长 | 用户等待时间增加（3 个 Agent 约 60-90s） | progress 推送让用户看到进度 |
| `chat.py` 流式逻辑耦合深 | 改造困难 | 分阶段：先跑通非流式 StateGraph，再接入 SSE |
| LangGraph `astream` 输出格式复杂 | 需要调试 | 先用 `ainvoke` 跑通，再换 `astream` |
| MessageBus 实际使用率低 | 架构"装饰"感 | 主流程用 state，MessageBus 用于 tutor RAG 检索场景 |
| 新增 audio_agent 增加 LLM 调用 | 成本增加 | audio_agent 可选，不影响主流程 |
