# 智枢(SmartHub) - 多智能体个性化学习资源生成系统

第十五届中国软件杯 A3 赛题。基于大模型的个性化学习资源生成与学习多智能体系统。

## 技术栈

- **前端**: Next.js 14 + TailwindCSS + TypeScript
- **后端**: FastAPI + SQLAlchemy + asyncpg
- **Agent**: 6 个子 Agent + Master Agent 编排器（5 个已实现，缺 MindMap Agent）
- **LLM**: MiniMax-M3（开发）→ 讯飞星火 V4（上线前切换）
- **数据库**: PostgreSQL 18 + Redis

## 项目结构

```
SmartHub/
├── frontend/          # 7 页面 Next.js 前端（6 页已联调后端）
├── backend/           # FastAPI 完整后端（8 表 + 6 Agent + 16 API）
├── docs/              # 赛题需求 / 设计文档 / 开发流程
├── 开发进度.md         # 实时进度跟踪
├── AGENTS.md          # 协作文档
└── docker-compose.yml # 数据库服务
```

## 快速开始

```bash
# 1. 初始化数据库（只需一次）
psql -U postgres -f backend/scripts/init_db.sql

# 2. 后端
cd backend
python -m venv venv; venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
# Swagger: http://localhost:8000/docs

# 3. 前端
cd frontend
npm install
npm run dev
# 访问 http://localhost:3000
```

## 进度

| 模块 | 状态 |
|------|------|
| 前端 7 页面 | ✅ 已完成（模板复刻 + 6 页已联调后端） |
| 后端 8 表 + 6 Agent + 16 API | ✅ 已完成（全部测试通过） |
| F1 对话式画像 | ✅ 后端+前端完成 |
| F2 多智能体资源生成 | ⚠️ 缺 MindMap Agent，前端已联调 |
| F3 学习路径 | ✅ 后端+前端完成 |
| N3 防幻觉 + 流式 | ❌ 未实现（仅 chat/stream 有 SSE） |
| F4 智能辅导 | ⚠️ Agent 有，RAG 空，前端已联调 |
| F5 效果评估 | ❌ 未实现 |

详情见 `开发进度.md` 和 `AGENTS.md`。
