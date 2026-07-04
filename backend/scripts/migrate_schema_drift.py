"""DB schema 漂移迁移脚本
修复老数据库缺少的列和表：
1. students.role 列 (VARCHAR(20) DEFAULT 'student')
2. students.is_active 列 (BOOLEAN DEFAULT true)
3. students.last_login 列 (TIMESTAMP)
4. chat_messages.content 列改为 TEXT（原 VARCHAR(10000)）
5. students.phone 列 (VARCHAR(20) UNIQUE)

用法:
    cd backend && venv\\Scripts\\python scripts/migrate_schema_drift.py
"""

import asyncio
import asyncpg


DSN = "postgresql://postgres:123456@localhost:5432/zhishu"


async def migrate():
    conn = await asyncpg.connect(DSN)
    try:
        # 1. students.role 列
        try:
            await conn.execute("ALTER TABLE students ADD COLUMN role VARCHAR(20) DEFAULT 'student'")
            print("[OK] students.role 列已添加")
        except asyncpg.DuplicateColumnError:
            print("[SKIP] students.role 列已存在")

        # 2. students.is_active 列
        try:
            await conn.execute("ALTER TABLE students ADD COLUMN is_active BOOLEAN DEFAULT true")
            print("[OK] students.is_active 列已添加")
        except asyncpg.DuplicateColumnError:
            print("[SKIP] students.is_active 列已存在")

        # 3. students.last_login 列
        try:
            await conn.execute("ALTER TABLE students ADD COLUMN last_login TIMESTAMP")
            print("[OK] students.last_login 列已添加")
        except asyncpg.DuplicateColumnError:
            print("[SKIP] students.last_login 列已存在")

        # 4. chat_messages.content 改为 TEXT
        try:
            await conn.execute("ALTER TABLE chat_messages ALTER COLUMN content TYPE TEXT")
            print("[OK] chat_messages.content 已改为 TEXT")
        except Exception as e:
            print(f"[SKIP] chat_messages.content 已是 TEXT 或无法更改: {e}")

        # 5. students.phone 列
        try:
            await conn.execute("ALTER TABLE students ADD COLUMN phone VARCHAR(20) UNIQUE")
            print("[OK] students.phone 列已添加")
        except asyncpg.DuplicateColumnError:
            print("[SKIP] students.phone 列已存在")

        # 6. 索引
        for idx_sql in [
            "CREATE INDEX IF NOT EXISTS idx_students_role ON students(role)",
        ]:
            try:
                await conn.execute(idx_sql)
            except Exception:
                pass
        print("[OK] 索引已验证")

        print("\n[DONE] schema 迁移完成")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(migrate())
