"""效果评估服务 — F5

记录学习行为，触发画像更新，提供统计分析。
"""

import uuid
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from app.models.learning_record import LearningRecord
from app.models.student_profile import StudentProfile
from app.models.resource import Resource
from app.models.exercise import Exercise
from app.models.learning_path import LearningPath


class EvaluationService:
    """效果评估服务"""

    async def record_action(
        self,
        db: AsyncSession,
        student_id: str,
        action: str,
        resource_type: str | None = None,
        resource_id: str | None = None,
        knowledge_point: str | None = None,
        score: float | None = None,
        duration_seconds: int | None = None,
        detail: dict | None = None,
        course_id: str | None = None,
    ) -> LearningRecord:
        """记录学习行为"""
        record = LearningRecord(
            id=uuid.uuid4(),
            student_id=uuid.UUID(student_id),
            course_id=uuid.UUID(course_id) if course_id else None,
            action=action,
            resource_type=resource_type,
            resource_id=uuid.UUID(resource_id) if resource_id else None,
            knowledge_point=knowledge_point,
            score=score,
            duration_seconds=duration_seconds,
            detail=detail or {},
        )
        db.add(record)
        await db.commit()
        return record

    async def get_statistics(
        self,
        db: AsyncSession,
        student_id: str,
        days: int = 30,
    ) -> dict:
        """获取学习统计

        Returns:
            {
                "total_actions": int,
                "total_duration_minutes": float,
                "action_breakdown": dict,
                "knowledge_mastery": dict,
                "daily_activity": list,
                "weak_areas": list,
            }
        """
        sid = uuid.UUID(student_id)
        since = datetime.utcnow() - timedelta(days=days)

        # 总行为数
        total_result = await db.execute(
            select(func.count(LearningRecord.id))
            .where(
                LearningRecord.student_id == sid,
                LearningRecord.created_at >= since,
            )
        )
        total_actions = total_result.scalar_one() or 0

        # 总学习时长（分钟）
        duration_result = await db.execute(
            select(func.sum(LearningRecord.duration_seconds))
            .where(
                LearningRecord.student_id == sid,
                LearningRecord.created_at >= since,
            )
        )
        total_seconds = duration_result.scalar_one() or 0
        total_minutes = round(total_seconds / 60, 1)

        # 行为分类统计
        action_result = await db.execute(
            select(
                LearningRecord.action,
                func.count(LearningRecord.id)
            )
            .where(
                LearningRecord.student_id == sid,
                LearningRecord.created_at >= since,
            )
            .group_by(LearningRecord.action)
        )
        action_breakdown = {row[0]: row[1] for row in action_result.fetchall()}

        # 知识点掌握度（基于练习得分）
        mastery_result = await db.execute(
            select(
                LearningRecord.knowledge_point,
                func.avg(LearningRecord.score).label("avg_score"),
                func.count(LearningRecord.id).label("count")
            )
            .where(
                LearningRecord.student_id == sid,
                LearningRecord.action == "exercise",
                LearningRecord.score.isnot(None),
                LearningRecord.created_at >= since,
            )
            .group_by(LearningRecord.knowledge_point)
        )
        knowledge_mastery = {
            row[0]: {
                "avg_score": round(float(row[1]), 1),
                "attempt_count": row[2],
            }
            for row in mastery_result.fetchall()
            if row[0]
        }

        # 每日活动统计
        daily_result = await db.execute(
            select(
                func.date(LearningRecord.created_at).label("date"),
                func.count(LearningRecord.id).label("count"),
                func.sum(LearningRecord.duration_seconds).label("duration")
            )
            .where(
                LearningRecord.student_id == sid,
                LearningRecord.created_at >= since,
            )
            .group_by(func.date(LearningRecord.created_at))
            .order_by(func.date(LearningRecord.created_at))
        )
        daily_activity = [
            {
                "date": str(row[0]),
                "count": row[1],
                "duration_minutes": round((row[2] or 0) / 60, 1),
            }
            for row in daily_result.fetchall()
        ]

        # 薄弱知识点（平均分 < 60 的）
        weak_areas = [
            kp for kp, data in knowledge_mastery.items()
            if data["avg_score"] < 60
        ]

        return {
            "total_actions": total_actions,
            "total_duration_minutes": total_minutes,
            "action_breakdown": action_breakdown,
            "knowledge_mastery": knowledge_mastery,
            "daily_activity": daily_activity,
            "weak_areas": weak_areas,
        }

    async def get_evaluation_report(
        self,
        db: AsyncSession,
        student_id: str,
    ) -> dict:
        """生成学习评估报告"""
        stats = await self.get_statistics(db, student_id, days=30)

        # 获取画像
        profile_result = await db.execute(
            select(StudentProfile)
            .where(StudentProfile.student_id == uuid.UUID(student_id))
            .limit(1)
        )
        profile = profile_result.scalar_one_or_none()

        # 资源统计
        resource_result = await db.execute(
            select(func.count(Resource.id))
            .where(Resource.student_id == uuid.UUID(student_id))
        )
        total_resources = resource_result.scalar_one() or 0

        # 练习统计
        exercise_result = await db.execute(
            select(
                func.count(Exercise.id),
                func.avg(Exercise.is_correct)
            )
            .where(Exercise.student_id == uuid.UUID(student_id))
        )
        exercise_stats = exercise_result.one()
        total_exercises = exercise_stats[0] or 0
        avg_score = float(exercise_stats[1] or 0)

        # 路径进度（从 daily_plan JSONB 统计）
        path_result = await db.execute(
            select(LearningPath)
            .where(LearningPath.student_id == uuid.UUID(student_id))
        )
        paths = path_result.scalars().all()
        total_nodes = 0
        completed_nodes = 0
        for path in paths:
            daily_plan = path.daily_plan or []
            total_nodes += len(daily_plan)
            completed_nodes += sum(1 for d in daily_plan if d.get("status") == "completed")

        # 综合评分（0-100）
        score = 0
        if total_actions := stats["total_actions"]:
            score += min(30, total_actions * 2)  # 活跃度最高 30 分
        if avg_score:
            score += min(40, avg_score * 0.4)  # 正确率最高 40 分
        if total_nodes > 0:
            path_progress = completed_nodes / total_nodes
            score += min(30, path_progress * 30)  # 路径进度最高 30 分

        return {
            "student_id": student_id,
            "summary": {
                "total_resources": total_resources,
                "total_exercises": total_exercises,
                "avg_score": round(avg_score, 1),
                "total_actions": stats["total_actions"],
                "total_duration_minutes": stats["total_duration_minutes"],
                "path_progress": f"{completed_nodes}/{total_nodes}",
            },
            "knowledge_mastery": stats["knowledge_mastery"],
            "weak_areas": stats["weak_areas"],
            "daily_activity": stats["daily_activity"],
            "overall_score": round(min(100, score), 1),
            "recommendations": self._generate_recommendations(stats, avg_score),
        }

    def _generate_recommendations(self, stats: dict, avg_score: float) -> list[str]:
        """生成学习建议"""
        recommendations = []

        if stats["total_actions"] < 10:
            recommendations.append("建议增加学习频率，每天至少完成 3-5 个学习行为")

        if avg_score < 60:
            recommendations.append("练习正确率较低，建议回顾薄弱知识点后再练习")

        if stats["weak_areas"]:
            recommendations.append(f"薄弱知识点: {', '.join(stats['weak_areas'][:3])}")

        if stats["total_duration_minutes"] < 60:
            recommendations.append("学习时长不足，建议每天学习 30 分钟以上")

        if not recommendations:
            recommendations.append("学习状态良好，继续保持！")

        return recommendations


evaluation_service = EvaluationService()
