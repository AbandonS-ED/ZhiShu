# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目背景

**智学 (ZhiShu)** —— 第十五届中国软件杯 A3 赛题参赛项目。

- **赛题**：基于大模型的个性化资源生成与学习多智能体系统开发
- **出题方**：科大讯飞（**必用**讯飞星火 V4 LLM、讯飞 Embedding、讯飞 TTS 等讯飞工具，是硬约束）
- **评分占比**：F1 对话式画像 35% + F2 多智能体资源生成 45% + F3 路径规划 + F4/F5 加分项；非功能项里 **流式输出 / 防幻觉(RAG) / 开源合规** 是技术门槛
- **课程切入点**：人工智能导论
- **主仓库**：https://github.com/AbandonS-ED/ZhiShu

## 仓库现状（截至 2026-06-05）

仓库处于**骨架阶段**——设计文档完整、代码极少：

```
ZhiShu/
├── backend/                       # FastAPI 骨架（可启动但无业务实现）
│   ├── app/
│   │   ├── api/                   # 5 个 router 文件，全部是占位返回
│   │   ├── core/{config,database}.py
│   │   ├── models/                # 3 个模型：Student / StudentProfile / DocumentChunk
│   │   ├── agents/                # 空目录
│   │   └── services/              # 空目录
│   ├── .env                       # 含占位符的讯飞凭据
│   ├── requirements.txt
│   └── venv/                      # 已建好的 Python 3.11 虚拟环境
├── frontend/                      # Next.js 14 脚手架（无任何业务页面/组件）
├── docs/                          # 空目录
├── docker-compose.yml             # postgres+pgvector / redis / minio（**不含 backend**）
├── docs/
│   ├── 赛题需求/
│   │   └── 中国软件杯-A3-赛题开发需求.md  # 赛题官方需求
│   ├── 设计文档/
│   │   ├── 项目设计文档-完整版.md         # ⭐ 9225 行设计圣经
│   │   └── 项目设计文档.md                # 35K 精简版
│   ├── 开发流程/
│   │   ├── 开发流程文档.md                # 12 阶段 V1.0 流程
│   │   └── AI-Coding工具使用说明.md
│   ├── 运维测试/
│   │   ├── 测试说明书.md
│   │   └── 部署运维文档.md
│   └── 交付物/
│       ├── 演示PPT大纲.md
│       └── 用户手册.md
```

**还没有**：所有 Agent 实现、所有前端业务代码、任何测试、Embedding 维度的修正、讯飞 LLM 客户端替换。

## 关键设计文档

- **必读**：[项目设计文档-完整版.md](docs/设计文档/项目设计文档-完整版.md) —— 含完整数据库 schema、8 个 Agent 的代码骨架、API 路由、前端组件、15 天 Vertical Slice 开发计划
- **赛题约束**：[中国软件杯-A3-赛题开发需求.md](docs/赛题需求/中国软件杯-A3-赛题开发需求.md) —— F1-F5 定义、评分细则、避坑点
- **开发流程**：[开发流程文档.md](docs/开发流程/开发流程文档.md) —— V1.0 12 阶段流程（与设计文档的 Vertical Slice 计划互补）

## 技术栈（已锁定，不要换）

| 层 | 选型 | 备注 |
|---|---|---|
| 前端 | Next.js 14 (App Router) + Tailwind + shadcn/ui | 14.2.35 |
| 后端 | FastAPI 0.136 + SQLAlchemy 2.0 (async) + asyncpg | Python 3.11 |
| Agent | LangGraph ≥0.2 + LangChain ≥0.3 | **建议钉版本**：`langgraph==0.2.78` `langchain==0.2.16` |
| 大模型 | 讯飞星火 V4（HTTP Bearer = `api_key`；WSS 用 HMAC-SHA256 鉴权 URL） | **勿用 OpenAI/Claude 顶替** |
| 向量库 | pgvector（**实际维度 1024**，设计文档里硬编码 1536 是 bug 要改） | |
| 数据库 | PostgreSQL 16 | 已有 docker-compose |
| 缓存/队列 | Redis 7 + Celery 5.6 | |
| 对象存储 | MinIO（**AGPL-3.0**，发布到 GitHub 需仓库带 LICENSE） | |
| Embedding | 讯飞 Embedding | 维度需查实际模型规格 |

## 开发与运行命令

```bash
# 1. 启动 DB / 缓存 / 对象存储
docker-compose up -d

# 2. 后端（PowerShell / cmd）
cd backend
venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
# Swagger: http://localhost:8000/docs

# 3. 前端
cd frontend
npm install
npm run dev
# http://localhost:3000

# 4. 单测（待补，pytest 框架尚未配置）
cd backend
pytest tests/ -v
pytest tests/test_X.py::test_name -v   # 跑单个测试
```

**.gitignore 已配置**，覆盖 `backend/venv/`、`backend/.env`、`frontend/node_modules/`、`frontend/.next/`、Python `__pycache__`、`.claude/` 等。提交前确认 `git status` 干净即可。

## 当前代码里的已知问题（动手前先看一眼）

1. **`backend/app/models/document_chunk.py`** 把 `embedding` 钉成 `Vector(1536)`。讯飞 Embedding 实际是 1024/256 维，硬编码会导致写入失败。**先确认买的模型再改 schema 和所有引用点。**
2. **讯飞 HTTP 鉴权**用 `Authorization: Bearer {api_key}`（**不含** `api_secret`，不要把 key:secret 拼一起）。
3. **`backend/app/core/database.py`** 的 `init_db` 里 `await conn.execute("CREATE EXTENSION IF NOT EXISTS vector")` 写错了——SQLAlchemy async 的 `execute` 需要 text 包装，且 `CREATE EXTENSION` 需要 superuser。改为 `from sqlalchemy import text; await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))`。
4. **设计文档里 `SparkLangchain._stream` / `_generate`** 在已有事件循环里调 `asyncio.run`/`loop.run_until_complete` 会死锁——LangGraph 同步调用会直接卡死。**真要落地必须重写**为 async-native 或用 `asyncio.to_thread`。
5. **MinIO 协议**是 AGPL-3.0，仓库根需要 `LICENSE` 文件声明。

## 架构与功能要点

### 多智能体协同（Master-Worker）

`Master Agent` 接收请求 → 拆任务 → 派给专项 Agent（并行）→ 汇总 → 流式返回。

8 个子 Agent：**Profile / Document / MindMap / Exercise / Code / Path / Tutor / Video**（Video 可降级为 TTS+幻灯片以节省工期）。

LangGraph `StateGraph` 编排，State 字段：`UserRequest / Profile / TaskPlan / ResourceGeneration / PathPlanning / Response`。

### 6 维学生画像（F1）

`student_profiles.dimensions` 用 JSONB 存：`knowledge_mastery / learning_style / cognitive_level / interests / weak_topics / learning_pace`。对话式抽取 + 行为回流持续更新。

### RAG + 防幻觉（N3 评分项）

文档解析 → 语义切片（800 字/100 重叠）→ Embedding → pgvector HNSW 检索 → LLM 重排 → **来源引用标注** → SourceValidator 验证（抓「年份+期刊+百分比」类捏造）→ 失败重生成。**这是答辩技术亮点，不可省。**

### 流式输出（N1/N4）

`/api/v1/chat/stream` 已留 SSE 入口（[backend/app/api/chat.py](backend/app/api/chat.py)），所有生成场景必须接 `StreamingResponse`。长任务用 Celery + Redis Pub/Sub 推 WebSocket 进度。

## 评分优先级

| 顺序 | 模块 | 占比 | 关键交付 |
|---|---|---|---|
| P0 | F1 对话式画像 | 35% | 6 维结构化 + 对话窗口 |
| P0 | F2 多智能体资源生成 | 45% | ≥5 种资源 + 真协同（非 if-else 串 Prompt） |
| P1 | F3 学习路径 | 必做 | 拓扑排序 + 动态调整 |
| P1 | N3 防幻觉 + 流式 | 技术门槛 | RAG + SSE |
| P2 | F4 智能辅导 | 加分 | RAG 问答 + 上下文 |
| P2 | F5 效果评估 | 加分 | 行为跟踪 + 统计 |
| P3 | F1-F5 都做完后 | 加分 | 演示视频 / PPT / 开源声明 |

## 风格与规范

- **不要做单 Prompt 伪 Agent**——评审会查代码、查 Agent 间通信（MessageBus / State 字段传递）。
- **所有生成链路必须留引用源**——内容安全和可解释性同时满足。
- **前端 ReactFlow / Mermaid 组件必须 `'use client'` + `dynamic(..., { ssr: false })`**，否则 App Router 编译会爆。
- **流式返回别"先等几秒再全返"**——必须真流，按 token/chunk 推。
- **写新功能前先看**：[项目设计文档-完整版.md](docs/设计文档/项目设计文档-完整版.md) 的对应章节，骨架代码已经写好，**直接落地而非重写**。
- **不要把讯飞 API 凭据提交到 git**——`.env` 必须在 `.gitignore` 里。

## 提交前自检

- [ ] `git status` 干净
- [ ] 没有未追踪的 `.env` / `venv` / `node_modules` / `__pycache__`
- [ ] 提交信息前缀：`feat:` / `fix:` / `refactor:` / `docs:` / `chore:` / `test:`
- [ ] 涉及评分项（流式/防幻觉/多智能体）的改动附 1-2 句说明，方便答辩时回溯
- [ ] 涉及讯飞 API 的改动在文档中标注是哪个 API（星火 V4 chat / Embedding / TTS）
