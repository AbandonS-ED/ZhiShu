# AGENTS.md — 智枢 (ZhiShu)

> 最后更新：2026-06-15（端点 33 / StateGraph 10 节点 / 5 维画像 / 114 pytest / 对话页刷新修复）

中国软件杯 A3 赛题：多智能体个性化学习资源生成系统。

**首次进入先读**：`README.md`（项目概览）→ `CLAUDE.md`（架构 + 已修复 + 踩坑）→ `开发进度.md`（实时进度 + 演示路径）。更细的模块设计在 `docs/设计文档/`。

## 硬约束

- **LLM**：开发用 MiniMax-M3，base_url `https://api.minimax.chat/v1`（**没有 `i`**，不是 `minimaxi`）。比赛上线前切讯飞星火 V4：`LLM_PROVIDER=spark` + `SPARK_API_KEY=xxx`。讯飞鉴权：`Authorization: Bearer {api_key}`，**不拼 api_secret**。
- **禁用** Google Fonts / Vercel / Sentry / OpenAI（中国不可达）。字体走 `frontend/src/app/fonts/` 本地 woff + `next/font/local`。
- **pip** 加 `-i https://pypi.tuna.tsinghua.edu.cn/simple`；npm 走 `frontend/.npmrc` 的 `registry.npmmirror.com`。
- **勿提交** `.env` / API 密钥 / `venv/` / `node_modules/`（`.gitignore` 已配，提交前再扫一眼）。
- **bcrypt 锁版本**：`backend/requirements.txt` 写 `bcrypt>=4.0.0`，克隆后第一次 `pip install` 即可。**不要引入 passlib**（与新版 bcrypt 后端冲突），项目里只用 `import bcrypt`。
- **端口**：后端用 **8001**（不要 8000），前端用 3000。`api.ts:5` 的 `BASE_URL` 已同步。

## 仓库结构

```
ZhiShu/
├── frontend/   Next.js 14.2.5 + Tailwind + 自定义 CSS（无 UI 组件库）
│   └── src/app/
│       ├── layout.tsx           全局布局，NO_SHELL_ROUTES=['/login','/admin']
│       ├── globals.css           学生端 + 管理端（admin-* 命名空间隔离）样式
│       ├── {page}.tsx            学生端 9 页面（含 setting）+ login
│       └── admin/                管理后台：独立 layout + 9 页面 + lib/admin/* 共享组件
├── backend/    FastAPI + SQLAlchemy 2.0 async + 8 Agent
│   ├── app/
│   │   ├── main.py               10 router 注册 + lifespan
│   │   ├── api/                  10 router（auth/profile/resource/path/tutor/chat/mindmap/dashboard/evaluation/admin_exercises）= 33 唯一端点
│   │   ├── agents/               master_agent.py (StateGraph 10 节点) + 7 子 Agent + initial_assessment_agent + state + communicator
│   │   ├── models/               11 个 SQLAlchemy Model（含 exercise_bank + learning_record + learning_activity_log）
│   │   ├── services/             12 个 Service（LLM 客户端 / 防幻觉 / RAG / 安全）
│   │   └── core/                 config / database / security (bcrypt+JWT) / dependencies (门禁) / celery_config (未启用)
│   ├── scripts/
│   │   ├── init_db.sql           建库 + 11 张表 + 14 索引 + admin 种子
│   │   ├── init_admin.py         ⭐ 自动 ALTER + bcrypt 哈希 + 创建/重置 admin 账号
│   │   ├── migrate_exercise_bank.sql  练习题库迁移（已合并到 init_db.sql）
│   │   └── run_migration.py      通用迁移执行器
│   ├── tests/                    smoke_test.py + 7 pytest (114) + 6 debug
│   ├── pytest.ini                asyncio_mode=auto, testpaths=tests
│   └── requirements.txt
├── docs/                          设计文档 / 开发流程 / 运维测试 / 交付物 / 资料 / 赛题需求
├── 开发进度.md / SMOKE_TEST_REPORT.md
└── docker-compose.yml             postgres+pgvector / redis / minio（全部未启用）
```

**前端 `package.json` 装了但未使用**（不要新增依赖）：`@radix-ui/*`（6 个）、`class-variance-authority`、`clsx`、`tailwind-merge`、`lucide-react`、`reactflow`、`mermaid`、`recharts`、`react-markdown`、`react-syntax-highlighter`、`rehype-highlight`、`zustand`、`swr`。模板 1:1 复刻用纯自定义 CSS，不引 UI 库。**zustand 已接入 Sidebar 实时刷新 student**。

## 命令（按顺序）

```bash
# 1. 首次建库 + 表（只需一次）
psql -U postgres -f backend/scripts/init_db.sql

# 2. 初始化/重置管理员账号（只需一次，可重复跑；PowerShell 调 init_admin.py 绕开 $2b$ 插值坑）
cd backend && venv\Scripts\python scripts\init_admin.py
# → 创建/更新 admin / admin123 / role=admin

# 3. 后端（必须 8001，不要 8000：Windows 端口僵尸 socket 坑）
cd backend
python -m venv venv && venv\Scripts\activate
pip install -i https://pypi.tuna.tsinghua.edu.cn/simple -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8001   # Swagger: http://localhost:8001/docs

# 4. 前端（.npmrc 已配 registry.npmmirror.com，无需额外设置）
cd frontend && npm install
npm run dev       # http://localhost:3000（学生端）
# http://localhost:3000/admin/login（管理端，admin/admin123）

# 5. 测试（不需要 Redis；pytest 用真 PG；pytest.ini 配了 asyncio_mode=auto）
cd backend && python -m pytest tests/ -v            # 114 个测试
cd backend && python -m tests.smoke_test            # 端到端 9 API（耗时 5-10 分钟）
cd frontend && npm run lint                          # 0 errors
cd frontend && npm run build                         # 18 路由编译
```

**启动顺序**：必须先起后端，前端才能登录。否则 `/auth/login` 报网络错误。

## 路由隔离（容易踩）

- 根 `app/layout.tsx` 维护 `NO_SHELL_ROUTES=['/login','/admin']`，让 admin 跳过学生端 Sidebar/Header，走自己的 `admin/layout.tsx`。**新增独立路由时**记得把前缀加进 `NO_SHELL_ROUTES`。
- **学生端 token**：`zhishu_token` / `zhishu_student`（JSON 对象含 `id`）/ `zhishu_refresh_token`。
- **管理端 token**：`zhishu_admin_token` / `zhishu_admin_user`。**两套完全隔离**，避免管理员误操作学生数据。

## 踩过的坑（不修会卡住）

- **`.next` 缓存损坏**：`npm run build` 后切 `npm run dev` 报 `Cannot find module` → 杀 node → `Remove-Item frontend/.next -Recurse` → 重启。
- **Windows 8000 端口僵尸 socket**：进程死后端口还被内核占着，`taskkill` / `Get-NetTCPConnection` 都看不到。**直接用 8001**，同步改 `frontend/src/lib/api.ts:5` 的 `BASE_URL`。
- **PowerShell `$2b$` 变量插值**：在 PowerShell 命令行直接传 `'$2b$12$...'` 会被 shell 解析为变量，破坏 bcrypt 哈希。**用 `init_admin.py` 绕开**。
- **PowerShell 终端 GBK**：LLM 输出含 emoji 会让 `print` 报 `UnicodeEncodeError`。`smoke_test.py` 已用 `io.TextIOWrapper(..., errors="replace")` 兜底。
- **CRLF/LF 警告**：Windows 正常现象，不要修。
- **pgvector 扩展未装**：Python 包已装，PostgreSQL 扩展未装。`embedding` 暂用 JSONB 占位，向量检索降级为 Python 余弦相似度。
- **`chat.py` event_generator 必须独立 `async_session()`**：复用请求 session 会导致流式期间锁住表，写操作 hang。RAG 检索用 `db_async_session()` 独立 session。
- **`chat.py` StateGraph `final_state` 累积 bug**：`astream` 只返回每个节点的输出，`final_state = node_output` 会丢失之前节点的结果。**必须用 `final_state.update(node_output)` 累积**。
- **SSE stream 方法漏带 token**：`chatApi.stream()` / `resourceApi.generateStream()` / `exerciseApi.generateStream()` / `pathApi.generateStream()` 用原生 `fetch`，**每个都要手动加 `Authorization: Bearer ${token}`**，否则 401 全失败。
- **`student.ts` localStorage key**：登录数据存 `zhishu_student`（JSON 对象含 `id`），**不是** `zhishu_student_id`（随机 UUID，老版本）。`getStudentId()` 必须从 `zhishu_student` 读取再 `JSON.parse`。
- **对话页刷新丢失会话**：`sessionId` 存在 React state 中，刷新即丢失。**必须用 localStorage 持久化**（`zhishu_chat_session`），组件挂载时自动调用 `loadSession` 恢复。
- **`loadSession` 渲染问题**：从 DB 加载历史消息时，`rendered` 必须统一为 `false`，让 `markdownToHtml` 始终渲染。如果 `rendered=true`，markdown 原文会直接显示（不含 HTML 渲染）。
- **`chat_messages.content` VARCHAR(10000) 截断**：长回复的 JSON 超过 10000 字符时 PostgreSQL 报错，消息无法保存。**必须改为 `Text` 类型**。迁移：`ALTER TABLE chat_messages ALTER COLUMN content TYPE TEXT`。
- **`.next` 缓存 + `.next/static/css` 动画缺失**：`globals.css` 缺 `@keyframes fadeIn` 导致登录页右侧表单 `opacity:0` 不可见。已有 keyframes 兜底。
- **根 layout 与 `/admin` 共用**：Next.js 根 `layout.tsx` 会被所有路由继承，**`NO_SHELL_ROUTES` 必须加 `/admin`** 让 admin 走自己的 layout，否则学生端 Sidebar 也会显示。

## 架构要点

- **10 router / 33 唯一 API / 8 Agent / 11 Model / 12 Service + MessageBus / 114 pytest**
- **请求路由**（`chat.py`）：`_quick_route()` 关键词匹配 → 匹配到走对应 handler，没匹配到走 StateGraph（Master Agent）。**短消息（<15字）默认走 tutor 真流式**。
- **StateGraph 编排**（`agents/master_agent.py`）：**10 节点** LangGraph（intent_recognition → task_planning → conditional_route → 6 个 Agent 节点（document / mindmap / exercise / path / tutor / audio）→ result_aggregation → response_generation）。**tutor/chat 走原路径真逐 token 流式**，其他意图走 StateGraph。
- **对话页出题 → 题库页做题**：对话页 StateGraph exercise 意图生成题目后，自动保存到 `exercises` 表（含去重 + 限容 20 道），回复末尾追加 `[👉 点击前往题库作答](/tiku?kp=xxx)` 跳转链接。题库页读取 `?kp=` 参数自动填入知识点。
- **5 维学生画像**（`initial_assessment_agent.py`）：理解力 / 记忆力 / 应用转化 / 想象力 / 专注力，每个维度含 `score` (0-100) + `confidence` (0-1)。**wyy 重构于 2026-06-13**，替换旧的 `profile_agent`。
- **多轮对话上下文**：`_handle_tutor_chat_stream` 和 `tutor_agent.answer()` 都传 `history`（最近 10 条）给 LLM。assistant 消息在 DB 里是 JSON（`{"type":"tutor","data":{...}}`），前端加载历史时自动解析 `answer` 字段。**对话页 sessionId 持久化 localStorage**，刷新后自动恢复上次会话。
- **`<think>` 标签过滤**：`chat.py` 的 `_strip_think` 状态机是流式期间**必须**的，否则会吞前端渲染。
- **防幻觉**（`services/anti_hallucination.py`）：6 个 Agent 都接 `validate()`（Document/Exercise 走完整三层，Profile/Path/MindMap/Tutor 走 `skip_llm=True` 快速模式）。
- **RAG 管道**：`document_parser` → `text_chunker` → `embedding_service` → `vector_store.search`（pgvector + JSONB fallback）→ `reranker`。`tutor.py` 的 `/ask` 和 `chat/stream` 的 tutor 分支都走完整流程。
- **SSE 流式**：4 个真流式端点（chat/stream、resource/generate/stream、resource/exercises/generate/stream、path/generate/stream）+ 1 个伪流式（profile/assess/stream）。所有 stream 方法**必须手动加 `Authorization` 头**。
- **登录注册**（`core/security.py`）：`bcrypt` 密码哈希 + JWT（HS256，7 天过期，密钥从 `JWT_SECRET` 环境变量读取）。全 33 个业务端点加 `Depends(get_current_user)` 门禁（`core/dependencies.py`）。前端 `api.ts` 的 `request()` 自动带 token，401 自动跳登录页。**`/auth/login` 和 `/auth/register` 不触发 401 自动跳转**。
- **管理后台**：`/admin` 路由独立 layout（`NO_SHELL_ROUTES`），token 隔离（`zhishu_admin_token`），admin 账号用 `role='admin'` 字段校验，禁用通过 `is_active=false` 实现。批量删除通过共享 `useSelection` Hook + `BatchDeleteBar` 组件（`lib/admin/components.tsx`）。管理端题库 CRUD 通过 `admin_exercises.py` 6 个端点实现。
- **会话删除**：`DELETE /chat/sessions/{session_id}` 删会话及所有消息，含所有权校验。
- **公共题库**：`exercise_bank` 表（11 字段 + 3 索引），admin 端点 `/api/v1/admin/exercises/*`（6 端点），学生端 `/resource/exercises/pool` 合并 `exercise_bank` + `exercises` 表随机抽题。
- **题库页隐藏/清空**：纯前端 localStorage 实现（`HIDDEN_KEY = 'zhishu_hidden_exercises'`）。每道题右下角 ✕ 隐藏，侧边栏"已隐藏"卡片恢复，"清空列表"批量隐藏所有可见题。`ConfirmDialog` 替代原生 `confirm()`。
- **AI 出题数量**：题库页分段选择器（5/10/15/20 道），后端 `ExerciseGenRequest.count` 支持 1-50，`exercise_agent` 系统提示已移除硬编码范围。
- **答案格式三层防护**：Prompt 规范（choice→字母 A/B/C/D，judge→正确/错误）→ 后端 `normalize_answer()` 归一化 → 前端 `parseAnswer()` 容错（✔√✗✘/t/f/是否/1/0）。
- **题库去重 + 限容**：`_is_duplicate_question()` 用 difflib 相似度 >0.85 判重，`_cap_exercises()` 每知识点最多 20 道 AI 题（超限删最旧）。

## 提交规范

- `feat:` / `fix:` / `refactor:` / `docs:` / `chore:` / `test:` 开头。
- 涉及评分项（流式/防幻觉/多智能体/RAG）的改动附 1-2 句说明。
- 单测改动需 114 pytest 仍然全过；前端改动需 `npm run lint` 0 errors + `npm run build` 18 路由编译成功。
- 比赛前**必做**：`.env` 改 `LLM_PROVIDER=spark` + 配 `SPARK_API_KEY`，跑一次 `tests/smoke_test` 验证讯飞星火路径。
