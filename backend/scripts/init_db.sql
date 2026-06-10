-- ============================================
-- 智枢(ZhiShu) 数据库初始化脚本
-- ============================================
-- 用法:
--   psql -U postgres -f init_db.sql
--
-- 前提:
--   - PostgreSQL 已安装并启动
--   - 知道 postgres 用户密码
-- ============================================

-- 1. 创建数据库
SELECT 'CREATE DATABASE zhishu'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'zhishu')\gexec

-- 2. 连接到 zhishu
\c zhishu

-- 3. 创建表

CREATE TABLE IF NOT EXISTS students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE,
    major VARCHAR(100),
    grade VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS student_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL,
    dimensions JSONB NOT NULL DEFAULT '{}',
    version INTEGER DEFAULT 1,
    is_current BOOLEAN DEFAULT TRUE,
    completeness_score FLOAT DEFAULT 0.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS document_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID,
    content TEXT NOT NULL,
    embedding JSONB,
    source_file VARCHAR(500),
    page_number INTEGER,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS resources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL,
    course_id UUID,
    title VARCHAR(500) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    content JSONB NOT NULL,
    knowledge_point VARCHAR(200),
    difficulty INTEGER DEFAULT 50,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS learning_paths (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL,
    course_id UUID,
    title VARCHAR(500) NOT NULL,
    description VARCHAR(2000),
    total_days INTEGER DEFAULT 30,
    daily_plan JSONB DEFAULT '[]',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS exercises (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL,
    resource_id UUID,
    exercise_type VARCHAR(50) NOT NULL,
    question VARCHAR(2000) NOT NULL,
    options JSONB,
    answer VARCHAR(2000) NOT NULL,
    explanation VARCHAR(2000),
    difficulty INTEGER DEFAULT 50,
    knowledge_point VARCHAR(200),
    student_answer VARCHAR(2000),
    is_correct FLOAT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chat_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL,
    title VARCHAR(500) DEFAULT '新对话',
    session_type VARCHAR(50) DEFAULT 'general',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL,
    role VARCHAR(20) NOT NULL,
    content VARCHAR(10000) NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS learning_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL,
    course_id UUID,
    action VARCHAR(50) NOT NULL,
    resource_type VARCHAR(50),
    resource_id UUID,
    knowledge_point VARCHAR(200),
    score FLOAT,
    duration_seconds INTEGER,
    detail JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_learning_records_student_id ON learning_records(student_id);
CREATE INDEX IF NOT EXISTS idx_learning_records_action ON learning_records(action);
CREATE INDEX IF NOT EXISTS idx_learning_records_created_at ON learning_records(created_at);

-- 4. 完成
\echo '✅ 数据库 zhishu 初始化完成，共 9 张表'
\echo '   students / student_profiles / document_chunks'
\echo '   resources / learning_paths / exercises'
\echo '   chat_sessions / chat_messages / learning_records'
