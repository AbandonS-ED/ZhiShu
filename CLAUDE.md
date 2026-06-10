# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目背景

**智枢 (SmartHub)** —— 第十五届中国软件杯 A3 赛题：基于大模型的个性化资源生成与学习多智能体系统。

- **出题方**：科大讯飞。**硬约束**：必须用讯飞星火 V4 / Embedding / TTS
- **评分占比**：F1 对话式画像 35% + F2 多智能体资源生成 45% + F3 路径规划 + F4/F5 加分
- **非功能项**（技术门槛）：流式输出 / 防幻觉(RAG) / 开源合规
- **课程切入点**：人工智能导论
- **主仓库**：<https://github.com/AbandonS-ED/ZhiShu>

## 仓库现状（2026-06-10）

```
ZhiShu/
├── frontend/                        # Next.js 14.2.5 + Tailwind 3.4 + TypeScript
│   ├── src/app/                     # 7 页面：/ /duihua /profile /resources /path /tiku /pinggu
│   │   ├── layout.tsx               # 模板风 .app 布局：Sidebar + Main
│   │   ├── page.tsx                 # / 仪表盘（'use client'）
│   │   ├── globals.css              # 模板设计系统（米色/墨黑/琥珀）
│   │   ├── duihua/page.tsx          # SSE 流式 + Master Agent 路由
│   │   ├── profile/page.tsx         # 6 维画像 + AI 弹窗（真实数据派生）
│   │   ├── resources/page.tsx       # SSE 流式生成 + API 资源合并网格
│   │   ├── path/page.tsx            # DAG 路径 + SSE 流式
│   │   ├── tiku/page.tsx            # 练习题 + SSE 流式
│   │   └── pinggu/page.tsx          # AI 评估（图表数据驱动）
│   ├── src/components/layout/
│   │   ├── Sidebar.tsx              # 7 项菜单，可折叠
│   │   └── Header.tsx               # 60px 玻璃拟态 + 动态页面标题
│   ├── src/lib/
│   │   ├── api.ts                   # API 客户端（8 模块）
│   │   ├── student.ts               # student_id 本地存储
│   │   └── utils.ts                 # cn() + escapeHtml() + markdownToHtml() + extractAnswer()
│   ├── src/app/profile/ChatModal.tsx # 对话式画像提取弹窗
│   ├── src/stores/appStore.ts       # Zustand store（暂未使用）
│   ├── src/types/index.ts           # TS 类型契约（暂未使用）
│   ├── src/app/fonts/               # 本地 woff 字体
│   └── .npmrc                       # npmmirror 国内镜像
├── backend/                         # FastAPI + 9 表 + 8 Agent + 23 唯一 API + 12 Service + 8 Router
│   ├── app/main.py                  # 8 router 注册 + lifespan 初始化
│   ├── app/api/                     # 8 router
│   ├── app/core/                    # config.py / database.py / dependencies.py / celery_config.py
│   ├── app/models/                  # 9 个 Model
│   ├── app/agents/                  # 8 Agent + StateGraph 编排
│   │   ├── state.py                 # AgentState TypedDict + IntentType
│   │   ├── communicator.py          # MessageBus pub/sub
│   │   └── master_agent.py          # LangGraph StateGraph 13 节点
│   ├── app/services/                # 12 个服务
│   ├── scripts/init_db.sql          # 手动建库 + 建表脚本
│   └── tests/                       # 7 个 test_*.py（119 pytest）+ smoke_test.py + 6 个 debug_*.py
├── docs/                            # 赛题需求 / 设计文档 / 开发流程 / 运维测试 / 交付物
├── 开发进度.md                       # 实时进度跟踪
├── AGENTS.md                        # 团队协作文档
├── CLAUDE.md                        # 本文件
├── SMOKE_TEST_REPORT.md             # 三次冒烟测试记录
├── README.md                        # 项目 README
└── docker-compose.yml               # postgres+pgvector / redis / minio
```

**实际状态（2026-06-10）**：

- ✅ 前端 7 页面 **1:1 复刻模板** + **7/7 全部接入 API**
- ✅ 后端完整：**9 表 + 8 Agent + 23 唯一 API 端点** + **12 Service**
- ✅ **P0 全部 10 个问题已修复**（UUID 校验 / learning_records 建表+recordAction / embed_text 拼写 / 前端 3 页面硬编码替换）
- ✅ MiniMax-M3 LLM 端到端验证通过
- ✅ **LangGraph StateGraph 多智能体编排**（13 节点）
- ✅ **防幻觉三层验证**（N3 必做项）
- ✅ **SSE 流式输出**（4 个流式端点）
- ✅ **RAG 管道**（文档解析 → 语义切片 → Embedding → 向量检索 → LLM 重排）
- ✅ **练习题 dual-format 流式**（markdown + JSON 双输出）
- ✅ **端到端冒烟测试**3 次验证：2026-06-09 / 2026-06-10 17:29 / 2026-06-10 20:30
- ✅ **119 pytest 全过**（test_state_graph 25 + test_agents 31 + test_anti_hallucination 19 + test_message_bus 12 + test_json_parser 11 + test_strip_think 11）

## 技术栈（已锁定，不要换）

| 层 | 选型 | 备注 |
|---|---|---|
| 前端 | Next.js 14.2.5 (App Router) + Tailwind 3.4 + TypeScript | 无 shadcn/ui，纯自定义 CSS |
| 后端 | FastAPI 0.136 + SQLAlchemy 2.0 async + asyncpg | Python 3.11 |
| Agent | LangGraph StateGraph（13 节点编排 + MessageBus 通信） | 8 Agent 协同 |
| LLM | **双客户端**：`MiniMaxClient`（开发） + `SparkClient`（上线前切） | `LLM_PROVIDER=spark\|minimax` 切换 |
| 向量库 | pgvector（Python 包已装，PG 扩展未装） | embedding 用 JSONB 占位 + 余弦相似度降级 |
| 数据库 | PostgreSQL 18 + Redis（本地安装） | MinIO AGPL-3.0 需 LICENSE |

## 中国网络约束（必读）

**Google 服务不可达**——`next/font/google` / Vercel / Sentry / OpenAI 全部失败。

- **字体**：本地 woff + `next/font/local`
- **npm registry**：`frontend/.npmrc` 已配 `registry.npmmirror.com`
- **PyPI**：`pip install -i https://pypi.tuna.tsinghua.edu.cn/simple`
- **讯飞鉴权**：`Authorization: Bearer {api_key}`，**不要拼 api_secret**

## 命令

```bash
# 数据库初始化（只需一次）
psql -U postgres -f backend/scripts/init_db.sql

# 后端
cd backend && python -m venv venv && venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8001
# Swagger: http://localhost:8001/docs

# 测试（120 pytest，需 PG 5432 + Redis 6379）
cd backend && python -m pytest tests/ -v

# 端到端冒烟
cd backend && python -m tests.smoke_test

# 前端
cd frontend && npm install && npm run dev / build / lint
```

**端口**：后端 8001（匹配 `frontend/src/lib/api.ts` 的 `BASE_URL`）。8000 Windows 僵尸 socket，绕开。

## 已知 bug / 隐患（动手前必读）

### P0 — 全部已修复（2026-06-10）

| # | 问题 | 修复方式 |
|---|---|---|
| 1 | `learning_records` 表不存在 | init_db.sql + create_all |
| 2 | `recordAction` 从未调用 | 前端 5 处调用 |
| 3 | `/tutor/ask` 调 `embed_text` | 改为 `embed_single` |
| 4 | UUID 校验缺失 | 新建 `dependencies.py` + 7 router |
| 5 | `Exercise.is_correct` 永远 None | 被 P0-1+2 覆盖 |
| 6 | SSE error 无 done | 误报，全部已存在 |
| 7 | `_strip_think` 吞内容 | 原状态机正确，回滚死代码 |
| 8 | profile 页硬编码 | 改为 `realProfile` 派生 |
| 9 | resources 页硬编码 | API 资源合并入网格 |
| 10 | pinggu 页硬编码 | 图表改为 props 传入 |

### P1 — 未修

- **`chat_message.content` 存 JSON 字符串** → 历史消息显示原始 JSON
- **防幻觉正则太激进**（"Hinton 在 2006 年..." 会被判幻觉）
- **引用匹配逻辑错误**（UUID vs "[1]" 永远不匹配）
- **`print()` 代替 logging**（10+ 处）
- **`markdownToHtml` 不消毒** → XSS 风险 6 处
- **3 套 `Resource` 类型定义**互相漂移
- **3 套 `Exercise` 类型定义**互相漂移
- **13 处 `alert()`** 替代品
- **`appStore.ts` Zustand 0 引用**
- **`chatApi.stream` 无超时/重试**
- **Spark client 默认 base_url 指向智谱**（非讯飞）
- **SSE 实现 4 处重复**（resource/exercise/path/chat）

### P2 — 清理项

- 缺数据库索引（`student_id` 在 5+ 张表）
- 缺外键约束
- `chat_messages.content VARCHAR(10000)` 太小
- `Resource.resource_type` 永远存 "knowledge"
- dashboard `learning_hours` 是 heuristic
- `gen_random_uuid()` 需 pgcrypto
- 5 处 `useState<any>`

### 已修复（不必再查）

- ✅ `database.py:3` 缺 `text()` → commit `c837fe3`
- ✅ 前端 XSS 漏洞 → 已加 `escapeHtml()`
- ✅ 内存泄漏 → 已加 `cancelAnimationFrame`
- ✅ 音频筛选 → 已加 `'audio'`
- ✅ CSS 变量 → `--warm` 改回 `#c47a3a`
- ✅ `echo=True` → `echo=settings.DEBUG`
- ✅ `tutor.py` 重复 `/generate` 已删
- ✅ MindMap Agent 加重试
- ✅ 防幻觉扩展到 6 个 Agent
- ✅ smoke_test 修复（TIMEOUT 120s, StepFailed）
- ✅ StateGraph 从 if-else 升级为 13 节点编排
- ✅ UUID 校验统一依赖（2026-06-10）
- ✅ `_strip_think` 死代码回滚（2026-06-10）
- ✅ profile/resources/pinggu 硬编码替换（2026-06-10）
- ✅ learning_records 建表 + recordAction（2026-06-10）
- ✅ `embed_text` → `embed_single`（2026-06-10）

## 架构与功能要点

### 多智能体编排（13 节点 StateGraph）

```
intent_recognition → task_planning → conditional_route
  → 7 子 Agent（串行/并行）
  → result_aggregation → response_generation
```

### 请求处理流程

```
用户输入 → chat/stream (SSE)
  → _quick_route() 关键词快速路由
    → tutor/chat: 真逐 token 流式（支持 RAG）
    → 其他意图: StateGraph 13 节点编排
```

### 6 维学生画像（F1）

`student_profiles.dimensions` JSONB：`knowledge_mastery / learning_style / cognitive_level / interest / weak_topics / learning_pace`

### 防幻觉（N3 评分项）

三层验证：PatternDetector → SourceValidator → LLMValidator。6 个 Agent 已接入。

### 流式输出（N1/N4）

| 路由 | 类型 | 方式 |
|---|---|---|
| `/api/v1/chat/stream` (tutor/chat) | ✅ **真流式** | `type=token` 逐 token |
| `/api/v1/chat/stream` (exercise) | ✅ **真流式** | dual-format 协议 |
| `/api/v1/resource/generate/stream` | ✅ **真流式** | `type=token` 逐 token |
| `/api/v1/resource/exercises/generate/stream` | ✅ **真流式** | dual-format |
| `/api/v1/path/generate/stream` | ⚠️ **伪流式** | progress + result |

### 练习题 dual-format 流式协议

LLM 一份输出 = 人类可读 markdown + `---JSON_DATA---` + 结构化 JSON。后端实时推 markdown，遇分隔符停止 emit token，结尾解析 JSON。

### 数据库表关系

`students` 1:N `student_profiles` / `chat_sessions` / `resources` / `learning_paths` / `exercises` / `learning_records`

## 前端约定

- **页面（除 `/`）必须加 `'use client'`**
- **CSS 集中在 `globals.css`**——不动 `tailwind.config.js`
- **静态数据写在 page.tsx 内**（联调后改为 API 调用）
- **`.next` 缓存损坏**：`npm run build` 后切 `npm run dev` 报错 → 删 `.next` → 重启

## 评分优先级

| 优先级 | 模块 | 占比 | 当前状态 |
|---|---|---|---|
| P0 | F1 对话式画像 | 35% | ✅ 完成 |
| P0 | F2 多智能体资源生成 | 45% | ✅ 完成 |
| P1 | F3 路径 / N3 防幻觉+流式 | 必做 | ✅ 完成 |
| P2 | F4 智能辅导 / F5 效果评估 | 加分 | ✅ 完成 |

## 写新功能前先看

- [docs/设计文档/项目设计文档-完整版.md](docs/设计文档/项目设计文档-完整版.md)
- [AGENTS.md](AGENTS.md)
- [开发进度.md](开发进度.md)

## 提交规范

`feat:` / `fix:` / `refactor:` / `docs:` / `chore:` / `test:`

- 涉及评分项（流式/防幻觉/多智能体）的改动附 1-2 句说明
- 涉及讯飞 API 的改动标注是哪个 API
- **勿提交** `.env` / `venv/` / `node_modules/`
- CRLF/LF 警告是 Windows 正常现象，**不要**试图修
