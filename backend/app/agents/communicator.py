"""MessageBus — Agent 间消息通信

提供两种通信模式：
1. Pub/Sub（发布/订阅）：广播事件给所有订阅者
2. Request/Response（请求/响应）：点对点请求并等待回复（超时 30s）

主流程走 StateGraph 的 AgentState 状态流转，MessageBus 用于：
- Agent 间异步通信（如 tutor 请求 RAG 检索）
- 事件广播（如 profile 更新通知）
- 架构展示（答辩时展示真实通信机制）
"""

import asyncio
import uuid
from enum import Enum
from dataclasses import dataclass, field
from typing import Callable, Awaitable, Optional


class MessageType(str, Enum):
    REQUEST = "request"
    RESPONSE = "response"
    EVENT = "event"
    BROADCAST = "broadcast"


@dataclass
class AgentMessage:
    """Agent 间消息"""
    msg_type: MessageType
    sender: str
    receiver: str
    action: str
    payload: dict
    correlation_id: str = ""
    reply_to: str = ""


class MessageBus:
    """Agent 间消息总线 — Pub/Sub + Request/Response"""

    def __init__(self):
        self._subscribers: dict[str, list[Callable]] = {}
        self._queues: dict[str, asyncio.Queue] = {}
        self._history: list[AgentMessage] = []

    def subscribe(self, topic: str, handler: Callable[[AgentMessage], Awaitable[None]]):
        """订阅主题"""
        if topic not in self._subscribers:
            self._subscribers[topic] = []
        self._subscribers[topic].append(handler)

    def unsubscribe(self, topic: str, handler: Callable):
        """取消订阅"""
        if topic in self._subscribers:
            self._subscribers[topic] = [
                h for h in self._subscribers[topic] if h != handler
            ]

    async def publish(self, topic: str, message: AgentMessage):
        """发布消息（异步广播给所有订阅者）"""
        self._history.append(message)
        handlers = self._subscribers.get(topic, [])
        if not handlers:
            return
        tasks = [handler(message) for handler in handlers]
        await asyncio.gather(*tasks, return_exceptions=True)

    async def request(
        self, sender: str, receiver: str, action: str, payload: dict
    ) -> dict:
        """请求/响应模式：发送请求并等待响应（超时 30s）"""
        correlation_id = f"{sender}_{receiver}_{action}_{uuid.uuid4().hex[:8]}"
        response_queue: asyncio.Queue = asyncio.Queue()
        self._queues[correlation_id] = response_queue

        message = AgentMessage(
            msg_type=MessageType.REQUEST,
            sender=sender,
            receiver=receiver,
            action=action,
            payload=payload,
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

    def get_history(self, limit: int = 50) -> list[AgentMessage]:
        """获取消息历史"""
        return self._history[-limit:]


class AgentCommunicator:
    """Agent 通信器 — 封装常用通信模式"""

    def __init__(self, agent_name: str, bus: MessageBus):
        self.agent_name = agent_name
        self.bus = bus

    async def request_profile(self, student_id: str) -> dict:
        """请求学生画像（旧画像系统已移除，返回空）"""
        return {"student_id": student_id, "profile": {}}

    async def request_rag(self, query: str, course_id: str) -> dict:
        """请求 RAG 检索"""
        return await self.bus.request(
            sender=self.agent_name,
            receiver="document_agent",
            action="retrieve",
            payload={"query": query, "course_id": course_id},
        )

    async def broadcast_event(self, event_type: str, data: dict):
        """广播事件"""
        message = AgentMessage(
            msg_type=MessageType.BROADCAST,
            sender=self.agent_name,
            receiver="*",
            action=event_type,
            payload=data,
        )
        await self.bus.publish("events", message)

    async def notify_progress(self, task_id: str, progress: float, step: str):
        """通知任务进度"""
        message = AgentMessage(
            msg_type=MessageType.EVENT,
            sender=self.agent_name,
            receiver="master_agent",
            action="progress_update",
            payload={
                "task_id": task_id,
                "progress": progress,
                "step": step,
            },
        )
        await self.bus.publish("progress", message)


# 全局消息总线实例
message_bus = MessageBus()
