"""AgentState — 多智能体共享状态定义

所有 Agent 节点通过此 TypedDict 传递数据。
LangGraph StateGraph 的核心状态结构。
"""

from enum import Enum
from typing import TypedDict, Optional, Any
from typing_extensions import Annotated
from langgraph.graph import add_messages


class IntentType(str, Enum):
    """意图类型枚举"""
    PROFILE = "profile"
    DOCUMENT = "document"
    EXERCISE = "exercise"
    PATH = "path"
    TUTOR = "tutor"
    MINDMAP = "mindmap"
    AUDIO = "audio"
    RESOURCE_GENERATE = "resource_generate"
    LEARN_AND_PRACTICE = "learn_and_practice"
    FULL_COURSE = "full_course"
    MULTI_CHAT = "multi_chat"


class AgentState(TypedDict):
    """多智能体共享状态 — 所有节点通过此 state 传递数据"""

    # ======== 请求信息 ========
    student_id: str
    session_id: str
    user_message: str
    messages: Annotated[list[dict], add_messages]

    # ======== 意图识别结果 ========
    intent: str
    intent_params: dict[str, Any]

    # ======== 学生画像 ========
    student_profile: Optional[dict]

    # ======== 任务队列 ========
    task_plan: list[dict[str, Any]]
    current_task_index: int

    # ======== 各 Agent 产出（按需填充） ========
    profile_result: Optional[dict]
    document_result: Optional[dict]
    mindmap_result: Optional[dict]
    exercise_result: Optional[dict]
    path_result: Optional[dict]
    tutor_result: Optional[dict]
    audio_result: Optional[dict]

    # ======== 聚合结果 ========
    final_response: str
    resources: list[dict]
    citations: list[str]

    # ======== 任务元数据 ========
    task_id: str
    status: str
    progress: float
    current_step: str
    error: Optional[str]


def default_state(**overrides) -> AgentState:
    """返回默认的初始状态，支持 kwargs 覆盖"""
    base: AgentState = {
        "student_id": "",
        "session_id": "",
        "user_message": "",
        "messages": [],
        "intent": "",
        "intent_params": {},
        "student_profile": None,
        "task_plan": [],
        "current_task_index": 0,
        "profile_result": None,
        "document_result": None,
        "mindmap_result": None,
        "exercise_result": None,
        "path_result": None,
        "tutor_result": None,
        "audio_result": None,
        "final_response": "",
        "resources": [],
        "citations": [],
        "task_id": "",
        "status": "pending",
        "progress": 0.0,
        "current_step": "",
        "error": None,
    }
    base.update(overrides)
    return base
