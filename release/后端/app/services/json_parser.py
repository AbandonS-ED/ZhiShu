"""JSON 解析工具 — 从 LLM 输出中提取结构化 JSON"""

import json
import re


def _replace_raw_newlines_in_strings(text: str) -> str:
    """把 JSON 字符串值中未转义的原始换行符替换为 \\n 转义序列。

    MiniMax/星火等 LLM 的 JSON 输出有时会在字符串值中包含裸换行符（0x0A），
    导致 json.loads() 报 "Invalid control character" 错误。
    此函数仅在字符串上下文（引号对内）中替换 \n → \\n。
    """
    result = []
    i = 0
    in_string = False
    while i < len(text):
        c = text[i]
        if c == '"' and (i == 0 or text[i - 1] != '\\'):
            # 裸引号：切换字符串状态
            in_string = not in_string
            result.append(c)
        elif c == '\n' and in_string:
            # 在字符串内遇到原始换行 → 替换为转义序列
            result.append('\\n')
        else:
            result.append(c)
        i += 1
    return ''.join(result)


def parse_json_response(content: str, fallback: dict | None = None) -> dict:
    """从 LLM 输出中解析 JSON，支持以下格式：
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
    cleaned = re.sub(r"<think>[\s\S]*?</think>", "", content)  # 闭合标签：删内容
    cleaned = re.sub(r"</?think>", "", cleaned)                 # 未闭合标签：只删标签本身
    cleaned = cleaned.strip()

    # 1. 直接解析（先尝试一次）
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
                block = cleaned[start:end].strip()
                try:
                    return json.loads(block)
                except json.JSONDecodeError:
                    # 尝试修复裸换行符后重试
                    block = _replace_raw_newlines_in_strings(block)
                    try:
                        return json.loads(block)
                    except json.JSONDecodeError:
                        pass

    # 3. 找 {} 边界提取
    start = cleaned.find("{")
    end = cleaned.rfind("}") + 1
    if start != -1 and end > start:
        candidate = cleaned[start:end]
        try:
            return json.loads(candidate)
        except json.JSONDecodeError:
            # 尝试修复裸换行符后重试
            candidate = _replace_raw_newlines_in_strings(candidate)
            try:
                return json.loads(candidate)
            except json.JSONDecodeError:
                pass

    return fallback
