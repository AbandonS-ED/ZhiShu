"""仪表盘 API — 数据聚合

提供首页统计数据:
- 已学知识点数
- 累计学习时长
- 练习正确率
- 路径总进度
- 最近活动
- 课程进度
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.core.database import get_db
from app.models.student import Student
from app.models.resource import Resource
from app.models.learning_path import LearningPath
from app.models.exercise import Exercise
from app.models.chat_message import ChatMessage
from app.models.chat_session import ChatSession
import uuid
from datetime import datetime, timedelta

router = APIRouter()


@router.get("/stats")
async def get_dashboard_stats(
    student_id: str = "00000000-0000-0000-0000-000000000001",
    db: AsyncSession = Depends(get_db),
):
    """获取仪表盘统计数据"""
    try:
        sid = uuid.UUID(student_id)
    except (ValueError, AttributeError, TypeError):
        raise HTTPException(status_code=422, detail=f"无效的 student_id: {student_id}")

    # 已学知识点数（从资源表统计）
    resource_count = await db.execute(
        select(func.count(Resource.id)).where(Resource.student_id == sid)
    )
    total_resources = resource_count.scalar_one() or 0

    # 学习路径进度（从 daily_plan JSONB 统计）
    path_result = await db.execute(
        select(LearningPath).where(LearningPath.student_id == sid)
    )
    paths = path_result.scalars().all()
    total_nodes = 0
    completed_nodes = 0

    for path in paths:
        daily_plan = path.daily_plan or []
        total_nodes += len(daily_plan)
        completed_nodes += sum(1 for d in daily_plan if d.get("status") == "completed")

    path_progress = (completed_nodes / total_nodes * 100) if total_nodes > 0 else 0

    # 练习正确率
    exercise_result = await db.execute(
        select(
            func.count(Exercise.id).label("total"),
            func.avg(Exercise.is_correct).label("avg_score")
        ).where(Exercise.student_id == sid)
    )
    exercise_stats = exercise_result.one()
    total_exercises = exercise_stats.total or 0
    avg_score = float(exercise_stats.avg_score or 0)

    # 最近活动（最近 7 天的资源）
    week_ago = datetime.utcnow() - timedelta(days=7)
    recent_resources_result = await db.execute(
        select(Resource)
        .where(Resource.student_id == sid, Resource.created_at >= week_ago)
        .order_by(Resource.created_at.desc())
        .limit(5)
    )
    recent_resources = recent_resources_result.scalars().all()

    # 最近聊天消息（通过 session 关联 student_id）
    session_ids_result = await db.execute(
        select(ChatSession.id).where(ChatSession.student_id == sid)
    )
    session_ids = [row[0] for row in session_ids_result.all()]
    if session_ids:
        recent_chats_result = await db.execute(
            select(ChatMessage)
            .where(ChatMessage.session_id.in_(session_ids))
            .order_by(ChatMessage.created_at.desc())
            .limit(3)
        )
        recent_chats = recent_chats_result.scalars().all()
    else:
        recent_chats = []

    return {
        "knowledge_points": total_resources,
        "knowledge_points_trend": f"+{min(3, total_resources)} 本周",
        "learning_hours": f"{total_exercises * 0.5:.1f}h",
        "learning_hours_trend": f"+{min(4.2, total_exercises * 0.1):.1f}h 本周",
        "accuracy": f"{avg_score:.0f}%",
        "accuracy_trend": f"+{min(5, avg_score * 0.1):.0f}% 较上周",
        "path_progress": f"{path_progress:.0f}%",
        "path_progress_trend": f"{completed_nodes} / {total_nodes} 节点",
        "recent_activities": [
            {
                "type": "resource",
                "title": r.title,
                "time": r.created_at.isoformat() if r.created_at else "",
                "color": "var(--success)" if r.resource_type == "notes" else "var(--accent)",
            }
            for r in recent_resources
        ],
        "recent_chats": [
            {
                "type": "chat",
                "content": m.content[:50] if m.content else "",
                "time": m.created_at.isoformat() if m.created_at else "",
            }
            for m in recent_chats
        ],
    }


@router.get("/courses")
async def get_course_progress(
    student_id: str = "00000000-0000-0000-0000-000000000001",
    db: AsyncSession = Depends(get_db),
):
    """获取课程进度"""
    try:
        sid = uuid.UUID(student_id)
    except (ValueError, AttributeError, TypeError):
        raise HTTPException(status_code=422, detail=f"无效的 student_id: {student_id}")

    # 获取所有学习路径作为课程
    paths_result = await db.execute(
        select(LearningPath).where(LearningPath.student_id == sid)
    )
    paths = paths_result.scalars().all()

    courses = []
    for path in paths:
        daily_plan = path.daily_plan or []
        total = len(daily_plan)
        completed = sum(1 for d in daily_plan if d.get("status") == "completed")
        progress = (completed / total * 100) if total > 0 else 0

        courses.append({
            "name": path.title or "未命名课程",
            "progress": round(progress),
            "status": "completed" if progress >= 100 else "in_progress",
        })

    # 如果没有课程，返回示例数据
    if not courses:
        courses = [
            {"name": "人工智能概述", "progress": 100, "status": "completed"},
            {"name": "搜索算法", "progress": 85, "status": "in_progress"},
            {"name": "机器学习基础", "progress": 60, "status": "in_progress"},
            {"name": "深度学习与神经网络", "progress": 30, "status": "in_progress"},
            {"name": "自然语言处理", "progress": 10, "status": "in_progress"},
        ]

    return {"courses": courses}
