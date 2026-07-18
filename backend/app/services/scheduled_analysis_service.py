"""定时画像分析服务 — 每隔固定时间用 AI Agent 分析学习行为并更新画像"""

import asyncio
import logging
from datetime import datetime, timezone, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from app.core.database import async_session
from app.models.student import Student
from app.models.student_profile import StudentProfile
from app.models.chat_message import ChatMessage
from app.models.chat_session import ChatSession
from app.models.learning_record import LearningRecord
from app.agents.behavior_analysis_agent import behavior_analysis_agent

logger = logging.getLogger(__name__)

# 分析间隔（小时）
ANALYSIS_INTERVAL_HOURS = 4


class ScheduledAnalysisService:
    """定时画像分析服务"""

    def __init__(self):
        self._running = False
        self._task = None

    async def start(self):
        """启动定时任务"""
        if self._running:
            logger.warning("[scheduled_analysis] Already running")
            return

        self._running = True
        self._task = asyncio.create_task(self._run_loop())
        logger.info(f"[scheduled_analysis] Started, interval={ANALYSIS_INTERVAL_HOURS}h")

    async def stop(self):
        """停止定时任务"""
        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        logger.info("[scheduled_analysis] Stopped")

    async def _run_loop(self):
        """主循环（PostgreSQL advisory lock 保证多 worker 只有一个执行）"""
        # 启动后延迟 30 秒再跑第一次分析，避免和用户 API 请求抢资源
        await asyncio.sleep(30)
        while self._running:
            try:
                # 尝试获取 advisory lock（多 worker 只有一个执行）
                async with async_session() as db:
                    result = await db.execute(
                        __import__("sqlalchemy").text("SELECT pg_try_advisory_lock(12345)")
                    )
                    got_lock = result.scalar()
                    if not got_lock:
                        logger.debug("[scheduled_analysis] Another worker holds the lock, skipping")
                        await asyncio.sleep(ANALYSIS_INTERVAL_HOURS * 3600)
                        continue

                try:
                    await self._analyze_all_students()
                finally:
                    # 释放锁
                    async with async_session() as db:
                        await db.execute(
                            __import__("sqlalchemy").text("SELECT pg_advisory_unlock(12345)")
                        )
                        await db.commit()

            except Exception as e:
                logger.error(f"[scheduled_analysis] Error in analysis loop: {e}")

            # 等待下一次分析
            await asyncio.sleep(ANALYSIS_INTERVAL_HOURS * 3600)

    async def _analyze_all_students(self):
        """分析所有学生"""
        logger.info("[scheduled_analysis] Starting analysis for all students")

        async with async_session() as db:
            # 获取所有有画像的学生
            result = await db.execute(
                select(Student.id, StudentProfile.id.label("profile_id"))
                .join(StudentProfile, Student.id == StudentProfile.student_id)
            )
            students = result.all()

            logger.info(f"[scheduled_analysis] Found {len(students)} students to analyze")

            for student in students:
                try:
                    await self._analyze_student(db, str(student.id))
                except Exception as e:
                    logger.error(f"[scheduled_analysis] Error analyzing student {student.id}: {e}")

        logger.info("[scheduled_analysis] Completed analysis for all students")

    async def _analyze_student(self, db: AsyncSession, student_id: str):
        """分析单个学生"""
        # 检查是否需要分析（距离上次分析是否超过间隔）
        profile = await self._get_profile(db, student_id)
        if not profile:
            return

        last_analyzed = profile.last_analyzed_at
        if last_analyzed:
            # 确保时区感知
            if last_analyzed.tzinfo is None:
                last_analyzed = last_analyzed.replace(tzinfo=timezone.utc)
            time_since = datetime.now(timezone.utc) - last_analyzed
            if time_since < timedelta(hours=ANALYSIS_INTERVAL_HOURS):
                logger.debug(f"[scheduled_analysis] Skipping {student_id}, analyzed {time_since} ago")
                return

        # 检查是否有新的学习行为
        has_new_behavior = await self._has_new_behavior(db, student_id, last_analyzed)
        if not has_new_behavior:
            logger.debug(f"[scheduled_analysis] Skipping {student_id}, no new behavior")
            return

        # 调用 AI Agent 分析（内部通过 profile_service 写入，自带锁）
        logger.info(f"[scheduled_analysis] Analyzing student {student_id}")
        result = await behavior_analysis_agent.analyze_and_update(
            db=db,
            student_id=student_id,
            behavior_type="scheduled",
            behavior_data={"analysis_type": "periodic"},
        )

        # 更新最后分析时间（用独立 session，因为 apply_llm_updates 已 commit）
        if result.get("status") in ("updated", "no_change"):
            try:
                async with async_session() as update_db:
                    from sqlalchemy import update as sql_update
                    await update_db.execute(
                        sql_update(StudentProfile)
                        .where(StudentProfile.student_id == student_id)
                        .values(last_analyzed_at=datetime.now(timezone.utc))
                    )
                    await update_db.commit()
            except Exception as e:
                logger.warning(f"[scheduled_analysis] Failed to update last_analyzed_at: {e}")

        return result

    async def _get_profile(self, db: AsyncSession, student_id: str) -> StudentProfile | None:
        """获取学生画像"""
        result = await db.execute(
            select(StudentProfile).where(StudentProfile.student_id == student_id).limit(1)
        )
        return result.scalar_one_or_none()

    async def _has_new_behavior(
        self, db: AsyncSession, student_id: str, since: datetime | None
    ) -> bool:
        """检查是否有新的学习行为"""
        if not since:
            return True

        # 确保时区感知
        if since.tzinfo is None:
            since = since.replace(tzinfo=timezone.utc)

        # 检查新对话
        chat_count = await db.execute(
            select(ChatMessage.id)
            .join(ChatSession, ChatMessage.session_id == ChatSession.id)
            .where(
                ChatSession.student_id == student_id,
                ChatMessage.created_at > since,
            )
            .limit(1)
        )
        if chat_count.scalar_one_or_none():
            return True

        # 检查新学习记录（包括练习）
        lr_count = await db.execute(
            select(LearningRecord.id)
            .where(
                LearningRecord.student_id == student_id,
                LearningRecord.created_at > since,
            )
            .limit(1)
        )
        if lr_count.scalar_one_or_none():
            return True

        return False

    async def force_analyze(self, student_id: str) -> dict:
        """强制分析单个学生（用于手动触发）"""
        async with async_session() as db:
            result = await behavior_analysis_agent.analyze_and_update(
                db=db,
                student_id=student_id,
                behavior_type="manual",
                behavior_data={"analysis_type": "forced"},
            )

            # 更新最后分析时间（独立 session）
            if result.get("status") in ("updated", "no_change"):
                try:
                    async with async_session() as update_db:
                        from sqlalchemy import update as sql_update
                        await update_db.execute(
                            sql_update(StudentProfile)
                            .where(StudentProfile.student_id == student_id)
                            .values(last_analyzed_at=datetime.now(timezone.utc))
                        )
                        await update_db.commit()
                except Exception as e:
                    logger.warning(f"[scheduled_analysis] Failed to update last_analyzed_at: {e}")

            return result


# 单例
scheduled_analysis_service = ScheduledAnalysisService()
