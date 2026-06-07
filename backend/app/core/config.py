from pydantic_settings import BaseSettings
from typing import List

class Settings(BaseSettings):
    PROJECT_NAME: str = "智枢(SmartHub)"
    VERSION: str = "1.0.0"
    
    DATABASE_URL: str = "postgresql+asyncpg://postgres:password@localhost:5432/zhishu"
    REDIS_URL: str = "redis://localhost:6379/0"
    
    # MiniMax-M3 (OpenAI 兼容格式，开发阶段用；上线前替换为讯飞星火 V4)
    MINIMAX_API_KEY: str = ""
    MINIMAX_BASE_URL: str = "https://api.minimax.chat/v1"
    MINIMAX_MODEL: str = "MiniMax-M3"

    # 讯飞星火 V4 (预留，待获取 API Key 后切换)
    # SPARK_API_KEY: str = ""
    # SPARK_BASE_URL: str = "https://spark-api-open.xf-yun.com/v1"
    # SPARK_CHAT_MODEL: str = "generalv3.5"
    # SPARK_EMBEDDING_MODEL: str = "text"
    
    CORS_ORIGINS: List[str] = ["http://localhost:3000"]
    
    class Config:
        env_file = ".env"
        extra = "allow"

settings = Settings()
