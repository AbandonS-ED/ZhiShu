from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db

router = APIRouter()

@router.post("/generate")
async def generate_path(student_id: str, course_id: str, db: AsyncSession = Depends(get_db)):
    return {"message": "路径生成接口待实现"}

@router.get("/{student_id}")
async def get_path(student_id: str, db: AsyncSession = Depends(get_db)):
    return {"message": "获取路径接口待实现"}
