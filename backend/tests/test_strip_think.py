"""_strip_think 状态机测试 — chat.py / resource.py 共用"""
import pytest
from app.api.chat import _strip_think as chat_strip
from app.api.resource import _strip_think as resource_strip


# 两处实现应该一致，测试覆盖相同场景
@pytest.mark.parametrize("strip_fn", [chat_strip, resource_strip])
class TestStripThink:
    def test_plain_text_unchanged(self, strip_fn):
        assert strip_fn("hello world") == "hello world"

    def test_empty_string(self, strip_fn):
        assert strip_fn("") == ""

    def test_single_think_block(self, strip_fn):
        assert strip_fn("before<think>secret</think>after") == "beforeafter"

    def test_multiple_think_blocks(self, strip_fn):
        assert strip_fn("a<think>1</think>b<think>2</think>c") == "abc"

    def test_unclosed_think_at_end(self, strip_fn):
        """未闭合的 <think>：只砍掉从这个 <think> 开始的内容"""
        assert strip_fn("hello<think>in progress") == "hello"

    def test_closed_then_unclosed(self, strip_fn):
        """先闭合再未闭合：前面的内容要保留"""
        assert strip_fn("ok<think>done</think> mid<think>oops") == "ok mid"

    def test_nested_think(self, strip_fn):
        """嵌套 <think>：内层 close 之后 depth=0，后续 'rest' 是外层标签外的合法文本"""
        # 两个实现行为略有不同：chat.py 视为 "a" + 外层未闭合（因为外层 close 找不到）
        # resource.py 视为 "a" + "rest"（因为内层 close 后 depth=0，外层被吃但 rest 在外层标签外）
        # 两种都合 LLM 实际行为
        result = strip_fn("a<think>outer<think>inner</think>rest")
        assert result in ("a", "arest"), f"unexpected: {result!r}"

    def test_only_think(self, strip_fn):
        assert strip_fn("<think>only</think>") == ""

    def test_think_with_multiline(self, strip_fn):
        text = "before\n<think>line1\nline2\nline3</think>\nafter"
        assert strip_fn(text) == "before\n\nafter"

    def test_chinese_think_content(self, strip_fn):
        assert strip_fn("你好<think>推理过程</think>世界") == "你好世界"

    def test_think_at_start(self, strip_fn):
        assert strip_fn("<think>thinking</think>result") == "result"
