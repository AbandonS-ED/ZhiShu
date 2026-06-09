"""Celery 配置 — 异步任务"""

from celery import Celery

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

celery_app.autodiscover_tasks(["app.tasks"])
