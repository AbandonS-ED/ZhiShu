-- 错题本表
CREATE TABLE IF NOT EXISTS wrong_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
    wrong_answer TEXT NOT NULL,
    correct_answer TEXT,
    error_type VARCHAR(50) DEFAULT 'unknown',
    error_analysis TEXT,
    ai_explanation TEXT,
    similar_exercises JSONB DEFAULT '[]'::jsonb,
    mastery_level INTEGER DEFAULT 0 CHECK (mastery_level >= 0 AND mastery_level <= 100),
    review_count INTEGER DEFAULT 0,
    correct_count INTEGER DEFAULT 0,
    is_mastered BOOLEAN DEFAULT FALSE,
    last_reviewed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wq_student ON wrong_questions(student_id);
CREATE INDEX IF NOT EXISTS idx_wq_mastered ON wrong_questions(is_mastered);
CREATE INDEX IF NOT EXISTS idx_wq_error_type ON wrong_questions(error_type);
CREATE INDEX IF NOT EXISTS idx_wq_created_at ON wrong_questions(created_at DESC);