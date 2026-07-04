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
    student_no VARCHAR(50) UNIQUE,
    password_hash VARCHAR(255),
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE,
    major VARCHAR(100),
    grade VARCHAR(50),
    role VARCHAR(20) NOT NULL DEFAULT 'student',
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- students.role 索引（管理员筛选 / 学生筛选）
CREATE INDEX IF NOT EXISTS idx_students_role ON students(role);
CREATE INDEX IF NOT EXISTS idx_students_is_active ON students(is_active);

CREATE TABLE IF NOT EXISTS student_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL UNIQUE,
    dimensions JSONB NOT NULL DEFAULT '{"comprehension":{"score":0,"confidence":0},"memory":{"score":0,"confidence":0},"application":{"score":0,"confidence":0},"imagination":{"score":0,"confidence":0},"focus":{"score":0,"confidence":0}}',
    background JSONB NOT NULL DEFAULT '{}',
    assessment_status VARCHAR(20) NOT NULL DEFAULT 'pending',
    assess_session_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Drop old profile tables (removed in refactor)
DROP TABLE IF EXISTS profile_guided_answers CASCADE;
DROP TABLE IF EXISTS profile_guided_sessions CASCADE;
DROP TABLE IF EXISTS subject_profiles CASCADE;

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

-- 5. 常用查询索引（student_id 在 5+ 张表频繁查询）
CREATE INDEX IF NOT EXISTS idx_student_profiles_student_id ON student_profiles(student_id);
CREATE INDEX IF NOT EXISTS idx_learning_paths_student_id ON learning_paths(student_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_student_id ON chat_sessions(student_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages(session_id);

CREATE TABLE IF NOT EXISTS learning_activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL,
    subject VARCHAR(100),
    activity_type VARCHAR(30) NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}',
    triggered_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_learning_activity_logs_student_id ON learning_activity_logs(student_id);
CREATE INDEX IF NOT EXISTS idx_learning_activity_logs_type ON learning_activity_logs(activity_type);

CREATE TABLE IF NOT EXISTS evaluation_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL,
    report_date DATE NOT NULL,
    report_data JSONB NOT NULL,
    overall_score FLOAT,
    generated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(student_id, report_date)
);
CREATE INDEX IF NOT EXISTS idx_evaluation_reports_student_date ON evaluation_reports(student_id, report_date);

-- 6. 完成
\echo '✅ 数据库 zhishu 初始化完成'
\echo '   students / student_profiles / document_chunks'
\echo '   learning_paths / chat_sessions / chat_messages'
\echo '   learning_records / learning_activity_logs / evaluation_reports'

-- 7. 初始化默认管理员账号（密码: admin123）
-- bcrypt 哈希: $2b$12$aUqTTt5KCfd1zGXqZoQaieRPYuoNXKCM/do3wrjcEK4yCqEij/yUS
-- 注意: PostgreSQL 的单引号字符串里直接写 $ 字符是安全的，不会被插值
-- 使用 ON CONFLICT 避免重复插入报错
INSERT INTO students (id, student_no, password_hash, name, email, role, is_active)
VALUES (
    'a0000000-0000-0000-0000-000000000001',
    'admin',
    '$2b$12$aUqTTt5KCfd1zGXqZoQaieRPYuoNXKCM/do3wrjcEK4yCqEij/yUS',
    '系统管理员',
    'admin@zhishu.local',
    'admin',
    true
)
ON CONFLICT (student_no) DO UPDATE SET
    password_hash = EXCLUDED.password_hash,
    role = EXCLUDED.role,
    is_active = EXCLUDED.is_active,
    updated_at = now();

\echo ''
\echo '👤 默认管理员账号已就绪:'
\echo '   学号: admin'
\echo '   密码: admin123'
\echo '   角色: admin'
