"""Admin API — 管理后台"""
import uuid
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, func as sa_func, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.student import Student
from app.models.resource import Resource
from app.models.learning_path import LearningPath
from app.models.chat_session import ChatSession
from app.models.chat_message import ChatMessage
from app.models.exercise import Exercise
from app.models.document_chunk import DocumentChunk
from app.core.agent_metrics import agent_metrics

router = APIRouter()


def _require_admin(user: Student):
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="仅管理员可操作")


# ====================================================================
# 仪表盘统计
# ====================================================================

@router.get("/stats")
async def get_stats(
    db: AsyncSession = Depends(get_db),
    user: Student = Depends(get_current_user),
):
    _require_admin(user)

    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)

    # 各表计数
    user_count = (await db.execute(select(sa_func.count()).select_from(Student).where(Student.role == "student"))).scalar() or 0
    admin_count = (await db.execute(select(sa_func.count()).select_from(Student).where(Student.role == "admin"))).scalar() or 0
    resource_count = (await db.execute(select(sa_func.count()).select_from(Resource))).scalar() or 0
    exercise_count = (await db.execute(select(sa_func.count()).select_from(Exercise))).scalar() or 0
    exercise_bank_count = (await db.execute(select(sa_func.count()).select_from(Text("1")) if False else text("SELECT count(*) FROM exercise_bank"))).scalar() or 0
    path_count = (await db.execute(select(sa_func.count()).select_from(LearningPath))).scalar() or 0
    chat_count = (await db.execute(select(sa_func.count()).select_from(ChatSession))).scalar() or 0
    doc_count = (await db.execute(select(sa_func.count()).select_from(DocumentChunk))).scalar() or 0

    # 今日活跃（有学习记录的用户）
    today_active = (await db.execute(
        select(sa_func.count(sa_func.distinct(text("student_id"))))
        .select_from(text("learning_records"))
        .where(text(f"created_at >= '{today_start.isoformat()}'"))
    )).scalar() or 0

    # 今日新增资源
    today_new_resources = (await db.execute(
        select(sa_func.count()).select_from(Resource)
        .where(Resource.created_at >= today_start)
    )).scalar() or 0

    return {
        "total_users": user_count,
        "admin_count": admin_count,
        "total_resources": resource_count,
        "total_exercises": exercise_count + exercise_bank_count,
        "total_paths": path_count,
        "total_chats": chat_count,
        "total_documents": doc_count,
        "today_active": today_active,
        "today_new_resources": today_new_resources,
    }


# ====================================================================
# 7天趋势
# ====================================================================

@router.get("/trends")
async def get_trends(
    days: int = Query(7, ge=1, le=30),
    db: AsyncSession = Depends(get_db),
    user: Student = Depends(get_current_user),
):
    _require_admin(user)

    now = datetime.now(timezone.utc)
    labels = []
    registrations = []
    resources = []
    for i in range(days - 1, -1, -1):
        day_start = (now - timedelta(days=i)).replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = day_start + timedelta(days=1)
        labels.append(day_start.strftime("%m-%d"))
        reg = (await db.execute(
            select(sa_func.count()).select_from(Student)
            .where(Student.created_at >= day_start, Student.created_at < day_end)
        )).scalar() or 0
        registrations.append(reg)
        res = (await db.execute(
            select(sa_func.count()).select_from(Resource)
            .where(Resource.created_at >= day_start, Resource.created_at < day_end)
        )).scalar() or 0
        resources.append(res)

    return {
        "labels": labels,
        "registrations": registrations,
        "resources": resources,
    }


# ====================================================================
# 用户管理
# ====================================================================

@router.get("/users")
async def list_users(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: str | None = None,
    role: str | None = None,
    db: AsyncSession = Depends(get_db),
    user: Student = Depends(get_current_user),
):
    _require_admin(user)

    q = select(Student)
    count_q = select(sa_func.count()).select_from(Student)

    if search:
        ilike = f"%{search}%"
        q = q.where(Student.name.ilike(ilike) | Student.student_no.ilike(ilike))
        count_q = count_q.where(Student.name.ilike(ilike) | Student.student_no.ilike(ilike))
    if role:
        q = q.where(Student.role == role)
        count_q = count_q.where(Student.role == role)

    total = (await db.execute(count_q)).scalar() or 0
    result = await db.execute(
        q.order_by(Student.created_at.desc())
        .offset((page - 1) * page_size).limit(page_size)
    )
    rows = result.scalars().all()

    items = []
    for r in rows:
        # 统计每个用户的资源数和题数
        res_count = (await db.execute(
            select(sa_func.count()).select_from(Resource)
            .where(Resource.student_id == r.id)
        )).scalar() or 0
        ex_count = (await db.execute(
            select(sa_func.count()).select_from(Exercise)
            .where(Exercise.student_id == r.id)
        )).scalar() or 0

        items.append({
            "id": str(r.id),
            "student_no": r.student_no,
            "name": r.name,
            "email": r.email or "",
            "role": r.role or "student",
            "is_active": r.is_active if r.is_active is not None else True,
            "resource_count": res_count,
            "exercise_count": ex_count,
            "last_login": r.last_login.isoformat() if r.last_login else None,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        })

    return {"items": items, "total": total, "page": page, "page_size": page_size}


@router.get("/users/{student_id}")
async def get_user_detail(
    student_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: Student = Depends(get_current_user),
):
    _require_admin(user)

    result = await db.execute(select(Student).where(Student.id == student_id))
    target = result.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="用户不存在")

    res_count = (await db.execute(
        select(sa_func.count()).select_from(Resource).where(Resource.student_id == target.id)
    )).scalar() or 0
    ex_count = (await db.execute(
        select(sa_func.count()).select_from(Exercise).where(Exercise.student_id == target.id)
    )).scalar() or 0
    path_count = (await db.execute(
        select(sa_func.count()).select_from(LearningPath).where(LearningPath.student_id == target.id)
    )).scalar() or 0

    return {
        "id": str(target.id),
        "student_no": target.student_no,
        "name": target.name,
        "email": target.email or "",
        "role": target.role or "student",
        "is_active": target.is_active if target.is_active is not None else True,
        "resource_count": res_count,
        "exercise_count": ex_count,
        "path_count": path_count,
        "last_login": target.last_login.isoformat() if target.last_login else None,
        "created_at": target.created_at.isoformat() if target.created_at else None,
    }


class UserUpdate(BaseModel):
    is_active: bool | None = None
    name: str | None = None


@router.put("/users/{student_id}")
async def update_user(
    student_id: uuid.UUID,
    req: UserUpdate,
    db: AsyncSession = Depends(get_db),
    user: Student = Depends(get_current_user),
):
    _require_admin(user)

    result = await db.execute(select(Student).where(Student.id == student_id))
    target = result.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="用户不存在")

    if req.is_active is not None:
        target.is_active = req.is_active
    if req.name is not None:
        target.name = req.name

    await db.commit()
    return {"message": "更新成功"}


# ====================================================================
# 资源管理
# ====================================================================

@router.get("/resources")
async def list_resources(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    student_id: uuid.UUID | None = None,
    db: AsyncSession = Depends(get_db),
    user: Student = Depends(get_current_user),
):
    _require_admin(user)

    q = select(Resource)
    count_q = select(sa_func.count()).select_from(Resource)

    if student_id:
        q = q.where(Resource.student_id == student_id)
        count_q = count_q.where(Resource.student_id == student_id)

    total = (await db.execute(count_q)).scalar() or 0
    result = await db.execute(
        q.order_by(Resource.created_at.desc())
        .offset((page - 1) * page_size).limit(page_size)
    )
    rows = result.scalars().all()

    items = []
    for r in rows:
        # 获取学生姓名
        s_result = await db.execute(select(Student).where(Student.id == r.student_id))
        s = s_result.scalar_one_or_none()
        items.append({
            "id": str(r.id),
            "student_id": str(r.student_id),
            "student_name": s.name if s else "未知",
            "title": r.title or "",
            "knowledge_point": r.knowledge_point or "",
            "resource_type": r.resource_type or "",
            "is_favorited": r.is_favorited if r.is_favorited is not None else False,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        })

    return {"items": items, "total": total, "page": page, "page_size": page_size}


# ====================================================================
# 学习路径管理
# ====================================================================

@router.get("/paths")
async def list_paths(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    student_id: uuid.UUID | None = None,
    db: AsyncSession = Depends(get_db),
    user: Student = Depends(get_current_user),
):
    _require_admin(user)

    q = select(LearningPath)
    count_q = select(sa_func.count()).select_from(LearningPath)

    if student_id:
        q = q.where(LearningPath.student_id == student_id)
        count_q = count_q.where(LearningPath.student_id == student_id)

    total = (await db.execute(count_q)).scalar() or 0
    result = await db.execute(
        q.order_by(LearningPath.created_at.desc())
        .offset((page - 1) * page_size).limit(page_size)
    )
    rows = result.scalars().all()

    items = []
    for r in rows:
        s_result = await db.execute(select(Student).where(Student.id == r.student_id))
        s = s_result.scalar_one_or_none()
        nodes = r.nodes or []
        edges = r.edges or []
        items.append({
            "id": str(r.id),
            "student_id": str(r.student_id),
            "student_name": s.name if s else "未知",
            "title": r.title or "",
            "total_days": r.total_days or 0,
            "node_count": len(nodes),
            "edge_count": len(edges),
            "nodes": nodes,
            "edges": edges,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        })

    return {"items": items, "total": total, "page": page, "page_size": page_size}


# ====================================================================
# 对话记录管理
# ====================================================================

@router.get("/chats")
async def list_chats(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    student_id: uuid.UUID | None = None,
    db: AsyncSession = Depends(get_db),
    user: Student = Depends(get_current_user),
):
    _require_admin(user)

    q = select(ChatSession)
    count_q = select(sa_func.count()).select_from(ChatSession)

    if student_id:
        q = q.where(ChatSession.student_id == student_id)
        count_q = count_q.where(ChatSession.student_id == student_id)

    total = (await db.execute(count_q)).scalar() or 0
    result = await db.execute(
        q.order_by(ChatSession.created_at.desc())
        .offset((page - 1) * page_size).limit(page_size)
    )
    rows = result.scalars().all()

    items = []
    for r in rows:
        s_result = await db.execute(select(Student).where(Student.id == r.student_id))
        s = s_result.scalar_one_or_none()
        msg_count = (await db.execute(
            select(sa_func.count()).select_from(ChatMessage)
            .where(ChatMessage.session_id == r.id)
        )).scalar() or 0
        items.append({
            "id": str(r.id),
            "student_id": str(r.student_id),
            "student_name": s.name if s else "未知",
            "title": r.title or "",
            "message_count": msg_count,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        })

    return {"items": items, "total": total, "page": page, "page_size": page_size}


@router.get("/chats/{session_id}/messages")
async def get_chat_messages(
    session_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: Student = Depends(get_current_user),
):
    _require_admin(user)

    result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.session_id == session_id)
        .order_by(ChatMessage.created_at)
    )
    rows = result.scalars().all()

    items = []
    for r in rows:
        content = r.content or ""
        # assistant 消息是 JSON，尝试解析
        if r.role == "assistant":
            import json
            try:
                parsed = json.loads(content)
                if isinstance(parsed, dict):
                    if parsed.get("type") == "tutor":
                        content = parsed.get("data", {}).get("answer", content)
                    elif parsed.get("type") == "multi":
                        content = parsed.get("data", {}).get("final_response", content)
            except (json.JSONDecodeError, TypeError):
                pass
        items.append({
            "id": str(r.id),
            "role": r.role,
            "content": content[:2000],  # 截断避免过大
            "created_at": r.created_at.isoformat() if r.created_at else None,
        })

    return {"items": items}


# ====================================================================
# Agent 监控
# ====================================================================

@router.get("/agents")
async def get_agents(
    user: Student = Depends(get_current_user),
):
    _require_admin(user)

    # 获取 Agent 指标
    agents = agent_metrics.get_all()

    # 获取系统资源
    try:
        import psutil
        cpu = psutil.cpu_percent(interval=0.1)
        proc = psutil.Process()
        mem_mb = proc.memory_info().rss / 1024 / 1024
    except ImportError:
        cpu = 0.0
        mem_mb = 0.0

    return {
        "agents": agents,
        "system": {
            "cpu_percent": round(cpu, 1),
            "memory_mb": round(mem_mb, 1),
        },
    }
