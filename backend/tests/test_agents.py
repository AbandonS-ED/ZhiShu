"""Tests for agent modules (prompt building, response parsing, validation)."""

import pytest
from app.agents.mindmap_agent import MindMapAgent
from app.agents.profile_agent import ProfileAgent
from app.agents.path_agent import PathAgent
from app.agents.tutor_agent import TutorAgent
from app.agents.exercise_agent import ExerciseAgent
from app.agents.document_agent import DocumentAgent


class TestMindMapAgent:
    def setup_method(self):
        self.agent = MindMapAgent()

    def test_build_prompt_basic(self):
        prompt = self.agent._build_prompt("A* 算法")
        assert "A* 算法" in prompt
        assert "JSON" in prompt

    def test_build_prompt_with_profile(self):
        profile = {"knowledge_mastery": {"A* 算法": 20}, "weak_topics": ["A* 算法"]}
        prompt = self.agent._build_prompt("A* 算法", profile)
        assert "薄弱点" in prompt
        assert "基础较弱" in prompt

    def test_validate_mermaid_clean(self):
        code = "mindmap\n  root((中心))\n    分支1"
        result = self.agent._validate_mermaid(code)
        assert result.startswith("mindmap")

    def test_validate_mermaid_with_code_block(self):
        code = "```\nmindmap\n  root((中心))\n```"
        result = self.agent._validate_mermaid(code)
        assert "```" not in result

    def test_validate_mermaid_empty(self):
        result = self.agent._validate_mermaid("")
        assert result.startswith("mindmap")
        assert "学习主题" in result

    def test_validate_mermaid_illegal_chars(self):
        code = 'mindmap\n  root((中心))\n    "分支"'
        result = self.agent._validate_mermaid(code)
        assert '"' not in result

    def test_is_fallback_result_empty(self):
        assert self.agent._is_fallback_result({"mermaid_code": ""}) is True

    def test_is_fallback_result_none(self):
        assert self.agent._is_fallback_result({"mermaid_code": None}) is True

    def test_is_fallback_result_valid(self):
        assert self.agent._is_fallback_result({"mermaid_code": "mindmap\n  root((A*))"}) is False

    def test_is_fallback_result_default(self):
        assert self.agent._is_fallback_result({"mermaid_code": self.agent.FALLBACK_MERMAID}) is True


class TestProfileAgent:
    def setup_method(self):
        self.agent = ProfileAgent()

    def test_build_user_prompt_basic(self):
        messages = [{"role": "user", "content": "我是一名大学生"}]
        prompt = self.agent._build_user_prompt(messages, None)
        assert "大学生" in prompt
        assert "6 维" in prompt

    def test_build_user_prompt_with_current(self):
        messages = [{"role": "user", "content": "我擅长数学"}]
        current = {"knowledge_mastery": {"数学": 80}}
        prompt = self.agent._build_user_prompt(messages, current)
        assert "current_profile" not in prompt  # uses "当前已有的画像数据"
        assert "80" in prompt

    def test_default_profile(self):
        profile = self.agent._default_profile()
        assert "knowledge_mastery" in profile
        assert "learning_style" in profile
        assert "cognitive_level" in profile
        assert "interest" in profile
        assert "weak_topics" in profile
        assert "learning_pace" in profile
        assert len(profile["knowledge_mastery"]) == 6

    def test_parse_profile_invalid_content(self):
        from app.services.json_parser import parse_json_response
        result = self.agent._parse_profile("不是 JSON")
        assert result["weak_topics"] == []


class TestPathAgent:
    def setup_method(self):
        self.agent = PathAgent()

    def test_build_prompt_basic(self):
        prompt = self.agent._build_prompt(["机器学习", "深度学习"], None, 30)
        assert "30 天" in prompt
        assert "机器学习" in prompt

    def test_build_prompt_with_profile(self):
        profile = {
            "knowledge_mastery": {"机器学习": 50},
            "weak_topics": ["深度学习"],
            "learning_pace": {"daily_hours": 2, "focus_duration": 45},
        }
        prompt = self.agent._build_prompt(["机器学习", "深度学习"], profile, 30)
        assert "薄弱点" in prompt
        assert "2 小时" in prompt

    def test_parse_response_invalid(self):
        result = self.agent._parse_response("不是 JSON")
        assert result["nodes"] == []
        assert result["edges"] == []


class TestTutorAgent:
    def setup_method(self):
        self.agent = TutorAgent()

    def test_build_prompt_question_only(self):
        prompt = self.agent._build_prompt("什么是机器学习?", None, None)
        assert "什么是机器学习?" in prompt
        assert "参考资料" not in prompt

    def test_build_prompt_with_context(self):
        chunks = [{"content": "机器学习是AI的子集", "source": "课本"}]
        profile = {"knowledge_mastery": {"机器学习": 50}}
        prompt = self.agent._build_prompt("什么是机器学习?", chunks, profile)
        assert "参考资料" in prompt
        assert "机器学习是AI的子集" in prompt

    def test_build_prompt_json_format(self):
        prompt = self.agent._build_prompt("问题", None, None, output_format="json")
        assert "返回 JSON" in prompt

    def test_build_prompt_text_format(self):
        prompt = self.agent._build_prompt("问题", None, None, output_format="text")
        assert "不要使用 JSON" in prompt

    def test_parse_response_valid(self):
        result = self.agent._parse_response(
            '{"answer": "机器学习是...", "confidence": 0.9}'
        )
        assert result["answer"] == "机器学习是..."
        assert result["confidence"] == 0.9

    def test_parse_response_invalid(self):
        result = self.agent._parse_response("纯文本回复")
        assert result["answer"] == "纯文本回复"


class TestExerciseAgent:
    def setup_method(self):
        self.agent = ExerciseAgent()

    def test_build_prompt_basic(self):
        prompt = self.agent._build_prompt("排序算法", None, "all", 5)
        assert "排序算法" in prompt
        assert "5 道" in prompt

    def test_build_prompt_choice_only(self):
        prompt = self.agent._build_prompt("排序算法", None, "choice", 3)
        assert "选择题" in prompt

    def test_parse_response_valid(self):
        content = '{"exercises": [{"type": "choice", "question": "排序算法中最快的是?", "options": ["A. 冒泡", "B. 快速"], "answer": "B"}]}'
        result = self.agent._parse_response(content)
        assert len(result["exercises"]) == 1
        assert result["exercises"][0]["type"] == "choice"

    def test_parse_response_invalid(self):
        result = self.agent._parse_response("不是 JSON")
        assert result["exercises"] == []


class TestDocumentAgent:
    def setup_method(self):
        self.agent = DocumentAgent()

    def test_build_prompt_basic(self):
        prompt = self.agent._build_prompt("二叉树", None, "all")
        assert "二叉树" in prompt
        assert "知识讲解" in prompt

    def test_build_prompt_code_only(self):
        prompt = self.agent._build_prompt("二叉树", None, "code")
        assert "仅代码示例" in prompt

    def test_parse_response_valid(self):
        content = '{"knowledge": "二叉树是一种树形结构", "code": "class Node:", "audio_script": "大家好"}'
        result = self.agent._parse_response(content)
        assert result["knowledge"] == "二叉树是一种树形结构"
        assert result["code"] == "class Node:"

    def test_parse_response_invalid(self):
        result = self.agent._parse_response("不是 JSON")
        assert result["knowledge"] == "不是 JSON"
