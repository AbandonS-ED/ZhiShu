import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

DATABASE_URL = "postgresql+asyncpg://postgres:123456@localhost:5432/zhishu"

async def migrate():
    engine = create_async_engine(DATABASE_URL, echo=False)
    async with engine.begin() as conn:
        await conn.execute(text('''
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
            )
        '''))
        print("exercise_bank table created/verified")

        result = await conn.execute(text(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_name = 'exercises' AND column_name = 'source'"
        ))
        if not result.fetchone():
            await conn.execute(text("ALTER TABLE exercises ADD COLUMN source VARCHAR(20) DEFAULT 'ai'"))
            print("Added source column to exercises")
        else:
            print("source column already exists")

        await conn.execute(text('CREATE INDEX IF NOT EXISTS idx_exercise_bank_kp ON exercise_bank(knowledge_point)'))
        await conn.execute(text('CREATE INDEX IF NOT EXISTS idx_exercise_bank_type ON exercise_bank(exercise_type)'))
        await conn.execute(text('CREATE INDEX IF NOT EXISTS idx_exercise_bank_active ON exercise_bank(is_active)'))
        print("Indexes created/verified")

    await engine.dispose()
    print("Migration complete!")

asyncio.run(migrate())
