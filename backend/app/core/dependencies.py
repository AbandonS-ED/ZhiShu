"""共享 FastAPI 依赖（UUID 校验 + 登录验证）"""
import uuid
from fastapi import HTTPException, Depends, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.security import decode_token
from app.models.student import Student


async def get_current_user(authorization: str = Header(None), db: AsyncSession = Depends(get_db)) -> Student:
    """从 Authorization: Bearer xxx 解析并验证用户，返回 Student 对象"""
    if not authorization:
        raise HTTPException(status_code=401, detail="未登录，请先登录")
    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(status_code=401, detail="登录凭证格式错误")
    student_id = decode_token(parts[1])
    if not student_id:
        raise HTTPException(status_code=401, detail="登录已过期，请重新登录")
    try:
        sid = uuid.UUID(student_id)
    except (ValueError, AttributeError, TypeError):
        raise HTTPException(status_code=401, detail="无效的登录凭证")
    result = await db.execute(select(Student).where(Student.id == sid))
    student = result.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=401, detail="用户不存在")
    return student


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



def require_admin(user: Student) -> None:
    """校验用户角色为管理员，否则 403"""
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="仅管理员可操作")
