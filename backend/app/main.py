from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import profile, path, tutor, chat, mindmap, dashboard, evaluation, auth
from app.api import admin
from app.core.config import settings
from app.core.database import init_db
from app.services.llm_factory import get_llm_client
from app.services.scheduled_analysis_service import scheduled_analysis_service
import logging

logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # 初始化 LLM 客户端（根据 LLM_PROVIDER 自动选择）
    get_llm_client()
    
    # 初始化数据库（数据库不可用时优雅降级）
    try:
        await init_db()
    except Exception as e:
        logger.warning("数据库初始化失败 %s，使用内存模式运行", e)
    
    # 启动定时画像分析服务
    try:
        await scheduled_analysis_service.start()
        logger.info("定时画像分析服务已启动")
    except Exception as e:
        logger.warning("定时画像分析服务启动失败: %s", e)
    
    yield
    
    # 停止定时任务
    await scheduled_analysis_service.stop()

app = FastAPI(
    title="智枢(SmartHub) API",
    description="多智能体个性化学习资源生成系统",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(profile.router, prefix="/api/v1/profile", tags=["学习画像"])
app.include_router(path.router, prefix="/api/v1/path", tags=["学习路径"])
app.include_router(tutor.router, prefix="/api/v1/tutor", tags=["智能辅导"])
app.include_router(chat.router, prefix="/api/v1/chat", tags=["聊天"])
app.include_router(mindmap.router, prefix="/api/v1/mindmap", tags=["思维导图"])
app.include_router(dashboard.router, prefix="/api/v1/dashboard", tags=["仪表盘"])
app.include_router(evaluation.router, prefix="/api/v1/evaluation", tags=["效果评估"])
app.include_router(auth.router, prefix="/api/v1/auth", tags=["认证"])
app.include_router(admin.router, prefix="/api/v1/admin", tags=["管理端"])

@app.get("/")
async def root():
    return {"message": "智枢(SmartHub) API 运行中"}

@app.get("/health")
async def health():
    return {"status": "healthy"}
