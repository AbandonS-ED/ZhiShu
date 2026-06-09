import pytest
from app.services.json_parser import parse_json_response


def test_parse_direct_json():
    result = parse_json_response('{"key": "value"}')
    assert result == {"key": "value"}


def test_parse_with_think_tag():
    result = parse_json_response('<think>推理过程</think>{"key": "value"}')
    assert result == {"key": "value"}


def test_parse_json_code_block():
    content = "```json\n{\"key\": \"value\"}\n```"
    result = parse_json_response(content)
    assert result == {"key": "value"}


def test_parse_generic_code_block():
    content = "```\n{\"key\": \"value\"}\n```"
    result = parse_json_response(content)
    assert result == {"key": "value"}


def test_parse_curly_brace():
    result = parse_json_response("text before\n{\"key\": \"value\"}\ntext after")
    assert result == {"key": "value"}


def test_parse_nested_json():
    content = '{"outer": {"inner": [1, 2, 3]}}'
    result = parse_json_response(content)
    assert result["outer"]["inner"] == [1, 2, 3]


def test_parse_fallback_on_invalid():
    result = parse_json_response("完全不是 JSON", {"default": True})
    assert result == {"default": True}


def test_parse_fallback_empty():
    result = parse_json_response("")
    assert result == {}


def test_parse_markdown_with_extra_text():
    content = '这是一些介绍文字\n\n```json\n{"exercises": [{"type": "choice", "question": "测试"}]}\n```\n\n结束语'
    result = parse_json_response(content)
    assert "exercises" in result
    assert result["exercises"][0]["type"] == "choice"


def test_parse_with_multiple_code_blocks():
    content = '```\nnot json\n```\n```json\n{"valid": true}\n```'
    result = parse_json_response(content)
    assert result == {"valid": True}


def test_parse_thinking_before_json():
    content = "<think>让我想想这个问题\n首先需要分析用户的需求\n</think>{\"answer\": \"你好\", \"confidence\": 0.9}"
    result = parse_json_response(content)
    assert result.get("answer") == "你好"
    assert result.get("confidence") == 0.9
