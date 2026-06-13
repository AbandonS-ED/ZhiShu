from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import profile, resource, path, tutor, chat, mindmap, dashboard, evaluation, auth
from app.api import admin_exercises
from app.core.config import settings
from app.core.database import init_db
from app.services.minimax_client import init_minimax_client
from app.services.spark_client import spark_client

@asynccontextmanager
async def lifespan(app: FastAPI):
    # 根据配置选择 LLM 客户端
    if settings.LLM_PROVIDER == "spark" and settings.SPARK_API_KEY:
        spark_client.api_key = settings.SPARK_API_KEY
        spark_client.base_url = settings.SPARK_BASE_URL
    else:
        init_minimax_client(
            api_key=settings.MINIMAX_API_KEY,
            base_url=settings.MINIMAX_BASE_URL,
        )
    
    # 初始化数据库
    await init_db()
    yield
    
    # 关闭客户端
    if settings.LLM_PROVIDER == "spark":
        await spark_client.close()

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
app.include_router(resource.router, prefix="/api/v1/resource", tags=["资源生成"])
app.include_router(path.router, prefix="/api/v1/path", tags=["学习路径"])
app.include_router(tutor.router, prefix="/api/v1/tutor", tags=["智能辅导"])
app.include_router(chat.router, prefix="/api/v1/chat", tags=["聊天"])
app.include_router(mindmap.router, prefix="/api/v1/mindmap", tags=["思维导图"])
app.include_router(dashboard.router, prefix="/api/v1/dashboard", tags=["仪表盘"])
app.include_router(evaluation.router, prefix="/api/v1/evaluation", tags=["效果评估"])
app.include_router(auth.router, prefix="/api/v1/auth", tags=["认证"])
app.include_router(admin_exercises.router, prefix="/api/v1/admin/exercises", tags=["管理端-题库"])

@app.get("/")
async def root():
    return {"message": "智枢(SmartHub) API 运行中"}

@app.get("/health")
async def health():
    return {"status": "healthy"}
