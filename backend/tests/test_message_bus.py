"""MessageBus 通信测试 — 验证 Agent 间消息机制"""

import asyncio
import pytest
from app.agents.communicator import (
    MessageBus, AgentMessage, MessageType, AgentCommunicator, message_bus,
)


class TestAgentMessage:
    """测试 AgentMessage 数据结构"""

    def test_create_message(self):
        msg = AgentMessage(
            msg_type=MessageType.REQUEST,
            sender="master",
            receiver="tutor",
            action="answer",
            payload={"question": "test"},
        )
        assert msg.sender == "master"
        assert msg.receiver == "tutor"
        assert msg.action == "answer"
        assert msg.correlation_id == ""

    def test_message_types(self):
        assert MessageType.REQUEST.value == "request"
        assert MessageType.RESPONSE.value == "response"
        assert MessageType.EVENT.value == "event"
        assert MessageType.BROADCAST.value == "broadcast"


class TestMessageBus:
    """测试 MessageBus 核心功能"""

    @pytest.fixture
    def bus(self):
        return MessageBus()

    @pytest.mark.asyncio
    async def test_publish_subscribe(self, bus):
        received = []

        async def handler(msg):
            received.append(msg)

        bus.subscribe("agent.tutor", handler)
        msg = AgentMessage(
            msg_type=MessageType.EVENT,
            sender="master",
            receiver="tutor",
            action="test",
            payload={"q": "hello"},
        )
        await bus.publish("agent.tutor", msg)
        assert len(received) == 1
        assert received[0].action == "test"

    @pytest.mark.asyncio
    async def test_multiple_subscribers(self, bus):
        received_a = []
        received_b = []

        async def handler_a(msg):
            received_a.append(msg)

        async def handler_b(msg):
            received_b.append(msg)

        bus.subscribe("agent.tutor", handler_a)
        bus.subscribe("agent.tutor", handler_b)
        msg = AgentMessage(
            msg_type=MessageType.EVENT,
            sender="master",
            receiver="tutor",
            action="broadcast_test",
            payload={},
        )
        await bus.publish("agent.tutor", msg)
        assert len(received_a) == 1
        assert len(received_b) == 1

    @pytest.mark.asyncio
    async def test_unsubscribe(self, bus):
        received = []

        async def handler(msg):
            received.append(msg)

        bus.subscribe("agent.tutor", handler)
        bus.unsubscribe("agent.tutor", handler)
        msg = AgentMessage(
            msg_type=MessageType.EVENT,
            sender="master",
            receiver="tutor",
            action="test",
            payload={},
        )
        await bus.publish("agent.tutor", msg)
        assert len(received) == 0

    @pytest.mark.asyncio
    async def test_request_response(self, bus):
        async def responder(msg):
            await bus.respond(msg.correlation_id, {"answer": "ok"})

        bus.subscribe("agent.profile", responder)
        result = await bus.request("master", "profile", "get_profile", {"id": "123"})
        assert result == {"answer": "ok"}

    @pytest.mark.asyncio
    async def test_request_timeout(self, bus):
        result = await bus.request("master", "tutor", "answer", {"q": "test"})
        assert result == {"error": "timeout"}

    @pytest.mark.asyncio
    async def test_message_history(self, bus):
        msg1 = AgentMessage(
            msg_type=MessageType.EVENT,
            sender="master", receiver="tutor",
            action="test1", payload={},
        )
        msg2 = AgentMessage(
            msg_type=MessageType.EVENT,
            sender="master", receiver="tutor",
            action="test2", payload={},
        )
        await bus.publish("agent.tutor", msg1)
        await bus.publish("agent.tutor", msg2)
        history = bus.get_history()
        assert len(history) == 2
        assert history[0].action == "test1"
        assert history[1].action == "test2"

    @pytest.mark.asyncio
    async def test_publish_no_subscribers(self, bus):
        msg = AgentMessage(
            msg_type=MessageType.EVENT,
            sender="master", receiver="nonexistent",
            action="test", payload={},
        )
        await bus.publish("agent.nonexistent", msg)


class TestAgentCommunicator:
    """测试 AgentCommunicator 封装"""

    @pytest.fixture
    def bus(self):
        return MessageBus()

    @pytest.mark.asyncio
    async def test_request_profile(self, bus):
        async def responder(msg):
            await bus.respond(msg.correlation_id, {"dimensions": {}})

        # request_profile sends to "profile_agent", bus publishes to "agent.profile_agent"
        bus.subscribe("agent.profile_agent", responder)
        comm = AgentCommunicator("document_agent", bus)
        result = await comm.request_profile("student-123")
        assert "dimensions" in result

    @pytest.mark.asyncio
    async def test_broadcast_event(self, bus):
        received = []

        async def handler(msg):
            received.append(msg)

        bus.subscribe("events", handler)
        comm = AgentCommunicator("profile_agent", bus)
        await comm.broadcast_event("profile_updated", {"student_id": "123"})
        assert len(received) == 1
        assert received[0].action == "profile_updated"

    @pytest.mark.asyncio
    async def test_notify_progress(self, bus):
        received = []

        async def handler(msg):
            received.append(msg)

        bus.subscribe("progress", handler)
        comm = AgentCommunicator("document_agent", bus)
        await comm.notify_progress("task-1", 0.5, "generating")
        assert len(received) == 1
        assert received[0].payload["progress"] == 0.5
