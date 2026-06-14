"""Profile API — 5-dimension personal ability profile."""
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

logger = logging.getLogger(__name__)
router = APIRouter()


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
        async for event in initial_assessment_agent.stream_llm_response(session_id, is_initial):
            yield event

            # 每轮都保存中间状态，防止用户中途退出丢失数据
            if '"type": "result"' in event:
                try:
                    data = json.loads(event[6:].strip())
                    dims = data.get("dimensions", {})
                    is_done = data.get("done", False)

                    # 获取或创建 profile
                    profile_result = await db.execute(
                        select(StudentProfile).where(StudentProfile.student_id == current_user.id)
                    )
                    profile = profile_result.scalar_one_or_none()

                    # 检查是否有有效的维度数据
                    has_valid_dims = any(
                        d.get("score", 0) > 0 for d in dims.values()
                    ) if dims else False

                    if has_valid_dims:
                        if profile:
                            # 更新现有 profile（合并维度，保留高置信度的分数）
                            old_dims = profile.dimensions or {}
                            merged_dims = {}
                            for dim_key in ["comprehension", "memory", "application", "imagination", "focus"]:
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
            },
            "background": {},
            "assessment_status": "pending",
        }

    dims = profile.dimensions or {}
    scores = {}
    for k, v in dims.items():
        if isinstance(v, dict) and "score" in v:
            scores[k] = v["score"]
        elif isinstance(v, (int, float)):
            scores[k] = v

    return {
        "dimensions": scores,
        "confidence": {
            k: v.get("confidence", 0) for k, v in dims.items() if isinstance(v, dict)
        } if dims else {},
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
        return {"status": "pending", "can_resume": False}

    status = profile.assessment_status or "pending"
    dims = profile.dimensions or {}

    # 计算已评估的维度和置信度
    assessed_dims = []
    for dim_key in ["comprehension", "memory", "application", "imagination", "focus"]:
        dim = dims.get(dim_key, {})
        if dim.get("score", 0) > 0:
            assessed_dims.append(dim_key)

    return {
        "status": status,
        "can_resume": status == "in_progress",
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
            },
            background=req.background,
            assessment_status="pending",
        )
        db.add(profile)

    await db.commit()
    return {"status": "ok", "message": "背景信息已更新"}
