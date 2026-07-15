"""聊天 API — SSE 流式对话 + Master Agent 编排"""

import json
import re
import uuid
import logging
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, field_validator
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.student import Student
from app.models.chat_session import ChatSession
from app.models.chat_message import ChatMessage
from app.models.student_profile import StudentProfile
from app.agents.master_agent import master_agent
from app.agents.exercise_agent import exercise_agent
from app.services.llm_factory import get_llm_client
from app.services.json_parser import parse_json_response
from app.core.dependencies import valid_student_id, valid_session_id
from app.services.chat_recommendation_service import chat_recommendation_service

router = APIRouter()
logger = logging.getLogger(__name__)


# ====================================================================
# 画像自动更新 — 基于对话内容分析学习行为
# ====================================================================

async def _update_profile_by_conversation(
    db: AsyncSession,
    student_id: str,
    user_message: str,
    assistant_response: str,
    intent: str,
):
    """基于对话内容自动更新画像（AI Agent 分析）"""
    # 1. 获取画像
    result = await db.execute(
        select(StudentProfile).where(StudentProfile.student_id == uuid.UUID(student_id))
    )
    profile = result.scalar_one_or_none()
    if not profile or not profile.dimensions:
        return

    dims = profile.dimensions
    
    # 2. 构建分析提示
    dims_text = ""
    for dim_key, dim_val in dims.items():
        if isinstance(dim_val, dict):
            score = dim_val.get("score", 50)
            conf = dim_val.get("confidence", 0.5)
            dims_text += f"- {dim_key}: {score}分 (置信度{conf:.0%})\n"

    analysis_prompt = f"""分析以下对话，判断学生能力维度的变化。

当前画像:
{dims_text}

学生消息: {user_message[:200]}
AI回复摘要: {assistant_response[:200]}
对话意图: {intent}

请输出 JSON（只输出 JSON，不要其他内容）:
{{"updates": [{{"dimension": "xxx", "change": 5, "reason": "原因"}}]}}

规则:
- dimension: comprehension/memory/application/imagination/focus/knowledge_base/learning_goal
- change: -5 到 +5 的整数
- 只输出有明显变化的维度
- 如果没有明显变化，输出 {{"updates": []}}"""

    try:
        # 3. 调用 LLM 分析
        response = await get_llm_client().chat(
            messages=[{"role": "user", "content": analysis_prompt}],
            temperature=0.2,
            max_tokens=300,
        )
        
        content = response.get("content", "")
        
        # 4. 解析结果
        json_match = content.find("{")
        if json_match >= 0:
            json_str = content[json_match:]
            # 找到 JSON 结束位置
            end_match = json_str.rfind("}")
            if end_match >= 0:
                json_str = json_str[:end_match + 1]
                data = json.loads(json_str)
                updates = data.get("updates", [])
                
                # 5. 应用更新
                updated_count = 0
                for update in updates:
                    dim_key = update.get("dimension")
                    change = update.get("change", 0)
                    reason = update.get("reason", "")
                    
                    if not dim_key or change == 0:
                        continue
                    
                    dim = dims.get(dim_key, {"score": 50, "confidence": 0.5})
                    old_score = dim.get("score", 50)
                    new_score = max(0, min(100, old_score + change))
                    
                    if new_score != old_score:
                        dim["score"] = new_score
                        dim["confidence"] = min(1.0, dim.get("confidence", 0.5) + 0.01)
                        dims[dim_key] = dim
                        updated_count += 1
                        logger.info(f"[auto_update] {dim_key}: {old_score} -> {new_score} ({reason})")
                
                if updated_count > 0:
                    profile.dimensions = dims
                    await db.commit()
                    logger.info(f"[auto_update] 画像已更新 {updated_count} 个维度")
                    
    except Exception as e:
        logger.warning(f"[auto_update] LLM 分析失败: {e}")

# 流式专用 system prompt — 让 LLM 先输出人类可读文本，末尾跟 JSON
STREAM_EXERCISE_SYSTEM = """你是一个练习题生成器。请按以下两部分输出：

前半部分：markdown 格式的人类可读内容（用户直接阅读）
📝 为你生成了 N 道关于「知识点」的练习题：

**1.** 【题型】题目内容（含选项、答案、解析、难度）

**2.** ...

---JSON_DATA---
后半部分：与前半部分内容一致的 JSON 数据
{"exercises": [{"type":"choice","question":"...","options":["A. ...","B. ..."],"answer":"B","explanation":"...","difficulty":50,"knowledge_point":"..."}]}

规则：
- 先输出前半部分（markdown），再输出 ---JSON_DATA---，再输出 JSON
- 两部分内容必须完全一致
- type 必须是以下值之一：choice(选择题)、judge(判断题)、short_answer(简答题)、coding(编程题)
- 答案格式：选择题 answer 必须是选项字母 A/B/C/D；判断题 answer 必须是 "正确" 或 "错误"
- 只输出以上内容，不要额外文字"""


def _strip_think(text: str) -> str:
    """去掉 <think>...</think> 标签及其内容（支持嵌套和未闭合标签）

    流中断在 <think> 内时，只截断到最后一个未闭合的 <think> 之前，
    而不是删掉 rfind 之后的所有内容（包括合法文本）。
    """
    result = ""
    depth = 0
    last_open_in_result = -1  # 记录 result 中最后一个未闭合 <think> 的位置
    i = 0
    n = len(text)
    while i < n:
        if text[i:i + 7] == "<think>":
            if depth == 0:
                last_open_in_result = len(result)
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
    if depth > 0 and last_open_in_result >= 0:
        result = result[:last_open_in_result]
    return result


class ChatRequest(BaseModel):
    student_id: str
    session_id: str | None = None
    message: str
    course_topics: list[str] | None = None

    @field_validator("student_id", "session_id")
    @classmethod
    def _validate_uuid(cls, v: str | None) -> str | None:
        if v is None:
            return v
        try:
            uuid.UUID(v)
            return v
        except (ValueError, AttributeError, TypeError):
            raise ValueError(f"无效的 UUID: {v}")


# ====================================================================
# tutor/chat 真逐 token 流式（保持原有逻辑不变）
# ====================================================================

async def _handle_tutor_chat_stream(
    intent: str, last_msg: str, history: list, student_profile, session, db
):
    """tutor/chat 意图：真逐 token 流式（原逻辑）"""
    yield f"data: {json.dumps({'type': 'progress', 'progress': 0.2, 'message': '正在分析请求...'}, ensure_ascii=False)}\n\n"

    context_chunks = None
    if intent == "tutor":
        from app.agents.tutor_agent import tutor_agent
        from app.services.vector_store import vector_store
        from app.services.embedding_service import embedding_service
        from app.core.database import async_session as db_async_session

        try:
            query_embedding = await embedding_service.embed_single(last_msg)
            async with db_async_session() as rag_db:
                chunks = await vector_store.search(rag_db, query_embedding, top_k=5)
            context_chunks = chunks
        except Exception as e:
            logger.error("[chat/stream] RAG 检索失败: %s", e)

        user_prompt = tutor_agent._build_prompt(
            last_msg, context_chunks, student_profile, output_format="text"
        )
        system_prompt = tutor_agent.STREAM_PROMPT
    else:
        user_prompt = None
        system_prompt = "你是一个友好的 AI 学习助手。用简洁清晰的中文回答。直接输出回答内容，不要返回 JSON 格式，不要使用 <think> 标签。"

    # 构建多轮对话消息：历史 + 当前问题
    messages = []
    for msg in history:
        role = msg.get("role", "")
        content = msg.get("content", "")
        # assistant 消息在 DB 里是 JSON，解析出文本
        if role == "assistant":
            try:
                data = json.loads(content)
                inner = data.get("data", data)
                content = inner.get("answer", inner.get("final_response", content))
            except (json.JSONDecodeError, TypeError):
                pass
        if role in ("user", "assistant") and content:
            messages.append({"role": role, "content": content})

    # 检查历史最后一条是否已经是当前用户消息，避免重复
    current_user_msg = user_prompt or last_msg
    if not messages or messages[-1].get("content") != current_user_msg:
        messages.append({"role": "user", "content": current_user_msg})

    yield f"data: {json.dumps({'type': 'progress', 'progress': 0.4, 'message': f'已路由到 {intent} Agent，开始生成...'}, ensure_ascii=False)}\n\n"

    think_depth = 0
    think_open = "<think>"
    think_close = "</think>"
    tail = ""
    stream_text = ""
    async for token in get_llm_client().chat_stream(
        messages=messages,
        system=system_prompt,
        max_tokens=4096,
        temperature=0.5 if intent == "tutor" else 0.7,
    ):
        pending = tail + token
        cursor = 0
        while cursor < len(pending):
            if think_depth == 0:
                idx = pending.find(think_open, cursor)
                if idx == -1:
                    safe_end = len(pending) - len(think_open) + 1
                    if safe_end > cursor:
                        seg = pending[cursor:safe_end]
                        stream_text += seg
                        yield f"data: {json.dumps({'type': 'token', 'content': seg}, ensure_ascii=False)}\n\n"
                    tail = pending[safe_end:]
                    cursor = len(pending)
                else:
                    if idx > cursor:
                        seg = pending[cursor:idx]
                        stream_text += seg
                        yield f"data: {json.dumps({'type': 'token', 'content': seg}, ensure_ascii=False)}\n\n"
                    cursor = idx + len(think_open)
                    think_depth = 1
            else:
                idx = pending.find(think_close, cursor)
                if idx == -1:
                    tail = ""
                    cursor = len(pending)
                else:
                    cursor = idx + len(think_close)
                    think_depth = 0
    if think_depth == 0 and tail:
        stream_text += tail
        yield f"data: {json.dumps({'type': 'token', 'content': tail}, ensure_ascii=False)}\n\n"

    if intent == "tutor":
        from app.agents.tutor_agent import tutor_agent
        result_data = tutor_agent._parse_response(stream_text)
    else:
        result_data = _extract_answer(stream_text)

    assistant_msg = ChatMessage(
        id=uuid.uuid4(),
        session_id=session.id,
        role="assistant",
        content=json.dumps({"type": intent, "data": result_data}, ensure_ascii=False),
    )
    db.add(assistant_msg)
    await db.commit()

    yield f"data: {json.dumps({'type': 'result', 'data': {'type': intent, **result_data}}, ensure_ascii=False)}\n\n"
    yield f"data: {json.dumps({'type': 'done'}, ensure_ascii=False)}\n\n"


# ====================================================================
# 单 Agent 意图：直接调用 Agent 实现真流式
# ====================================================================

async def _handle_single_agent_stream(
    intent: str, last_msg: str, student_profile, session, db, student_id: str
):
    """document/mindmap/exercise/path/audio 意图：直接调用 Agent 实现真流式"""
    from app.agents.document_agent import document_agent
    from app.agents.mindmap_agent import mindmap_agent
    from app.agents.exercise_agent import exercise_agent
    from app.services.llm_factory import get_llm_client
    from app.services.anti_hallucination import anti_hallucination

    # 提取知识点
    import re
    kp = last_msg.strip()
    kp = re.sub(r"^(请|帮我|帮忙|给我想?|给我)?(讲解|解释|说明|介绍|生成|出|写|做|画|规划)?(一下|个|份)?\s*", "", kp)
    kp = re.sub(r"(的原理|的代码|的练习|的思维导图|相关内容|相关知识)?\s*$", "", kp)
    kp = kp.strip()
    if len(kp) < 2:
        kp = last_msg[:50]

    yield f"data: {json.dumps({'type': 'progress', 'progress': 0.15, 'message': f'正在分析「{kp}」...'}, ensure_ascii=False)}\n\n"

    if intent == "document":
        # 文档生成：流式返回
        yield f"data: {json.dumps({'type': 'progress', 'progress': 0.3, 'message': '正在生成学习文档...'}, ensure_ascii=False)}\n\n"

        prompt = document_agent._build_prompt(kp, student_profile, "all")
        stream_text = ""
        prev_display_len = 0
        async for token in get_llm_client().chat_stream(
            messages=[{"role": "user", "content": prompt}],
            system=document_agent.SYSTEM_PROMPT,
            max_tokens=4096,
            temperature=0.7,
        ):
            stream_text += token
            # 去掉 <think> 标签后再推送
            display = _strip_think(stream_text)
            new_content = display[prev_display_len:]
            prev_display_len = len(display)
            if new_content:
                yield f"data: {json.dumps({'type': 'token', 'content': new_content}, ensure_ascii=False)}\n\n"

        result = document_agent._parse_response(stream_text)

        # 防幻觉验证
        yield f"data: {json.dumps({'type': 'progress', 'progress': 0.8, 'message': '正在验证内容...'}, ensure_ascii=False)}\n\n"
        validation = await anti_hallucination.validate(
            content=result.get("knowledge", ""),
            knowledge_point=kp,
        )
        result["validation"] = {
            "passed": validation.passed,
            "issues": validation.issues,
            "confidence": validation.confidence,
        }

        result_data = {"type": "document", "data": result}

    elif intent == "mindmap":
        # 思维导图：流式返回
        yield f"data: {json.dumps({'type': 'progress', 'progress': 0.3, 'message': '正在生成思维导图...'}, ensure_ascii=False)}\n\n"

        prompt = mindmap_agent._build_prompt(kp, student_profile)
        stream_text = ""
        prev_display_len = 0
        async for token in get_llm_client().chat_stream(
            messages=[{"role": "user", "content": prompt}],
            system=mindmap_agent.SYSTEM_PROMPT,
            max_tokens=4096,
            temperature=0.7,
        ):
            stream_text += token
            # 去掉 <think> 标签后再推送
            display = _strip_think(stream_text)
            new_content = display[prev_display_len:]
            prev_display_len = len(display)
            if new_content:
                yield f"data: {json.dumps({'type': 'token', 'content': new_content}, ensure_ascii=False)}\n\n"

        result = mindmap_agent._parse_response(stream_text)

        result_data = {"type": "mindmap", "data": result}

    elif intent == "exercise":
        # 练习题：dual-format 流式
        yield f"data: {json.dumps({'type': 'progress', 'progress': 0.3, 'message': '正在生成练习题...'}, ensure_ascii=False)}\n\n"

        # 解析数量参数
        count_match = re.search(r"(\d+)\s*道", last_msg)
        count = int(count_match.group(1)) if count_match else 5

        prompt = exercise_agent._build_prompt(kp, student_profile, "all", count)
        prompt = prompt.replace("请返回 JSON 格式。只返回 JSON。", "请先输出人类可读的完整题目内容，末尾再输出 JSON 数据。")

        STREAM_EXERCISE_SYSTEM = """你是一个练习题生成器。请按以下两部分输出：

前半部分：markdown 格式的人类可读内容（用户直接阅读）
📝 为你生成了 N 道关于「知识点」的练习题：

**1.** 【题型】题目内容（含选项、答案、解析、难度）

---JSON_DATA---
后半部分：与前半部分内容一致的 JSON 数据
{"exercises": [{"type":"choice","question":"...","options":["A. ...","B. ..."],"answer":"B","explanation":"...","difficulty":50,"knowledge_point":"..."}]}

规则：
- type 必须是：choice(选择题)、judge(判断题)、short_answer(简答题)、coding(编程题)
- 选择题 answer 必须是选项字母 A/B/C/D
- 只输出以上内容，不要额外文字"""

        stream_text = ""
        sep = "---JSON_DATA---"
        sep_found = False
        async for token in get_llm_client().chat_stream(
            messages=[{"role": "user", "content": prompt}],
            system=STREAM_EXERCISE_SYSTEM,
            max_tokens=4096,
            temperature=0.7,
        ):
            stream_text += token
            if sep in stream_text:
                sep_found = True
            # exercise 意图不推送 token 内容，只在完成后显示题目列表

        # 解析 JSON
        if sep in stream_text:
            json_part = stream_text.split(sep, 1)[1].strip()
            from app.services.json_parser import parse_json_response
            result = parse_json_response(json_part, {"exercises": []})
        else:
            result = exercise_agent._parse_response(stream_text)

        result_data = {"type": "exercise", "data": result}

    elif intent == "audio":
        # 音频脚本
        yield f"data: {json.dumps({'type': 'progress', 'progress': 0.3, 'message': '正在生成音频脚本...'}, ensure_ascii=False)}\n\n"

        result = await document_agent.generate(
            knowledge_point=kp,
            student_profile=student_profile,
            resource_type="audio",
        )

        result_data = {"type": "audio", "data": result}

    else:
        result_data = {"type": intent, "data": {"message": f"不支持的意图: {intent}"}}

    # 保存 assistant 消息
    assistant_msg = ChatMessage(
        id=uuid.uuid4(),
        session_id=session.id,
        role="assistant",
        content=json.dumps(result_data, ensure_ascii=False),
    )
    db.add(assistant_msg)
    await db.commit()

    yield f"data: {json.dumps({'type': 'result', 'data': result_data}, ensure_ascii=False)}\n\n"
    yield f"data: {json.dumps({'type': 'done'}, ensure_ascii=False)}\n\n"


# ====================================================================
# 其他意图：StateGraph 多智能体编排（保留用于复合意图）
# ====================================================================

async def _handle_state_graph_stream(
    req: ChatRequest, history: list, student_profile, session, db
):
    """非 tutor/chat 意图：走 StateGraph 多智能体编排"""
    yield f"data: {json.dumps({'type': 'progress', 'progress': 0.1, 'message': '正在分析请求...'}, ensure_ascii=False)}\n\n"

    # 构建 StateGraph 初始状态
    initial_state = {
        "student_id": req.student_id,
        "session_id": str(session.id),
        "user_message": req.message,
        "messages": history,
        "student_profile": student_profile,
        "intent_params": {},
        "course_topics": req.course_topics,
    }

    # 通过 StateGraph 执行（累积所有节点的输出作为最终状态）
    final_state: dict = {}
    async for event in master_agent.run_stream(initial_state):
        if "error" in event:
            error_state = event["error"]
            yield f"data: {json.dumps({'type': 'error', 'message': error_state.get('error', '未知错误')}, ensure_ascii=False)}\n\n"
            yield f"data: {json.dumps({'type': 'done'}, ensure_ascii=False)}\n\n"
            return

        node_name = list(event.keys())[0]
        node_output = event[node_name]

        # 推进度
        if isinstance(node_output, dict) and node_output.get("progress"):
            yield f"data: {json.dumps({'type': 'progress', 'progress': node_output['progress'], 'message': node_output.get('current_step', '')}, ensure_ascii=False)}\n\n"

        # 推送 Agent 执行进度（让用户知道正在生成内容）
        if isinstance(node_output, dict):
            if node_output.get("document_result"):
                yield f"data: {json.dumps({'type': 'progress', 'progress': 0.6, 'message': '文档生成完成，正在整理内容...'}, ensure_ascii=False)}\n\n"
            elif node_output.get("mindmap_result"):
                yield f"data: {json.dumps({'type': 'progress', 'progress': 0.6, 'message': '思维导图生成完成，正在整理内容...'}, ensure_ascii=False)}\n\n"
            elif node_output.get("exercise_result"):
                yield f"data: {json.dumps({'type': 'progress', 'progress': 0.6, 'message': '练习题生成完成，正在整理内容...'}, ensure_ascii=False)}\n\n"

        # 累积：每个节点的输出合并到 final_state
        if isinstance(node_output, dict):
            final_state.update(node_output)

    # StateGraph 执行完毕 → 推结果
    if not final_state or not isinstance(final_state, dict):
        yield f"data: {json.dumps({'type': 'error', 'message': 'StateGraph 执行异常'}, ensure_ascii=False)}\n\n"
        yield f"data: {json.dumps({'type': 'done'}, ensure_ascii=False)}\n\n"
        return

    final_response = final_state.get("final_response", "任务处理完成。")
    final_response = _strip_think(final_response)  # 去掉 <think> 标签
    resources = final_state.get("resources", [])

    # 切片推 token（让前端实时看到内容，更小的切片让显示更平滑）
    chunk_size = 8
    for i in range(0, len(final_response), chunk_size):
        chunk = final_response[i:i + chunk_size]
        if chunk:
            yield f"data: {json.dumps({'type': 'token', 'content': chunk}, ensure_ascii=False)}\n\n"

    # 推完整结果
    result_data = {
        "type": "multi",
        "data": {
            "final_response": final_response,
            "resources": resources,
            "intent": final_state.get("intent", ""),
        },
    }
    yield f"data: {json.dumps({'type': 'result', 'data': result_data}, ensure_ascii=False)}\n\n"

    # 存储 assistant 消息
    assistant_msg = ChatMessage(
        id=uuid.uuid4(),
        session_id=session.id,
        role="assistant",
        content=json.dumps(result_data, ensure_ascii=False),
    )
    db.add(assistant_msg)
    await db.commit()

    # 异步更新画像（基于本次对话内容）
    try:
        await _update_profile_by_conversation(
            db=db,
            student_id=req.student_id,
            user_message=req.message,
            assistant_response=final_response,
            intent=final_state.get("intent", ""),
        )
    except Exception as e:
        logger.warning(f"画像更新失败（不影响对话）: {e}")

    yield f"data: {json.dumps({'type': 'done'}, ensure_ascii=False)}\n\n"


@router.post("/stream")
async def stream_chat(req: ChatRequest, db: AsyncSession = Depends(get_db), user: Student = Depends(get_current_user)):
    """SSE 流式对话 — Master Agent 路由 + 逐 token 流式返回"""
    if str(user.id) != req.student_id:
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="只能操作自己的学习数据")

    # 获取或创建会话
    if req.session_id:
        result = await db.execute(
            select(ChatSession).where(ChatSession.id == uuid.UUID(req.session_id))
        )
        session = result.scalar_one_or_none()
    else:
        session = None

    if not session:
        # 用 LLM 生成简短标题
        title = req.message[:50]
        try:
            title_prompt = f"用10个字以内概括这个请求的核心内容，只输出标题，不要其他文字：{req.message[:100]}"
            title_response = await get_llm_client().chat(
                messages=[{"role": "user", "content": title_prompt}],
                system="你是一个标题生成器。用简短的中文概括用户请求的核心内容。",
                max_tokens=30,
                temperature=0.3,
            )
            generated_title = title_response.get("content", "").strip().strip('"').strip("'")
            if generated_title and len(generated_title) <= 20:
                title = generated_title
        except Exception:
            pass

        session = ChatSession(
            id=uuid.uuid4(),
            student_id=uuid.UUID(req.student_id),
            title=title,
        )
        db.add(session)
        await db.commit()

    # 保存用户消息
    user_msg = ChatMessage(
        id=uuid.uuid4(),
        session_id=session.id,
        role="user",
        content=req.message,
    )
    db.add(user_msg)
    await db.commit()

    # 获取对话历史
    result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.session_id == session.id)
        .order_by(ChatMessage.created_at)
    )
    history = [{"role": m.role, "content": m.content} for m in result.scalars().all()]

    # 获取学生画像
    profile_result = await db.execute(
        select(StudentProfile)
        .where(StudentProfile.student_id == uuid.UUID(req.student_id))
        .limit(1)
    )
    profile = profile_result.scalar_one_or_none()
    student_profile = profile.dimensions if profile else None

    async def event_generator():
        try:
            yield f"data: {json.dumps({'type': 'session', 'session_id': str(session.id)}, ensure_ascii=False)}\n\n"

            last_msg = history[-1].get("content", "") if history else ""

            # 关键词快速路由判断意图
            intent = _quick_route(last_msg)

            # tutor/chat → 走原路径（真逐 token 流式）
            if intent in ("tutor", "chat"):
                async for evt in _handle_tutor_chat_stream(
                    intent, last_msg, history, student_profile, session, db
                ):
                    yield evt
                return

            # 单 Agent 意图 → 走直接调用（真流式）
            single_agent_intents = ("document", "mindmap", "exercise", "audio")
            if intent in single_agent_intents:
                async for evt in _handle_single_agent_stream(
                    intent, last_msg, student_profile, session, db, req.student_id
                ):
                    yield evt
                return

            # 复合意图 → 走 StateGraph 多智能体编排
            async for evt in _handle_state_graph_stream(
                req, history, student_profile, session, db
            ):
                yield evt

        except Exception as e:
            import traceback
            yield f"data: {json.dumps({'type': 'error', 'message': f'服务器内部错误: {str(e)}'}, ensure_ascii=False)}\n\n"
            yield f"data: {json.dumps({'type': 'done'}, ensure_ascii=False)}\n\n"
            logger.exception("[chat/stream] 异常")

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/sessions/{student_id}")
async def list_sessions(
    student_id: uuid.UUID = Depends(valid_student_id),
    db: AsyncSession = Depends(get_db),
    user: Student = Depends(get_current_user),
):
    """获取学生的会话列表"""
    if user.id != student_id:
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="只能查看自己的数据")
    result = await db.execute(
        select(ChatSession)
        .where(ChatSession.student_id == student_id)
        .order_by(ChatSession.updated_at.desc())
    )
    sessions = result.scalars().all()
    return [
        {
            "id": str(s.id),
            "title": s.title,
            "session_type": s.session_type,
            "created_at": s.created_at.isoformat() if s.created_at else None,
        }
        for s in sessions
    ]


@router.get("/sessions/{session_id}/messages")
async def list_messages(
    session_id: uuid.UUID = Depends(valid_session_id),
    db: AsyncSession = Depends(get_db),
    user: Student = Depends(get_current_user),
):
    """获取会话的消息历史"""
    sess_result = await db.execute(
        select(ChatSession).where(ChatSession.id == session_id)
    )
    session = sess_result.scalar_one_or_none()
    if not session or session.student_id != user.id:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="会话不存在")
    result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.session_id == session_id)
        .order_by(ChatMessage.created_at)
    )
    messages = result.scalars().all()
    return [
        {
            "id": str(m.id),
            "role": m.role,
            "content": m.content,
            "created_at": m.created_at.isoformat() if m.created_at else None,
        }
        for m in messages
    ]


@router.delete("/sessions/{session_id}")
async def delete_session(
    session_id: uuid.UUID = Depends(valid_session_id),
    db: AsyncSession = Depends(get_db),
    user: Student = Depends(get_current_user),
):
    """删除会话及其所有消息"""
    from fastapi import HTTPException
    from sqlalchemy import delete as sql_delete

    sess_result = await db.execute(
        select(ChatSession).where(ChatSession.id == session_id)
    )
    session = sess_result.scalar_one_or_none()
    if not session or session.student_id != user.id:
        raise HTTPException(status_code=404, detail="会话不存在")

    # 先删消息，再删会话
    await db.execute(
        sql_delete(ChatMessage).where(ChatMessage.session_id == session_id)
    )
    await db.delete(session)
    await db.commit()
    return {"status": "ok", "message": "会话已删除"}


def _extract_answer(text: str) -> dict:
    """从 LLM 输出中提取 answer：支持 JSON 格式和纯文本"""
    import re
    # 去掉 <think> 标签
    text = re.sub(r"<think>[\s\S]*?</think>", "", text).strip()
    # 尝试解析完整 JSON
    try:
        data = json.loads(text)
        if isinstance(data, dict) and "answer" in data:
            return {"type": "chat", "answer": data["answer"], "suggestion": data.get("suggestion", "")}
    except (json.JSONDecodeError, TypeError):
        pass
    # 用花括号匹配提取 JSON 对象（处理多行 JSON）
    if "{" in text:
        start = text.index("{")
        depth = 0
        for i in range(start, len(text)):
            if text[i] == "{":
                depth += 1
            elif text[i] == "}":
                depth -= 1
                if depth == 0:
                    try:
                        data = json.loads(text[start:i + 1])
                        if isinstance(data, dict) and "answer" in data:
                            return {"type": "chat", "answer": data["answer"], "suggestion": data.get("suggestion", "")}
                    except (json.JSONDecodeError, TypeError):
                        pass
                    break
    # 纯文本直接返回
    return {"type": "chat", "answer": text}


def _quick_route(msg: str) -> str | None:
    """关键词快速路由，返回 intent 名或 None（需 LLM 判断）
    与 master_agent._quick_route 保持同步，复合意图优先匹配。"""
    import re as _re
    msg_lower = msg.lower()

    # 复合意图优先（必须在单一意图之前）
    compound_map = {
        "learn_and_practice": ["讲解.*并.*出", "学习.*练习", "讲解.*练习题"],
        "resource_generate": ["完整资料", "全套资料", "所有资料", "全部资料"],
        "full_course": ["完整学习计划", "整体学习", "全套规划"],
    }
    for intent, patterns in compound_map.items():
        for pattern in patterns:
            if _re.search(pattern, msg_lower):
                return intent

    # 单一意图
    non_tutor_intents = {
        "profile": ["画像", "分析我的", "了解我", "学习情况"],
        "mindmap": ["思维导图", "脑图", "知识结构", "导图", "结构图"],
        "exercise": ["练习", "题目", "出题", "测试", "考核", "做题"],
        "document": ["教程", "学习材料", "讲解", "解释", "介绍一下", "说明"],
        "audio": ["音频", "语音讲解"],
    }
    for intent, words in non_tutor_intents.items():
        if any(w in msg_lower for w in words):
            return intent

    # tutor 最后检查（避免"讲解...并出题"被误判为 tutor）
    # 简单问题（"什么是 X"、"为什么XX"）走 tutor 真流式
    tutor_keywords = [
        "为什么", "怎么", "什么", "原理", "区别", "对比", "比较",
        "等于", "多少", "几", "？", "?", "怎么算", "如何", "请问", "帮我说", "帮我讲",
        "然后", "接下来", "接着", "继续", "还有", "再说", "另外", "补充",
        "对吗", "是吗", "对吧", "是不是", "对不对",
    ]
    # 短消息（<15字）没匹配到其他意图，默认走 tutor（多轮追问场景）
    if len(msg.strip()) < 15 and not any(
        w in msg_lower for w in ["画像", "思维导图", "脑图", "练习", "题目", "出题", "教程", "学习材料", "音频", "讲解", "解释"]
    ):
        return "tutor"
    if any(w in msg_lower for w in tutor_keywords):
        return "tutor"

    return None


class RecommendQuestionsRequest(BaseModel):
    session_id: str | None = None
    count: int = 4


@router.post("/recommend-questions")
async def recommend_questions(
    req: RecommendQuestionsRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Student = Depends(get_current_user),
):
    """返回个性化推荐问题列表（基于画像/评估/对话/题库/路径）"""
    questions = await chat_recommendation_service.get_recommendations(
        db=db,
        student_id=str(current_user.id),
        session_id=req.session_id,
        count=req.count,
    )
    return {"questions": questions}
    """从用户消息中提取知识点（与 master_agent._extract_intent_params 同步）"""
    import re
    kp = msg.strip()
    # 去掉常见动词前缀
    kp = re.sub(r"^(请|帮我|帮忙|给我想?|给我)?(讲解|解释|说明|介绍|生成|出|写|做|画|规划)?(一下|个|份)?\s*", "", kp)
    # 去掉尾部修饰
    kp = re.sub(r"(的原理|的代码|的练习|的思维导图|的学习路径|相关内容|相关知识)?\s*$", "", kp)
    kp = kp.strip()
    if len(kp) < 2:
        kp = msg[:50]
    return kp
