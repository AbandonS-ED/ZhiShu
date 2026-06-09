"""聊天 API — SSE 流式对话 + Master Agent 编排"""

import json
import re
import uuid
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.models.chat_session import ChatSession
from app.models.chat_message import ChatMessage
from app.models.student_profile import StudentProfile
from app.agents.master_agent import master_agent
from app.services import minimax_client as mc_module
from app.services.json_parser import parse_json_response

router = APIRouter()

# 流式专用 system prompt — 让 LLM 先输出人类可读文本，末尾跟 JSON
STREAM_EXERCISE_SYSTEM = """你是一个练习题生成器。请按以下两部分输出：

前半部分：markdown 格式的人类可读内容（用户直接阅读）
📝 为你生成了 N 道关于「知识点」的练习题：

**1.** 【题型】题目内容（含选项、答案、解析、难度）

**2.** ...

---JSON_DATA---
后半部分：与前半部分内容一致的 JSON 数据
{"exercises": [{"type":"choice/judge/short_answer/coding","question":"...","options":["A. ...","B. ..."],"answer":"...","explanation":"...","difficulty":50,"knowledge_point":"..."}]}

规则：
- 先输出前半部分（markdown），再输出 ---JSON_DATA---，再输出 JSON
- 两部分内容必须完全一致
- type 必须是以下值之一：choice(选择题)、judge(判断题)、short_answer(简答题)、coding(编程题)
- 只输出以上内容，不要额外文字"""


def _strip_think(text: str) -> str:
    """去掉 <think>...</think> 标签及其内容"""
    result = ""
    depth = 0
    i = 0
    while i < len(text):
        if text[i:i+7] == "<think>":
            depth += 1
            i += 7
        elif text[i:i+8] == "</think>":
            depth = max(0, depth - 1)
            i += 8
        elif depth == 0:
            result += text[i]
            i += 1
        else:
            i += 1
    if "<think>" in result:
        idx = result.rfind("<think>")
        result = result[:idx]
    return result


class ChatRequest(BaseModel):
    student_id: str
    session_id: str | None = None
    message: str
    course_topics: list[str] | None = None


@router.post("/stream")
async def stream_chat(req: ChatRequest, db: AsyncSession = Depends(get_db)):
    """SSE 流式对话 — Master Agent 路由 + 逐 token 流式返回"""

    # 获取或创建会话
    if req.session_id:
        result = await db.execute(
            select(ChatSession).where(ChatSession.id == uuid.UUID(req.session_id))
        )
        session = result.scalar_one_or_none()
    else:
        session = None

    if not session:
        session = ChatSession(
            id=uuid.uuid4(),
            student_id=uuid.UUID(req.student_id),
            title=req.message[:50],
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
        .where(StudentProfile.is_current == True)
        .order_by(StudentProfile.version.desc())
        .limit(1)
    )
    profile = profile_result.scalar_one_or_none()
    student_profile = profile.dimensions if profile else None

    async def event_generator():
        try:
            yield f"data: {json.dumps({'type': 'session', 'session_id': str(session.id)}, ensure_ascii=False)}\n\n"

            state = {
                "request_type": "",
                "student_id": req.student_id,
                "messages": history,
                "student_profile": student_profile,
                "knowledge_point": None,
                "course_topics": req.course_topics,
                "context_chunks": None,
                "result": None,
                "error": None,
            }

            yield f"data: {json.dumps({'type': 'progress', 'progress': 0.2, 'message': '正在分析请求...'}, ensure_ascii=False)}\n\n"

            last_msg = state["messages"][-1].get("content", "") if state["messages"] else ""
            request_type = _quick_route(last_msg)

            if not request_type:
                state = await master_agent.route(state)
                if state.get("error"):
                    yield f"data: {json.dumps({'type': 'error', 'message': state['error']}, ensure_ascii=False)}\n\n"
                    return
                request_type = state.get("request_type", "chat")
            else:
                state["request_type"] = request_type
                if not state.get("knowledge_point"):
                    state["knowledge_point"] = _extract_knowledge_point(last_msg)

            yield f"data: {json.dumps({'type': 'progress', 'progress': 0.4, 'message': f'已路由到 {request_type} Agent，开始生成...'}, ensure_ascii=False)}\n\n"

            async def yield_token(text: str):
                if text:
                    return f"data: {json.dumps({'type': 'token', 'content': text}, ensure_ascii=False)}\n\n"
                return None

            if request_type in ("tutor", "chat"):
                last_msg = state["messages"][-1].get("content", "")

                if request_type == "tutor":
                    from app.agents.tutor_agent import tutor_agent
                    from app.services.vector_store import vector_store
                    from app.services.embedding_service import embedding_service
                    from app.core.database import async_session as db_async_session

                    try:
                        query_embedding = await embedding_service.embed_single(last_msg)
                        async with db_async_session() as rag_db:
                            chunks = await vector_store.search(rag_db, query_embedding, top_k=5)
                        state["context_chunks"] = chunks
                    except Exception as e:
                        print(f"[chat/stream] RAG 检索失败: {e}")
                        state["context_chunks"] = None

                    user_prompt = tutor_agent._build_prompt(
                        last_msg, state.get("context_chunks"), student_profile, output_format="text"
                    )
                    system_prompt = tutor_agent.STREAM_PROMPT
                else:
                    user_prompt = None
                    system_prompt = "你是一个友好的 AI 学习助手。用简洁清晰的中文回答。直接输出回答内容，不要返回 JSON 格式，不要使用 <think> 标签。"

                messages = [{"role": "user", "content": user_prompt or last_msg}]
                print(f"[chat/stream] 开始流式调用 request_type={request_type}, msg_count={len(messages)}")

                think_depth = 0
                think_open = "<think>"
                think_close = "</think>"
                tail = ""
                stream_text = ""
                async for token in mc_module.minimax_client.chat_stream(
                    messages=messages,
                    system=system_prompt,
                    max_tokens=4096,
                    temperature=0.5 if request_type == "tutor" else 0.7,
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
                                    out = await yield_token(seg)
                                    if out:
                                        yield out
                                tail = pending[safe_end:]
                                cursor = len(pending)
                            else:
                                if idx > cursor:
                                    seg = pending[cursor:idx]
                                    stream_text += seg
                                    out = await yield_token(seg)
                                    if out:
                                        yield out
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
                    out = await yield_token(tail)
                    if out:
                        yield out
                print(f"[chat/stream] LLM 流式结束, stream长度={len(stream_text)}")

                if request_type == "tutor":
                    result_data = tutor_agent._parse_response(stream_text)
                else:
                    result_data = _extract_answer(stream_text)

                assistant_msg = ChatMessage(
                    id=uuid.uuid4(),
                    session_id=session.id,
                    role="assistant",
                    content=json.dumps({"type": request_type, "data": result_data}, ensure_ascii=False),
                )
                db.add(assistant_msg)
                await db.commit()

                yield f"data: {json.dumps({'type': 'result', 'data': {'type': request_type, **result_data}}, ensure_ascii=False)}\n\n"

            elif request_type in ("exercise", "document", "path", "mindmap", "profile"):
                kp = state.get("knowledge_point", "通用知识")

                use_dual_format = False
                if request_type == "exercise":
                    from app.agents.exercise_agent import exercise_agent
                    from app.services.anti_hallucination import anti_hallucination as ah
                    prompt = exercise_agent._build_prompt(kp, student_profile, "all", 5).replace(
                        "请返回 JSON 格式。只返回 JSON。", "请先输出人类可读的完整题目内容，末尾再输出 JSON 数据。"
                    )
                    system = STREAM_EXERCISE_SYSTEM
                    parse = exercise_agent._parse_response
                    use_dual_format = True

                elif request_type == "document":
                    from app.agents.document_agent import document_agent
                    from app.services.anti_hallucination import anti_hallucination as ah
                    prompt = document_agent._build_prompt(kp, student_profile, "all")
                    system = document_agent.SYSTEM_PROMPT
                    parse = document_agent._parse_response

                elif request_type == "path":
                    from app.agents.path_agent import path_agent
                    topics = state.get("course_topics") or [kp]
                    prompt = path_agent._build_prompt(topics, student_profile, 30)
                    system = path_agent.SYSTEM_PROMPT
                    parse = path_agent._parse_response

                elif request_type == "mindmap":
                    from app.agents.mindmap_agent import mindmap_agent
                    prompt = mindmap_agent._build_prompt(kp, student_profile)
                    system = mindmap_agent.SYSTEM_PROMPT
                    parse = mindmap_agent._parse_response

                else:
                    from app.agents.profile_agent import profile_agent
                    prompt = profile_agent._build_user_prompt(state["messages"], student_profile)
                    system = profile_agent.system_prompt
                    parse = profile_agent._parse_profile

                stream_text = ""
                token_count = 0
                sep = "---JSON_DATA---"
                sep_found = False
                prev_display_len = 0

                if use_dual_format:
                    # 双格式：实时推 LLM token（过滤 think），遇 ---JSON_DATA--- 停止
                    async for token in mc_module.minimax_client.chat_stream(
                        messages=[{"role": "user", "content": prompt}],
                        system=system,
                        max_tokens=4096,
                        temperature=0.7,
                    ):
                        stream_text += token
                        token_count += 1
                        if sep in stream_text:
                            sep_found = True
                        if not sep_found:
                            display = _strip_think(stream_text)
                            new_content = display[prev_display_len:]
                            prev_display_len = len(display)
                            if new_content:
                                yield f"data: {json.dumps({'type': 'token', 'content': new_content}, ensure_ascii=False)}\n\n"
                            elif token_count % 100 == 0:
                                yield f"data: {json.dumps({'type': 'progress', 'message': f'正在由 {request_type} Agent 生成... ({token_count})'}, ensure_ascii=False)}\n\n"
                else:
                    async for token in mc_module.minimax_client.chat_stream(
                        messages=[{"role": "user", "content": prompt}],
                        system=system,
                        max_tokens=4096,
                        temperature=0.7,
                    ):
                        stream_text += token
                        token_count += 1
                        if token_count % 100 == 0:
                            yield f"data: {json.dumps({'type': 'progress', 'message': f'正在由 {request_type} Agent 生成... ({token_count})'}, ensure_ascii=False)}\n\n"

                print(f"[chat/stream] {request_type} 流式结束, len={len(stream_text)}, tokens={token_count}, dual={use_dual_format}")

                if use_dual_format and sep in stream_text:
                    json_part = stream_text.split(sep, 1)[1].strip()
                    result = parse_json_response(json_part, {"exercises": []})
                else:
                    result = parse(stream_text)
                if request_type == "mindmap":
                    result["mermaid_code"] = mindmap_agent._validate_mermaid(result.get("mermaid_code", ""))

                result_data = {"type": request_type, "data": result}

                display_text = ""
                if use_dual_format:
                    # 双格式已在 LLM 流式时实时推 token，这里不需要再推
                    pass
                elif request_type == "exercise":
                    exs = result.get("exercises", [])
                    display_text = f"📝 为你生成了 **{len(exs)}** 道题：\n\n"
                    for i, ex in enumerate(exs, 1):
                        q = ex.get("question", "")
                        display_text += f"{i}. {q}\n\n"
                elif request_type == "document":
                    display_text = result.get("knowledge", "") or ""
                    if not display_text:
                        display_text = json.dumps(result, ensure_ascii=False)
                elif request_type == "path":
                    display_text = f"📚 **{result.get('title', '学习路径')}**\n\n"
                    display_text += f"{result.get('description', '')}\n\n"
                    display_text += f"共 {len(result.get('nodes', []))} 个知识点，{len(result.get('edges', []))} 条依赖关系"
                elif request_type == "mindmap":
                    display_text = f"🧠 **{result.get('title', '思维导图')}**\n\n"
                    display_text += f"```mermaid\n{result.get('mermaid_code', '')}\n```"
                else:
                    display_text = json.dumps(result, ensure_ascii=False, indent=2)

                if display_text:
                    chunk_size = 16
                    for i in range(0, len(display_text), chunk_size):
                        chunk = display_text[i:i + chunk_size]
                        if chunk:
                            out = await yield_token(chunk)
                            if out:
                                yield out

                assistant_msg = ChatMessage(
                    id=uuid.uuid4(),
                    session_id=session.id,
                    role="assistant",
                    content=json.dumps(result_data, ensure_ascii=False),
                )
                db.add(assistant_msg)
                await db.commit()

                yield f"data: {json.dumps({'type': 'result', 'data': result_data}, ensure_ascii=False)}\n\n"

            else:
                state = await master_agent.execute(state)

                if state.get("error"):
                    yield f"data: {json.dumps({'type': 'error', 'message': state['error']}, ensure_ascii=False)}\n\n"
                    return

                result_data = state.get("result", {})

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
        except Exception as e:
            import traceback
            yield f"data: {json.dumps({'type': 'error', 'message': f'服务器内部错误: {str(e)}'}, ensure_ascii=False)}\n\n"
            print(f"[chat/stream] 异常: {traceback.format_exc()}")

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.get("/sessions/{student_id}")
async def list_sessions(student_id: str, db: AsyncSession = Depends(get_db)):
    """获取学生的会话列表"""
    result = await db.execute(
        select(ChatSession)
        .where(ChatSession.student_id == uuid.UUID(student_id))
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
async def list_messages(session_id: str, db: AsyncSession = Depends(get_db)):
    """获取会话的消息历史"""
    result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.session_id == uuid.UUID(session_id))
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
    """关键词快速路由，返回 agent 名或 None（需 LLM 判断）"""
    msg_lower = msg.lower()
    # 明确的 agent 关键词（流式 agent 优先）
    keywords = {
        "tutor": ["讲解", "为什么", "怎么", "是什么", "解释", "原理", "区别", "对比", "比较", " vs ", " vs", "vs "],
        "profile": ["画像", "分析我的", "了解我", "学习情况"],
        "mindmap": ["思维导图", "脑图", "知识结构", "导图", "结构图"],
        "exercise": ["练习", "题目", "出题", "测试", "考核", "做题"],
        "path": ["路径", "规划", "计划", "学习安排", "路线"],
        "document": ["教程", "学习材料"],
    }
    for agent, words in keywords.items():
        if any(w in msg_lower for w in words):
            return agent
    return None


def _extract_knowledge_point(msg: str) -> str:
    """从用户消息中提取知识点"""
    import re
    # 去掉常见动词前缀
    cleaned = re.sub(r"^(请|帮我|帮忙|给我想?|给我)?(讲解|解释|说明|介绍|生成|出|写|做|画|规划)?(一下|个|份)?\s*", "", msg)
    # 去掉尾部修饰
    cleaned = re.sub(r"(的原理|的代码|的练习|的思维导图|的学习路径|相关内容|相关知识)?\s*$", "", cleaned)
    cleaned = cleaned.strip()
    if len(cleaned) > 1:
        return cleaned
    # 回退：取消息核心部分
    return msg[:50]
