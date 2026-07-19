"""Celery 配置 — 异步任务 + 定时调度"""

from celery import Celery
from celery.schedules import crontab

celery_app = Celery(
    "zhishu",
    broker="redis://localhost:6379/0",
    backend="redis://localhost:6379/1",
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Asia/Shanghai",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=300,
    task_soft_time_limit=240,
)

# 定时任务调度
celery_app.conf.beat_schedule = {
    "generate-daily-evaluation-reports": {
        "task": "app.tasks.evaluation_tasks.generate_daily_reports",
        "schedule": crontab(hour=4, minute=0),  # 每天凌晨 4 点
    },
}

celery_app.autodiscover_tasks(["app.tasks"])
