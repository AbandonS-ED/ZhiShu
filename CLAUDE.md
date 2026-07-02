# CLAUDE.md — 智枢 (ZhiShu) 技术文档

## 项目背景

**智枢 (SmartHub)** — 第十五届中国软件杯 A3 赛题：基于大模型的个性化资源生成与学习多智能体系统。

- **出题方**: 科大讯飞。**硬约束**: 必须用讯飞星火 V4 / Embedding / TTS
- **评分占比**: F1 对话式画像 35% + F2 多智能体资源生成 45% + F3 路径规划 + F4/F5 加分
- **课程切入点**: 人工智能导论
- **主仓库**: https://github.com/AbandonS-ED/ZhiShu

## 技术栈

| 层 | 选型 | 版本 | 备注 |
|---|---|---|---|
| 前端 | Next.js (App Router) + Tailwind CSS + TypeScript | 14.2.5 | 本地 woff 字体，无 Google Fonts |
| 后端 | FastAPI + SQLAlchemy 2.0 async + asyncpg | 0.136 | Python 3.11 |
| Agent | LangGraph StateGraph + MessageBus | - | 10 节点编排 + 10 子 Agent |
| LLM | 双客户端: MiniMaxClient (开发) / SparkClient (上线) | - | `LLM_PROVIDER=minimax\|spark` 切换 |
| 向量库 | pgvector (JSONB 降级方案) | - | embedding 用 JSONB 占位 |
| 数据库 | PostgreSQL 18 + Redis | - | 12 张表 |
| 异步任务 | Celery (Redis broker) | - | 每日 4 点预生成评估报告 |

## 项目结构

```
ZhiShu/
├── frontend/                        # Next.js 前端
│   ├── src/app/                     # 页面路由 (9 学生页 + 9 管理页)
│   ├── src/components/              # 共享组件 (Icon.tsx + RobotIcon.tsx + layout/)
│   ├── src/lib/                     # 工具库 (api.ts + sse.ts + admin/)
│   ├── src/stores/appStore.ts       # Zustand 全局状态
│   ├── src/types/index.ts           # TypeScript 类型定义
│   └── src/hooks/usePageTimer.ts    # 页面停留计时器
├── backend/                         # FastAPI 后端
│   ├── app/main.py                  # 应用入口 + 路由注册
│   ├── app/api/                     # 12 个路由模块 (67 端点)
│   ├── app/agents/                  # 10 个 Agent + StateGraph 编排
│   ├── app/services/                # 16 个服务模块
│   ├── app/models/                  # 13 个数据模型
│   ├── app/tasks/                   # Celery 异步任务
│   └── app/core/                    # 核心模块 (配置/数据库/安全)
├── tests/                           # 114 pytest + 冒烟测试
├── docs/                            # 设计文档
├── scripts/                         # 数据库初始化脚本
├── docker-compose.yml               # Docker 编排
├── start.ps1                        # Windows 一键启动
└── stop.ps1                         # Windows 一键停止
```

## 硬约束

- **LLM**: 开发用 MiniMax-M3，`base_url` `https://api.minimax.chat/v1`（**没有 `i`**，不是 `minimaxi`）。比赛前切星火：`LLM_PROVIDER=spark` + `SPARK_API_KEY=xxx`。讯飞鉴权只用 `Authorization: Bearer {api_key}`，不拼 api_secret。
- **禁用** Google Fonts / Vercel / Sentry / OpenAI（中国不可达）。字体走 `frontend/src/app/fonts/` 本地 woff + `next/font/local`。
- **pip** 加 `-i https://pypi.tuna.tsinghua.edu.cn/simple`；npm 走 `frontend/.npmrc` 的 `registry.npmmirror.com`。
- **端口**: 后端 **8001**（不要 8000），前端 3000。`api.ts:3` 的 `BASE_URL` 已同步。用 `start.ps1` 一键启动，`stop.ps1` 一键停止。
- **bcrypt**: 只用 `import bcrypt`，**不要引入 passlib**（冲突）。
- **勿提交** `.env` / API 密钥 / `venv/` / `node_modules/` / `.service-pids.json`。

## 命令

```bash
# 建库（只需一次）
psql -U postgres -f backend/scripts/init_db.sql

# 初始化管理员（可重复跑，默认 admin / admin123 / role=admin）
cd backend && venv\Scripts\python scripts\init_admin.py

# 一键启停（推荐）
.\start.ps1              # 同时启动后端 8001 + 前端 3000
.\stop.ps1               # 杀所有 python/node 进程

# 手动启动后端
cd backend && python -m venv venv && venv\Scripts\activate
pip install -i https://pypi.tuna.tsinghua.edu.cn/simple -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8001
# Swagger: http://localhost:8001/docs

# 手动启动前端
cd frontend && npm install && npm run dev
# 管理后台: http://localhost:3000/admin/login（admin / admin123）

# Celery 定时任务
cd backend && celery -A app.core.celery_config worker --loglevel=info
cd backend && celery -A app.core.celery_config beat --loglevel=info

# 测试
cd backend && python -m pytest tests/ -v          # 114 pytest
cd backend && python -m tests.smoke_test           # 端到端 9 API
cd frontend && npm run lint                        # 0 errors
cd frontend && npm run build                       # 18 页面
```

## 架构要点

### 多智能体编排 (10 节点 StateGraph)

```
intent_recognition → task_planning → conditional_route
  → 6 个 Agent 节点 (document / mindmap / exercise / path / tutor / audio)
  → result_aggregation → response_generation
```

`master_agent.py` 实际节点: `intent_recognition` + `task_planning` + 6 个 `run_*_agent` (document / mindmap / exercise / path / tutor / audio) + `result_aggregation` + `response_generation` = **10 个节点**。

### 7 维学生画像

`student_profiles.dimensions` JSONB: `comprehension / memory / application / imagination / focus / learning_speed / knowledge_breadth`（理解力/记忆力/应用转化/想象力/专注力/学习节奏/知识广度），每个维度含 `score` (0-100) 和 `confidence` (0-1)，由 `initial_assessment_agent.py` 通过对话评估生成。

### 7 维学生画像

`student_profiles.dimensions` JSONB: `comprehension / memory / application / imagination / focus / learning_speed / knowledge_breadth`（理解力/记忆力/应用转化/想象力/专注力/学习节奏/知识广度），每个维度含 `score` (0-100) 和 `confidence` (0-1)，由 `initial_assessment_agent.py` 通过对话评估生成。

### 防幻觉 (N3 评分项)

三层验证: PatternDetector → SourceValidator → LLMValidator。6 个 Agent 已接入。

### 流式输出

| 路由 | 类型 | 方式 |
|---|---|---|
| `/api/v1/chat/stream` (tutor/chat) | ✅ 真流式 | `type=token` 逐 token |
| `/api/v1/chat/stream` (exercise) | ✅ 真流式 | dual-format 协议 |
| `/api/v1/resource/generate/stream` | ✅ 真流式 | `type=token` 逐 token |
| `/api/v1/resource/exercises/generate/stream` | ✅ 真流式 | dual-format |
| `/api/v1/path/generate/stream` | ✅ 真流式 | `type=token` 逐 token |
| `/api/v1/profile/assess/stream` | ✅ 真流式 | `type=token` 逐 token |
| `/api/v1/resource/learning-package/generate/stream` | ✅ 真流式 | `type=token` 逐 token |

### 数据库表关系 (12 张表)

`students` 1:N `student_profiles` / `chat_sessions` / `resources` / `learning_paths` / `exercises` / `learning_records` / `evaluation_reports`

`exercise_bank`: 公共题库 (admin 创建，独立于学生)
`document_chunks`: RAG 知识库文档分块

### 登录注册系统

```
注册: POST /auth/send-code → 生成 6 位验证码 → 控制台打印 → 内存存储 (5 分钟有效)
     POST /auth/register → 校验验证码 + bcrypt 哈希密码 + 手机号唯一 → 存入 students → 返回 JWT
登录: POST /auth/login → bcrypt 校验密码 → 检查 is_active → 记录 last_login → 返回 JWT
验证: Authorization: Bearer <token> → decode_token() → get_current_user() 依赖
门禁: 67 个业务端点全部加 Depends(get_current_user) + student_id 所有权校验
```

### 管理后台系统

```
路由: /admin/* (前缀匹配，与学生端完全隔离)
布局: admin/layout.tsx 跳过 RootLayout 的 AppShell
Token: zhishu_admin_token (与学生端 zhishu_token 隔离)
登录: /admin/login → 调用 /auth/login → 校验 role === 'admin' → 存 zhishu_admin_user
题库 CRUD: admin_exercises.py 6 个端点 (列表/创建/批量导入/编辑/删除/知识点列表)
管理端点: admin.py 12 个端点 (统计/趋势/用户CRUD/资源/路径/对话/文档/Agent 监控)
Agent 监控: agent_metrics.py 内存计数器 (threading.Lock 线程安全)
并行查询: get_stats 用 asyncio.gather() 并行 10 个计数查询
N+1 优化: users/resources/paths/chats 列表全部改用 JOIN 子查询
共享依赖: require_admin() 提取到 dependencies.py，admin.py + admin_exercises.py 复用
```

## 已知问题

### 已修复 (不必再查)

- ✅ `database.py:3` 缺 `text()` → commit `c837fe3`
- ✅ 前端 XSS 漏洞 → 已加 `escapeHtml()`
- ✅ 内存泄漏 → 已加 `cancelAnimationFrame`
- ✅ 音频筛选 → 已加 `'audio'`
- ✅ `echo=True` → `echo=settings.DEBUG`
- ✅ StateGraph 从 if-else 升级为 10 节点编排
- ✅ UUID 校验统一依赖
- ✅ 登录注册系统 (bcrypt + JWT + 全路由门禁)
- ✅ 管理后台前端 9 页面 + 学生端布局隔离
- ✅ 公共题库系统 (exercise_bank 表 + 管理员 CRUD)
- ✅ `profile_agent` → `initial_assessment_agent` 重构
- ✅ 对话页刷新修复 (sessionId 持久化 + loadSession 渲染)
- ✅ 骨架屏 loading (4 页面 shimmer 动画)
- ✅ 评估报告 AI 化 + 预生成缓存 + 定时生成
- ✅ 管理后台 API 增强 (18 端点 + Agent 监控 + 并行查询 + N+1 优化)
- ✅ 手机验证码注册 (控制台输出 + 5 分钟有效期 + 手机号唯一)
- ✅ 三页面接入真实 API (paths/chats/documents)
- ✅ forEach async 批量操作修复 (users/page.tsx)
- ✅ SQL 注入风险修复 (admin.py 改用 ORM 模型)
- ✅ 图表 innerHTML 改为 React BarChart 组件
- ✅ 搜索改为后端搜索 (resources/page.tsx)
- ✅ 共享 require_admin 依赖提取
- ✅ agent_metrics 线程安全 (threading.Lock)
- ✅ dashboard 骨架屏 loading 状态
- ✅ Agent 卡片样式优化 (响应式网格 + 文字截断)
- ✅ 登录页滚动修复 (body:has(.login-page) overflow:auto)
- ✅ 验证码按钮样式重构 (code-row + code-btn 独立样式)
- ✅ 注册表单平滑展开动画 (register-extras max-height transition)
- ✅ 管理后台用户删除功能 (级联删除 + 安全检查 + 二次确认)
- ✅ 资源中心重构 (推荐 Feed + 三阶段学习包)
- ✅ 评估报告 AI 化 (LLM 生成 + 趋势分析 + 知识点统计)

### P2 — 清理项

- 缺外键约束
- `Resource.resource_type` 永远存 "knowledge"
- dashboard `learning_hours` 是 heuristic
- `gen_random_uuid()` 需 pgcrypto
- 5 处 `useState<any>`

## 踩过的坑

| 坑 | 症状 | 解法 |
|---|---|---|
| `.next` 缓存损坏 | `npm run build` 后切 dev 报 `Cannot find module` | 杀 node → 删除 `.next` → 重启 |
| Windows 8000 端口僵尸 | 进程死了端口还占着 | 直接用 8001 |
| PowerShell `$2b$` 插值 | bcrypt 哈希被 shell 解析成变量 | 用 `init_admin.py` 脚本 |
| pgvector 扩展未装 | Python 包装了但 PG 扩展没装 | embedding 用 JSONB 占位 |
| `chat.py` session 复用 | 流式期间锁住表，写操作 hang | `event_generator` 必须用独立 `async_session()` |
| StateGraph final_state | `astream` 只返回当前节点输出 | 必须 `final_state.update(node_output)` 累积 |
| SSE stream 漏 token | 401 全失败 | 每个 stream 方法手动加 `Authorization: Bearer` |
| localStorage key 名 | 登录数据存 `zhishu_student` (JSON 含 `id`) | `getStudentId()` 从 `zhishu_student` 读取再 `JSON.parse` |
| 对话页刷新丢会话 | `sessionId` 在 React state，刷新即丢 | 已用 localStorage 持久化 |
| `loadSession` 渲染 | `rendered=true` 跳过 `markdownToHtml` | 所有历史消息 `rendered=false` |
| 根 layout 共用 | admin 路由继承学生端 Sidebar/Header | `NO_SHELL_ROUTES` 必须加 `/admin` |
| DB schema 漂移 | 老 DB 缺表/列 | 跑 `scripts/migrate_schema_drift.py` 幂等修复 |
| Celery import 路径 | `from app.core.celery_config import app` 报错 | celery 必须在 `backend/` 目录下执行 |
| recommendation_service 时区 | `datetime.utcnow()` 与 DB offset-aware 时间比较失败 | 用 `datetime.now(timezone.utc)` 替代 |

## 提交规范

- `feat:` / `fix:` / `refactor:` / `docs:` / `chore:` / `test:` 开头
- 涉及评分项 (流式/防幻觉/多智能体) 附 1-2 句说明
- 前端改动需 `npm run lint` 0 errors + `npm run build` 18 页面通过
- 比赛前**必做**: `.env` 改 `LLM_PROVIDER=spark` + 跑 `tests/smoke_test` 验证星火路径

## 写新功能前先看

- [docs/设计文档/项目设计文档-完整版.md](docs/设计文档/项目设计文档-完整版.md)
- [AGENTS.md](AGENTS.md)
- [开发进度.md](开发进度.md)
