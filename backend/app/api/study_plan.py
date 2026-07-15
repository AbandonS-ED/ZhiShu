"""学习计划 API 路由

提供学习计划的CRUD操作和AI生成功能
"""

import uuid
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, Field
from typing import Optional, List
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.student import Student
from app.services.study_plan_service import study_plan_service

router = APIRouter()


# ===== 请求模型 =====

class CreatePlanRequest(BaseModel):
    knowledge_point: str = Field(..., description="知识点名称")
    difficulty: str = Field("intermediate", description="难度: beginner/intermediate/advanced")
    prerequisites: List[str] = Field(default_factory=list, description="前置知识点列表")


class CompleteStepRequest(BaseModel):
    step_id: str = Field(..., description="步骤ID")


class GeneratePathRequest(BaseModel):
    target_knowledge: str = Field(..., description="目标知识点")
    current_level: str = Field("beginner", description="当前水平: beginner/intermediate/advanced")


# ===== API 端点 =====

@router.post("/create")
async def create_study_plan(
    req: CreatePlanRequest,
    current_user: Student = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """创建学习计划（AI生成步骤）"""
    try:
        plan = await study_plan_service.create_study_plan(
            db=db,
            student_id=str(current_user.id),
            knowledge_point=req.knowledge_point,
            difficulty=req.difficulty,
            prerequisites=req.prerequisites
        )
        return {"success": True, "data": plan}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"创建学习计划失败: {str(e)}")


@router.get("/list")
async def get_study_plans(
    status: Optional[str] = Query(None, description="筛选状态: planning/learning/completed"),
    current_user: Student = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """获取学习计划列表"""
    try:
        plans = await study_plan_service.get_student_plans(
            db=db,
            student_id=str(current_user.id),
            status=status
        )
        return {"success": True, "data": plans}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取计划列表失败: {str(e)}")


@router.get("/{plan_id}")
async def get_study_plan(
    plan_id: str,
    current_user: Student = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """获取学习计划详情"""
    try:
        plan = await study_plan_service.get_study_plan(db=db, plan_id=plan_id)
        if not plan:
            raise HTTPException(status_code=404, detail="学习计划不存在")
        return {"success": True, "data": plan}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取计划详情失败: {str(e)}")


@router.post("/{plan_id}/complete-step")
async def complete_study_step(
    plan_id: str,
    req: CompleteStepRequest,
    current_user: Student = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """完成学习步骤"""
    try:
        result = await study_plan_service.complete_step(
            db=db,
            plan_id=plan_id,
            step_id=req.step_id
        )
        return {"success": True, "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"完成步骤失败: {str(e)}")


@router.post("/generate-path")
async def generate_learning_path(
    req: GeneratePathRequest,
    current_user: Student = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """生成学习路径（知识点依赖关系图）"""
    try:
        path = await study_plan_service.generate_learning_path(
            db=db,
            student_id=str(current_user.id),
            target_knowledge=req.target_knowledge,
            current_level=req.current_level
        )
        return {"success": True, "data": path}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"生成学习路径失败: {str(e)}")


@router.get("/paths/list")
async def get_learning_paths(
    current_user: Student = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """获取学习路径列表"""
    try:
        paths = await study_plan_service.get_student_paths(
            db=db,
            student_id=str(current_user.id)
        )
        return {"success": True, "data": paths}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取学习路径失败: {str(e)}")


@router.post("/paths/{path_id}/nodes/{node_id}/complete")
async def complete_node(
    path_id: str,
    node_id: str,
    current_user: Student = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """完成学习节点"""
    try:
        import json
        from sqlalchemy import select, update
        from app.models.study_plan import LearningPath
        
        # 获取学习路径
        result = await db.execute(
            select(LearningPath).where(
                LearningPath.id == uuid.UUID(path_id),
                LearningPath.student_id == current_user.id
            )
        )
        path = result.scalar_one_or_none()
        
        if not path:
            raise HTTPException(status_code=404, detail="学习路径不存在")
        
        # 更新节点状态
        nodes = path.nodes or []
        current_index = -1
        
        for i, node in enumerate(nodes):
            if node.get("id") == node_id:
                nodes[i]["status"] = "completed"
                current_index = i
                break
        
        # 将下一个节点设为 current
        if current_index >= 0 and current_index + 1 < len(nodes):
            if nodes[current_index + 1].get("status") == "pending":
                nodes[current_index + 1]["status"] = "current"
        
        # 保存到数据库
        await db.execute(
            update(LearningPath).where(LearningPath.id == uuid.UUID(path_id)).values(nodes=nodes)
        )
        await db.commit()
        
        return {"success": True, "message": "节点已完成"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"更新节点状态失败: {str(e)}")
