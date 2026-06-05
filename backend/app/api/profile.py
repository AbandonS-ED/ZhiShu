from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db

router = APIRouter()

@router.post("/build")
async def build_profile(student_id: str, message: str, db: AsyncSession = Depends(get_db)):
    return {"message": "画像构建接口待实现"}

@router.get("/{student_id}")
async def get_profile(student_id: str, db: AsyncSession = Depends(get_db)):
    return {"message": "获取画像接口待实现"}
