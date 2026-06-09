"""JSON 解析工具 — 提取重复的 JSON 解析逻辑"""

import json
import re


def parse_json_response(content: str, fallback: dict | None = None) -> dict:
    """从 LLM 响应中解析 JSON

    尝试顺序：
    1. 清除 <think> 标签后直接解析
    2. 从 ```json code block 提取
    3. 从 ``` code block 提取
    4. 找 {} 边界提取

    Args:
        content: LLM 原始响应文本
        fallback: 解析失败时的默认返回值

    Returns:
        解析后的 dict
    """
    if fallback is None:
        fallback = {}

    # 0. 清除 <think> 标签
    cleaned = re.sub(r"<think>[\s\S]*?</think>", "", content).strip()

    # 1. 直接解析
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass

    # 2. 从 code block 提取
    for marker in ["```json", "```"]:
        idx = cleaned.find(marker)
        if idx != -1:
            start = idx + len(marker)
            end = cleaned.find("```", start)
            if end != -1:
                try:
                    return json.loads(cleaned[start:end].strip())
                except (json.JSONDecodeError, ValueError):
                    continue

    # 3. 找 {} 边界
    start = cleaned.find("{")
    end = cleaned.rfind("}") + 1
    if start != -1 and end > start:
        try:
            return json.loads(cleaned[start:end])
        except json.JSONDecodeError:
            pass

    return fallback
