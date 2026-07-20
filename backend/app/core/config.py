import logging
from pydantic_settings import BaseSettings
from typing import List

logger = logging.getLogger(__name__)

class Settings(BaseSettings):
    PROJECT_NAME: str = "智枢(SmartHub)"
    VERSION: str = "1.0.0"

    DATABASE_URL: str = "postgresql+asyncpg://postgres:password@localhost:5432/zhishu"
    REDIS_URL: str = "redis://localhost:6379/0"

    # MiniMax-M3 (OpenAI 兼容格式，开发阶段用；上线前替换为讯飞星火 V4)
    MINIMAX_API_KEY: str = ""
    MINIMAX_BASE_URL: str = "https://api.minimax.chat/v1"
    MINIMAX_MODEL: str = "MiniMax-M3"

    # 小米 MiMo v2.5 (OpenAI 兼容格式)
    MIMO_API_KEY: str = ""
    MIMO_BASE_URL: str = "https://token-plan-cn.xiaomimimo.com/v1"
    MIMO_MODEL: str = "mimo-v2.5-pro"

    # 讯飞星火 V4 (上线前切换)
    SPARK_API_KEY: str = ""
    SPARK_BASE_URL: str = "https://spark-api-open.xf-yun.com/v1"
    SPARK_MODEL: str = "Spark-V4"

    # LLM 选择: "minimax" / "spark" / "mimo"
    LLM_PROVIDER: str = "mimo"

    CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:3001"]

    # JWT 签名密钥。生产环境 .env 必须设置；开发环境若无则用强随机密钥兜底
    JWT_SECRET: str = ""

    DEBUG: bool = False

    class Config:
        env_file = ".env"
        extra = "allow"


settings = Settings()

# JWT_SECRET 兜底：开发环境若无显式设置则生成强随机密钥（重启失效，仅用于本地启动）
if not settings.JWT_SECRET:
    import secrets as _secrets
    settings.JWT_SECRET = _secrets.token_hex(32)
    logger.warning(
        "[config] JWT_SECRET 未设置，已生成临时开发密钥（重启后失效）。"
        "生产部署必须在 .env 配置 JWT_SECRET。"
    )

