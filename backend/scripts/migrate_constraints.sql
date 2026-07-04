-- ============================================
-- 智枢(ZhiShu) 数据库迁移脚本 — 添加外键约束 + 修改字段类型
-- ============================================
-- 用法:
--   psql -U postgres -d zhishu -f migrate_constraints.sql
--
-- 注意:
--   - 此脚本会修改现有表结构，请先备份数据
--   - 如果已有数据违反外键约束，脚本会失败
-- ============================================

-- 1. 修改 chat_messages.content 为 TEXT 类型
ALTER TABLE chat_messages ALTER COLUMN content TYPE TEXT;

-- 2. 添加外键约束（如果不存在）

-- chat_sessions.student_id → students.id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_chat_sessions_student_id'
    ) THEN
        ALTER TABLE chat_sessions
            ADD CONSTRAINT fk_chat_sessions_student_id
            FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;
    END IF;
END $$;

-- chat_messages.session_id → chat_sessions.id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_chat_messages_session_id'
    ) THEN
        ALTER TABLE chat_messages
            ADD CONSTRAINT fk_chat_messages_session_id
            FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE;
    END IF;
END $$;

-- learning_paths.student_id → students.id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_learning_paths_student_id'
    ) THEN
        ALTER TABLE learning_paths
            ADD CONSTRAINT fk_learning_paths_student_id
            FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;
    END IF;
END $$;

-- learning_records.student_id → students.id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_learning_records_student_id'
    ) THEN
        ALTER TABLE learning_records
            ADD CONSTRAINT fk_learning_records_student_id
            FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;
    END IF;
END $$;

-- learning_activity_logs.student_id → students.id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_learning_activity_logs_student_id'
    ) THEN
        ALTER TABLE learning_activity_logs
            ADD CONSTRAINT fk_learning_activity_logs_student_id
            FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;
    END IF;
END $$;

-- student_profiles.student_id → students.id（确保有 ON DELETE CASCADE）
DO $$
BEGIN
    -- 先删除旧约束（如果存在）
    IF EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'student_profiles_student_id_fkey'
    ) THEN
        ALTER TABLE student_profiles DROP CONSTRAINT student_profiles_student_id_fkey;
    END IF;
    -- 添加新约束
    ALTER TABLE student_profiles
        ADD CONSTRAINT fk_student_profiles_student_id
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;
END $$;

-- 3. 验证
SELECT
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
ORDER BY tc.table_name;

-- 完成
\echo 'Migration complete!'
