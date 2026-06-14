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
from app.models.student import Student
from app.models.student_profile import StudentProfile
from app.agents.initial_assessment_agent import initial_assessment_agent

logger = logging.getLogger(__name__)
router = APIRouter()


class AssessStreamRequest(BaseModel):
    session_id: str = ""
    answer: str = ""


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

            if '"type": "result"' in event and '"done": true' in event:
                try:
                    data = json.loads(event[6:].strip())
                    profile_result = await db.execute(
                        select(StudentProfile).where(StudentProfile.student_id == current_user.id)
                    )
                    profile = profile_result.scalar_one_or_none()
                    dims = data.get("dimensions", {})
                    if profile:
                        profile.dimensions = dims
                        profile.assessment_status = "completed"
                    else:
                        profile = StudentProfile(
                            student_id=current_user.id,
                            dimensions=dims,
                            assessment_status="completed",
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
        "background": profile.background or {},
        "assessment_status": profile.assessment_status or "pending",
    }
