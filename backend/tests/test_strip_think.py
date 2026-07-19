"""_strip_think 状态机测试 — chat.py"""
import pytest
from app.api.chat import _strip_think as chat_strip


class TestStripThink:
    def test_plain_text_unchanged(self):
        assert chat_strip("hello world") == "hello world"

    def test_empty_string(self):
        assert chat_strip("") == ""

    def test_single_think_block(self):
        assert chat_strip("before<think>secret</think>after") == "beforeafter"

    def test_multiple_think_blocks(self):
        assert chat_strip("a<think>1</think>b<think>2</think>c") == "abc"

    def test_unclosed_think_at_end(self):
        """未闭合的 <think>：只砍掉从这个 <think> 开始的内容"""
        assert chat_strip("hello<think>in progress") == "hello"

    def test_closed_then_unclosed(self):
        """先闭合再未闭合：前面的内容要保留"""
        assert chat_strip("ok<think>done</think> mid<think>oops") == "ok mid"

    def test_nested_think(self):
        """嵌套 <think>：内层 close 之后 depth=0，后续 'rest' 是外层标签外的合法文本"""
        result = chat_strip("a<think>outer<think>inner</think>rest")
        assert result in ("a", "arest"), f"unexpected: {result!r}"

    def test_only_think(self):
        assert chat_strip("<think>only</think>") == ""

    def test_think_with_multiline(self):
        text = "before\n<think>line1\nline2\nline3</think>\nafter"
        assert chat_strip(text) == "before\n\nafter"

    def test_chinese_think_content(self):
        assert chat_strip("你好<think>推理过程</think>世界") == "你好世界"

    def test_think_at_start(self):
        assert chat_strip("<think>thinking</think>result") == "result"
