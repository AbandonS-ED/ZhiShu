import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

DATABASE_URL = "postgresql+asyncpg://postgres:123456@localhost:5432/zhishu"

async def migrate():
    engine = create_async_engine(DATABASE_URL, echo=False)
    async with engine.begin() as conn:
        result = await conn.execute(text(
            "SELECT data_type FROM information_schema.columns "
            "WHERE table_name='chat_messages' AND column_name='content'"
        ))
        row = result.fetchone()
        current_type = row[0] if row else "not found"
        print(f"Current content type: {current_type}")
        if current_type and current_type != "text":
            await conn.execute(text(
                "ALTER TABLE chat_messages ALTER COLUMN content TYPE TEXT"
            ))
            print("Altered content column to TEXT")
        else:
            print("Already TEXT or table not found")
    await engine.dispose()
    print("Migration complete!")

asyncio.run(migrate())
