-- 学习计划表
CREATE TABLE IF NOT EXISTS study_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL,
    knowledge_point VARCHAR(200) NOT NULL,
    title VARCHAR(300),
    description TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'planning',
    total_steps INTEGER NOT NULL DEFAULT 0,
    completed_steps INTEGER NOT NULL DEFAULT 0,
    estimated_minutes INTEGER,
    actual_minutes INTEGER,
    difficulty VARCHAR(20),
    prerequisites JSONB DEFAULT '[]'::jsonb,
    ai_generated JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX IF NOT EXISTS idx_sp_student ON study_plans(student_id);
CREATE INDEX IF NOT EXISTS idx_sp_status ON study_plans(status);

-- 学习计划步骤表
CREATE TABLE IF NOT EXISTS study_plan_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id UUID NOT NULL REFERENCES study_plans(id) ON DELETE CASCADE,
    "order" INTEGER NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    estimated_minutes INTEGER,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    resource_id UUID,
    exercise_ids JSONB DEFAULT '[]'::jsonb,
    step_type VARCHAR(30),
    content_hint TEXT,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sps_plan ON study_plan_steps(plan_id);
CREATE INDEX IF NOT EXISTS idx_sps_status ON study_plan_steps(status);

-- 学习计划专用路径表（避免与 path_agent 的 learning_paths 冲突）
CREATE TABLE IF NOT EXISTS learning_path_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL,
    name VARCHAR(200) NOT NULL,
    title VARCHAR(500) NOT NULL DEFAULT '',
    description TEXT,
    nodes JSONB DEFAULT '[]'::jsonb,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    ai_generated JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_lpp_student ON learning_path_plans(student_id);
CREATE INDEX IF NOT EXISTS idx_lpp_status ON learning_path_plans(status);