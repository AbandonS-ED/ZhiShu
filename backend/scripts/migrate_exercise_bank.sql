-- ============================================
-- 练习题库升级：公共题库 + source 字段
-- ============================================
-- 用法: psql -U postgres -d zhishu -f migrate_exercise_bank.sql

-- 1. 新建 exercise_bank 表（公共题库）
CREATE TABLE IF NOT EXISTS exercise_bank (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question VARCHAR(2000) NOT NULL,
    exercise_type VARCHAR(50) NOT NULL,
    options JSONB,
    answer VARCHAR(2000) NOT NULL,
    explanation VARCHAR(2000),
    difficulty INTEGER DEFAULT 50,
    knowledge_point VARCHAR(200),
    source VARCHAR(20) DEFAULT 'admin',
    is_active BOOLEAN DEFAULT true,
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE
);

-- 2. exercises 表加 source 字段
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS source VARCHAR(20) DEFAULT 'ai';

-- 3. 索引
CREATE INDEX IF NOT EXISTS idx_exercise_bank_kp ON exercise_bank(knowledge_point);
CREATE INDEX IF NOT EXISTS idx_exercise_bank_type ON exercise_bank(exercise_type);
CREATE INDEX IF NOT EXISTS idx_exercise_bank_active ON exercise_bank(is_active);

\echo '✅ exercise_bank 表已创建，exercises.source 字段已添加'
