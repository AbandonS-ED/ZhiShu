"""学习计划服务

功能:
1. 根据用户需求生成学习路径
2. 生成学习计划（AI辅助）
3. 管理学习步骤状态
4. 学习完成统计
"""

import uuid
import json
import logging
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from sqlalchemy import select, update, delete, func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.study_plan import StudyPlan, StudyPlanStep, LearningPath
from app.models.student_profile import StudentProfile
from app.services.llm_factory import get_llm_client
from app.agents.learning_path_agent import learning_path_agent

logger = logging.getLogger(__name__)


class StudyPlanService:
    """学习计划服务"""

    async def create_study_plan(
        self,
        db: AsyncSession,
        student_id: str,
        knowledge_point: str,
        difficulty: str = "intermediate",
        prerequisites: List[str] = None
    ) -> Dict[str, Any]:
        """创建学习计划（AI生成步骤）"""
        try:
            # 获取学生画像
            profile = await self._get_student_profile(db, student_id)
            
            # 调用AI生成学习计划
            plan_data = await self._generate_plan_with_ai(
                knowledge_point=knowledge_point,
                difficulty=difficulty,
                profile=profile,
                prerequisites=prerequisites or []
            )
            
            # 创建计划记录
            plan = StudyPlan(
                id=uuid.uuid4(),
                student_id=uuid.UUID(student_id),
                knowledge_point=knowledge_point,
                title=plan_data.get("title", f"{knowledge_point}学习计划"),
                description=plan_data.get("description", ""),
                status="planning",
                total_steps=len(plan_data.get("steps", [])),
                completed_steps=0,
                estimated_minutes=plan_data.get("total_minutes", 60),
                difficulty=difficulty,
                prerequisites=prerequisites or [],
                ai_generated=plan_data.get("metadata", {})
            )
            db.add(plan)
            
            # 创建步骤记录
            steps = []
            for i, step_data in enumerate(plan_data.get("steps", [])):
                step = StudyPlanStep(
                    id=uuid.uuid4(),
                    plan_id=plan.id,
                    order=i + 1,
                    title=step_data.get("title", f"步骤{i + 1}"),
                    description=step_data.get("description", ""),
                    estimated_minutes=step_data.get("minutes", 15),
                    status="pending" if i > 0 else "current",
                    step_type=step_data.get("type", "learn"),
                    content_hint=step_data.get("hint", "")
                )
                db.add(step)
                steps.append({
                    "id": str(step.id),
                    "order": step.order,
                    "title": step.title,
                    "description": step.description,
                    "estimated_minutes": step.estimated_minutes,
                    "status": step.status,
                    "step_type": step.step_type
                })
            
            await db.commit()
            
            return {
                "id": str(plan.id),
                "knowledge_point": plan.knowledge_point,
                "title": plan.title,
                "description": plan.description,
                "status": plan.status,
                "total_steps": plan.total_steps,
                "estimated_minutes": plan.estimated_minutes,
                "difficulty": plan.difficulty,
                "prerequisites": plan.prerequisites,
                "steps": steps,
                "created_at": plan.created_at.isoformat() if plan.created_at else None
            }
            
        except Exception as e:
            logger.error("创建学习计划失败: %s", e)
            await db.rollback()
            raise

    async def get_study_plan(self, db: AsyncSession, plan_id: str) -> Optional[Dict[str, Any]]:
        """获取学习计划详情"""
        try:
            result = await db.execute(
                select(StudyPlan).where(StudyPlan.id == uuid.UUID(plan_id))
            )
            plan = result.scalar_one_or_none()
            
            if not plan:
                return None
            
            # 获取步骤
            steps_result = await db.execute(
                select(StudyPlanStep)
                .where(StudyPlanStep.plan_id == plan.id)
                .order_by(StudyPlanStep.order)
            )
            steps = steps_result.scalars().all()
            
            return {
                "id": str(plan.id),
                "knowledge_point": plan.knowledge_point,
                "title": plan.title,
                "description": plan.description,
                "status": plan.status,
                "total_steps": plan.total_steps,
                "completed_steps": plan.completed_steps,
                "estimated_minutes": plan.estimated_minutes,
                "actual_minutes": plan.actual_minutes,
                "difficulty": plan.difficulty,
                "prerequisites": plan.prerequisites,
                "steps": [
                    {
                        "id": str(step.id),
                        "order": step.order,
                        "title": step.title,
                        "description": step.description,
                        "estimated_minutes": step.estimated_minutes,
                        "status": step.status,
                        "step_type": step.step_type,
                        "content_hint": step.content_hint,
                        "resource_id": str(step.resource_id) if step.resource_id else None,
                        "completed_at": step.completed_at.isoformat() if step.completed_at else None
                    }
                    for step in steps
                ],
                "created_at": plan.created_at.isoformat() if plan.created_at else None,
                "completed_at": plan.completed_at.isoformat() if plan.completed_at else None
            }
            
        except Exception as e:
            logger.error("获取学习计划失败: %s", e)
            return None

    async def get_student_plans(
        self, 
        db: AsyncSession, 
        student_id: str,
        status: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """获取学生的所有学习计划"""
        try:
            query = select(StudyPlan).where(StudyPlan.student_id == uuid.UUID(student_id))
            
            if status:
                query = query.where(StudyPlan.status == status)
            
            query = query.order_by(StudyPlan.created_at.desc())
            
            result = await db.execute(query)
            plans = result.scalars().all()
            
            plan_list = []
            for plan in plans:
                # 获取步骤统计
                steps_result = await db.execute(
                    select(func.count(StudyPlanStep.id))
                    .where(StudyPlanStep.plan_id == plan.id)
                )
                step_count = steps_result.scalar() or 0
                
                completed_result = await db.execute(
                    select(func.count(StudyPlanStep.id))
                    .where(
                        and_(
                            StudyPlanStep.plan_id == plan.id,
                            StudyPlanStep.status == "completed"
                        )
                    )
                )
                completed_count = completed_result.scalar() or 0
                
                plan_list.append({
                    "id": str(plan.id),
                    "knowledge_point": plan.knowledge_point,
                    "title": plan.title,
                    "status": plan.status,
                    "total_steps": step_count,
                    "completed_steps": completed_count,
                    "estimated_minutes": plan.estimated_minutes,
                    "difficulty": plan.difficulty,
                    "created_at": plan.created_at.isoformat() if plan.created_at else None
                })
            
            return plan_list
            
        except Exception as e:
            logger.error("获取学生计划列表失败: %s", e)
            return []

    async def complete_step(
        self, 
        db: AsyncSession, 
        plan_id: str, 
        step_id: str
    ) -> Dict[str, Any]:
        """完成学习步骤"""
        try:
            # 更新步骤状态
            await db.execute(
                update(StudyPlanStep)
                .where(StudyPlanStep.id == uuid.UUID(step_id))
                .values(
                    status="completed",
                    completed_at=datetime.now(timezone.utc)
                )
            )
            
            # 获取当前计划
            plan_result = await db.execute(
                select(StudyPlan).where(StudyPlan.id == uuid.UUID(plan_id))
            )
            plan = plan_result.scalar_one_or_none()
            
            if not plan:
                raise ValueError("学习计划不存在")
            
            # 更新计划进度
            new_completed = plan.completed_steps + 1
            
            # 检查是否全部完成
            all_completed = new_completed >= plan.total_steps
            
            update_values = {
                "completed_steps": new_completed,
                "updated_at": datetime.now(timezone.utc)
            }
            
            if all_completed:
                update_values["status"] = "completed"
                update_values["completed_at"] = datetime.now(timezone.utc)
            else:
                update_values["status"] = "learning"
            
            await db.execute(
                update(StudyPlan)
                .where(StudyPlan.id == uuid.UUID(plan_id))
                .values(**update_values)
            )
            
            # 如果有下一步，激活下一步
            if not all_completed:
                next_step_result = await db.execute(
                    select(StudyPlanStep)
                    .where(
                        and_(
                            StudyPlanStep.plan_id == uuid.UUID(plan_id),
                            StudyPlanStep.order == new_completed + 1
                        )
                    )
                )
                next_step = next_step_result.scalar_one_or_none()
                if next_step:
                    await db.execute(
                        update(StudyPlanStep)
                        .where(StudyPlanStep.id == next_step.id)
                        .values(status="current")
                    )
            
            await db.commit()
            
            return {
                "success": True,
                "completed_steps": new_completed,
                "total_steps": plan.total_steps,
                "all_completed": all_completed,
                "plan_status": "completed" if all_completed else "learning"
            }
            
        except Exception as e:
            logger.error("完成步骤失败: %s", e)
            await db.rollback()
            raise

    async def generate_learning_path(
        self,
        db: AsyncSession,
        student_id: str,
        target_knowledge: str,
        current_level: str = "beginner"
    ) -> Dict[str, Any]:
        """生成学习路径（知识点依赖关系图）"""
        try:
            # 获取学生画像
            profile = await self._get_student_profile(db, student_id)
            
            # 使用专门的Agent生成学习路径
            path_data = await learning_path_agent.generate_path(
                target_knowledge=target_knowledge,
                current_level=current_level,
                student_profile=profile
            )
            
            # 保存路径
            path_name = path_data.get("name", f"{target_knowledge}学习路径")
            path = LearningPath(
                id=uuid.uuid4(),
                student_id=uuid.UUID(student_id),
                name=path_name,
                title=path_name,  # 同时设置title字段
                description=path_data.get("description", ""),
                nodes=path_data.get("nodes", []),
                status="active",
                ai_generated={"generated_by": "learning_path_agent"}
            )
            db.add(path)
            await db.commit()
            
            return {
                "id": str(path.id),
                "name": path.name,
                "description": path.description,
                "nodes": path.nodes,
                "created_at": path.created_at.isoformat() if path.created_at else None
            }
            
        except Exception as e:
            logger.error("生成学习路径失败: %s", e)
            await db.rollback()
            raise

    async def get_student_paths(
        self, 
        db: AsyncSession, 
        student_id: str
    ) -> List[Dict[str, Any]]:
        """获取学生的学习路径"""
        try:
            result = await db.execute(
                select(LearningPath)
                .where(LearningPath.student_id == uuid.UUID(student_id))
                .order_by(LearningPath.created_at.desc())
            )
            paths = result.scalars().all()
            
            return [
                {
                    "id": str(path.id),
                    "name": path.name,
                    "description": path.description,
                    "nodes": path.nodes,
                    "status": path.status,
                    "created_at": path.created_at.isoformat() if path.created_at else None
                }
                for path in paths
            ]
            
        except Exception as e:
            logger.error("获取学习路径失败: %s", e)
            return []

    async def _get_student_profile(
        self, 
        db: AsyncSession, 
        student_id: str
    ) -> Dict[str, Any]:
        """获取学生画像"""
        try:
            result = await db.execute(
                select(StudentProfile)
                .where(StudentProfile.student_id == uuid.UUID(student_id))
            )
            profile = result.scalar_one_or_none()
            
            if profile:
                return {
                    "dimensions": profile.dimensions or {},
                    "background": profile.background or {},
                    "assessment_status": profile.assessment_status
                }
            return {}
            
        except Exception as e:
            logger.warning("获取学生画像失败: %s", e)
            return {}

    async def _generate_plan_with_ai(
        self,
        knowledge_point: str,
        difficulty: str,
        profile: Dict[str, Any],
        prerequisites: List[str]
    ) -> Dict[str, Any]:
        """调用AI生成学习计划"""
        try:
            llm = get_llm_client()
            
            # 构建提示词
            profile_info = ""
            if profile.get("dimensions"):
                dims = profile["dimensions"]
                weak_points = [k for k, v in dims.items() if v < 60]
                if weak_points:
                    profile_info = f"学生薄弱点: {', '.join(weak_points)}"
            
            system_prompt = """你是一个学习规划专家。根据用户要学习的知识点，生成详细的学习计划。

输出格式（JSON）:
{
  "title": "计划标题",
  "description": "计划描述",
  "total_minutes": 总时长（分钟）,
  "steps": [
    {
      "title": "步骤标题",
      "description": "步骤描述",
      "minutes": 预计时长,
      "type": "learn/practice/review",
      "hint": "学习提示"
    }
  ],
  "metadata": {}
}

要求:
1. 步骤数量3-6步
2. 包含理论学习和实践练习
3. 根据难度调整时长
4. 步骤描述要具体"""

            user_prompt = f"""请为以下知识点生成学习计划:

知识点: {knowledge_point}
难度: {difficulty}
前置知识: {', '.join(prerequisites) if prerequisites else '无'}
{profile_info}

请生成详细的学习计划。"""

            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ]
            
            response = await llm.chat(messages, max_tokens=2000, temperature=0.7)
            
            # 解析响应
            content = response.get("content", "")
            
            # 尝试提取JSON
            try:
                # 查找JSON块
                json_start = content.find("{")
                json_end = content.rfind("}") + 1
                if json_start >= 0 and json_end > json_start:
                    json_str = content[json_start:json_end]
                    plan_data = json.loads(json_str)
                    return plan_data
            except json.JSONDecodeError as e:
                logger.warning("学习计划 JSON 解析失败，使用 fallback: %s", e)
            
            # 如果解析失败，返回默认计划
            return self._get_default_plan(knowledge_point, difficulty)
            
        except Exception as e:
            logger.warning("AI生成计划失败，使用默认计划: %s", e)
            return self._get_default_plan(knowledge_point, difficulty)

    def _get_default_plan(
        self,
        knowledge_point: str, 
        difficulty: str
    ) -> Dict[str, Any]:
        """获取默认学习计划"""
        base_minutes = 15 if difficulty == "beginner" else 20 if difficulty == "intermediate" else 25
        
        return {
            "title": f"{knowledge_point}学习计划",
            "description": f"系统学习{knowledge_point}的完整计划",
            "total_minutes": base_minutes * 4,
            "steps": [
                {
                    "title": "概念理解",
                    "description": f"学习{knowledge_point}的基本概念和核心原理",
                    "minutes": base_minutes,
                    "type": "learn",
                    "hint": "重点理解基础概念，建立知识框架"
                },
                {
                    "title": "知识深入",
                    "description": f"掌握{knowledge_point}的关键技术和实现方法",
                    "minutes": base_minutes + 5,
                    "type": "learn",
                    "hint": "结合实例理解，加深记忆"
                },
                {
                    "title": "实践练习",
                    "description": f"通过实例理解{knowledge_point}的实际应用",
                    "minutes": base_minutes,
                    "type": "practice",
                    "hint": "动手实践，加深理解"
                },
                {
                    "title": "总结巩固",
                    "description": "回顾学习内容，完成配套练习",
                    "minutes": base_minutes - 5,
                    "type": "review",
                    "hint": "查漏补缺，巩固学习成果"
                }
            ],
            "metadata": {"is_default": True}
        }

    def _get_default_path(self, target_knowledge: str) -> Dict[str, Any]:
        """获取默认学习路径 - 根据知识点生成详细路径"""
        # 根据知识点生成更详细的路径
        kp_lower = target_knowledge.lower()
        
        # 通用详细路径模板
        nodes = [
            {
                "id": "node_1",
                "knowledge_point": f"{target_knowledge}概述与发展历史",
                "category": "基础概念",
                "order": 1,
                "status": "pending",
                "prerequisites": [],
                "description": f"了解{target_knowledge}的基本概念、发展背景和应用领域"
            },
            {
                "id": "node_2",
                "knowledge_point": f"{target_knowledge}核心原理与理论基础",
                "category": "基础概念",
                "order": 2,
                "status": "pending",
                "prerequisites": ["node_1"],
                "description": f"掌握{target_knowledge}的核心原理和理论基础"
            },
            {
                "id": "node_3",
                "knowledge_point": f"{target_knowledge}基本概念与术语",
                "category": "基础概念",
                "order": 3,
                "status": "pending",
                "prerequisites": ["node_2"],
                "description": f"熟悉{target_knowledge}领域的专业术语和基本概念"
            },
            {
                "id": "node_4",
                "knowledge_point": f"{target_knowledge}基础技术与方法",
                "category": "核心原理",
                "order": 4,
                "status": "pending",
                "prerequisites": ["node_3"],
                "description": f"学习{target_knowledge}的基础技术和常用方法"
            },
            {
                "id": "node_5",
                "knowledge_point": f"{target_knowledge}关键技术详解",
                "category": "核心原理",
                "order": 5,
                "status": "pending",
                "prerequisites": ["node_4"],
                "description": f"深入理解{target_knowledge}的关键技术"
            },
            {
                "id": "node_6",
                "knowledge_point": f"{target_knowledge}实践应用案例",
                "category": "实践应用",
                "order": 6,
                "status": "pending",
                "prerequisites": ["node_5"],
                "description": f"通过实际案例学习{target_knowledge}的应用"
            },
            {
                "id": "node_7",
                "knowledge_point": f"{target_knowledge}工具与环境搭建",
                "category": "实践应用",
                "order": 7,
                "status": "pending",
                "prerequisites": ["node_6"],
                "description": f"掌握{target_knowledge}相关工具的使用和环境配置"
            },
            {
                "id": "node_8",
                "knowledge_point": f"{target_knowledge}项目实战",
                "category": "实践应用",
                "order": 8,
                "status": "pending",
                "prerequisites": ["node_7"],
                "description": f"通过完整项目实践{target_knowledge}的综合应用"
            },
            {
                "id": "node_9",
                "knowledge_point": f"{target_knowledge}进阶技术与前沿",
                "category": "进阶拓展",
                "order": 9,
                "status": "pending",
                "prerequisites": ["node_8"],
                "description": f"了解{target_knowledge}的进阶技术和前沿发展"
            },
            {
                "id": "node_10",
                "knowledge_point": f"{target_knowledge}综合复习与总结",
                "category": "进阶拓展",
                "order": 10,
                "status": "pending",
                "prerequisites": ["node_9"],
                "description": f"系统复习{target_knowledge}，查漏补缺"
            }
        ]
        
        return {
            "name": f"{target_knowledge}学习路径",
            "description": f"从基础到进阶的{target_knowledge}完整学习路径，共10个知识点",
            "nodes": [
                {**nodes[0], "status": "current"},  # 第一个节点设为当前
                *nodes[1:]
            ],
            "metadata": {"is_default": True}
        }


# 创建全局服务实例
study_plan_service = StudyPlanService()
