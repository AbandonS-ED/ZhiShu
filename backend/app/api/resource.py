from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db

router = APIRouter()

@router.post("/generate")
async def generate_resource(student_id: str, course_id: str, knowledge_point: str, db: AsyncSession = Depends(get_db)):
    return {"message": "资源生成接口待实现"}

@router.get("/list")
async def list_resources(student_id: str, db: AsyncSession = Depends(get_db)):
    return {"message": "资源列表接口待实现"}
