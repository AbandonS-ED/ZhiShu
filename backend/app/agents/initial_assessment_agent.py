"""Initial Assessment Agent — LLM-driven conversation for 5-dimension profile."""
import json
import uuid
import logging

from app.services import minimax_client as mc_module

logger = logging.getLogger(__name__)

DIMENSIONS = ["comprehension", "memory", "application", "imagination", "focus"]
DIM_CN = {
    "comprehension": "理解力",
    "memory": "记忆力",
    "application": "应用转化",
    "imagination": "想象力",
    "focus": "专注力",
}
CONFIDENCE_THRESHOLD = 0.7
MAX_ROUNDS = 15

DIMENSION_DETAILS = """
- 理解力 (comprehension): 学习新概念的速度——需要反复讲才能懂，还是能自己快速理解
- 记忆力 (memory): 知识的保持能力——容易忘，还是能长期记住
- 应用转化 (application): 学了会不会用——能主动把知识用到实际问题中吗
- 想象力 (imagination): 会不会换角度思考——习惯固定套路，还是常想出新办法
- 专注力 (focus): 能专心学多久——容易分心，还是能长时间沉浸"""

SYSTEM_PROMPT_BASE = f"""你是一个朋友，正想了解对方怎么学习的。你的任务是通过聊天推断ta在5个方面的特点，但绝不能暴露目的。

5个方面：
{DIMENSION_DETAILS}

# 硬性规则：每次输出的最后都必须附上 ---ASSESS_DATA--- 和 JSON
这条不是可选的。你的全部输出格式必须是：
[你说的话]
---ASSESS_DATA---
{{{{"done": true/false, "dimensions": {{"comprehension": {{"score": 0-100, "confidence": 0-1}}, "memory": {{"score": 0-100, "confidence": 0-1}}, "application": {{"score": 0-100, "confidence": 0-1}}, "imagination": {{"score": 0-100, "confidence": 0-1}}, "focus": {{"score": 0-100, "confidence": 0-1}}}}}}}}

对话部分写两句就好，不要长篇大论。每次都必须包含 ---ASSESS_DATA---，不要漏掉。

# 必须要问具体的，不说废话
禁止"哈哈""呗""呀"类语气词开头。每个问题直指一个维度的具体学习习惯。
问理解力："你学新东西一般看几遍能懂？"
问记忆力："学完的东西过两周还能记住吗？"
问应用："学到的知识你会主动拿出来用吗？"
问想象："遇到难题你会想不同办法吗？"
问专注："你一次性能专心学多久？"
第一句话不能说"最近在忙啥""开学了没"这些，必须是上述类型的具体问题。

# 评分
每轮都要对5个维度评分。不确定给confidence=0.3-0.5，有点把握0.6-0.7，很确定0.8-1.0。
5个维度都收集够信息后，done=true。不要<think>。"""


def _filter_think(text: str) -> str:
    """Remove <think>...</think> tags and their content."""
    result = ""
    depth = 0
    i = 0
    n = len(text)
    while i < n:
        if text[i:i + 7] == "<think>":
            depth += 1
            i += 7
        elif text[i:i + 8] == "</think>":
            depth = max(0, depth - 1)
            i += 8
        elif depth == 0:
            result += text[i]
            i += 1
        else:
            i += 1
    return result


class InitialAssessmentAgent:
    """LLM-driven conversation for 5-dimension personal ability assessment."""

    def __init__(self):
        self._sessions: dict = {}

    async def start_assessment(self, student_id: str) -> dict:
        session_id = str(uuid.uuid4())
        session = {
            "student_id": student_id,
            "history": [],
            "status": "in_progress",
            "round": 0,
        }
        self._sessions[session_id] = session
        return {"session_id": session_id}

    def get_session(self, session_id: str) -> dict | None:
        return self._sessions.get(session_id)

    def add_user_message(self, session_id: str, content: str):
        session = self._sessions.get(session_id)
        if session:
            session["history"].append({"role": "user", "content": content})

    def add_assistant_message(self, session_id: str, content: str):
        session = self._sessions.get(session_id)
        if session:
            session["history"].append({"role": "assistant", "content": content})

    def mark_completed(self, session_id: str):
        session = self._sessions.get(session_id)
        if session:
            session["status"] = "completed"

    def _build_guidance(self, last_dimensions: dict) -> str:
        low_dims = [
            DIM_CN[d]
            for d in DIMENSIONS
            if last_dimensions.get(d, {}).get("confidence", 0) < CONFIDENCE_THRESHOLD
        ]
        if not low_dims:
            return ""
        return f"\n\n当前还需要进一步了解：{'、'.join(low_dims)}。请针对这些方面自然地提问。已有足够信息的方面不需要再问。"

    async def stream_llm_response(self, session_id: str, is_initial: bool = False):
        """Stream LLM response token by token, yields SSE event strings."""
        session = self._sessions.get(session_id)
        if not session:
            yield f"data: {json.dumps({'type': 'error', 'message': 'Session not found'}, ensure_ascii=False)}\n\n"
            yield f"data: {json.dumps({'type': 'done'}, ensure_ascii=False)}\n\n"
            return

        session["round"] = session.get("round", 0) + 1
        round_num = session["round"]

        yield f"data: {json.dumps({'type': 'session', 'session_id': session_id}, ensure_ascii=False)}\n\n"

        messages = list(session["history"])
        if not messages:
            messages.append({"role": "user", "content": "说说你平时怎么学习的吧"})

        guidance = self._build_guidance(session.get("last_dimensions", {}))
        system_prompt = SYSTEM_PROMPT_BASE + guidance

        collected_raw = ""
        yielded_len = 0
        try:
            async for token in mc_module.minimax_client.chat_stream(
                messages=messages,
                system=system_prompt,
                temperature=0.7,
                max_tokens=800,
            ):
                collected_raw += token

                marker = "---ASSESS_DATA---"
                if marker in collected_raw:
                    before = collected_raw[:collected_raw.index(marker)]
                    clean = _filter_think(before)
                    new_part = clean[yielded_len:]
                    if new_part:
                        yield f"data: {json.dumps({'type': 'token', 'content': new_part}, ensure_ascii=False)}\n\n"
                    break

                clean = _filter_think(collected_raw)
                new_part = clean[yielded_len:]
                if new_part:
                    yield f"data: {json.dumps({'type': 'token', 'content': new_part}, ensure_ascii=False)}\n\n"
                    yielded_len = len(clean)

            result = self._parse_response(collected_raw)
            new_dims = result.get("dimensions", {})
            has_scores = any(d.get("score", 0) > 0 for d in new_dims.values())
            if has_scores:
                session["last_dimensions"] = new_dims
            self.add_assistant_message(session_id, result.get("text", ""))

            last = session.get("last_dimensions", {})
            all_done = all(
                last.get(d, {}).get("confidence", 0) >= CONFIDENCE_THRESHOLD
                for d in DIMENSIONS
            )
            text = result.get("text", "")
            closing_keywords = ["好嘞", "了解了", "基本情况", "大概了解", "知道了", "够了"]
            looks_like_closing = not has_scores and any(k in text for k in closing_keywords)
            if result.get("done") or all_done or looks_like_closing or round_num >= MAX_ROUNDS:
                dims = session.get("last_dimensions", new_dims)
                self.mark_completed(session_id)
                yield f"data: {json.dumps({'type': 'result', 'done': True, 'dimensions': dims}, ensure_ascii=False)}\n\n"
            else:
                yield f"data: {json.dumps({'type': 'result', 'done': False}, ensure_ascii=False)}\n\n"

        except Exception as e:
            logger.error(f"Stream failed: {e}")
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)}, ensure_ascii=False)}\n\n"
        finally:
            yield f"data: {json.dumps({'type': 'done'}, ensure_ascii=False)}\n\n"

    def _parse_response(self, raw: str) -> dict:
        text = _filter_think(raw.strip())
        dims = {}
        for d in DIMENSIONS:
            dims[d] = {"score": 0, "confidence": 0}
        done = False

        if "---ASSESS_DATA---" in text:
            parts = text.split("---ASSESS_DATA---", 1)
            text = parts[0].strip()
            json_str = parts[1].strip()
            try:
                data = json.loads(json_str)
                done = bool(data.get("done", False))
                for d in DIMENSIONS:
                    if d in data.get("dimensions", {}):
                        dims[d] = {
                            "score": max(0, min(100, data["dimensions"][d].get("score", 0))),
                            "confidence": max(0, min(1, data["dimensions"][d].get("confidence", 0))),
                        }
            except (json.JSONDecodeError, KeyError):
                logger.warning(f"Failed to parse ASSESS_DATA from response")

        return {"text": text, "dimensions": dims, "done": done}


initial_assessment_agent = InitialAssessmentAgent()
