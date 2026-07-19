"""StateGraph 编排测试 — 验证 Master Agent 的图结构和节点逻辑"""

import pytest
from app.agents.state import AgentState, default_state, IntentType


class TestAgentState:
    """测试 AgentState 工具函数"""

    def test_default_state_has_all_fields(self):
        state = default_state()
        required_keys = [
            "student_id", "session_id", "user_message", "messages",
            "intent", "intent_params", "student_profile",
            "task_plan", "current_task_index",
            "profile_result", "document_result", "mindmap_result",
            "exercise_result", "path_result", "tutor_result", "audio_result",
            "final_response", "resources", "citations",
            "task_id", "status", "progress", "current_step", "error",
        ]
        for key in required_keys:
            assert key in state, f"Missing key: {key}"

    def test_default_state_values(self):
        state = default_state()
        assert state["student_id"] == ""
        assert state["intent"] == ""
        assert state["task_plan"] == []
        assert state["current_task_index"] == 0
        assert state["progress"] == 0.0
        assert state["status"] == "pending"
        assert state["error"] is None

    def test_default_state_overrides(self):
        state = default_state(student_id="test-123", intent="document")
        assert state["student_id"] == "test-123"
        assert state["intent"] == "document"

    def test_intent_type_enum(self):
        assert IntentType.DOCUMENT.value == "document"
        assert IntentType.FULL_COURSE.value == "full_course"


class TestMasterAgentGraph:
    """测试 Master Agent 的 StateGraph 结构"""

    def test_graph_builds(self):
        from app.agents.master_agent import master_agent
        assert master_agent.graph is not None

    def test_graph_has_all_nodes(self):
        from app.agents.master_agent import master_agent
        graph = master_agent.graph.get_graph()
        expected_nodes = {
            "__start__", "__end__",
            "intent_recognition", "task_planning",
            "run_document_agent",
            "run_mindmap_agent", "run_exercise_agent",
            "run_tutor_agent", "run_audio_agent",
            "result_aggregation", "response_generation",
        }
        assert set(graph.nodes) == expected_nodes

    def test_graph_edge_count(self):
        from app.agents.master_agent import master_agent
        graph = master_agent.graph.get_graph()
        assert len(graph.edges) >= 20

    def test_quick_route_exercise(self):
        from app.agents.master_agent import _quick_route
        assert _quick_route("\u51fa5\u9053\u7ec3\u4e60\u9898") == "exercise"
        assert _quick_route("\u5e2e\u6211\u505a\u6d4b\u8bd5") == "exercise"

    def test_quick_route_mindmap(self):
        from app.agents.master_agent import _quick_route
        assert _quick_route("\u753b\u601d\u7ef4\u5bfc\u56fe") == "mindmap"
        assert _quick_route("\u751f\u6210\u77e5\u8bc6\u7ed3\u6784\u56fe") == "mindmap"

    def test_quick_route_document(self):
        from app.agents.master_agent import _quick_route
        assert _quick_route("\u7ed9\u6211\u5b66\u4e60\u6750\u6599") == "document"

    def test_quick_route_tutor(self):
        from app.agents.master_agent import _quick_route
        assert _quick_route("\u8bb2\u89e3\u4e00\u4e0b\u8ba1\u7b97\u7a0b\u5e8f") == "tutor"
        assert _quick_route("\u4e3a\u4ec0\u4e48\u673a\u5668\u5b66\u4e60\u8fd9\u4e48\u706b") == "tutor"
        assert _quick_route("\u662f\u4ec0\u4e48\u662f\u68af\u5ea6\u4e0b\u964d") == "tutor"

    def test_quick_route_compound_priority(self):
        """复合意图必须在单一意图之前匹配"""
        from app.agents.master_agent import _quick_route
        result = _quick_route("\u8bb2\u89e3\u673a\u5668\u5b66\u4e60\u5e76\u51fa\u51e0\u9053\u9898")
        assert result == "learn_and_practice"

    def test_quick_route_none(self):
        from app.agents.master_agent import _quick_route
        assert _quick_route("hello world") is None
        assert _quick_route("12345") is None

    def test_extract_intent_params(self):
        from app.agents.master_agent import _extract_intent_params
        params = _extract_intent_params("\u8bb2\u89e3\u4e00\u4e0b\u673a\u5668\u5b66\u4e60\u7b97\u6cd5")
        assert "knowledge_point" in params
        assert len(params["knowledge_point"]) > 0

    def test_task_templates_all_intents(self):
        from app.agents.master_agent import TASK_TEMPLATES
        assert "document" in TASK_TEMPLATES
        assert "exercise" in TASK_TEMPLATES
        assert "learn_and_practice" in TASK_TEMPLATES
        assert "full_course" in TASK_TEMPLATES

    def test_full_course_has_four_tasks(self):
        from app.agents.master_agent import TASK_TEMPLATES
        tasks = TASK_TEMPLATES["full_course"]
        assert len(tasks) == 4


class TestSubAgentAdapters:
    """测试子 Agent 的 execute() 适配方法"""

    def test_document_agent_execute_signature(self):
        from app.agents.document_agent import document_agent
        import inspect
        sig = inspect.signature(document_agent.execute)
        params = list(sig.parameters.keys())
        assert "state" in params

    def test_exercise_agent_execute_signature(self):
        from app.agents.exercise_agent import exercise_agent
        import inspect
        sig = inspect.signature(exercise_agent.execute)
        params = list(sig.parameters.keys())
        assert "state" in params

    def test_mindmap_agent_execute_signature(self):
        from app.agents.mindmap_agent import mindmap_agent
        import inspect
        sig = inspect.signature(mindmap_agent.execute)
        params = list(sig.parameters.keys())
        assert "state" in params

    def test_tutor_agent_execute_signature(self):
        from app.agents.tutor_agent import tutor_agent
        import inspect
        sig = inspect.signature(tutor_agent.execute)
        params = list(sig.parameters.keys())
        assert "state" in params

    def test_audio_agent_execute_signature(self):
        from app.agents.audio_agent import audio_agent
        import inspect
        sig = inspect.signature(audio_agent.execute)
        params = list(sig.parameters.keys())
        assert "state" in params
