# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目背景

**智枢 (SmartHub)** —— 第十五届中国软件杯 A3 赛题：基于大模型的个性化资源生成与学习多智能体系统。

- **出题方**：科大讯飞。**硬约束**：必须用讯飞星火 V4 / Embedding / TTS
- **评分占比**：F1 对话式画像 35% + F2 多智能体资源生成 45% + F3 路径规划 + F4/F5 加分
- **非功能项**（技术门槛）：流式输出 / 防幻觉(RAG) / 开源合规
- **课程切入点**：人工智能导论
- **主仓库**：<https://github.com/AbandonS-ED/ZhiShu>

## 仓库现状（2026-06-07）

```
SmartHub/
├── frontend/                        # Next.js 14.2.5 + Tailwind 3.4 + TypeScript
│   ├── src/app/                     # 7 页面：/ /duihua /profile /resources /path /tiku /pinggu
│   │   ├── layout.tsx               # 模板风 .app 布局：Sidebar + Main
│   │   ├── page.tsx                 # / 仪表盘（server component，无 'use client'）
│   │   ├── globals.css              # 模板设计系统（米色/墨黑/琥珀 ~500 行有效样式）
│   │   └── [其他 5 个 page.tsx]     # 'use client' + 模板 HTML
│   ├── src/components/layout/
│   │   ├── Sidebar.tsx              # 7 项菜单（仪表盘 + 智能对话 + 学习画像 + 资源 + 路径 + 题库 + 评估），可折叠
│   │   └── Header.tsx               # 60px 玻璃拟态 + 动态页面标题
│   ├── src/stores/appStore.ts       # Zustand store（暂未使用）
│   ├── src/types/index.ts           # TS 类型契约
│   ├── src/lib/utils.ts             # cn() 工具
│   ├── src/app/fonts/               # GeistVF.woff / GeistMonoVF.woff（本地字体）
│   └── .npmrc                       # npmmirror 国内镜像
├── backend/                         # FastAPI 骨架
│   ├── app/main.py                  # 5 router 注册
│   ├── app/api/                     # 5 router 全是占位
│   ├── app/core/{config,database}.py
│   ├── app/models/                  # Student / StudentProfile / DocumentChunk
│   ├── app/services/                # ⚠️ minimax_client.py + minimax_langchain.py（错的 LLM）
│   └── tests/                       # __init__.py 空
├── docs/                            # 已分类：赛题需求 / 设计文档 / 开发流程 / 运维测试 / 交付物
├── 开发进度.md                       # chl 维护的任务表
├── AGENTS.md                        # 团队协作文档
└── docker-compose.yml               # postgres+pgvector / redis / minio（不含 backend）
```

**实际状态**：

- ✅ 前端 7 页面 **1:1 复刻模板** + `npm run build` 通过
- ⚠️ 后端是骨架——5 个 router 全是占位返回，3 张表，0 个 Agent
- ⚠️ MiniMax LLM 客户端是错的，必须替换为讯飞星火
- ⚠️ 5 个已知 bug（见下方"已知 bug"段）

## 技术栈（已锁定，不要换）

| 层 | 选型 | 备注 |
|---|---|---|
| 前端 | Next.js 14.2.5 (App Router) + Tailwind 3.4 + TypeScript | 无 shadcn/ui，纯自定义 CSS |
| 后端 | FastAPI 0.136 + SQLAlchemy 2.0 async + asyncpg | Python 3.11 |
| Agent | LangGraph + LangChain | 待搭建 |
| LLM | 讯飞星火 V4 | **勿用 OpenAI/Claude/MiniMax** |
| 向量库 | pgvector | **实际维度 1024** |
| 数据库 | PostgreSQL 16 + Redis 7 + MinIO | MinIO 是 AGPL-3.0，需仓库带 LICENSE |

## 中国网络约束（必读）

**Google 服务不可达**——`next/font/google` / Vercel / Sentry / OpenAI 全部失败。

- **字体**：用 `frontend/src/app/fonts/` 本地 woff + `next/font/local`（**勿用** `next/font/google`）
- **npm registry**：`frontend/.npmrc` 已配 `registry.npmmirror.com`，全队自动生效
- **PyPI**：`pip install -i https://pypi.tuna.tsinghua.edu.cn/simple -r requirements.txt`（注释已写在 requirements.txt 顶部）
- **讯飞鉴权**：HTTP 只做 `Authorization: Bearer {api_key}`，**不要拼 api_secret**
- **`requirements.txt` 末尾的 `anthropic` 依赖已不用**，首次装包后删除

## 命令

```bash
# 基础设施
docker-compose up -d

# 后端
cd backend
python -m venv venv; venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
# Swagger: http://localhost:8000/docs

# 前端（注意：用 npx next 而非 npm run dev，因为 next 可能不在 PATH）
cd frontend
npm install
npx next dev          # http://localhost:3000
npx next build        # ✅ 已验证通过
npx next lint         # ✅ 通过
```

⚠️ **`npx next dev`** 比 `npm run dev` 可靠——后者依赖 `node_modules/.bin` 必须在 PATH，前者在 npm 配置下会下载最新版本（可能导致版本不匹配）。

## 已知 bug（动手前必读）

1. **`backend/app/core/database.py:13`** —— `await conn.execute("CREATE EXTENSION ...")` 缺 `text()` 包装。修：`from sqlalchemy import text; await conn.execute(text(...))`
2. **`backend/app/models/document_chunk.py:13`** —— `Vector(1536)` 应改为 `Vector(1024)`（讯飞 Embedding 实际维度）
3. **`backend/app/services/minimax_*.py`** —— 整个 MiniMax 客户端是错的 LLM。删除，替换为 `spark_client.py` + `spark_langchain.py`
4. **`backend/app/core/config.py`** —— `MINIMAX_*` 配置应改为 `SPARK_*`（讯飞星火）
5. **`backend/app/services/minimax_langchain.py:702-712`** —— `_stream`/`_generate` 中 `asyncio.run()` 在已有事件循环里死锁，须重写为 async-native 或 `asyncio.to_thread`

## 架构与功能要点

### 多智能体协同（Master-Worker）

`Master Agent` 接收请求 → 拆任务 → 派给 6 个子 Agent（并行）→ 汇总 → 流式返回。

6 个子 Agent：
- **Profile Agent** — 对话式画像提取，输出 6 维结构化 JSON（35% 分值核心）
- **Document Agent** — 知识讲解 + 代码示例 + 音频脚本生成（3 种输出格式）
- **MindMap Agent** — 思维导图生成，输出 Mermaid 代码
- **Exercise Agent** — 练习题生成（选择/判断/简答/编程），输出 JSON 题目列表
- **Path Agent** — 学习路径规划，输出知识图谱节点 + 边 + 每日计划
- **Tutor Agent** — RAG 问答 + 评估报告生成

LangGraph `StateGraph` 编排，State 字段：`UserRequest / Profile / TaskPlan / ResourceGeneration / PathPlanning / Response`。

### 6 维学生画像（F1）

`student_profiles.dimensions` 用 JSONB 存：`knowledge_mastery / learning_style / cognitive_level / interests / weak_topics / learning_pace`。

### RAG + 防幻觉（N3 评分项）

文档解析 → 语义切片（800字/100重叠）→ Embedding → pgvector HNSW 检索 → LLM 重排 → **来源引用标注** → SourceValidator 验证（抓"年份+期刊+百分比"类捏造）→ 失败重生成。**这是答辩技术亮点，不可省。**

### 流式输出（N1/N4）

`/api/v1/chat/stream` SSE 骨架已在 [backend/app/api/chat.py](backend/app/api/chat.py)。所有生成场景必须接 `StreamingResponse`。长任务用 Celery + Redis Pub/Sub 推 WebSocket 进度。

## 前端约定

- **页面（除 `/`）必须加 `'use client'`**——模板 HTML 含 onClick / useState 等运行时逻辑
- **CSS 集中在 `globals.css`**——不动 `tailwind.config.js`（用模板 CSS 变量比 Tailwind 更准）
- **静态数据写在 page.tsx 内**——不拆分 data 文件
- **Sidebar.tsx** 有折叠功能（`useState` + `.collapsed` class），CSS 里有 `.sidebar.collapsed` 样式定义
- **页面带动态内容（Python 代码块、JSON 模板字符串）**用 `dangerouslySetInnerHTML` 包裹，否则 JSX 解析 `{...}` 会失败——见 [duihua/page.tsx](frontend/src/app/duihua/page.tsx) 例子
- **`.next` 缓存损坏**：每次 `npm run build` 后切回 `npm run dev` 常报 `Cannot find module './<id>.js'`。解法：杀掉 node 进程 → `Remove-Item frontend/.next -Recurse` → 重启 dev server。**不是代码 bug**。

## 评分优先级

| 优先级 | 模块 | 占比 |
|--------|------|------|
| P0 | F1 对话式画像 | 35% |
| P0 | F2 多智能体资源生成 | 45% |
| P1 | F3 学习路径 / N3 防幻觉+流式 | 必做 |
| P2 | F4 智能辅导 / F5 效果评估 | 加分 |

## 写新功能前先看

- [docs/设计文档/项目设计文档-完整版.md](docs/设计文档/项目设计文档-完整版.md) —— 9225 行设计圣经：DB schema + 6 Agent 骨架 + API + 15 天 Vertical Slice 计划
- [AGENTS.md](AGENTS.md) —— 团队协作文档，命令/锁定技术栈/已知 bug 清单
- [开发进度.md](开发进度.md) —— 团队任务跟踪表

**直接落地设计文档的骨架代码，不要重写。**

## 提交规范

- 前缀：`feat:` / `fix:` / `refactor:` / `docs:` / `chore:` / `test:`
- 涉及评分项的改动附 1-2 句说明，方便答辩时回溯
- 涉及讯飞 API 的改动在 commit 中标注是哪个 API（星火 V4 chat / Embedding / TTS）
- **勿提交** `.env` / `venv/` / `node_modules/`（已 gitignore）
- CRLF/LF 警告是 Windows 正常现象，**不要**试图修
