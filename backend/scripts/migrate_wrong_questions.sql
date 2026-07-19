-- 迁移：wrong_questions 表添加 source_type / exercise_bank_id / question_snapshot 字段
-- 执行：psql -U postgres -d zhishu -f migrate_wrong_questions.sql
-- 幂等：所有语句均安全重复执行

-- 1. 添加 source_type 字段（默认 'exercise'，向后兼容）
ALTER TABLE wrong_questions
ADD COLUMN IF NOT EXISTS source_type VARCHAR(20) NOT NULL DEFAULT 'exercise';

-- 2. 添加 exercise_bank_id 字段（指向 ExerciseBank 表）
ALTER TABLE wrong_questions
ADD COLUMN IF NOT EXISTS exercise_bank_id UUID;

-- 3. 添加 question_snapshot 字段（JSONB 快照，防止源表删数据后无法显示）
ALTER TABLE wrong_questions
ADD COLUMN IF NOT EXISTS question_snapshot JSONB;

-- 4. 放宽 exercise_id 约束（允许为 NULL，当 source_type='bank' 时）
ALTER TABLE wrong_questions
ALTER COLUMN exercise_id DROP NOT NULL;

-- 5. 添加索引
CREATE INDEX IF NOT EXISTS idx_wq_exercise_bank ON wrong_questions(exercise_bank_id);
CREATE INDEX IF NOT EXISTS idx_wq_source_type ON wrong_questions(source_type);

-- 完成
SELECT '迁移完成：wrong_questions 表已添加 source_type / exercise_bank_id / question_snapshot 字段' AS result;
