"""效果评估服务 — F5

记录学习行为，触发画像更新，提供统计分析。
"""

import uuid
import json
import re
import logging
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from app.models.learning_record import LearningRecord
from app.models.student_profile import StudentProfile
from app.models.resource import Resource
from app.models.exercise import Exercise
from app.models.learning_path import LearningPath
from app.models.student import Student

logger = logging.getLogger(__name__)


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

        # 获取学生信息
        student_result = await db.execute(
            select(Student)
            .where(Student.id == uuid.UUID(student_id))
            .limit(1)
        )
        student = student_result.scalar_one_or_none()
        student_name = student.name if student else "同学"

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

        # 获取练习详情（用于 LLM 分析）
        exercise_details = await self._get_exercise_details(db, student_id)

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

        # 计算近期趋势
        trend = await self._calculate_trend(db, student_id)

        # 尝试用 LLM 生成报告，失败则降级到规则引擎
        llm_report = await self._generate_llm_report(
            student_name=student_name,
            overall_score=round(min(100, score), 1),
            stats=stats,
            profile=profile,
            exercise_details=exercise_details,
            trend=trend,
        )

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
            "report": llm_report,
            "profile": self._extract_profile(profile),
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

    async def _get_exercise_details(self, db: AsyncSession, student_id: str) -> dict:
        """获取练习详情（用于 LLM 分析）"""
        sid = uuid.UUID(student_id)
        since = datetime.utcnow() - timedelta(days=30)

        # 按知识点统计正确/错误数
        result = await db.execute(
            select(
                Exercise.knowledge_point,
                func.count(Exercise.id).label("total"),
                func.sum(func.cast(Exercise.is_correct == 1, type_=int)).label("correct_count"),
            )
            .where(
                Exercise.student_id == sid,
                Exercise.knowledge_point.isnot(None),
                Exercise.created_at >= since,
            )
            .group_by(Exercise.knowledge_point)
        )

        details = {}
        for row in result.fetchall():
            kp = row[0]
            total = row[1] or 0
            correct_count = row[2] or 0
            error_count = total - correct_count
            error_rate = error_count / total if total > 0 else 0
            details[kp] = {
                "total": total,
                "correct_count": correct_count,
                "error_count": error_count,
                "error_rate": round(error_rate, 2),
            }

        return details

    async def _calculate_trend(self, db: AsyncSession, student_id: str) -> dict:
        """计算近期趋势（近7天 vs 之前7天）"""
        sid = uuid.UUID(student_id)
        now = datetime.utcnow()
        recent_start = now - timedelta(days=7)
        prev_start = now - timedelta(days=14)

        # 近7天正确率
        recent_result = await db.execute(
            select(func.avg(Exercise.is_correct))
            .where(
                Exercise.student_id == sid,
                Exercise.created_at >= recent_start,
            )
        )
        recent_score = float(recent_result.scalar_one() or 0)

        # 之前7天正确率
        prev_result = await db.execute(
            select(func.avg(Exercise.is_correct))
            .where(
                Exercise.student_id == sid,
                Exercise.created_at >= prev_start,
                Exercise.created_at < recent_start,
            )
        )
        prev_score = float(prev_result.scalar_one() or 0)

        # 近7天学习时长
        recent_duration_result = await db.execute(
            select(func.sum(LearningRecord.duration_seconds))
            .where(
                LearningRecord.student_id == sid,
                LearningRecord.created_at >= recent_start,
            )
        )
        recent_minutes = (recent_duration_result.scalar_one() or 0) / 60

        # 之前7天学习时长
        prev_duration_result = await db.execute(
            select(func.sum(LearningRecord.duration_seconds))
            .where(
                LearningRecord.student_id == sid,
                LearningRecord.created_at >= prev_start,
                LearningRecord.created_at < recent_start,
            )
        )
        prev_minutes = (prev_duration_result.scalar_one() or 0) / 60

        return {
            "recent_score": round(recent_score * 100, 1),
            "prev_score": round(prev_score * 100, 1),
            "score_change": round((recent_score - prev_score) * 100, 1),
            "recent_hours": round(recent_minutes / 60, 1),
            "prev_hours": round(prev_minutes / 60, 1),
            "duration_change": round((recent_minutes - prev_minutes) / 60, 1),
        }

    async def _generate_llm_report(
        self,
        student_name: str,
        overall_score: float,
        stats: dict,
        profile,
        exercise_details: dict,
        trend: dict,
    ) -> dict:
        """用 LLM 生成评估报告，失败则降级到规则引擎"""
        try:
            from app.core.config import settings
            from app.services.minimax_client import MiniMaxClient

            # 选择 LLM 客户端
            if settings.LLM_PROVIDER == "spark":
                from app.services.spark_client import SparkClient
                llm = SparkClient(api_key=settings.SPARK_API_KEY)
            else:
                llm = MiniMaxClient(
                    api_key=settings.MINIMAX_API_KEY,
                    base_url=settings.MINIMAX_BASE_URL,
                )

            # 构造 Prompt
            prompt = self._build_report_prompt(
                student_name, overall_score, stats, profile, exercise_details, trend
            )

            # 调用 LLM
            response = await llm.chat(
                messages=[{"role": "user", "content": prompt}],
                system="你是一个专业的学习分析专家，负责分析学生的学习数据并生成评估报告。请严格按照指定的 JSON 格式输出。",
                max_tokens=2000,
                temperature=0.7,
            )

            content = response.get("content", "")

            # 解析 LLM 响应
            report = self._parse_llm_response(content)
            if report:
                logger.info(f"LLM 报告生成成功: student_id={student_name}")
                return report
            else:
                logger.warning(f"LLM 响应解析失败，降级到规则引擎")
                return self._generate_fallback_report(
                    student_name, overall_score, stats, exercise_details, trend
                )

        except Exception as e:
            logger.error(f"LLM 报告生成失败: {e}，降级到规则引擎")
            return self._generate_fallback_report(
                student_name, overall_score, stats, exercise_details, trend
            )

    def _build_report_prompt(
        self,
        student_name: str,
        overall_score: float,
        stats: dict,
        profile,
        exercise_details: dict,
        trend: dict,
    ) -> str:
        """构造 LLM Prompt"""
        # 知识点掌握度
        knowledge_list = []
        for kp, data in stats.get("knowledge_mastery", {}).items():
            knowledge_list.append(
                f"- {kp}: 掌握度 {data['avg_score']}%（{data['attempt_count']}次练习）"
            )
        knowledge_text = "\n".join(knowledge_list) if knowledge_list else "暂无数据"

        # 错题统计
        error_list = []
        for kp, data in exercise_details.items():
            if data["error_rate"] > 0.3:
                error_list.append(
                    f"- {kp}: 错误率 {int(data['error_rate']*100)}%（{data['error_count']}题错误）"
                )
        error_text = "\n".join(error_list) if error_list else "暂无明显易错点"

        # 画像数据
        profile_text = ""
        if profile and profile.dimensions:
            dims = profile.dimensions
            profile_text = f"""
【学习画像】
理解力: {dims.get('comprehension', {}).get('score', 0)}
记忆力: {dims.get('memory', {}).get('score', 0)}
应用转化: {dims.get('application', {}).get('score', 0)}
想象力: {dims.get('imagination', {}).get('score', 0)}
专注力: {dims.get('focus', {}).get('score', 0)}"""

        # 等级判定
        level = "优秀" if overall_score >= 85 else "良好" if overall_score >= 70 else "中等" if overall_score >= 55 else "需加强"

        prompt = f"""请根据以下学习数据，为{student_name}同学生成一份详细的评估报告。

【基础信息】
姓名: {student_name}
综合评分: {overall_score}分
等级: {level}
日均学习时长: {round(stats.get('total_duration_minutes', 0) / 30 / 60, 1)}小时
练习总次数: {stats.get('total_actions', 0)}
{profile_text}

【知识点掌握度】
{knowledge_text}

【易错点分析】
{error_text}

【近期趋势】
近7天正确率: {trend.get('recent_score', 0)}%
之前7天正确率: {trend.get('prev_score', 0)}%
正确率变化: {trend.get('score_change', 0):+.1f}%
近7天学习时长: {trend.get('recent_hours', 0)}h
之前7天学习时长: {trend.get('prev_hours', 0)}h
时长变化: {trend.get('duration_change', 0):+.1f}h

请生成评估报告，严格按照以下 JSON 格式输出（不要输出其他内容）：
{{
  "overall_evaluation": "总体评价（1-2句话，概括整体表现）",
  "strengths": [
    {{"name": "知识点名称", "mastery": 85, "description": "具体描述为什么这是优势"}}
  ],
  "weak_points": [
    {{"name": "知识点名称", "mastery": 22, "description": "具体描述薄弱原因和改进建议"}}
  ],
  "error_prone_areas": [
    {{"name": "易错点名称", "error_rate": 65, "description": "具体描述为什么容易出错"}}
  ],
  "recommendations": ["建议1", "建议2", "建议3", "建议4"],
  "progress_trend": {{
    "score_change": 5,
    "duration_change": 4.2,
    "description": "较上周相比，练习正确率提升了{trend.get('score_change', 0):+.1f}%，学习时长增加了{trend.get('duration_change', 0):+.1f}h。继续保持当前节奏，预计可按计划完成学习目标。"
  }}
}}"""

        return prompt

    def _parse_llm_response(self, content: str) -> dict | None:
        """解析 LLM 响应为 JSON"""
        try:
            # 尝试直接解析
            report = json.loads(content)
            if "overall_evaluation" in report:
                return report
        except json.JSONDecodeError:
            pass

        # 尝试提取 JSON 块
        json_match = re.search(r'\{[\s\S]*\}', content)
        if json_match:
            try:
                report = json.loads(json_match.group())
                if "overall_evaluation" in report:
                    return report
            except json.JSONDecodeError:
                pass

        return None

    def _extract_profile(self, profile) -> dict:
        """提取画像数据"""
        if not profile or not profile.dimensions:
            return {
                "comprehension": 0,
                "memory": 0,
                "application": 0,
                "imagination": 0,
                "focus": 0,
            }

        dims = profile.dimensions
        return {
            "comprehension": dims.get("comprehension", {}).get("score", 0),
            "memory": dims.get("memory", {}).get("score", 0),
            "application": dims.get("application", {}).get("score", 0),
            "imagination": dims.get("imagination", {}).get("score", 0),
            "focus": dims.get("focus", {}).get("score", 0),
        }

    def _generate_fallback_report(
        self,
        student_name: str,
        overall_score: float,
        stats: dict,
        exercise_details: dict,
        trend: dict,
    ) -> dict:
        """规则引擎降级报告"""
        # 等级判定
        level = "优秀" if overall_score >= 85 else "良好" if overall_score >= 70 else "中等" if overall_score >= 55 else "需加强"

        # 日均学习时长
        daily_hours = round(stats.get("total_duration_minutes", 0) / 30 / 60, 1)

        # 总体评价
        overall_evaluation = (
            f"{student_name}同学在本阶段的学习中表现{level}，综合评分为 {overall_score} 分。"
            f"日均学习时长稳定在 {daily_hours} 小时，"
            f"共完成 {stats.get('total_actions', 0)} 次学习行为。"
        )

        # 优势领域（掌握度 > 70%）
        strengths = []
        for kp, data in stats.get("knowledge_mastery", {}).items():
            if data["avg_score"] >= 70:
                strengths.append({
                    "name": kp,
                    "mastery": round(data["avg_score"]),
                    "description": f"掌握度 {round(data['avg_score'])}%，{data['attempt_count']}次练习表现稳定",
                })
        strengths = strengths[:3]  # 最多3个

        # 薄弱环节（掌握度 < 50%）
        weak_points = []
        for kp, data in stats.get("knowledge_mastery", {}).items():
            if data["avg_score"] < 50:
                weak_points.append({
                    "name": kp,
                    "mastery": round(data["avg_score"]),
                    "description": f"掌握度仅 {round(data['avg_score'])}%，需重点加强学习",
                })
        weak_points = weak_points[:3]  # 最多3个

        # 易错点（错误率 > 30%）
        error_prone_areas = []
        for kp, data in exercise_details.items():
            if data["error_rate"] > 0.3:
                error_prone_areas.append({
                    "name": kp,
                    "error_rate": int(data["error_rate"] * 100),
                    "description": f"错误率 {int(data['error_rate']*100)}%，需针对性练习",
                })
        error_prone_areas = error_prone_areas[:3]  # 最多3个

        # 学习建议
        recommendations = self._generate_recommendations(stats, stats.get("avg_score", 0))

        # 进步趋势
        progress_trend = {
            "score_change": trend.get("score_change", 0),
            "duration_change": trend.get("duration_change", 0),
            "description": (
                f"较上周相比，练习正确率变化 {trend.get('score_change', 0):+.1f}%，"
                f"学习时长变化 {trend.get('duration_change', 0):+.1f}h。"
                f"继续保持当前节奏，预计可按计划完成学习目标。"
            ),
        }

        return {
            "overall_evaluation": overall_evaluation,
            "strengths": strengths,
            "weak_points": weak_points,
            "error_prone_areas": error_prone_areas,
            "recommendations": recommendations,
            "progress_trend": progress_trend,
        }


evaluation_service = EvaluationService()
