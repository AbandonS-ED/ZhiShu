"""DB schema 漂移迁移脚本
修复老数据库缺少的列和表：
1. exercise_bank 表
2. exercises.source 列 (VARCHAR(20) DEFAULT 'ai')
3. resources.is_favorited 列 (BOOLEAN DEFAULT false)
4. resources.is_preset 列 (BOOLEAN DEFAULT false)
5. students.role 列 (VARCHAR(20) DEFAULT 'student')
6. students.is_active 列 (BOOLEAN DEFAULT true)
7. students.last_login 列 (TIMESTAMP)
    8. chat_messages.content 列改为 TEXT（原 VARCHAR(10000)）
    9. students.phone 列 (VARCHAR(20) UNIQUE)

用法:
    cd backend && venv\\Scripts\\python scripts/migrate_schema_drift.py
"""

import asyncio
import asyncpg


DSN = "postgresql://postgres:123456@localhost:5432/zhishu"


async def migrate():
    conn = await asyncpg.connect(DSN)
    try:
        # 1. exercise_bank 表
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS exercise_bank (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                type VARCHAR(20) NOT NULL,
                question TEXT NOT NULL,
                options JSONB,
                answer TEXT,
                explanation TEXT,
                difficulty INTEGER DEFAULT 50,
                knowledge_point VARCHAR(200),
                source VARCHAR(20) DEFAULT 'admin',
                tags JSONB,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        print("[OK] exercise_bank 表已验证")

        # 2. exercises.source 列
        try:
            await conn.execute("ALTER TABLE exercises ADD COLUMN source VARCHAR(20) DEFAULT 'ai'")
            print("[OK] exercises.source 列已添加")
        except asyncpg.DuplicateColumnError:
            print("[SKIP] exercises.source 列已存在")

        # 3. resources.is_favorited 列
        try:
            await conn.execute("ALTER TABLE resources ADD COLUMN is_favorited BOOLEAN DEFAULT false")
            print("[OK] resources.is_favorited 列已添加")
        except asyncpg.DuplicateColumnError:
            print("[SKIP] resources.is_favorited 列已存在")

        # 4. resources.is_preset 列
        try:
            await conn.execute("ALTER TABLE resources ADD COLUMN is_preset BOOLEAN DEFAULT false")
            print("[OK] resources.is_preset 列已添加")
        except asyncpg.DuplicateColumnError:
            print("[SKIP] resources.is_preset 列已存在")

        # 5. students.role 列
        try:
            await conn.execute("ALTER TABLE students ADD COLUMN role VARCHAR(20) DEFAULT 'student'")
            print("[OK] students.role 列已添加")
        except asyncpg.DuplicateColumnError:
            print("[SKIP] students.role 列已存在")

        # 6. students.is_active 列
        try:
            await conn.execute("ALTER TABLE students ADD COLUMN is_active BOOLEAN DEFAULT true")
            print("[OK] students.is_active 列已添加")
        except asyncpg.DuplicateColumnError:
            print("[SKIP] students.is_active 列已存在")

        # 7. students.last_login 列
        try:
            await conn.execute("ALTER TABLE students ADD COLUMN last_login TIMESTAMP")
            print("[OK] students.last_login 列已添加")
        except asyncpg.DuplicateColumnError:
            print("[SKIP] students.last_login 列已存在")

        # 8. chat_messages.content 改为 TEXT
        try:
            await conn.execute("ALTER TABLE chat_messages ALTER COLUMN content TYPE TEXT")
            print("[OK] chat_messages.content 已改为 TEXT")
        except Exception as e:
            print(f"[SKIP] chat_messages.content 已是 TEXT 或无法更改: {e}")

        # 9. students.phone 列
        try:
            await conn.execute("ALTER TABLE students ADD COLUMN phone VARCHAR(20) UNIQUE")
            print("[OK] students.phone 列已添加")
        except asyncpg.DuplicateColumnError:
            print("[SKIP] students.phone 列已存在")

        # 10. 索引
        for idx_sql in [
            "CREATE INDEX IF NOT EXISTS idx_exercises_kp ON exercises(knowledge_point)",
            "CREATE INDEX IF NOT EXISTS idx_exercise_bank_kp ON exercise_bank(knowledge_point)",
            "CREATE INDEX IF NOT EXISTS idx_exercise_bank_type ON exercise_bank(type)",
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
