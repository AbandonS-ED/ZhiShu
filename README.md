# 智枢(SmartHub) - 多智能体个性化学习资源生成系统

第十五届中国软件杯 A3 赛题。基于大模型的个性化学习资源生成与学习多智能体系统。

## 技术栈

- **前端**: Next.js 14 + TailwindCSS + TypeScript
- **后端**: FastAPI + SQLAlchemy + asyncpg
- **Agent**: LangGraph（待搭建）
- **数据库**: PostgreSQL + pgvector / Redis / MinIO
- **LLM**: 讯飞星火 V4

## 项目结构

```
SmartHub/
├── frontend/          # 7 页面 Next.js 前端（模板 1:1 复刻）
├── backend/           # FastAPI 骨架（5 stub router + 3 表）
├── docs/              # 赛题需求 / 设计文档 / 开发流程
├── 开发进度.md         # 实时进度跟踪
├── AGENTS.md          # 协作文档
└── docker-compose.yml # 数据库服务
```

## 快速开始

```bash
# 1. 启动数据库
docker-compose up -d

# 2. 后端
cd backend
python -m venv venv; venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# 3. 前端
cd frontend
npm install
npm run dev

# 访问 http://localhost:3000
```

## 进度

| 模块 | 状态 |
|------|------|
| 前端 7 页面 | ✅ 已完成（模板复刻） |
| 后端骨架 | ✅ 已完成（stub） |
| F1 对话式画像 | ⬜ |
| F2 多智能体资源生成 | ⬜ |
| F3-F5 + RAG + 测试 | ⬜ |

详情见 `开发进度.md` 和 `AGENTS.md`。
