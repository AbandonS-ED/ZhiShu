"""清空所有旧画像数据（student_profiles + subject_profiles + guided sessions/answers）"""
import asyncio
from sqlalchemy import text
from app.core.database import async_session


async def main():
    async with async_session() as db:
        await db.execute(text("DELETE FROM student_profiles"))
        await db.execute(text("DELETE FROM subject_profiles"))
        await db.execute(text("DELETE FROM profile_guided_sessions"))
        await db.execute(text("DELETE FROM profile_guided_answers"))
        await db.commit()
    print("✅ 所有画像数据已清空")


asyncio.run(main())
