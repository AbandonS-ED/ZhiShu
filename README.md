# 智枢(SmartHub) - 多智能体个性化学习资源生成系统

基于大模型的个性化学习资源生成与学习多智能体系统

## 技术栈

- **前端**: Next.js 14 + TailwindCSS + shadcn/ui
- **后端**: FastAPI + SQLAlchemy + asyncpg
- **Agent**: LangGraph
- **数据库**: PostgreSQL + pgvector
- **缓存**: Redis
- **LLM**: 讯飞星火V4

## 项目结构

```
SmartHub/
├── frontend/          # Next.js前端
│   ├── src/
│   │   ├── app/       # App Router
│   │   └── components/
│   └── package.json
├── backend/           # FastAPI后端
│   ├── app/
│   │   ├── api/       # API路由
│   │   ├── core/      # 配置和数据库
│   │   ├── models/    # 数据模型
│   │   ├── services/  # 业务服务
│   │   └── agents/    # 智能体
│   ├── venv/          # Python虚拟环境
│   └── requirements.txt
├── docs/              # 文档
└── docker-compose.yml # 数据库服务
```

## 快速开始

### 1. 启动数据库服务

```bash
docker-compose up -d
```

### 2. 启动后端

```bash
cd backend
python -m venv venv
venv\Scripts\activate  # Windows
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 3. 启动前端

```bash
cd frontend
npm install
npm run dev
```

访问 http://localhost:3000

## API文档

启动后端后访问 http://localhost:8000/docs 查看Swagger文档
