"""评估报告定时任务 — 每天 4 点生成"""

import asyncio
import uuid
import logging
from datetime import datetime, date
from celery import shared_task
from sqlalchemy import select
from app.core.celery_config import celery_app
from app.core.database import async_session_factory
from app.models.student import Student
from app.models.evaluation_report import EvaluationReport
from app.services.evaluation_service import evaluation_service

logger = logging.getLogger(__name__)


@celery_app.task(name="app.tasks.evaluation_tasks.generate_daily_reports")
def generate_daily_reports():
    """每天 4 点遍历所有学生，生成评估报告"""
    asyncio.run(_generate_daily_reports_async())


async def _generate_daily_reports_async():
    """异步生成所有学生的每日评估报告"""
    today = date.today()
    logger.info(f"开始生成每日评估报告: {today}")

    async with async_session_factory() as db:
        try:
            # 查询所有学生
            result = await db.execute(
                select(Student.id, Student.name, Student.student_no)
            )
            students = result.fetchall()

            success_count = 0
            error_count = 0

            for student in students:
                student_id = str(student.id)
                try:
                    # 检查今天是否已生成
                    existing = await db.execute(
                        select(EvaluationReport).where(
                            EvaluationReport.student_id == student.id,
                            EvaluationReport.report_date == today,
                        )
                    )
                    if existing.scalar_one_or_none():
                        logger.info(f"学生 {student.student_no} 今日报告已存在，跳过")
                        continue

                    # 生成报告
                    report_data = await evaluation_service.get_evaluation_report(
                        db, student_id
                    )

                    # 存入数据库
                    report_record = EvaluationReport(
                        id=uuid.uuid4(),
                        student_id=student.id,
                        report_date=today,
                        report_data=report_data,
                        overall_score=report_data.get("overall_score", 0),
                    )
                    db.add(report_record)
                    success_count += 1
                    logger.info(f"学生 {student.student_no} 报告生成成功")

                except Exception as e:
                    error_count += 1
                    logger.error(f"学生 {student.student_no} 报告生成失败: {e}")
                    continue

            await db.commit()
            logger.info(f"每日报告生成完成: 成功 {success_count}, 失败 {error_count}")

        except Exception as e:
            logger.error(f"每日报告生成任务失败: {e}")
            await db.rollback()
