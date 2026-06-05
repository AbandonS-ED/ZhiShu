from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import profile, resource, path, tutor, chat
from app.core.config import settings
from app.core.database import init_db

@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield

app = FastAPI(
    title="智学(ZhiShu) API",
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

@app.get("/")
async def root():
    return {"message": "智学(ZhiShu) API 运行中"}

@app.get("/health")
async def health():
    return {"status": "healthy"}
