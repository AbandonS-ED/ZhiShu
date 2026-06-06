from pydantic_settings import BaseSettings
from typing import List

class Settings(BaseSettings):
    PROJECT_NAME: str = "智枢(SmartHub)"
    VERSION: str = "1.0.0"
    
    DATABASE_URL: str = "postgresql+asyncpg://postgres:password@localhost:5432/zhishu"
    REDIS_URL: str = "redis://localhost:6379/0"
    
    MINIMAX_API_KEY: str = ""
    MINIMAX_BASE_URL: str = "https://api.minimaxi.chat/v1"
    MINIMAX_MODEL: str = "MiniMax-M3"
    
    CORS_ORIGINS: List[str] = ["http://localhost:3000"]
    
    class Config:
        env_file = ".env"
        extra = "allow"

settings = Settings()
