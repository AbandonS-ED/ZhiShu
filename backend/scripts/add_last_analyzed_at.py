"""添加 last_analyzed_at 字段到 student_profiles 表"""

import asyncio
import sys
import os

# 添加项目根目录到路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import engine
from sqlalchemy import text


async def migrate():
    """执行迁移"""
    async with engine.begin() as conn:
        # 检查字段是否已存在
        result = await conn.execute(text(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_name = 'student_profiles' AND column_name = 'last_analyzed_at'"
        ))
        if result.fetchone():
            print("字段 last_analyzed_at 已存在，跳过迁移")
            return

        # 添加字段
        await conn.execute(text(
            "ALTER TABLE student_profiles ADD COLUMN last_analyzed_at TIMESTAMPTZ"
        ))
        print("已添加字段 last_analyzed_at 到 student_profiles 表")

    print("迁移完成")


if __name__ == "__main__":
    asyncio.run(migrate())
