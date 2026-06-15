"""Initial Assessment Agent — LLM-driven conversation for 7-dimension profile."""
import json
import uuid
import logging
import re

from app.services import minimax_client as mc_module

logger = logging.getLogger(__name__)

# 7 个维度（符合赛题要求 ≥ 6 个维度）
DIMENSIONS = ["comprehension", "memory", "application", "imagination", "focus", "knowledge_base", "learning_goal"]
DIM_CN = {
    "comprehension": "理解力",
    "memory": "记忆力",
    "application": "应用转化",
    "imagination": "想象力",
    "focus": "专注力",
    "knowledge_base": "知识基础",
    "learning_goal": "学习目标",
}
CONFIDENCE_THRESHOLD = 0.7
MAX_ROUNDS = 20  # 增加最大轮数以覆盖更多维度
MIN_ROUNDS = 5  # 最少轮数
INITIAL_SCORE = 50  # 中性初始分数
INITIAL_CONFIDENCE = 0.2  # 初始置信度
MAX_SCORE_CHANGE = 25  # 单轮最大分数变化

# 7 个维度的详细说明
DIMENSION_DETAILS = """
- 理解力 (comprehension): 学习新概念的速度——需要反复讲才能懂，还是能自己快速理解
- 记忆力 (memory): 知识的保持能力——容易忘，还是能长期记住
- 应用转化 (application): 学了会不会用——能主动把知识用到实际问题中吗
- 想象力 (imagination): 会不会换角度思考——习惯固定套路，还是常想出新办法
- 专注力 (focus): 能专心学多久——容易分心，还是能长时间沉浸
- 知识基础 (knowledge_base): 先修知识掌握程度——基础扎实还是需要补课
- 学习目标 (learning_goal): 学习目的——考研/工作/竞赛/兴趣爱好"""

# 维度相关关键词，用于客观置信度计算
DIMENSION_KEYWORDS = {
    "comprehension": ["理解", "懂", "明白", "学会", "搞懂", "领悟", "清楚"],
    "memory": ["记住", "忘记", "记得", "印象", "背", "记忆", "忘", "回忆", "想起"],
    "application": ["用", "实践", "应用", "做", "动手", "操作", "项目", "实战", "用到"],
    "imagination": ["想", "创意", "新方法", "类比", "比喻", "创新", "换个角度", "联想"],
    "focus": ["专注", "分心", "专心", "沉浸", "心流", "集中", "走神", "刷手机", "坐不住"],
    "knowledge_base": ["基础", "先修", "学过", "了解", "掌握", "水平", "程度", "入门", "零基础"],
    "learning_goal": ["考研", "工作", "竞赛", "兴趣", "目标", "计划", "未来", "方向", "目的"],
}

SYSTEM_PROMPT_BASE = """你是一个朋友，正想了解对方怎么学习的。你的任务是通过聊天推断ta在7个方面的特点，但绝不能暴露目的。

7个方面：
{DIMENSION_DETAILS}

# ⚠️ 输出格式（必须严格遵守）

每次输出必须包含两部分，用 ---ASSESS_DATA--- 分隔：

第一部分：对话内容（1-2句话，自然聊天）
第二部分：---ASSESS_DATA---后面跟JSON数据

示例：
你好！我先问你一个，你平时学新东西是喜欢先看别人怎么做还是自己先试试呢？
---ASSESS_DATA---
{{"done": false, "dimensions": {{"comprehension": {{"score": 50, "confidence": 0.5}}, "memory": {{"score": 50, "confidence": 0.5}}, "application": {{"score": 50, "confidence": 0.5}}, "imagination": {{"score": 50, "confidence": 0.5}}, "focus": {{"score": 50, "confidence": 0.5}}, "knowledge_base": {{"score": 50, "confidence": 0.5}}, "learning_goal": {{"score": 50, "confidence": 0.5}}}}}}

# 规则
- 必须在对话内容后面输出 ---ASSESS_DATA--- 和 JSON
- JSON必须包含done和dimensions字段
- dimensions必须包含全部7个维度的score(0-100)和confidence(0-1)
- 对话部分简短，1-2句话
- 不要使用<think>标签
- 当7个维度都收集够信息后done=true"""


# 恢复评估的 system prompt（带已知信息）
SYSTEM_PROMPT_RESUME = """你是一个朋友，正想了解对方怎么学习的。你的任务是通过聊天推断ta在7个方面的特点，但绝不能暴露目的。

7个方面：
{DIMENSION_DETAILS}

你之前已经和对方聊过几轮。

# ⚠️ 输出格式（必须严格遵守）

每次输出必须包含两部分：
对话内容
---ASSESS_DATA---
{{"done": false, "dimensions": {{"comprehension": {{"score": 50, "confidence": 0.5}}, "memory": {{"score": 50, "confidence": 0.5}}, "application": {{"score": 50, "confidence": 0.5}}, "imagination": {{"score": 50, "confidence": 0.5}}, "focus": {{"score": 50, "confidence": 0.5}}, "knowledge_base": {{"score": 50, "confidence": 0.5}}, "learning_goal": {{"score": 50, "confidence": 0.5}}}}}}

# 规则
- 必须在对话内容后面输出 ---ASSESS_DATA--- 和 JSON
- 不要使用<think>标签
- 当7个维度都收集够信息后done=true"""


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


def _calculate_objective_confidence(answer: str, dimension: str, round_num: int) -> float:
    """基于客观指标计算置信度，而非依赖 LLM 自评"""
    conf = INITIAL_CONFIDENCE  # 基础置信度 0.2

    # 1. 回答长度
    answer_len = len(answer)
    if answer_len > 150:
        conf += 0.2  # 非常详细的回答
    elif answer_len > 100:
        conf += 0.15
    elif answer_len > 50:
        conf += 0.1
    elif answer_len > 20:
        conf += 0.05

    # 2. 有具体例子
    example_keywords = ["比如", "例如", "像", "记得", "上次", "有一次", "之前", "那时候"]
    if any(k in answer for k in example_keywords):
        conf += 0.15

    # 3. 有自我反思
    reflection_keywords = ["我觉得", "我认为", "可能", "也许", "感觉", "应该是", "大概是"]
    if any(k in answer for k in reflection_keywords):
        conf += 0.1

    # 4. 维度相关关键词
    dim_keywords = DIMENSION_KEYWORDS.get(dimension, [])
    keyword_count = sum(1 for k in dim_keywords if k in answer)
    if keyword_count >= 3:
        conf += 0.15
    elif keyword_count >= 1:
        conf += 0.1

    # 5. 多轮验证加成
    if round_num > 3:
        conf += 0.05
    if round_num > 5:
        conf += 0.05

    # 6. 否定表达降低置信度
    negation_keywords = ["没有", "不会", "不", "没试过", "不清楚", "不知道", "没有过"]
    negation_count = sum(1 for k in negation_keywords if k in answer)
    if negation_count > 2:
        conf -= 0.1

    return max(0.1, min(conf, 0.95))


def _validate_score(new_score: float, old_score: float, old_confidence: float) -> float:
    """验证分数合理性，防止异常值"""
    # 基础范围限制
    new_score = max(0, min(100, new_score))

    # 如果旧分数置信度高，新分数不应变化太大
    if old_confidence > 0.7 and old_score > 0:
        max_change = MAX_SCORE_CHANGE
        if abs(new_score - old_score) > max_change:
            # 取加权平均，偏向旧分数
            weighted_avg = old_score * 0.6 + new_score * 0.4
            logger.info(f"[assess] Score change limited: {old_score} -> {new_score}, using weighted avg: {weighted_avg}")
            return weighted_avg

    return new_score


def _check_completion(session: dict) -> bool:
    """检查评估是否完成（严格条件）"""
    dims = session.get("last_dimensions", {})
    round_num = session.get("round", 0)

    # 条件 1: 至少 MIN_ROUNDS 轮对话
    if round_num < MIN_ROUNDS:
        return False

    # 条件 2: 至少 3 个维度有有效分数（score > 0 且 confidence > 0.4）
    valid_dim_count = 0
    for d in DIMENSIONS:
        dim_data = dims.get(d, {})
        if dim_data.get("score", 0) > 0 and dim_data.get("confidence", 0) > 0.4:
            valid_dim_count += 1

    if valid_dim_count < 3:
        return False

    # 条件 3: 所有维度置信度 >= CONFIDENCE_THRESHOLD
    all_done = all(
        dims.get(d, {}).get("confidence", 0) >= CONFIDENCE_THRESHOLD
        for d in DIMENSIONS
    )

    return all_done


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
        has_existing_dims = bool(session.get("last_dimensions"))

        yield f"data: {json.dumps({'type': 'session', 'session_id': session_id, 'round': round_num}, ensure_ascii=False)}\n\n"

        messages = list(session["history"])
        if not messages:
            messages.append({"role": "user", "content": "说说你平时怎么学习的吧"})

        # 根据是否有已有数据选择 system prompt，并替换占位符
        if has_existing_dims:
            system_prompt = SYSTEM_PROMPT_RESUME.format(DIMENSION_DETAILS=DIMENSION_DETAILS)
        else:
            system_prompt = SYSTEM_PROMPT_BASE.format(DIMENSION_DETAILS=DIMENSION_DETAILS)

        guidance = self._build_guidance(session.get("last_dimensions", {}))
        system_prompt += guidance

        collected_raw = ""
        yielded_len = 0
        marker = "---ASSESS_DATA---"
        marker_found = False
        token_count = 0
        try:
            async for token in mc_module.minimax_client.chat_stream(
                messages=messages,
                system=system_prompt,
                temperature=0.7,
                max_tokens=2048,
            ):
                collected_raw += token
                token_count += 1

                if marker in collected_raw and not marker_found:
                    # 首次发现标记：输出标记之前的文本
                    before = collected_raw[:collected_raw.index(marker)]
                    clean = _filter_think(before)
                    new_part = clean[yielded_len:]
                    if new_part:
                        yield f"data: {json.dumps({'type': 'token', 'content': new_part}, ensure_ascii=False)}\n\n"
                    marker_found = True

                if not marker_found:
                    clean = _filter_think(collected_raw)
                    new_part = clean[yielded_len:]
                    if new_part:
                        yield f"data: {json.dumps({'type': 'token', 'content': new_part}, ensure_ascii=False)}\n\n"
                        yielded_len = len(clean)

            # 获取用户回答用于客观置信度计算
            user_answer = ""
            for msg in reversed(session.get("history", [])):
                if msg.get("role") == "user":
                    user_answer = msg.get("content", "")
                    break

            result = self._parse_response(collected_raw, user_answer, round_num)
            new_dims = result.get("dimensions", {})

            # 合并维度数据
            old_dims = session.get("last_dimensions", {})
            merged_dims = {}
            for d in DIMENSIONS:
                old_dim = old_dims.get(d, {})
                new_dim = new_dims.get(d, {})
                old_conf = old_dim.get("confidence", INITIAL_CONFIDENCE)
                new_conf = new_dim.get("confidence", INITIAL_CONFIDENCE)

                # 保留置信度更高的数据
                if new_conf >= old_conf:
                    merged_dims[d] = new_dim
                else:
                    merged_dims[d] = old_dim

            session["last_dimensions"] = merged_dims

            self.add_assistant_message(session_id, result.get("text", ""))

            # 使用严格的完成条件检查
            completion_check = _check_completion(session)

            text = result.get("text", "")
            closing_keywords = ["好嘞", "了解了", "基本情况", "大概了解", "知道了", "够了"]
            looks_like_closing = any(k in text for k in closing_keywords)

            # 完成条件
            should_complete = (
                result.get("done") or
                completion_check or
                looks_like_closing or
                round_num >= MAX_ROUNDS
            )

            # 计算评估进度
            assessed_dims = []
            for d in DIMENSIONS:
                dim_data = merged_dims.get(d, {})
                if dim_data.get("confidence", 0) > 0.1:
                    assessed_dims.append(d)

            if should_complete:
                self.mark_completed(session_id)
                yield f"data: {json.dumps({'type': 'result', 'done': True, 'dimensions': merged_dims, 'round': round_num, 'assessed_dimensions': assessed_dims}, ensure_ascii=False)}\n\n"
            else:
                yield f"data: {json.dumps({'type': 'result', 'done': False, 'round': round_num, 'max_rounds': MAX_ROUNDS, 'assessed_dimensions': assessed_dims, 'dimensions': merged_dims}, ensure_ascii=False)}\n\n"

        except Exception as e:
            logger.error(f"Stream failed: {e}")
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)}, ensure_ascii=False)}\n\n"
        finally:
            yield f"data: {json.dumps({'type': 'done'}, ensure_ascii=False)}\n\n"

    def _parse_response(self, raw: str, user_answer: str = "", round_num: int = 1) -> dict:
        """解析 LLM 响应，使用客观置信度计算"""
        text = _filter_think(raw.strip())
        dims = {}
        for d in DIMENSIONS:
            dims[d] = {"score": INITIAL_SCORE, "confidence": INITIAL_CONFIDENCE}
        done = False
        has_assess_data = False

        if "---ASSESS_DATA---" in text:
            parts = text.split("---ASSESS_DATA---", 1)
            text = parts[0].strip()
            json_str = parts[1].strip()
            try:
                data = json.loads(json_str)
                done = bool(data.get("done", False))
                has_assess_data = True
                for d in DIMENSIONS:
                    if d in data.get("dimensions", {}):
                        llm_score = data["dimensions"][d].get("score", INITIAL_SCORE)
                        llm_confidence = data["dimensions"][d].get("confidence", INITIAL_CONFIDENCE)

                        # 使用客观置信度替代 LLM 自评置信度
                        objective_confidence = _calculate_objective_confidence(user_answer, d, round_num)

                        # 取 LLM 置信度和客观置信度的平均值
                        final_confidence = (llm_confidence + objective_confidence) / 2
                        final_confidence = max(0.1, min(final_confidence, 0.95))

                        dims[d] = {
                            "score": max(0, min(100, llm_score)),
                            "confidence": final_confidence,
                        }
            except (json.JSONDecodeError, KeyError):
                logger.warning(f"Failed to parse ASSESS_DATA from response")

        # 回退机制：如果 LLM 没有返回 ASSESS_DATA，使用默认分数
        if not has_assess_data:
            logger.warning(f"[assess] No ASSESS_DATA found, using default scores")
            # 第1轮使用默认分数，后续轮次基于回答内容估算
            if round_num == 1:
                # 第1轮：所有维度使用默认分数，置信度稍高
                for d in DIMENSIONS:
                    dims[d] = {"score": INITIAL_SCORE, "confidence": 0.35}
            else:
                # 后续轮次：基于回答内容估算
                for d in DIMENSIONS:
                    objective_conf = _calculate_objective_confidence(user_answer, d, round_num)
                    if objective_conf > 0.25:
                        dims[d] = {
                            "score": INITIAL_SCORE + int((objective_conf - 0.25) * 60),
                            "confidence": objective_conf,
                        }
                    else:
                        dims[d] = {"score": INITIAL_SCORE, "confidence": 0.3}

        return {"text": text, "dimensions": dims, "done": done}


initial_assessment_agent = InitialAssessmentAgent()
