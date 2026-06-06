# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目背景

**智学 (ZhiShu)** —— 第十五届中国软件杯 A3 赛题参赛项目（2026/06 立项）。

- **赛题**：基于大模型的个性化资源生成与学习多智能体系统开发
- **出题方**：科大讯飞。**硬约束：必须使用讯飞星火 V4 / 讯飞 Embedding / 讯飞 TTS 等讯飞工具**
- **评分占比**：F1 对话式画像 35% + F2 多智能体资源生成 45% + F3 路径规划 + F4/F5 加分
- **课程切入点**：人工智能导论
- **主仓库**：<https://github.com/AbandonS-ED/ZhiShu>

> **跑题地图**：F1-F5 定义见 [docs/赛题需求/中国软件杯-A3-赛题开发需求.md](docs/赛题需求/中国软件杯-A3-赛题开发需求.md)；非功能项里**流式输出 / 防幻觉(RAG) / 开源合规**是技术门槛项。

## 仓库现状（2026-06-06）

```text

ZhiShu/
├── backend/                        # FastAPI 骨架（5 router 全是占位返回，3 张表）
│   ├── app/
│   │   ├── api/        chat / path / profile / resource / tutor — 全部 stub
│   │   ├── agents/     空目录（待填 8 个子 Agent）
│   │   ├── core/       config.py + database.py
│   │   ├── models/     Student / StudentProfile(JSONB) / DocumentChunk(pgvector)
│   │   └── services/   ⚠️ 暂是 minimax_client.py + minimax_langchain.py（错的 LLM）
│   ├── .env                       讯飞凭据占位
│   ├── requirements.txt           顶部有 pip 清华镜像提示
│   ├── Dockerfile                 wyy 加的
│   └── venv/                      本地 venv（已 gitignore）
├── frontend/                       # Next.js 14 + Tailwind + shadcn 风格
│   ├── src/app/                   6 页面: / /mindmap /path /profile /resources /tutor
│   ├── src/components/            5 组件: Header/Sidebar/RadarChart/ProgressCard/QuickActions
│   ├── src/stores/appStore.ts     Zustand store（Student/Profile/Resources）
│   ├── src/types/index.ts         TS 类型契约
│   ├── .npmrc                     npmmirror 配置（国内装包飞起）
│   └── 前端开发进度.md/            chl 的开发日志
├── docs/                          已分类: 赛题需求 / 设计文档 / 开发流程 / 运维测试 / 交付物
├── 开发进度.md                    chl 维护的活任务跟踪表
├── docker-compose.yml             postgres+pgvector / redis / minio（**不含 backend**）
├── AGENTS.md                      团队协作文档（与 CLAUDE.md 互补）
├── .gitignore                     已配全
└── docker-compose.yml
```

**实际状态**：

- ✅ 前端**完整可跑**（5 页面 + 8 组件 + Zustand，mock 数据，`npm run build` 成功）
- ⚠️ 后端是骨架——5 个 router 全是占位、3 张表、0 个 Agent
- ⚠️ 还没有任何测试、没有 Alembic 迁移、没有种子数据
- ⚠️ MiniMax LLM 客户端是错的——必须替换为讯飞星火

## 团队与分支

| 分支 | 维护者 | 状态 |
| --- | --- | --- |
| `main` | 全员主干 | **当前在 main** |
| `origin/chl` | chl | 前端完整实现（5 页面 + 8 组件 + Zustand），**已合入 main** |
| `origin/wyy` | wyy | 后端 Dockerfile + tests，**未合入 main**（他在删脚手架，跟 chl 冲突） |

**合并经验**（避免重复踩坑）：

- 跨分支合前端代码时，**优先 cherry-pick 新增文件**而不是 `git merge`（chl 写的页面跟 wyy 删的脚手架文件冲突过）
- wyy 的 commit `7c4de48` 删了 frontend 脚手架；wyy 的 `bb59292` 又删了前端开发指南（2786 行）——**这两笔跟 chl 冲突**。合 chl 时跳过对被删文件的修改
- 团队 commit 信息中英混杂、风格不统一，目前没人统一规则

## 关键文档（按优先级读）

1. **开发进度跟踪**：[开发进度.md](开发进度.md) —— chl 维护的活任务表
2. **设计圣经**：[docs/设计文档/项目设计文档-完整版.md](docs/设计文档/项目设计文档-完整版.md) —— 9225 行，含完整 DB schema、8 Agent 骨架、15 天 Vertical Slice 计划
3. **赛题约束**：[docs/赛题需求/中国软件杯-A3-赛题开发需求.md](docs/赛题需求/中国软件杯-A3-赛题开发需求.md)
4. **开发流程**：[docs/开发流程/开发流程文档.md](docs/开发流程/开发流程文档.md) —— 12 阶段 V1.0 流程
5. **团队协作**：[AGENTS.md](AGENTS.md) —— 命令/锁定技术栈/已知 bug 清单

## 中国网络环境约束（必读）

**Google 服务不可达**（Google Fonts / OpenAI / Anthropic / Vercel / Sentry 全部失败）。

| 资源 | 替代方案 |
| --- | --- |
| Google Fonts（Inter/Roboto...） | **用项目自带 woff**：`frontend/src/app/fonts/GeistVF.woff` + `next/font/local`（**勿用** `next/font/google`） |
| npm registry | `frontend/.npmrc` 已配 `registry.npmmirror.com`，全队自动生效 |
| PyPI | `pip install -i <https://pypi.tuna.tsinghua.edu.cn/simple> ...`（注释已写在 requirements.txt 顶部） |
| LLM | 讯飞星火 V4（赛题要求，恰好国内可用） |
| 部署 | 阿里云 / 腾讯云 / 自建（**勿用** Vercel） |
| 监控 | 阿里云 ARMS（**勿用** Sentry） |

## 技术栈（已锁定，不要换）

| 层 | 选型 | 备注 |
| --- | --- | --- |
| 前端 | Next.js 14.2.5 (App Router) + Tailwind 3.4 + shadcn 风格 | `package.json` 改写自 chl |
| 后端 | FastAPI 0.136 + SQLAlchemy 2.0 async + asyncpg | Python 3.11 |
| Agent | LangGraph ≥0.2 + LangChain ≥0.3 | **建议钉版本**：`langgraph==0.2.78 langchain==0.2.16` |
| 大模型 | 讯飞星火 V4（HTTP Bearer = `api_key`；WSS 用 HMAC-SHA256 鉴权 URL） | **勿用 OpenAI/Claude/MiniMax** |
| 向量库 | pgvector | **实际维度 1024**，设计文档里硬编码 1536 是 bug 要改 |
| 数据库 | PostgreSQL 16 | 已有 docker-compose |
| 缓存/队列 | Redis 7 + Celery 5.6 |
| 对象存储 | MinIO（**AGPL-3.0**，发布到 GitHub 需仓库带 LICENSE） |

## 开发与运行命令

```bash

# 1. 启动基础设施
docker-compose up -d         # postgres:5432 / redis:6379 / minio:9000+9001

# 2. 后端（PowerShell / cmd）
cd backend
python -m venv venv           # 首次需要
venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
# Swagger: <http://localhost:8000/docs>
# ⚠️ 当前 init_db() 有 bug：CREATE EXTENSION 缺 text() 包装，启动会报错

# 3. 前端
cd frontend
npm install                  # .npmrc 自动走 npmmirror
npm run dev                  # <http://localhost:3000>
npm run build                # ✅ 已验证可成功
npm run lint                 # ✅ 可过（剩 1 个非阻塞 warning 在 tutor/page.tsx:87）

# 4. 单测（待补，pytest 框架尚未配置）
cd backend
pytest tests/ -v
pytest tests/test_X.py::test_name -v   # 跑单个测试
```

## 当前代码里的已知问题（动手前先看一眼）

1. **`backend/app/core/database.py:13`** —— `await conn.execute("CREATE EXTENSION IF NOT EXISTS vector")` 缺 `text()` 包装。**修法**：

   ```python

   from sqlalchemy import text
   await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
   ```

2. **`backend/app/models/document_chunk.py`** —— `Vector(1536)` 是错的。讯飞 Embedding 实际是 1024 维（或 256，看买的模型）。**改 schema 前先确认买的型号**。
3. **`backend/app/services/minimax_*.py`** —— 整个 MiniMax 客户端是**错的 LLM**（比赛要求讯飞）。删除，用 `app/services/spark_*.py` 替换（设计文档里有 SparkClient + SparkLangchain 骨架）。
4. **设计文档里 `SparkLangchain._stream` / `_generate`** —— 在已有事件循环里调 `asyncio.run` 会死锁。**真要落地必须重写**为 async-native 或 `asyncio.to_thread`。
5. **MinIO** 是 AGPL-3.0——仓库根需要 `LICENSE` 文件声明（赛题 N2"开源合规"评分项要求"显著位置标注"）。
6. **后端 5 个 router** 全是占位（return `{"message": "待实现"}`）。**D1 Vertical Slice 第一刀是 Document Agent 走通 + 接 chat/stream**。

## 架构与功能要点

### 多智能体协同（Master-Worker）

`Master Agent` 接收请求 → 拆任务 → 派给专项 Agent（并行）→ 汇总 → 流式返回。

8 个子 Agent：**Profile / Document / MindMap / Exercise / Code / Path / Tutor / Video**（Video 可降级为 TTS+幻灯片以节省工期）。`backend/app/agents/` 当前是空目录。

LangGraph `StateGraph` 编排，State 字段：`UserRequest / Profile / TaskPlan / ResourceGeneration / PathPlanning / Response`。

### 6 维学生画像（F1）

`student_profiles.dimensions` 用 JSONB 存：`knowledge_mastery / learning_style / cognitive_level / interests / weak_topics / learning_pace`。对话式抽取 + 行为回流持续更新。

### RAG + 防幻觉（N3 评分项）

文档解析 → 语义切片（800 字/100 重叠）→ Embedding → pgvector HNSW 检索 → LLM 重排 → **来源引用标注** → SourceValidator 验证（抓「年份+期刊+百分比」类捏造）→ 失败重生成。**答辩技术亮点，不可省。**

### 流式输出（N1/N4）

`/api/v1/chat/stream` 已留 SSE 入口（[backend/app/api/chat.py](backend/app/api/chat.py)），所有生成场景必须接 `StreamingResponse`。长任务用 Celery + Redis Pub/Sub 推 WebSocket 进度。

### 前端目录约定

```text

frontend/src/
├── app/           # 路由页面（每个 page.tsx 是 App Router 路由）
├── components/    # 通用组件（按功能分: dashboard/, layout/）
├── stores/        # Zustand store
├── lib/           # 工具函数（cn() 在 utils.ts）
└── types/         # TypeScript 类型契约
```

**约定**：所有用到 `window` / `document` 的组件（ReactFlow / Mermaid）必须 `'use client'` + 必要时 `dynamic(..., { ssr: false })`（mindmap/page.tsx 已用 `'use client'`）。

## 评分优先级

| 顺序 | 模块 | 占比 | 关键交付 |
| --- | --- | --- | --- |
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
- **流式返回别"先等几秒再全返"**——必须真流，按 token/chunk 推。
- **写新功能前先看**：[docs/设计文档/项目设计文档-完整版.md](docs/设计文档/项目设计文档-完整版.md) 对应章节，骨架代码已经写好，**直接落地而非重写**。
- **不要把讯飞 API 凭据提交到 git**——`.env` 已在 `.gitignore`。
- **前端依赖能 npm 装的不要引外部 CDN**——Google Fonts / Vercel Analytics / Sentry 一律不用。

## 提交前自检

- [ ] `git status` 干净
- [ ] 没有未追踪的 `.env` / `venv` / `node_modules` / `__pycache__`
- [ ] 提交信息前缀：`feat:` / `fix:` / `refactor:` / `docs:` / `chore:` / `test:`
- [ ] 涉及评分项（流式/防幻觉/多智能体）的改动附 1-2 句说明，方便答辩时回溯
- [ ] 涉及讯飞 API 的改动在文档中标注是哪个 API（星火 V4 chat / Embedding / TTS）
- [ ] 跨分支合并优先 cherry-pick 新增文件（参考 chl/wyy 冲突经验）
