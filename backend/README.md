# 智学(ZhiShu) Backend

基于 FastAPI + LangGraph 的多智能体学习资源生成系统后端。

## 技术栈

- **框架**: FastAPI 0.136 + SQLAlchemy 2.0 async + asyncpg
- **Agent**: LangGraph ≥0.2 + LangChain ≥0.3
- **LLM**: 讯飞星火 V4
- **向量库**: pgvector (1024维)
- **缓存/任务**: Redis 7 + Celery 5.6
- **存储**: MinIO

## 快速启动

### 前提

```bash
# 启动基础设施 (PostgreSQL + Redis + MinIO)
docker-compose up -d
```

### 本地开发

```bash
cd backend

# 创建并激活虚拟环境
python -m venv venv
# Windows:
venv\Scripts\activate
# Linux/Mac:
# source venv/bin/activate

# 安装依赖
pip install -r requirements.txt

# 启动服务
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 使用 Docker

```bash
docker build -t zhishu-backend .
docker run -p 8000:8000 zhishu-backend
```

## 项目结构

```
backend/
├── app/
│   ├── main.py          # FastAPI 入口
│   ├── api/             # API 路由 (5 个模块)
│   ├── core/            # 配置、数据库引擎
│   ├── models/          # SQLAlchemy 数据模型
│   ├── services/        # 业务服务 (LLM 客户端等)
│   └── agents/          # 多智能体系统
├── tests/               # 测试
├── Dockerfile
└── requirements.txt
```

## API 文档

启动后访问: http://localhost:8000/docs

## 测试

```bash
pytest tests/ -v
```
