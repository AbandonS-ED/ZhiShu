# 智枢(SmartHub) Backend

基于 FastAPI + LangGraph 的多智能体学习资源生成系统后端。

## 技术栈

- **框架**: FastAPI 0.136 + SQLAlchemy 2.0 async + asyncpg
- **Agent**: LangGraph + LangChain（待搭建）
- **LLM**: 讯飞星火 V4（**当前是 MiniMax 占位，需重写**）
- **向量库**: pgvector（**当前维度 1536 错误，应为 1024**）
- **缓存/任务**: Redis 7 + Celery 5.6
- **存储**: MinIO

## 快速开始

```bash
# 启动基础设施
docker-compose up -d

# 本地开发
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# API 文档
# http://localhost:8000/docs
```

## 项目结构

```
backend/
├── app/
│   ├── main.py          # 入口（5 个 router）
│   ├── api/             # 5 个 stub router（全部待实现）
│   ├── core/            # config.py + database.py
│   ├── models/          # Student / StudentProfile(JSONB) / DocumentChunk(pgvector)
│   ├── services/        # minimax_client.py + minimax_langchain.py（待替换为讯飞）
│   └── agents/          # 6 个子 Agent：Profile / Document / MindMap / Exercise / Path / Tutor
├── tests/               # 空
├── Dockerfile
└── requirements.txt
```

## API 路由

| 模块 | 前缀 | 端点 | 状态 |
|------|------|------|------|
| 学习画像 | `/api/v1/profile` | POST /build, GET /{id} | stub |
| 资源生成 | `/api/v1/resource` | POST /generate, GET /list | stub |
| 学习路径 | `/api/v1/path` | POST /generate, GET /{id} | stub |
| 智能辅导 | `/api/v1/tutor` | POST /ask | stub |
| 聊天 | `/api/v1/chat` | POST /stream (SSE) | skeleton |

## 已知问题

- `database.py` `CREATE EXTENSION` 缺 `text()` 包装
- `document_chunk.py` `Vector(1536)` 应为 `Vector(1024)`
- 全部 services/ 是 MiniMax，应替换为讯飞星火 V4
- `config.py` 指向 MINIMAX，应改为 SPARK
- `minimax_langchain.py` 中 `asyncio.run()` 在已有事件循环里死锁
- `requirements.txt` 末尾的 `anthropic` 依赖未使用，应删掉

## 测试

```bash
cd backend
pytest tests/ -v
```
