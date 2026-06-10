"""共享 FastAPI 依赖（UUID 校验等）"""
import uuid
from fastapi import HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db


async def valid_student_id(student_id: str, db: AsyncSession = Depends(get_db)) -> uuid.UUID:
    """路径参数 student_id → UUID，校验失败返回 422"""
    try:
        return uuid.UUID(student_id)
    except (ValueError, AttributeError, TypeError):
        raise HTTPException(status_code=422, detail=f"无效的 student_id: {student_id}")


async def valid_session_id(session_id: str) -> uuid.UUID:
    """路径参数 session_id → UUID，校验失败返回 422"""
    try:
        return uuid.UUID(session_id)
    except (ValueError, AttributeError, TypeError):
        raise HTTPException(status_code=422, detail=f"无效的 session_id: {session_id}")


async def valid_path_id(path_id: str) -> uuid.UUID:
    """路径参数 path_id → UUID，校验失败返回 422"""
    try:
        return uuid.UUID(path_id)
    except (ValueError, AttributeError, TypeError):
        raise HTTPException(status_code=422, detail=f"无效的 path_id: {path_id}")
