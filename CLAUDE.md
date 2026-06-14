# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目背景

**智枢 (SmartHub)** —— 第十五届中国软件杯 A3 赛题：基于大模型的个性化资源生成与学习多智能体系统。

- **出题方**：科大讯飞。**硬约束**：必须用讯飞星火 V4 / Embedding / TTS
- **评分占比**：F1 对话式画像 35% + F2 多智能体资源生成 45% + F3 路径规划 + F4/F5 加分
- **非功能项**（技术门槛）：流式输出 / 防幻觉(RAG) / 开源合规
- **课程切入点**：人工智能导论
- **主仓库**：<https://github.com/AbandonS-ED/ZhiShu>

## 仓库现状（2026-06-15）

```
ZhiShu/
├── frontend/                        # Next.js 14.2.5 + Tailwind 3.4 + TypeScript
│   ├── src/app/                     # 学生端 9 页面 + 管理端 9 页面 + 2 布局
│   │   ├── layout.tsx               # 学生端全局布局（Sidebar + Main，/admin /login 跳过）
│   │   ├── globals.css              # 设计系统（米色/墨黑/琥珀，含 admin + set- 样式）
│   │   ├── page.tsx                 # / 仪表盘
│   │   ├── login/                   # 登录/注册页（独立布局）
│   │   ├── duihua/ profile/ resources/ path/ tiku/ pinggu/ setting/  # 7 个学生页面
│   │   └── admin/                   # ⭐ 管理后台（独立布局 + 权限拦截）
│   │       ├── layout.tsx           # 管理后台布局（admin-sb + admin-hd + 退出）
│   │       ├── page.tsx             # /admin 仪表盘
│   │       ├── login/               # /admin/login 管理员登录
│   │       ├── users/               # /admin/users 用户管理（含批量删除）
│   │       ├── resources/           # /admin/resources 资源管理
│   │       ├── exercises/           # /admin/exercises 题库管理（CRUD + 批量导入）
│   │       ├── paths/               # /admin/paths 学习路径
│   │       ├── chats/               # /admin/chats 对话记录
│   │       ├── documents/           # /admin/documents 知识库
│   │       └── agents/              # /admin/agents Agent 监控
│   ├── src/components/layout/        # 学生端 Sidebar + Header
│   ├── src/lib/
│   │   ├── api.ts                   # API 客户端（10 模块 + auth，自动带 token）
│   │   ├── student.ts               # student_id 本地存储（zhishu_student）
│   │   ├── utils.ts                 # cn() + escapeHtml() + markdownToHtml() + extractAnswer()
│   │   ├── admin/context.tsx        # 管理后台共享状态（AdminProvider + useAdmin）
│   │   └── admin/components.tsx     # 管理后台共享组件（AdminCheckbox + BatchDeleteBar + useSelection）
│   ├── src/stores/appStore.ts       # Zustand store（已接入 Sidebar 实时刷新）
│   ├── src/types/index.ts           # TS 类型契约（13 接口）
│   └── .npmrc                       # npmmirror 国内镜像
├── backend/                         # FastAPI + 11 表 + 8 Agent + 10 Router + 13 Service
│   ├── app/main.py                  # 10 router 注册 + lifespan 初始化
│   ├── app/api/                     # 10 router（auth / profile / resource / path / tutor / chat / mindmap / dashboard / evaluation / admin_exercises）
│   ├── app/core/
│   │   ├── config.py                # Settings（MINIMAX_* + SPARK_* + JWT_SECRET + LLM_PROVIDER）
│   │   ├── database.py              # async SQLAlchemy + pgvector 可选
│   │   ├── dependencies.py          # UUID 校验 + get_current_user 门禁
│   │   ├── security.py              # bcrypt 密码哈希 + JWT 生成/验证
│   │   └── celery_config.py         # Celery 配置（未启动 worker）
│   ├── app/models/                  # 11 个 Model
│   │   ├── student.py               # 学生/管理员（student_no + password_hash + role + is_active + last_login）
│   │   ├── student_profile.py       # 5 维 JSONB 画像（理解力/记忆力/应用转化/想象力/专注力 + confidence）
│   │   ├── document_chunk.py        # RAG 文档分块（embedding 用 JSONB 占位）
│   │   ├── resource.py              # 学习资源
│   │   ├── learning_path.py         # DAG 学习路径
│   │   ├── exercise.py              # 练习题（含 source 字段）
│   │   ├── exercise_bank.py         # 公共题库（admin 创建）
│   │   ├── chat_session.py          # 聊天会话
│   │   ├── chat_message.py          # 聊天消息
│   │   ├── learning_record.py       # 学习行为记录（F5 评估）
│   │   └── learning_activity_log.py # 学习行为日志（wyy 独占）
│   ├── app/agents/                  # 8 Agent（StateGraph 10 节点编排）
│   │   ├── state.py                 # AgentState TypedDict + IntentType（11 种意图）
│   │   ├── communicator.py          # MessageBus pub/sub
│   │   ├── initial_assessment_agent.py  # 对话式 5 维画像评估（替换旧 profile_agent）
│   │   ├── document_agent.py        # 知识讲解 + 代码 + 音频脚本 + 防幻觉验证
│   │   ├── exercise_agent.py        # 自适应练习题生成 + 防幻觉验证
│   │   ├── path_agent.py            # 学习路径规划（DAG）
│   │   ├── tutor_agent.py           # RAG 智能问答 + 多轮上下文
│   │   ├── mindmap_agent.py         # 思维导图 Mermaid 生成
│   │   ├── audio_agent.py           # 音频脚本生成
│   │   └── master_agent.py          # LangGraph StateGraph 10 节点
│   ├── app/services/                # 12 个服务（+ agents/communicator.py = 13）
│   │   ├── minimax_client.py        # httpx 直接调用 MiniMax-M3
│   │   ├── minimax_langchain.py     # LangChain BaseChatModel 封装
│   │   ├── spark_client.py          # 讯飞星火 V4 客户端
│   │   ├── anti_hallucination.py    # 三层防幻觉验证
│   │   ├── content_safety.py        # 内容安全
│   │   ├── document_parser.py       # 文档解析器
│   │   ├── embedding_service.py     # 向量化服务
│   │   ├── evaluation_service.py    # 效果评估
│   │   ├── json_parser.py           # JSON 解析工具
│   │   ├── reranker.py              # LLM 语义重排
│   │   ├── text_chunker.py          # 语义切片器
│   │   └── vector_store.py          # pgvector 检索 + JSONB 降级
│   ├── scripts/
│   │   ├── init_db.sql              # 11 张表 + 14 索引 + admin 账号种子数据
│   │   ├── init_admin.py            # 自动 ALTER + bcrypt 哈希 + 创建/重置 admin 账号
│   │   ├── migrate_exercise_bank.sql # 练习题库迁移（已合并到 init_db.sql）
│   │   └── run_migration.py         # 通用迁移执行器
│   └── tests/                       # smoke_test.py + 7 个 pytest（114 测试）+ 6 个 debug
├── docs/                            # 设计文档 / 开发流程 / 交付物 / 赛题需求
│   ├── 设计文档/
│   │   ├── 项目设计文档-完整版.md    # v2.0 完整版
│   │   ├── 项目设计文档.md
│   │   ├── 登录注册方案.md          # 登录注册实现方案
│   │   ├── 多智能体协同升级方案-LangGraph-StateGraph.md
│   │   ├── 管理后台设计文档.md      # ⭐ 管理后台（27 API + 9 页面）
│   │   └── 用户设置页面设计.md
│   ├── 开发流程/  前端设计/  运维测试/  交付物/  资料/  赛题需求/
├── 开发进度.md                       # 实时进度跟踪
├── AGENTS.md                        # 团队协作文档
├── CLAUDE.md                        # 本文件
├── SMOKE_TEST_REPORT.md             # 冒烟测试记录（5 次）
├── README.md                        # 项目 README
└── docker-compose.yml               # postgres+pgvector / redis / minio（未启用）
```

**实际状态（2026-06-15）**：

- ✅ **学生端 9 页面** 1:1 复刻模板 + 9/9 全部接入 API（含登录/注册 + 设置页）
- ✅ **管理后台 9 页面** 1:1 复刻 `houtai.html` 模板 + 批量删除 + 搜索筛选 + 详情弹窗 + **题库 CRUD 已实联 admin_exercises API**
- ✅ 后端完整：**11 表 + 8 Agent + 33 唯一 API 端点** + **13 Service**（含 6 个 auth 端点 + 6 个 admin 端点）
- ✅ **登录注册系统**：bcrypt + JWT + 全 33 个业务端点门禁
- ✅ **管理后台权限**：`role` 字段 + `is_active` + `last_login` + 独立 token (`zhishu_admin_token`)
- ✅ **5 维学生画像**（理解力/记忆力/应用转化/想象力/专注力 + confidence）：由 `initial_assessment_agent` 对话式评估
- ✅ **P0 全部 10 个问题已修复**
- ✅ MiniMax-M3 LLM 端到端验证通过
- ✅ **LangGraph StateGraph 10 节点编排**（master_agent.py 实际节点数）
- ✅ **防幻觉三层验证** + 4 个 SSE 流式端点
- ✅ **RAG 管道**（document_parser → text_chunker → embedding → vector_store.search → reranker）
- ✅ **练习题 dual-format 流式**（markdown + JSON 同传）
- ✅ **端到端冒烟测试 5 次 9/9 PASS**
- ✅ **114 pytest 全过**（7 文件：agents / anti_hallucination / api / json_parser / message_bus / state_graph / strip_think）
- ✅ **多轮对话上下文**（最近 10 条消息）
- ✅ **公共题库系统**（`exercise_bank` 表 + 6 admin 端点 + `/resource/exercises/pool` 题池合并随机抽题）
- ✅ **用户设置页面**（`/setting`：信息编辑 + 修改密码 + 账号信息展示）
- ✅ **对话页出题 → 题库页做题**（StateGraph exercise 保存 DB + 跳转链接 + ?kp= 自动聚焦）
- ✅ **题库页隐藏/清空**（localStorage 隐藏 + 侧边栏恢复 + 清空列表 + ConfirmDialog）
- ✅ **AI 出题数量可选**（分段选择器 5/10/15/20，后端支持 1-50）
- ✅ **答案格式三层防护**（Prompt 规范 + 后端 normalize_answer + 前端 parseAnswer 容错）
- ✅ **题库去重 + 限容**（difflib 相似度 >0.85 判重，每知识点最多 20 道 AI 题）
- ✅ **对话历史 JSON 解析**（前端加载 assistant 消息时自动解析 `answer` 字段）
- ✅ **对话页刷新修复**（sessionId 持久化 + loadSession 渲染修复 + DB content 列改 TEXT）

## 技术栈（已锁定，不要换）

| 层 | 选型 | 备注 |
|---|---|---|
| 前端 | Next.js 14.2.5 (App Router) + Tailwind 3.4 + TypeScript | 无 shadcn/ui，纯自定义 CSS |
| 后端 | FastAPI 0.136 + SQLAlchemy 2.0 async + asyncpg | Python 3.11 |
| Agent | LangGraph StateGraph（13 节点编排 + MessageBus 通信） | 8 Agent 协同 |
| LLM | **双客户端**：`MiniMaxClient`（开发） + `SparkClient`（上线前切） | `LLM_PROVIDER=spark|minimax` 切换 |
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
pip install -i https://pypi.tuna.tsinghua.edu.cn/simple -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8001
# Swagger: http://localhost:8001/docs

# 测试（114 pytest，需 PG 5432）
cd backend && python -m pytest tests/ -v

# 端到端冒烟
cd backend && python -m tests.smoke_test

# 前端
cd frontend && npm install && npm run dev / build / lint
```

**端口**：后端 8001（匹配 `frontend/src/lib/api.ts` 的 `BASE_URL`，**不要用 8000**：Windows 端口僵尸 socket 问题）。

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

- **防幻觉正则太激进**（"Hinton 在 2006 年..." 会被判幻觉）
- **引用匹配逻辑错误**（UUID vs "[1]" 永远不匹配）
- **`print()` 代替 logging**（10+ 处）
- **`markdownToHtml` 不消毒** → XSS 风险 6 处
- **3 套 `Resource` 类型定义**互相漂移
- **3 套 `Exercise` 类型定义**互相漂移
- **13 处 `alert()`** 替代品
- **`chatApi.stream` 无超时/重试**
- **Spark client 默认 base_url 指向智谱**（非讯飞）
- **SSE 实现 4 处重复**（resource/exercise/path/chat）
- **DB schema 漂移**：老 DB 不会自动迁移 `exercise_bank` 表和 `exercises.source` 列。修法：删 `DROP DATABASE zhishu` 重跑 `init_db.sql`，或手动执行 `migrate_exercise_bank.sql`。
- **`requirements.txt` 列出 `bcrypt>=4.0.0` 但旧 venv 没装**——clone 仓库后第一次 `pip install -r requirements.txt` 即可。
- **`profile_agent` 调 LLM 报 `'HumanMessage' object is not subscriptable`** → ✅ **已重写**为 `initial_assessment_agent`（wyy 合并 PR，2026-06-13）

### P2 — 清理项

- 缺外键约束
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
- ✅ StateGraph 从 if-else 升级为 10 节点编排
- ✅ UUID 校验统一依赖（2026-06-10）
- ✅ `_strip_think` 死代码回滚（2026-06-10）
- ✅ profile/resources/pinggu 硬编码替换（2026-06-10）
- ✅ learning_records 建表 + recordAction（2026-06-10）
- ✅ `embed_text` → `embed_single`（2026-06-10）
- ✅ 登录注册系统（2026-06-11）：bcrypt 密码哈希 + JWT + 全路由门禁
- ✅ CSS `@keyframes fadeIn` 缺失（2026-06-11）：登录页右侧表单不可见
- ✅ `get_current_user` 门禁覆盖全部业务端点（2026-06-11）
- ✅ SSE stream 方法全部加 Authorization 头（2026-06-11）
- ✅ `chat.py` StateGraph final_state 累积 bug 修复（2026-06-11）
- ✅ 多轮对话上下文支持（2026-06-11）
- ✅ **管理后台前端 9 页面 + 学生端布局隔离**（2026-06-11）
- ✅ **管理后台后端权限基础设施**（2026-06-11）
- ✅ **管理后台批量删除**（2026-06-11）
- ✅ **管理后台登出按钮统一样式**（2026-06-11）
- ✅ **admin_exercises 题库 CRUD**（6 个端点：列表/创建/批量导入/编辑/删除/知识点列表）
- ✅ **练习题 pool 端点**（`GET /resource/exercises/pool`）
- ✅ **auth 新端点**（`GET /me`、`PUT /me`、`POST /change-password`）
- ✅ **设置页面**（`/setting` 个人信息编辑 + 修改密码）
- ✅ **init_db.sql 合并 exercise_bank 表 + exercises.source 列**（2026-06-13）
- ✅ **models/__init__.py 补 LearningRecord 导出**（2026-06-13）
- ✅ **`profile_agent` → `initial_assessment_agent` 重构**（2026-06-13）：5 维画像 + confidence，wyy 合并 PR
- ✅ **`models/learning_activity_log.py` 新模型**（2026-06-13）：wyy 独占，学习行为日志
- ✅ **MD 全量同步**（2026-06-14）：端点 39→33、节点 13→10、端口 8000→8001、测试 119→114
- ✅ **对话页出题 → 题库页做题**（2026-06-15）：StateGraph exercise 保存 DB + 跳转链接 + ?kp= 自动聚焦
- ✅ **题库页隐藏/清空**（2026-06-15）：localStorage 隐藏 + 侧边栏恢复 + 清空列表 + ConfirmDialog
- ✅ **AI 出题数量可选**（2026-06-15）：分段选择器 5/10/15/20，后端支持 1-50
- ✅ **答案格式三层防护**（2026-06-15）：Prompt 规范 + 后端 normalize_answer + 前端 parseAnswer 容错
- ✅ **题库去重 + 限容**（2026-06-15）：difflib 相似度 >0.85 判重，每知识点最多 20 道 AI 题
- ✅ **对话历史 JSON 解析**（2026-06-15）：前端加载 assistant 消息时自动解析 answer 字段
- ✅ **首页 dashboard student_id 修复**（2026-06-15）：传入真实 student_id 而非硬编码默认值
- ✅ **对话页刷新修复**（2026-06-15）：① sessionId localStorage 持久化（刷新自动恢复上次会话）② loadSession 渲染修复（rendered 统一 false + strip think 标签 + JSON 解析失败兜底）③ chat_messages.content VARCHAR(10000) → TEXT（避免长回复截断）

## 架构与功能要点

### 多智能体编排（10 节点 StateGraph）

```
intent_recognition → task_planning → conditional_route
  → 5 个 Agent 节点（document / mindmap / exercise / path / tutor / audio 任选）
  → result_aggregation → response_generation
```

`master_agent.py` 实际节点：`intent_recognition` + `task_planning` + 5 个 `run_*_agent`（document / mindmap / exercise / path / tutor / audio，实际是 6 个） + `result_aggregation` + `response_generation` = **10 个节点**（不是 13）。`run_audio_agent` 在代码中存在但通常不被 conditional_route 选择。

### 登录注册系统

```
注册：POST /auth/register → bcrypt 哈希密码 → 存入 students.password_hash → 返回 JWT
登录：POST /auth/login → bcrypt 校验密码 → 检查 is_active → 记录 last_login → 返回 JWT
验证：Authorization: Bearer <token> → decode_token() → get_current_user() 依赖
门禁：33 个业务端点全部加 Depends(get_current_user) + student_id 所有权校验
公开：/auth/login、/auth/register、/mindmap/examples（无需 token）
```

- 密码哈希：`bcrypt`（`core/security.py`）
- JWT：标准 HS256 格式，7 天过期，密钥从 `JWT_SECRET` 环境变量读取
- 前端：`api.ts` 的 `request()` 自动带 `Authorization: Bearer` 头，401 自动跳登录页

### 管理后台系统

```
路由：/admin/* (前缀匹配，与学生端完全隔离)
布局：admin/layout.tsx 跳过 RootLayout 的 AppShell（Sidebar + Header）
Token：zhishu_admin_token（与学生端 zhishu_token 隔离，避免误操作）
登录：/admin/login → 调用 /auth/login → 校验 role === 'admin' → 存 zhishu_admin_user
权限：role 字段（student / admin）+ is_active 软删除 + last_login 记录
登出：admin/layout.tsx 底部登出按钮（与学生端样式一致）→ 清 token → 跳 /admin/login
题库 CRUD：admin_exercises.py 6 个端点（列表/创建/批量导入/编辑/删除/知识点列表）
```

- 数据库：`students` 表加 `role/is_active/last_login` 字段 + `idx_students_role` 索引
- 初始化：运行 `venv\Scripts\python scripts\init_admin.py`（自动 ALTER + bcrypt 哈希 + 创建/重置 admin 账号）
- 默认管理员：`student_no=admin`, `password=admin123`, `role=admin`
- 前端共享：`lib/admin/context.tsx`（AdminProvider + useAdmin）+ `lib/admin/components.tsx`（AdminCheckbox + BatchDeleteBar + useSelection）
- 批量删除：6 个列表页（users/resources/exercises/paths/chats/documents）支持多选 + 二次确认 + 取消选择

### 请求处理流程

```
用户输入 → chat/stream (SSE)
  → _quick_route() 关键词快速路由
    → tutor/chat: 真逐 token 流式（支持 RAG + 多轮上下文）
    → 其他意图: StateGraph 13 节点编排
```

### 多轮对话上下文

- `_handle_tutor_chat_stream` 和 `tutor_agent.answer()` 都传 `history`（最近 10 条）给 LLM
- assistant 消息在 DB 里是 JSON `{"type":"tutor","data":{...}}`，需要解析出 `answer` 字段
- short message（<15 字）默认走 tutor 真流式

### 5 维学生画像（F1）

`student_profiles.dimensions` JSONB：`comprehension / memory / application / imagination / focus`（理解力/记忆力/应用转化/想象力/专注力），每个维度含 `score` (0-100) 和 `confidence` (0-1)，由 `initial_assessment_agent.py` 通过对话评估生成（**wyy 重构 2026-06-13**，替换旧的 `profile_agent`）。

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

所有 stream 方法必须手动加 `Authorization: Bearer` 头。

### 练习题 dual-format 流式协议

LLM 一份输出 = 人类可读 markdown + `---JSON_DATA---` + 结构化 JSON。后端实时推 markdown，遇分隔符停止 emit token，结尾解析 JSON。

### 数据库表关系（10 张表）

`students` 1:N `student_profiles` / `chat_sessions` / `resources` / `learning_paths` / `exercises` / `learning_records`

`exercise_bank`：公共题库（admin 创建，独立于学生）

## 前端约定

- **所有页面必须加 `'use client'`**
- **CSS 集中在 `globals.css`**——不动 `tailwind.config.js`
- **CSS 命名空间隔离**：学生端 `.card`/`.chat-main`/`.stat`/`.btn`，管理端 `admin-*` 前缀
- **静态数据写在 page.tsx 内**（联调后改为 API 调用）
- **`.next` 缓存损坏**：`npm run build` 后切 `npm run dev` 报错 → 删 `.next` → 重启
- **student_id**：从 `localStorage.getItem('zhishu_student')` 读取（登录时存入），不是随机 UUID
- **XSS 防护**：用户输入使用 `escapeHtml()` 转义
- **Markdown 渲染**：自定义 `markdownToHtml()`，不依赖 react-markdown
- **管理后台**：独立 `zhishu_admin_token` 存储，`/admin/login` 校验 `role === 'admin'`
- **批量删除复用**：`useSelection` Hook + `BatchDeleteBar` + `AdminCheckbox` 共享组件

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
