"""执行 wrong_questions 迁移（DDL 语句）"""
import psycopg2

conn = psycopg2.connect(
    host="localhost", port=5432, dbname="zhishu", user="postgres", password="123456"
)
conn.autocommit = True
cur = conn.cursor()

statements = [
    "ALTER TABLE wrong_questions ADD COLUMN IF NOT EXISTS source_type VARCHAR(20) NOT NULL DEFAULT 'exercise'",
    "ALTER TABLE wrong_questions ADD COLUMN IF NOT EXISTS exercise_bank_id UUID",
    "ALTER TABLE wrong_questions ADD COLUMN IF NOT EXISTS question_snapshot JSONB",
    "ALTER TABLE wrong_questions ALTER COLUMN exercise_id DROP NOT NULL",
    "CREATE INDEX IF NOT EXISTS idx_wq_exercise_bank ON wrong_questions(exercise_bank_id)",
    "CREATE INDEX IF NOT EXISTS idx_wq_source_type ON wrong_questions(source_type)",
]

for stmt in statements:
    try:
        cur.execute(stmt)
        print(f"  OK: {stmt[:60]}...")
    except Exception as e:
        print(f"  SKIP: {stmt[:60]}... ({e})")

print("OK: wrong_questions 表迁移完成")
cur.close()
conn.close()
