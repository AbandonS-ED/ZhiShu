from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import text
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)

engine = create_async_engine(settings.DATABASE_URL, echo=settings.DEBUG)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

class Base(DeclarativeBase):
    pass

async def init_db():
    # 先尝试安装 pgvector 扩展（用独立事务，失败不影响后续）
    try:
        async with engine.begin() as conn:
            await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
    except Exception:
        logger.warning("pgvector 扩展未安装，向量检索功能不可用")

    # 建表（数据库不可用时优雅降级）
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
    except OSError as e:
        logger.warning("数据库连接失败 (%s)，使用内存模式运行（部分功能不可用）", e)
    except Exception as e:
        logger.warning("建表失败 %s，使用内存模式运行", e)

    # 迁移：为旧表添加新列（表已存在时 create_all 不会修改现有表）
    try:
        async with engine.begin() as conn:
            await conn.execute(text("""
                ALTER TABLE student_profiles
                    ADD COLUMN IF NOT EXISTS background JSONB NOT NULL DEFAULT '{}',
                    ADD COLUMN IF NOT EXISTS assessment_status VARCHAR(20) NOT NULL DEFAULT 'pending',
                    ADD COLUMN IF NOT EXISTS assess_session_id UUID,
                    DROP COLUMN IF EXISTS completeness_score
            """))
            await conn.execute(text("DROP TABLE IF EXISTS profile_guided_answers CASCADE"))
            await conn.execute(text("DROP TABLE IF EXISTS profile_guided_sessions CASCADE"))
            await conn.execute(text("DROP TABLE IF EXISTS subject_profiles CASCADE"))
            logger.info("数据库迁移完成")
    except Exception:
        pass  # 表可能不存在，忽略

async def get_db():
    async with async_session() as session:
        try:
            yield session
        finally:
            await session.close()
