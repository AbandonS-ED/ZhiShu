"""Profile API — 7-dimension personal ability profile."""
import json
import logging
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.sse_utils import sse_stream_response
from app.models.student import Student
from app.models.student_profile import StudentProfile
from app.agents.initial_assessment_agent import initial_assessment_agent
from app.agents.behavior_analysis_agent import behavior_analysis_agent

logger = logging.getLogger(__name__)
router = APIRouter()

# 维度更新规则：根据学习行为自动调整维度分数
UPDATE_RULES = {
    # 练习正确率影响应用转化
    "exercise_correct_rate": {
        "dimension": "application",
        "high_threshold": 0.8,  # 正确率 > 80% 提升
        "low_threshold": 0.5,   # 正确率 < 50% 降低
        "high_boost": 3,        # 提升分数
        "low_reduce": -2,       # 降低分数
    },
    # 资源访问频率影响专注力
    "resource_access_count": {
        "dimension": "focus",
        "high_threshold": 5,    # 访问 > 5 次提升
        "low_threshold": 1,     # 访问 < 1 次降低
        "high_boost": 2,
        "low_reduce": -1,
    },
    # 学习时长影响记忆力
    "study_duration": {
        "dimension": "memory",
        "high_threshold": 60,   # 学习 > 60 分钟提升
        "low_threshold": 10,    # 学习 < 10 分钟降低
        "high_boost": 2,
        "low_reduce": -1,
    },
}


class AssessStreamRequest(BaseModel):
    session_id: str = ""
    answer: str = ""


class UpdateBackgroundRequest(BaseModel):
    background: dict


@router.post("/assess/stream")
async def assess_stream(
    req: AssessStreamRequest,
    current_user: Student = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not req.session_id:
        session = await initial_assessment_agent.start_assessment(str(current_user.id))
        session_id = session["session_id"]
        is_initial = True
    else:
        session = initial_assessment_agent.get_session(req.session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        session_id = req.session_id
        initial_assessment_agent.add_user_message(session_id, req.answer)
        is_initial = False

    async def event_generator():
        from app.core.database import async_session as db_async_session

        async for event in initial_assessment_agent.stream_llm_response(session_id, is_initial):
            yield event

            # 每轮都保存中间状态，防止用户中途退出丢失数据
            if '"type": "result"' in event:
                try:
                    data = json.loads(event[6:].strip())
                    dims = data.get("dimensions", {})
                    is_done = data.get("done", False)

                    # 检查是否有有效的维度数据
                    has_valid_dims = any(
                        d.get("score", 0) > 0 for d in dims.values()
                    ) if dims else False

                    if has_valid_dims:
                        # 在 generator 内部创建新的数据库会话
                        async with db_async_session() as db:
                            # 获取或创建 profile
                            profile_result = await db.execute(
                                select(StudentProfile).where(StudentProfile.student_id == current_user.id)
                            )
                            profile = profile_result.scalar_one_or_none()

                            if profile:
                                # 更新现有 profile（合并维度，保留高置信度的分数）
                                old_dims = profile.dimensions or {}
                                merged_dims = {}
                                # 合并所有7个维度
                                all_dims = set(list(old_dims.keys()) + list(dims.keys()))
                                for dim_key in all_dims:
                                    old_dim = old_dims.get(dim_key, {})
                                    new_dim = dims.get(dim_key, {})
                                    old_conf = old_dim.get("confidence", 0)
                                    new_conf = new_dim.get("confidence", 0)
                                    # 保留置信度更高的数据
                                    if new_conf >= old_conf:
                                        merged_dims[dim_key] = new_dim
                                    else:
                                        merged_dims[dim_key] = old_dim
                                profile.dimensions = merged_dims
                                profile.assessment_status = "completed" if is_done else "in_progress"
                            else:
                                profile = StudentProfile(
                                    student_id=current_user.id,
                                    dimensions=dims,
                                    assessment_status="completed" if is_done else "in_progress",
                                )
                                db.add(profile)
                            await db.commit()

                except Exception as e:
                    logger.error(f"Failed to save profile: {e}")

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.get("/me")
async def get_my_profile(
    current_user: Student = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(StudentProfile).where(StudentProfile.student_id == current_user.id)
    )
    profile = result.scalar_one_or_none()

    if not profile:
        return {
            "dimensions": {
                "comprehension": 0,
                "memory": 0,
                "application": 0,
                "imagination": 0,
                "focus": 0,
                "knowledge_base": 0,
                "learning_goal": 0,
            },
            "confidence": {},
            "background": {},
            "assessment_status": "pending",
        }

    dims = profile.dimensions or {}
    all_dims = ["comprehension", "memory", "application", "imagination", "focus", "knowledge_base", "learning_goal"]
    scores = {}
    confidences = {}
    for k in all_dims:
        if k in dims and isinstance(dims[k], dict):
            scores[k] = dims[k].get("score", 50)
            confidences[k] = dims[k].get("confidence", 0)
        elif k in dims and isinstance(dims[k], (int, float)):
            scores[k] = dims[k]
            confidences[k] = 0
        else:
            scores[k] = 0
            confidences[k] = 0

    return {
        "dimensions": scores,
        "confidence": confidences,
        "background": profile.background or {},
        "assessment_status": profile.assessment_status or "pending",
    }


@router.post("/reset")
async def reset_profile(
    current_user: Student = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """重置画像，允许用户重新评估"""
    result = await db.execute(
        select(StudentProfile).where(StudentProfile.student_id == current_user.id)
    )
    profile = result.scalar_one_or_none()

    if profile:
        profile.dimensions = {
            "comprehension": {"score": 0, "confidence": 0},
            "memory": {"score": 0, "confidence": 0},
            "application": {"score": 0, "confidence": 0},
            "imagination": {"score": 0, "confidence": 0},
            "focus": {"score": 0, "confidence": 0},
            "knowledge_base": {"score": 0, "confidence": 0},
            "learning_goal": {"score": 0, "confidence": 0},
        }
        profile.assessment_status = "pending"
        await db.commit()
    else:
        profile = StudentProfile(
            student_id=current_user.id,
            dimensions={
                "comprehension": {"score": 0, "confidence": 0},
                "memory": {"score": 0, "confidence": 0},
                "application": {"score": 0, "confidence": 0},
                "imagination": {"score": 0, "confidence": 0},
                "focus": {"score": 0, "confidence": 0},
                "knowledge_base": {"score": 0, "confidence": 0},
                "learning_goal": {"score": 0, "confidence": 0},
            },
            assessment_status="pending",
        )
        db.add(profile)
        await db.commit()

    return {"status": "ok", "message": "画像已重置，可以重新评估"}


@router.get("/assessment-status")
async def get_assessment_status(
    current_user: Student = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取评估状态，用于恢复评估"""
    result = await db.execute(
        select(StudentProfile).where(StudentProfile.student_id == current_user.id)
    )
    profile = result.scalar_one_or_none()

    if not profile:
        return {"status": "pending", "can_resume": False, "session_id": None}

    status = profile.assessment_status or "pending"
    dims = profile.dimensions or {}

    # 计算已评估的维度和置信度
    assessed_dims = []
    for dim_key in ["comprehension", "memory", "application", "imagination", "focus", "knowledge_base", "learning_goal"]:
        dim = dims.get(dim_key, {})
        if dim.get("score", 0) > 0:
            assessed_dims.append(dim_key)

    # 尝试从内存中获取会话 ID（如果会话存在）
    session_id = None
    if status == "in_progress":
        # 查找该用户的活跃会话
        for sid, sess in initial_assessment_agent._sessions.items():
            if sess.get("student_id") == str(current_user.id) and sess.get("status") == "in_progress":
                session_id = sid
                break

    return {
        "status": status,
        "can_resume": status == "in_progress" and session_id is not None,
        "session_id": session_id,
        "assessed_dimensions": assessed_dims,
        "dimensions": {
            k: v for k, v in dims.items()
            if isinstance(v, dict) and v.get("score", 0) > 0
        } if dims else {},
    }


@router.put("/background")
async def update_background(
    req: UpdateBackgroundRequest,
    current_user: Student = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """更新学习背景信息"""
    result = await db.execute(
        select(StudentProfile).where(StudentProfile.student_id == current_user.id)
    )
    profile = result.scalar_one_or_none()

    if profile:
        profile.background = req.background
    else:
        profile = StudentProfile(
            student_id=current_user.id,
            dimensions={
                "comprehension": {"score": 0, "confidence": 0},
                "memory": {"score": 0, "confidence": 0},
                "application": {"score": 0, "confidence": 0},
                "imagination": {"score": 0, "confidence": 0},
                "focus": {"score": 0, "confidence": 0},
                "knowledge_base": {"score": 0, "confidence": 0},
                "learning_goal": {"score": 0, "confidence": 0},
            },
            background=req.background,
            assessment_status="pending",
        )
        db.add(profile)

    await db.commit()
    return {"status": "ok", "message": "背景信息已更新"}


class UpdateBehaviorRequest(BaseModel):
    """学习行为数据"""
    exercise_correct_rate: float | None = None  # 练习正确率 (0-1)
    resource_access_count: int | None = None     # 资源访问次数
    study_duration: float | None = None          # 学习时长（分钟）


@router.post("/update-behavior")
async def update_profile_by_behavior(
    req: UpdateBehaviorRequest,
    current_user: Student = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """根据学习行为自动更新画像（随学随新）"""
    result = await db.execute(
        select(StudentProfile).where(StudentProfile.student_id == current_user.id)
    )
    profile = result.scalar_one_or_none()

    if not profile:
        return {"status": "ok", "message": "无画像数据，跳过更新"}

    dims = profile.dimensions or {}
    updated = False

    # 根据行为数据更新维度
    if req.exercise_correct_rate is not None:
        rule = UPDATE_RULES["exercise_correct_rate"]
        dim = dims.get(rule["dimension"], {"score": 50, "confidence": 0.5})
        old_score = dim.get("score", 50)
        if req.exercise_correct_rate >= rule["high_threshold"]:
            new_score = min(100, old_score + rule["high_boost"])
            dim["score"] = new_score
            dim["confidence"] = min(1.0, dim.get("confidence", 0.5) + 0.05)
            updated = True
        elif req.exercise_correct_rate <= rule["low_threshold"]:
            new_score = max(0, old_score + rule["low_reduce"])
            dim["score"] = new_score
            dim["confidence"] = min(1.0, dim.get("confidence", 0.5) + 0.05)
            updated = True
        dims[rule["dimension"]] = dim

    if req.resource_access_count is not None:
        rule = UPDATE_RULES["resource_access_count"]
        dim = dims.get(rule["dimension"], {"score": 50, "confidence": 0.5})
        old_score = dim.get("score", 50)
        if req.resource_access_count >= rule["high_threshold"]:
            new_score = min(100, old_score + rule["high_boost"])
            dim["score"] = new_score
            dim["confidence"] = min(1.0, dim.get("confidence", 0.5) + 0.05)
            updated = True
        elif req.resource_access_count <= rule["low_threshold"]:
            new_score = max(0, old_score + rule["low_reduce"])
            dim["score"] = new_score
            dim["confidence"] = min(1.0, dim.get("confidence", 0.5) + 0.05)
            updated = True
        dims[rule["dimension"]] = dim

    if req.study_duration is not None:
        rule = UPDATE_RULES["study_duration"]
        dim = dims.get(rule["dimension"], {"score": 50, "confidence": 0.5})
        old_score = dim.get("score", 50)
        if req.study_duration >= rule["high_threshold"]:
            new_score = min(100, old_score + rule["high_boost"])
            dim["score"] = new_score
            dim["confidence"] = min(1.0, dim.get("confidence", 0.5) + 0.05)
            updated = True
        elif req.study_duration <= rule["low_threshold"]:
            new_score = max(0, old_score + rule["low_reduce"])
            dim["score"] = new_score
            dim["confidence"] = min(1.0, dim.get("confidence", 0.5) + 0.05)
            updated = True
        dims[rule["dimension"]] = dim

    if updated:
        profile.dimensions = dims
        await db.commit()
        logger.info(f"[profile] Updated profile for user {current_user.id} based on behavior")

    return {"status": "ok", "message": "画像已更新", "updated": updated}


class AnalyzeBehaviorRequest(BaseModel):
    behavior_type: str  # "chat", "exercise", "resource", "study"
    behavior_data: dict = {}


@router.post("/analyze-behavior")
async def analyze_behavior(
    req: AnalyzeBehaviorRequest,
    current_user: Student = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """使用 AI Agent 分析学习行为并更新画像"""
    result = await behavior_analysis_agent.analyze_and_update(
        db=db,
        student_id=str(current_user.id),
        behavior_type=req.behavior_type,
        behavior_data=req.behavior_data,
    )
    return result


@router.post("/force-analyze")
async def force_analyze(
    current_user: Student = Depends(get_current_user),
):
    """手动触发画像分析（立即执行）"""
    from app.services.scheduled_analysis_service import scheduled_analysis_service
    result = await scheduled_analysis_service.force_analyze(str(current_user.id))
    return result


@router.get("/analysis-status")
async def analysis_status(
    current_user: Student = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取画像分析状态"""
    result = await db.execute(
        select(StudentProfile).where(StudentProfile.student_id == current_user.id)
    )
    profile = result.scalar_one_or_none()
    
    if not profile:
        return {"has_profile": False, "last_analyzed_at": None}
    
    return {
        "has_profile": True,
        "last_analyzed_at": profile.last_analyzed_at.isoformat() if profile.last_analyzed_at else None,
        "assessment_status": profile.assessment_status,
    }
