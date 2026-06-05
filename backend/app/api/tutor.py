from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db

router = APIRouter()

@router.post("/ask")
async def ask_tutor(student_id: str, question: str, db: AsyncSession = Depends(get_db)):
    return {"message": "智能辅导接口待实现"}
