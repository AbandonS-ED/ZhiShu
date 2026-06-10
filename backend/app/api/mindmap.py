"""思维导图 API — MindMap 生成"""

import uuid
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, field_validator
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.student import Student
from app.models.student_profile import StudentProfile
from app.agents.mindmap_agent import mindmap_agent

router = APIRouter()


class MindMapGenRequest(BaseModel):
    student_id: str
    knowledge_point: str

    @field_validator("student_id")
    @classmethod
    def validate_uuid(cls, v: str) -> str:
        try:
            uuid.UUID(v)
            return v
        except (ValueError, AttributeError, TypeError):
            raise ValueError(f"无效的 UUID: {v}")


@router.post("/generate")
async def generate_mindmap(req: MindMapGenRequest, db: AsyncSession = Depends(get_db), user: Student = Depends(get_current_user)):
    """生成思维导图"""
    if str(user.id) != req.student_id:
        raise HTTPException(status_code=403, detail="只能操作自己的学习数据")

    # 获取学生画像
    profile_result = await db.execute(
        select(StudentProfile)
        .where(StudentProfile.student_id == uuid.UUID(req.student_id))
        .where(StudentProfile.is_current == True)
        .order_by(StudentProfile.version.desc())
        .limit(1)
    )
    profile = profile_result.scalar_one_or_none()
    student_profile = profile.dimensions if profile else None

    # 生成思维导图
    result = await mindmap_agent.generate(
        knowledge_point=req.knowledge_point,
        student_profile=student_profile,
    )

    return {
        "knowledge_point": req.knowledge_point,
        "mindmap": result,
    }


@router.get("/examples")
async def mindmap_examples():
    """返回示例 Mermaid 思维导图（供前端测试用）"""
    return {
        "examples": [
            {
                "title": "Python 基础",
                "mermaid_code": """mindmap
  root((Python 基础))
    数据类型
      整数 int
      浮点数 float
      字符串 str
      列表 list
      字典 dict
    控制流
      if 条件判断
      for 循环
      while 循环
    函数
      定义函数
      参数传递
      返回值
    面向对象
      类 class
      继承
      多态""",
                "nodes": ["Python 基础", "数据类型", "控制流", "函数", "面向对象"],
            },
            {
                "title": "机器学习",
                "mermaid_code": """mindmap
  root((机器学习))
    监督学习
      分类
        决策树
        SVM
      回归
        线性回归
        多项式回归
    无监督学习
      聚类
        K-Means
        DBSCAN
      降维
        PCA
    深度学习
      神经网络
      CNN
      RNN""",
                "nodes": ["机器学习", "监督学习", "无监督学习", "深度学习"],
            },
        ]
    }
