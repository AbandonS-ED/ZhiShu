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

    # 讯飞星火 V4 (上线前切换)
    SPARK_API_KEY: str = ""
    SPARK_BASE_URL: str = "https://spark-api-open.xf-yun.com/v1"
    SPARK_MODEL: str = "Spark-V4"
    
    # LLM 选择: "minimax" 或 "spark"
    LLM_PROVIDER: str = "minimax"
    
    CORS_ORIGINS: List[str] = ["http://localhost:3000"]
    
    DEBUG: bool = False
    
    class Config:
        env_file = ".env"
        extra = "allow"

settings = Settings()
