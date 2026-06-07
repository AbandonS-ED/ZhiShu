"""聊天 API — SSE 流式对话 + Master Agent 编排"""

import json
import uuid
from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.models.chat_session import ChatSession
from app.models.chat_message import ChatMessage
from app.models.student_profile import StudentProfile
from app.agents.master_agent import master_agent

router = APIRouter()


class ChatRequest(BaseModel):
    student_id: str
    session_id: str | None = None
    message: str
    course_topics: list[str] | None = None


@router.post("/stream")
async def stream_chat(req: ChatRequest, db: AsyncSession = Depends(get_db)):
    """SSE 流式对话 — Master Agent 自动路由到对应子 Agent"""

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
        # 发送会话信息
        yield f"data: {json.dumps({'type': 'session', 'session_id': str(session.id)}, ensure_ascii=False)}\n\n"

        # 构建 Master Agent 状态
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

        # 执行 Master Agent
        yield f"data: {json.dumps({'type': 'progress', 'progress': 0.3, 'message': '正在分析请求...'}, ensure_ascii=False)}\n\n"

        final_state = await master_agent.run(state)

        if final_state.get("error"):
            yield f"data: {json.dumps({'type': 'error', 'message': final_state['error']}, ensure_ascii=False)}\n\n"
            return

        yield f"data: {json.dumps({'type': 'progress', 'progress': 0.7, 'message': '正在生成内容...'}, ensure_ascii=False)}\n\n"

        result_data = final_state.get("result", {})

        # 保存助手消息
        assistant_msg = ChatMessage(
            id=uuid.uuid4(),
            session_id=session.id,
            role="assistant",
            content=json.dumps(result_data, ensure_ascii=False),
        )
        db.add(assistant_msg)
        await db.commit()

        # 发送结果
        yield f"data: {json.dumps({'type': 'result', 'data': result_data}, ensure_ascii=False)}\n\n"
        yield f"data: {json.dumps({'type': 'done'}, ensure_ascii=False)}\n\n"

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
