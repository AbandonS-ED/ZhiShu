# AGENTS.md

> 更详细的仓库状态见 `CLAUDE.md`，本文件用于快速查阅。

## 项目背景

第十五届中国软件杯 A3 赛题 —— 多智能体个性化学习资源生成系统。
**必须使用讯飞星火 V4**作为大模型（硬约束，不能换）。
课程切入点：人工智能导论。

## 常用命令

```bash
# 启动基础设施（在仓库根目录执行）
docker-compose up -d
# 启动后：PostgreSQL:5432 / Redis:6379 / MinIO:9000+9001

# 启动后端（PowerShell）
cd backend
venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
# 打开 http://localhost:8000/docs 查看接口文档

# 启动前端
cd frontend
npm install
npm run dev
# 打开 http://localhost:3000

# 跑测试（还没配好，只有 pytest 桩）
cd backend && pytest tests/ -v
```

## 技术栈（已锁定，不要换）

| 层 | 选型 |
|---|---|
| 前端 | Next.js 14 (App Router) + Tailwind + shadcn/ui |
| 后端 | FastAPI 0.136 + SQLAlchemy 2.0 async + asyncpg，Python 3.11 |
| Agent | LangGraph ≥0.2 + LangChain ≥0.3 |
| 大模型 | 讯飞星火 V4（不能用 OpenAI/Claude 代替） |
| 向量库 | pgvector（实际维度 1024，见下方 bug #1） |
| 数据库 | PostgreSQL 16 |
| 缓存 | Redis 7 + Celery 5.6 |
| 存储 | MinIO（AGPL-3.0 协议，需要在仓库根目录放 LICENSE 文件） |

## 代码里已有的坑（动手前先修）

1. **向量维度写错了** —— `backend/app/models/document_chunk.py` 第 13 行 `Vector(1536)`，讯飞 Embedding 实际是 1024 维，不改的话写入会报错。
2. **数据库初始化会崩** —— `backend/app/core/database.py` 第 13 行 `await conn.execute("CREATE EXTENSION ...")` 缺少 `text()` 包装，SQLAlchemy async 执行不了裸字符串。改成 `await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))`。
3. **设计文档里的 LangChain 封装会死锁** —— `_stream`/`_generate` 方法在已有事件循环里调 `asyncio.run()`，LangGraph 跑起来直接卡死。必须改成 async 原生写法或用 `asyncio.to_thread`。
4. **LLM 客户端写错了** —— `backend/app/services/minimax_client.py` 和 `minimax_langchain.py` 是 MiniMax 的，赛题要求讯飞星火 V4，需要删掉重写。
5. **讯飞鉴权别搞错** —— HTTP 接口只用 `Authorization: Bearer {api_key}`，不要把 api_key 和 api_secret 拼在一起。

## 架构要点（从文件名看不出来）

- **8 个子 Agent**：Profile / Document / MindMap / Exercise / Code / Path / Tutor / Video。由 Master Agent 通过 LangGraph StateGraph 统一编排，Agent 之间通过 State 字段传递数据，不要写成 if-else 串 Prompt。
- **6 维学生画像**存在 `student_profiles.dimensions`（JSONB）：知识掌握 / 学习风格 / 认知水平 / 兴趣 / 薄弱点 / 学习节奏。
- **RAG 流程**：文档解析 → 语义切片（800 字/100 重叠）→ Embedding → pgvector HNSW 检索 → LLM 重排 → 来源引用标注 → SourceValidator 验证 → 失败重试。这是答辩技术亮点，不能省。
- **所有生成场景必须流式输出**。`/api/v1/chat/stream` SSE 骨架已有。长任务走 Celery + Redis Pub/Sub → WebSocket 推进度。
- **前端 ReactFlow/Mermaid 组件**必须加 `'use client'` + `dynamic(..., { ssr: false })`，否则 App Router 编译会报错。

## 设计文档（写功能前先看）

- `docs/设计文档/项目设计文档-完整版.md` —— 完整数据库 schema、8 个 Agent 代码骨架、API 路由、前端组件、15 天 Vertical Slice 计划。**里面有现成骨架，直接落地，不要重写。**
- `docs/赛题需求/中国软件杯-A3-赛题开发需求.md` —— F1-F5 定义、评分细则、避坑点。
- `docs/开发流程/开发流程文档.md` —— 12 阶段 V1.0 流程。
- `开发进度.md` —— 各模块实时进度。

## 评分优先级

| 优先级 | 模块 | 占比 | 关键交付 |
|---|---|---|---|
| P0 | F1 对话式画像 | 35% | 6 维结构化 + 对话窗口 |
| P0 | F2 多智能体资源生成 | 45% | ≥5 种资源 + 真协同 |
| P1 | F3 学习路径 | 必做 | 拓扑排序 + 动态调整 |
| P1 | N3 防幻觉 + 流式 | 技术门槛 | RAG + SSE |
| P2 | F4 智能辅导 | 加分 | RAG 问答 + 上下文 |
| P2 | F5 效果评估 | 加分 | 行为跟踪 + 统计 |

## 待清理

- `backend/requirements.txt` 里的 `anthropic` —— 赛题用讯飞，不是 Anthropic，删掉。
- `backend/app/services/minimax_client.py` + `minimax_langchain.py` —— 见上方 bug #4，删掉重写。
- `frontend/` 没有 `package-lock.json` —— 跑 `npm install` 会生成，稳定后提交进去。

## 提交规范

前缀：`feat:` / `fix:` / `refactor:` / `docs:` / `chore:` / `test:`。
涉及评分项（流式/防幻觉/多智能体）的改动附 1-2 句说明，方便答辩回溯。
永远不要提交 `.env` 或讯飞 API 密钥。
