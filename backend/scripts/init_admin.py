"""
初始化管理员账号脚本

PowerShell 会把 $2b$ 当作变量插值，所以不能直接在 PowerShell 里跑 SQL 插入。
用这个 Python 脚本可以安全地初始化/重置管理员账号。

脚本会:
1. 自动检查并添加缺失的字段（role / is_active / last_login）
2. 创建或更新 admin 账号

用法:
  cd backend
  venv\Scripts\python scripts\init_admin.py
"""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

import bcrypt
from sqlalchemy import select, text
from app.core.database import async_session
from app.models.student import Student


ADMIN_ID = "a0000000-0000-0000-0000-000000000001"
ADMIN_NO = "admin"
ADMIN_NAME = "系统管理员"
ADMIN_EMAIL = "admin@zhishu.local"
ADMIN_PASSWORD = "admin123"


async def ensure_columns(db):
    """检查并添加 students 表缺失的字段（幂等）"""
    needed_columns = [
        ("role", "VARCHAR(20) NOT NULL DEFAULT 'student'"),
        ("is_active", "BOOLEAN NOT NULL DEFAULT TRUE"),
        ("last_login", "TIMESTAMP WITH TIME ZONE"),
    ]
    for col_name, col_def in needed_columns:
        r = await db.execute(
            text(
                "SELECT 1 FROM information_schema.columns "
                "WHERE table_name='students' AND column_name=:c"
            ),
            {"c": col_name},
        )
        exists = r.scalar() is not None
        if not exists:
            print(f"[init_admin] adding column students.{col_name} ...")
            await db.execute(text(f"ALTER TABLE students ADD COLUMN {col_name} {col_def}"))
        else:
            print(f"[init_admin] column students.{col_name} already exists")


async def ensure_indexes(db):
    """Ensure students.role index exists"""
    r = await db.execute(
        text(
            "SELECT 1 FROM pg_indexes "
            "WHERE tablename='students' AND indexname=:n"
        ),
        {"n": "idx_students_role"},
    )
    if r.scalar() is None:
        print("[init_admin] adding index idx_students_role")
        await db.execute(text("CREATE INDEX idx_students_role ON students(role)"))


async def main():
    pwd_hash = bcrypt.hashpw(ADMIN_PASSWORD.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    print(f"[init_admin] bcrypt hash: {pwd_hash}")
    print(f"[init_admin] verify 'admin123': {bcrypt.checkpw(ADMIN_PASSWORD.encode('utf-8'), pwd_hash.encode('utf-8'))}")

    async with async_session() as db:
        await ensure_columns(db)
        await ensure_indexes(db)
        await db.commit()

        result = await db.execute(select(Student).where(Student.student_no == ADMIN_NO))
        student = result.scalar_one_or_none()

        if student:
            print(f"[init_admin] admin exists (id={student.id}), updating password/role")
            student.password_hash = pwd_hash
            student.role = "admin"
            student.is_active = True
            student.name = ADMIN_NAME
            student.email = ADMIN_EMAIL
        else:
            print("[init_admin] creating new admin account")
            student = Student(
                id=ADMIN_ID,
                student_no=ADMIN_NO,
                password_hash=pwd_hash,
                name=ADMIN_NAME,
                email=ADMIN_EMAIL,
                role="admin",
                is_active=True,
            )
            db.add(student)

        await db.commit()
        await db.refresh(student)
        print()
        print(f"[init_admin] OK - admin account ready")
        print(f"   id        = {student.id}")
        print(f"   student_no = {student.student_no}")
        print(f"   name      = {student.name}")
        print(f"   role      = {student.role}")
        print(f"   is_active = {student.is_active}")
        print()
        print("=> Open http://localhost:3000/admin/login")
        print("   student_no: admin")
        print("   password:   admin123")


if __name__ == "__main__":
    asyncio.run(main())
