"""异步任务"""

from app.core.celery_config import celery_app


@celery_app.task(bind=True, max_retries=3)
def generate_resource_async(self, student_id: str, knowledge_point: str, resource_type: str = "all"):
    """异步生成学习资源"""
    import asyncio
    from app.agents.document_agent import document_agent

    async def _generate():
        return await document_agent.generate(
            knowledge_point=knowledge_point,
            student_profile=None,
            resource_type=resource_type,
        )

    try:
        result = asyncio.run(_generate())
        return {"status": "completed", "result": result}
    except Exception as exc:
        self.retry(exc=exc, countdown=60)


@celery_app.task(bind=True, max_retries=3)
def generate_exercises_async(self, student_id: str, knowledge_point: str, count: int = 5):
    """异步生成练习题"""
    import asyncio
    from app.agents.exercise_agent import exercise_agent

    async def _generate():
        return await exercise_agent.generate(
            knowledge_point=knowledge_point,
            student_profile=None,
            count=count,
        )

    try:
        result = asyncio.run(_generate())
        return {"status": "completed", "result": result}
    except Exception as exc:
        self.retry(exc=exc, countdown=60)


@celery_app.task(bind=True, max_retries=3)
def generate_path_async(self, student_id: str, course_topics: list, total_days: int = 30):
    """异步生成学习路径"""
    import asyncio
    from app.agents.path_agent import path_agent

    async def _generate():
        return await path_agent.generate(
            student_id=student_id,
            course_topics=course_topics,
            total_days=total_days,
        )

    try:
        result = asyncio.run(_generate())
        return {"status": "completed", "result": result}
    except Exception as exc:
        self.retry(exc=exc, countdown=60)
