# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目背景

**智枢 (SmartHub)** —— 第十五届中国软件杯 A3 赛题：基于大模型的个性化资源生成与学习多智能体系统。

- **出题方**：科大讯飞。**硬约束**：必须用讯飞星火 V4 / Embedding / TTS
- **评分占比**：F1 对话式画像 35% + F2 多智能体资源生成 45% + F3 路径规划 + F4/F5 加分
- **非功能项**（技术门槛）：流式输出 / 防幻觉(RAG) / 开源合规
- **课程切入点**：人工智能导论
- **主仓库**：<https://github.com/AbandonS-ED/ZhiShu>

## 仓库现状（2026-06-08）

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
│   ├── src/types/index.ts           # TS 类型契约（暂未使用）
│   ├── src/lib/
│   │   ├── api.ts                   # API 客户端（6 模块：profile/chat/resource/exercise/path/tutor）
│   │   ├── student.ts               # student_id 本地存储（localStorage）
│   │   └── utils.ts                 # cn() + escapeHtml() 工具
│   ├── src/app/profile/ChatModal.tsx  # 对话式画像提取弹窗
│   ├── src/app/fonts/               # GeistVF.woff / GeistMonoVF.woff（本地字体）
│   └── .npmrc                       # npmmirror 国内镜像
├── backend/                         # FastAPI + 9 表 + 7 Agent + 28 API + 11 Service
│   ├── app/main.py                  # 8 router 注册 + lifespan 初始化
│   ├── app/api/                     # 8 router：profile / resource / path / tutor / chat / mindmap / dashboard / evaluation
│   ├── app/core/{config,database}.py
│   ├── app/models/                  # 9 个 Model（Student / Profile / DocumentChunk / Resource / LearningPath / Exercise / ChatSession / ChatMessage / LearningRecord）
│   ├── app/agents/                  # 7 个 Agent（Profile / Document / Exercise / Path / Tutor / Master / MindMap）
│   ├── app/services/                # 11 个服务：minimax_client / spark_client / anti_hallucination / content_safety / document_parser / embedding_service / evaluation_service / json_parser / reranker / text_chunker / vector_store
│   ├── scripts/init_db.sql          # 手动建库 + 建表脚本
│   └── tests/                       # __init__.py 空
├── docs/                            # 已分类：赛题需求 / 设计文档 / 开发流程 / 运维测试 / 交付物
├── 开发进度.md                       # 实时进度跟踪
├── AGENTS.md                        # 团队协作文档
└── docker-compose.yml               # postgres+pgvector / redis / minio（不含 backend）
```

**实际状态（2026-06-08）**：

- ✅ 前端 7 页面 **1:1 复刻模板**
- ✅ **前端联调**：7/7 页全部接入后端 API（`/` 数据聚合 + `/duihua` SSE + `/profile` AI 弹窗 + `/resources` SSE 流式 + `/path` SSE 流式 + `/tiku` SSE 流式 + `/pinggu` AI 评估）
- ✅ 后端完整：9 表 + 7 Agent + 28 API 端点 + 11 Service
- ✅ MiniMax-M3 LLM 端到端验证通过
- ✅ **MindMap Agent** 已实现（F2 评分项）
- ✅ **防幻觉三层验证** 已实现（N3 必做项）
- ✅ **SSE 流式输出** 所有生成接口已接（资源/练习/路径）
- ✅ **RAG 管道** 已实现（文档解析 → 语义切片 → Embedding → 向量检索 → LLM 重排）

## 技术栈（已锁定，不要换）

| 层 | 选型 | 备注 |
|---|---|---|
| 前端 | Next.js 14.2.5 (App Router) + Tailwind 3.4 + TypeScript | 无 shadcn/ui，纯自定义 CSS |
| 后端 | FastAPI 0.136 + SQLAlchemy 2.0 async + asyncpg | Python 3.11 |
| Agent | LangGraph + LangChain（已安装，未使用 StateGraph） | 直接调用 LLM |
| LLM | **双客户端**：`MiniMaxClient`（开发，默认） + `SparkClient`（上线前切到讯飞星火 V4） | OpenAI 兼容格式；`LLM_PROVIDER=spark\|minimax` 切换 |
| 向量库 | pgvector（Python 包已装，PG 扩展未装） | embedding 用 JSONB 占位 + Python fallback 余弦相似度 |
| 数据库 | PostgreSQL 18 + Redis（本地安装，无 Docker） | MinIO AGPL-3.0 需 LICENSE |

**LLM 流式客户端要点**（`backend/app/services/minimax_client.py:chat_stream`）：

- MiniMax-M3 响应里 token 在 `delta.content`；**部分 chunk 把推理内容放 `delta.reasoning_content`**，要兜底
- 空 token / 解析失败仅 `print` 调试日志，**不抛**——保证流式不被中途异常打断
- 频繁 `print(f"[chat_stream] …")`，正式上线前改成 loguru 或关掉

**Spark 客户端**（`backend/app/services/spark_client.py`）：

- 走 `Authorization: Bearer {SPARK_API_KEY}`，**不要拼 api_secret**
- `lifespan` 根据 `settings.LLM_PROVIDER` 二选一；`spark` 模式额外 `await spark_client.close()` 释放 HTTP 连接池

## 中国网络约束（必读）

**Google 服务不可达**——`next/font/google` / Vercel / Sentry / OpenAI 全部失败。

- **字体**：用 `frontend/src/app/fonts/` 本地 woff + `next/font/local`（**勿用** `next/font/google`）
- **npm registry**：`frontend/.npmrc` 已配 `registry.npmmirror.com`，全队自动生效
- **PyPI**：`pip install -i https://pypi.tuna.tsinghua.edu.cn/simple -r requirements.txt`
- **讯飞鉴权**：HTTP 只做 `Authorization: Bearer {api_key}`，**不要拼 api_secret**
- **`requirements.txt`** 实际仅含 14 个依赖（FastAPI/SQLAlchemy/asyncpg/LangGraph/LangChain/httpx/pgvector 等），设计文档中列出的 loguru/sse-starlette/pymupdf/minio 等未安装

## 命令

```bash
# 数据库初始化（只需一次）
psql -U postgres -f backend/scripts/init_db.sql

# 后端
cd backend
python -m venv venv; venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
# Swagger: http://localhost:8000/docs

# 切换到讯飞星火 V4：在 backend/.env 配 SPARK_API_KEY 后设
# LLM_PROVIDER=spark
# ⚠️ 8000 端口在 Windows 上有"僵尸 socket"问题（任务停了但端口还占着，
#    taskkill / Get-NetTCPConnection 都看不到 PID）。绕开：改用 8001
uvicorn app.main:app --host 0.0.0.0 --port 8001
# 同步改 frontend/src/lib/api.ts:4 的 BASE_URL = 'http://localhost:8001/api/v1'

# 前端
cd frontend
npm install
npx next dev          # http://localhost:3000
npx next build        # ✅ 通过（7 路由：/ /duihua /path /pinggu /profile /resources /tiku）
npx next lint         # ✅ 通过
```

## 已知 bug / 隐患（动手前必读）

### P0 — 已修复

- ✅ **`duihua/page.tsx` XSS 漏洞** — 已添加 `escapeHtml()` 转义用户输入
- ✅ **`pinggu/page.tsx` 内存泄漏** — `requestAnimationFrame` 已添加 `cancelAnimationFrame` 清理
- ✅ **`resources/page.tsx` 音频筛选缺失** — filter 数组已添加 `'audio'`
- ✅ **`globals.css` CSS 变量偏离** — `--warm` 已改回 `#c47a3a`（琥珀色）

### P1 — 死代码 / 冗余

- **`types/index.ts` + `stores/appStore.ts`** — 9 个 interface + Zustand store 0 引用，和 page 内 local interface 互相漂移，等接 API 时再启用或重写
- **`lib/utils.ts`** — `cn()` 全工程 0 引用；`escapeHtml / markdownToHtml / extractAnswer` 实际在 duihua/profile 页面有引用
- **`package.json`** — 9 个重量级依赖未用（@radix-ui ×5、reactflow、mermaid、react-syntax-highlighter、recharts、swr）
- **`profile/page.tsx:164-244`** — 雷达图用 `svg.innerHTML = html` 字符串拼接，应改为声明式 JSX
- **`{duihua,resources,pinggu}/page.tsx`** 共 7 处 `key={i}` 配排序/前置插入的列表——会触发 React diff 动画重跑

### P2 — 已知老问题

- **pgvector 扩展未装** — Python 包已装，PostgreSQL 扩展未装，embedding 用 JSONB 占位 + Python fallback 余弦相似度
- **`echo=True`** — database.py SQL 日志硬编码，生产需改为 `echo=settings.DEBUG`
- **`tutor.py /generate` 与 `resource.py /generate` 重复** — 待清理
- **router 入参未校验** — `{profile,path,resource,tutor}.py` 全用 query string 接收 `student_id: str`，没 UUID 校验，接库前必须改
- **无 Docker 环境** — PostgreSQL/Redis 需本地安装（D:\2026test\）
- **`requirements.txt` 不完整** — 缺少 loguru/sse-starlette/pymupdf/python-docx/minio 等设计文档依赖
- **`chat/stream` 实现细节**（`backend/app/api/chat.py`）— 先 `_quick_route` 关键词路由兜底，再走 `master_agent.route`；`tutor/chat` 类型直接走 `minimax_client.chat_stream` 拿 token 流，其他类型走 `master_agent.execute`。**`event_generator` 内必须独立 `async_session()`**（不能复用请求 session，否则流式期间锁住表导致写操作 hang）
- **RAG 全链路新增**（`backend/app/services/{embedding_service,vector_store,reranker,anti_hallucination,text_chunker,document_parser}.py`）— 但 `tutor.py` 的 RAG 还未贯通到 SSE 流式（仅 `ask` 接口用），Tutor Agent 的 stream prompt 走的是 LLM 直答
- **前端 5 页面大改未提交** — `duihua` (-180/+426)、`pinggu` (-/+28)、`profile` (-/+72)、`resources` (-/+20)、`tiku` (-/+21)，改完务必先 `npx next build` 验证

### 已修复（不必再查）

- ✅ `database.py:16` 缺 `text()` → commit `c837fe3` 加了
- ✅ `anthropic` 依赖 → 已删
- ✅ `Vector(1536)` → 实际代码用 JSONB 占位（无需改）
- ✅ `minimax_langchain.py` `asyncio.get_event_loop()` → `c837fe3` 改 `get_running_loop()`
- ✅ `resources/page.tsx:313` TS 错误 → `4e4ef25` 已修
- ✅ XSS 漏洞 → 已添加 `escapeHtml()`
- ✅ 内存泄漏 → 已添加 `cancelAnimationFrame`
- ✅ 音频筛选 → 已添加 `'audio'`
- ✅ CSS 变量 → `--warm` 已改回 `#c47a3a`

## 架构与功能要点

### 多智能体协同（Master-Worker）

`/api/v1/chat/stream` 的请求流（`backend/app/api/chat.py:event_generator`）：

```text
请求进入
  ├─ _quick_route(last_msg)        # 关键词命中（"什么是" / "怎么" / "为什么"）→ 直接路由
  │  └─ 未命中 ↓
  ├─ master_agent.route(state)     # LLM 意图分类
  │  ├─ request_type="tutor"       # 走 tutor_agent._build_prompt + STREAM_PROMPT → 真逐 token 流
  │  ├─ request_type="chat"        # 直答 LLM → 真逐 token 流
  │  └─ request_type="document"/"exercise"/"path"/"mindmap"/"profile"
  │                              # → master_agent.execute(state)（同步汇总，仍走 SSE 包 progress + result）
  └─ 流式事件序列：session → progress → token* → result → done
```

7 个子 Agent：
- **Profile Agent** — 对话式画像提取，输出 6 维结构化 JSON（✅ 已实现）
- **Document Agent** — 知识讲解 + 代码示例 + 音频脚本生成 + 防幻觉验证（✅ 已实现）
- **MindMap Agent** — 思维导图生成，输出 Mermaid 代码（✅ 已实现）
- **Exercise Agent** — 练习题生成（选择/判断/简答/编程）+ 防幻觉验证（✅ 已实现）
- **Path Agent** — 学习路径规划，输出知识图谱节点 + 边 + 每日计划（✅ 已实现）
- **Tutor Agent** — RAG 问答 + 评估报告生成（✅ 已实现，`tutor/ask` 走 RAG，`tutor_agent.answer` 流式直答 LLM）
- **Master Agent** — 多 Agent 编排器，LLM 路由分发（✅ 已实现）

### 6 维学生画像（F1）

`student_profiles.dimensions` 用 JSONB 存：`knowledge_mastery / learning_style / cognitive_level / interests / weak_topics / learning_pace`。

### 防幻觉（N3 评分项）— ✅ 已实现

三层验证：
1. **PatternDetector** — 正则模式检测（虚假年份/期刊/统计数据/人物引用/绝对化表述）
2. **SourceValidator** — 来源引用验证（检查引用格式是否有来源支撑）
3. **LLMValidator** — LLM 语义一致性校验（用 LLM 检查事实错误）

已集成到 Document Agent 和 Exercise Agent。

### 流式输出（N1/N4）— ✅ 全部生成接口已接

所有生成场景都已接 `StreamingResponse`：

- `/api/v1/chat/stream` — **真逐 token 流式**（之前是 `agent.run()` 整段返回再 SSE 包），含 `_quick_route` 关键词路由 + `master_agent.route` 兜底
- `/api/v1/resource/generate/stream` — 资源生成 SSE 流式
- `/api/v1/resource/exercises/generate/stream` — 练习题生成 SSE 流式
- `/api/v1/path/generate/stream` — 学习路径 SSE 流式

**真流式 vs 伪流式**：判断标准——前端 `event.data` 里的 `type` 字段。

- `type=token` → 真逐 token 流（chat 现在的实现）
- `type=progress` → 阶段进度推送（resource / exercise / path 仍是这种，因为内部 LLM 调用是同步阻塞）
- 后续要做的：把 `resource_agent / exercise_agent / path_agent` 改成生成器 / `chat_stream` 包装，让 `type=token` 覆盖全部生成接口

- `type=token` → 真逐 token 流（chat 现在的实现）
- `type=progress` → 阶段进度推送（resource / exercise / path 仍是这种，因为内部 LLM 调用是同步阻塞）
- 后续要做的：把 `resource_agent / exercise_agent / path_agent` 改成生成器 / `chat_stream` 包装，让 `type=token` 覆盖全部生成接口

## 前端约定

- **页面（除 `/`）必须加 `'use client'`**——模板 HTML 含 onClick / useState 等运行时逻辑
- **CSS 集中在 `globals.css`**——不动 `tailwind.config.js`（用模板 CSS 变量比 Tailwind 更准）
- **静态数据写在 page.tsx 内**——不拆分 data 文件（联调后改为 API 调用）
- **Sidebar.tsx** 有折叠功能（`useState` + `.collapsed` class），CSS 里有 `.sidebar.collapsed` 样式定义
- **`.next` 缓存损坏**：每次 `npm run build` 后切回 `npm run dev` 常报 `Cannot find module './<id>.js'`。解法：杀掉 node 进程 → `Remove-Item frontend/.next -Recurse` → 重启 dev server。**不是代码 bug**。

## 评分优先级

| 优先级 | 模块 | 占比 | 当前状态 |
|--------|------|------|----------|
| P0 | F1 对话式画像 | 35% | ✅ 后端+前端完成 |
| P0 | F2 多智能体资源生成 | 45% | ✅ MindMap Agent 已实现，前端已联调 |
| P1 | F3 路径 / N3 防幻觉+流式 | 必做 | ✅ 路径完成 + ✅ 防幻觉完成 + ✅ 流式完成 |
| P2 | F4 智能辅导 / F5 效果评估 | 加分 | ✅ Tutor Agent RAG 接入 + ✅ 评估模块完成 |

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
