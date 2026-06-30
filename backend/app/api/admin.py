"""Admin API — 管理后台"""
import asyncio
import json
import uuid
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, func as sa_func, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user, require_admin
from app.models.student import Student
from app.models.resource import Resource
from app.models.learning_path import LearningPath
from app.models.chat_session import ChatSession
from app.models.chat_message import ChatMessage
from app.models.exercise import Exercise
from app.models.exercise_bank import ExerciseBank
from app.models.learning_record import LearningRecord
from app.models.document_chunk import DocumentChunk
from app.core.agent_metrics import agent_metrics

router = APIRouter()


def _require_admin(user: Student):
    """兼容旧调用，委托给共享依赖"""
    require_admin(user)


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

    # 并行执行所有计数查询
    [
        user_count,
        admin_count,
        resource_count,
        exercise_count,
        exercise_bank_count,
        path_count,
        chat_count,
        doc_count,
        today_active,
        today_new_resources,
    ] = await asyncio.gather(
        db.execute(select(sa_func.count()).select_from(Student).where(Student.role == "student")),
        db.execute(select(sa_func.count()).select_from(Student).where(Student.role == "admin")),
        db.execute(select(sa_func.count()).select_from(Resource)),
        db.execute(select(sa_func.count()).select_from(Exercise)),
        db.execute(select(sa_func.count()).select_from(ExerciseBank)),
        db.execute(select(sa_func.count()).select_from(LearningPath)),
        db.execute(select(sa_func.count()).select_from(ChatSession)),
        db.execute(select(sa_func.count()).select_from(DocumentChunk)),
        db.execute(
            select(sa_func.count(sa_func.distinct(LearningRecord.student_id)))
            .where(LearningRecord.created_at >= today_start)
        ),
        db.execute(
            select(sa_func.count()).select_from(Resource)
            .where(Resource.created_at >= today_start)
        ),
    )

    user_count = user_count.scalar() or 0
    admin_count = admin_count.scalar() or 0
    resource_count = resource_count.scalar() or 0
    exercise_count = exercise_count.scalar() or 0
    exercise_bank_count = exercise_bank_count.scalar() or 0
    path_count = path_count.scalar() or 0
    chat_count = chat_count.scalar() or 0
    doc_count = doc_count.scalar() or 0
    today_active = today_active.scalar() or 0
    today_new_resources = today_new_resources.scalar() or 0

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
    day_start_base = (now - timedelta(days=days - 1)).replace(hour=0, minute=0, second=0, microsecond=0)
    day_end = day_start_base + timedelta(days=days)

    # 批量查询注册趋势
    reg_rows = (await db.execute(
        select(
            sa_func.date(Student.created_at).label("day"),
            sa_func.count().label("cnt"),
        )
        .where(Student.created_at >= day_start_base, Student.created_at < day_end)
        .group_by(sa_func.date(Student.created_at))
    )).all()
    reg_map = {str(r.day): r.cnt for r in reg_rows}

    # 批量查询资源趋势
    res_rows = (await db.execute(
        select(
            sa_func.date(Resource.created_at).label("day"),
            sa_func.count().label("cnt"),
        )
        .where(Resource.created_at >= day_start_base, Resource.created_at < day_end)
        .group_by(sa_func.date(Resource.created_at))
    )).all()
    res_map = {str(r.day): r.cnt for r in res_rows}

    labels = []
    registrations = []
    resources = []
    for i in range(days - 1, -1, -1):
        d = (now - timedelta(days=i)).replace(hour=0, minute=0, second=0, microsecond=0)
        day_str = d.strftime("%Y-%m-%d")
        labels.append(d.strftime("%m-%d"))
        registrations.append(reg_map.get(day_str, 0))
        resources.append(res_map.get(day_str, 0))

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

    # 子查询：每个用户的资源数
    res_sub = (
        select(Resource.student_id, sa_func.count().label("resource_count"))
        .group_by(Resource.student_id)
    ).subquery()

    # 子查询：每个用户的题数
    ex_sub = (
        select(Exercise.student_id, sa_func.count().label("exercise_count"))
        .group_by(Exercise.student_id)
    ).subquery()

    q = (
        select(
            Student,
            sa_func.coalesce(res_sub.c.resource_count, 0).label("resource_count"),
            sa_func.coalesce(ex_sub.c.exercise_count, 0).label("exercise_count"),
        )
        .outerjoin(res_sub, Student.id == res_sub.c.student_id)
        .outerjoin(ex_sub, Student.id == ex_sub.c.student_id)
    )
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
    rows = result.all()

    items = []
    for r in rows:
        student = r[0]  # Student object
        items.append({
            "id": str(student.id),
            "student_no": student.student_no,
            "name": student.name,
            "email": student.email or "",
            "role": student.role or "student",
            "is_active": student.is_active if student.is_active is not None else True,
            "resource_count": r.resource_count,
            "exercise_count": r.exercise_count,
            "last_login": student.last_login.isoformat() if student.last_login else None,
            "created_at": student.created_at.isoformat() if student.created_at else None,
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
    search: str | None = None,
    db: AsyncSession = Depends(get_db),
    user: Student = Depends(get_current_user),
):
    _require_admin(user)

    # 子查询获取学生姓名
    stu_sub = select(Student.id, Student.name).subquery()

    q = (
        select(Resource, sa_func.coalesce(stu_sub.c.name, "未知").label("student_name"))
        .outerjoin(stu_sub, Resource.student_id == stu_sub.c.id)
    )
    count_q = select(sa_func.count()).select_from(Resource)

    if student_id:
        q = q.where(Resource.student_id == student_id)
        count_q = count_q.where(Resource.student_id == student_id)

    if search:
        ilike = f"%{search}%"
        q = q.where(Resource.title.ilike(ilike) | Resource.knowledge_point.ilike(ilike))
        count_q = count_q.where(Resource.title.ilike(ilike) | Resource.knowledge_point.ilike(ilike))

    total = (await db.execute(count_q)).scalar() or 0
    result = await db.execute(
        q.order_by(Resource.created_at.desc())
        .offset((page - 1) * page_size).limit(page_size)
    )
    rows = result.all()

    items = []
    for r in rows:
        res_obj = r[0]  # Resource object
        items.append({
            "id": str(res_obj.id),
            "student_id": str(res_obj.student_id),
            "student_name": r.student_name,
            "title": res_obj.title or "",
            "knowledge_point": res_obj.knowledge_point or "",
            "resource_type": res_obj.resource_type or "",
            "is_favorited": res_obj.is_favorited if res_obj.is_favorited is not None else False,
            "created_at": res_obj.created_at.isoformat() if res_obj.created_at else None,
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

    stu_sub = select(Student.id, Student.name).subquery()

    q = (
        select(LearningPath, sa_func.coalesce(stu_sub.c.name, "未知").label("student_name"))
        .outerjoin(stu_sub, LearningPath.student_id == stu_sub.c.id)
    )
    count_q = select(sa_func.count()).select_from(LearningPath)

    if student_id:
        q = q.where(LearningPath.student_id == student_id)
        count_q = count_q.where(LearningPath.student_id == student_id)

    total = (await db.execute(count_q)).scalar() or 0
    result = await db.execute(
        q.order_by(LearningPath.created_at.desc())
        .offset((page - 1) * page_size).limit(page_size)
    )
    rows = result.all()

    items = []
    for r in rows:
        path_obj = r[0]  # LearningPath object
        nodes = path_obj.nodes or []
        edges = path_obj.edges or []
        items.append({
            "id": str(path_obj.id),
            "student_id": str(path_obj.student_id),
            "student_name": r.student_name,
            "title": path_obj.title or "",
            "total_days": path_obj.total_days or 0,
            "node_count": len(nodes),
            "edge_count": len(edges),
            "nodes": nodes,
            "edges": edges,
            "created_at": path_obj.created_at.isoformat() if path_obj.created_at else None,
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

    stu_sub = select(Student.id, Student.name).subquery()
    msg_sub = (
        select(ChatMessage.session_id, sa_func.count().label("message_count"))
        .group_by(ChatMessage.session_id)
    ).subquery()

    q = (
        select(
            ChatSession,
            sa_func.coalesce(stu_sub.c.name, "未知").label("student_name"),
            sa_func.coalesce(msg_sub.c.message_count, 0).label("message_count"),
        )
        .outerjoin(stu_sub, ChatSession.student_id == stu_sub.c.id)
        .outerjoin(msg_sub, ChatSession.id == msg_sub.c.session_id)
    )
    count_q = select(sa_func.count()).select_from(ChatSession)

    if student_id:
        q = q.where(ChatSession.student_id == student_id)
        count_q = count_q.where(ChatSession.student_id == student_id)

    total = (await db.execute(count_q)).scalar() or 0
    result = await db.execute(
        q.order_by(ChatSession.created_at.desc())
        .offset((page - 1) * page_size).limit(page_size)
    )
    rows = result.all()

    items = []
    for r in rows:
        chat_obj = r[0]  # ChatSession object
        items.append({
            "id": str(chat_obj.id),
            "student_id": str(chat_obj.student_id),
            "student_name": r.student_name,
            "title": chat_obj.title or "",
            "message_count": r.message_count,
            "created_at": chat_obj.created_at.isoformat() if chat_obj.created_at else None,
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
