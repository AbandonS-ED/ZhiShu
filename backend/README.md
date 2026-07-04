# 智枢(SmartHub) Backend

> 最后更新：2026-07-02（数据库 schema 修复 + 文档同步版本）

基于 FastAPI + 9 Agent 的多智能体学习资源生成系统后端。

## 技术栈

- **框架**: FastAPI 0.136 + SQLAlchemy 2.0 async + asyncpg
- **Agent**: 9 个子 Agent + Master Agent 编排器（LangGraph StateGraph **10 节点**）
- **认证**: bcrypt 密码哈希 + JWT（7 天过期）+ 全 67 业务端点门禁
- **角色**: `role` 字段（student / admin）+ `is_active` 软删除 + `last_login` 记录
- **LLM**: MiniMax-M3（开发）→ 讯飞星火 V4（上线前切换 `LLM_PROVIDER=spark`）
- **数据库**: PostgreSQL 18 + **12 张表** + 14 索引 + JSONB（embedding 占位）+ Redis（Celery broker，当前未起 worker）

## 快速开始

```bash
# 1. 初始化数据库（只需一次）
psql -U postgres -f backend/scripts/init_db.sql

# 2. 初始化/重置管理员账号（只需一次，可重复跑）
cd backend
venv\Scripts\python scripts\init_admin.py
# → 创建 admin/admin123 / role=admin

# 3. 本地开发
cd backend
python -m venv venv
venv/Scripts/activate
pip install -i https://pypi.tuna.tsinghua.edu.cn/simple -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8001

# API 文档
# http://localhost:8001/docs
```

> 端口说明：默认 8001。`frontend/src/lib/api.ts:5` 的 `BASE_URL` 已配置 `http://localhost:8001/api/v1`。`8000` 在 Windows 上有"僵尸 socket"问题（任务停了但端口还占着，`taskkill` / `Get-NetTCPConnection` 都看不到 PID），多数情况下需用 8001 绕开。

## 项目结构

```
backend/
├── app/
│   ├── main.py              # 入口（12 个 router + lifespan 初始化）= 67 唯一端点
│   ├── api/                 # 12 个 router：auth / profile / resource / path / tutor / chat / mindmap / dashboard / evaluation / admin / admin_exercises
│   ├── core/
│   │   ├── config.py        # Settings（MINIMAX_* + SPARK_* + JWT_SECRET + LLM_PROVIDER）
│   │   ├── database.py      # async SQLAlchemy + pgvector 可选
│   │   ├── security.py      # 密码哈希（bcrypt）+ JWT 生成/验证
│   │   ├── dependencies.py  # UUID 校验 + get_current_user 门禁
│   │   └── celery_config.py # Celery 配置（未启用）
│   ├── models/              # 13 个 Model
│   │   ├── student.py       # 学生/管理员（student_no + password_hash + role + is_active + last_login）
│   │   ├── student_profile.py # 7 维 JSONB 画像（comprehension/memory/application/imagination/focus/knowledge_base/learning_goal + confidence）
│   │   ├── document_chunk.py  # RAG 文档分块（embedding 用 JSONB 占位）
│   │   ├── resource.py      # 学习资源
│   │   ├── learning_path.py # DAG 学习路径
│   │   ├── exercise.py      # 练习题（含 source 字段：ai/bank）
│   │   ├── exercise_bank.py # 公共题库（admin 创建）
│   │   ├── chat_session.py  # 聊天会话
│   │   ├── chat_message.py  # 聊天消息
│   │   ├── learning_record.py # 学习行为记录（F5 评估）
│   │   ├── learning_activity_log.py # 学习行为日志
│   │   └── evaluation_report.py # 预生成评估报告缓存
│   ├── agents/              # 9 个 Agent
│   │   ├── state.py           # AgentState TypedDict + IntentType（11 种意图）
│   │   ├── communicator.py    # MessageBus pub/sub
│   │   ├── initial_assessment_agent.py  # 对话式 7 维画像评估
│   │   ├── document_agent.py  # 知识讲解 + 代码 + 音频脚本 + 防幻觉验证
│   │   ├── exercise_agent.py  # 自适应练习题生成 + 防幻觉验证
│   │   ├── path_agent.py      # 学习路径规划（DAG）
│   │   ├── tutor_agent.py     # RAG 智能问答 + 多轮上下文
│   │   ├── mindmap_agent.py   # 思维导图 Mermaid 生成
│   │   ├── audio_agent.py     # 音频脚本生成
│   │   ├── behavior_analysis_agent.py # 行为分析 + 画像更新
│   │   └── master_agent.py    # LangGraph StateGraph **10 节点**
│   └── services/              # 16 个 Service
│       ├── minimax_client.py     # httpx OpenAI 兼容格式客户端
│       ├── minimax_langchain.py  # LangChain BaseChatModel 封装
│       ├── spark_client.py       # 讯飞星火 V4 客户端
│       ├── anti_hallucination.py # 防幻觉三层验证
│       ├── content_safety.py     # 内容安全（敏感词过滤 + LLM 语义检查）
│       ├── document_parser.py    # 文档解析器（PDF/DOCX/PPTX/MD/TXT）
│       ├── embedding_service.py  # 向量化服务（MiniMax embeddings API）
│       ├── evaluation_service.py # 效果评估（行为跟踪 + 统计分析）
│       ├── json_parser.py        # JSON 解析工具
│       ├── reranker.py           # LLM 语义重排
│       ├── text_chunker.py       # 语义切片器（800字限制 + 重叠窗口）
│       ├── vector_store.py       # pgvector 检索 + JSONB 降级方案
│       ├── recommendation_service.py # 推荐服务
│       ├── chat_recommendation_service.py # 对话推荐服务
│       ├── llm_factory.py        # LLM 客户端工厂
│       └── scheduled_analysis_service.py # 定时画像分析
├── scripts/
│   ├── init_db.sql          # 手动建库 + 建表 SQL 脚本（**12 张表** + 14 索引 + admin 种子数据）
│   ├── init_admin.py        # 自动 ALTER + bcrypt 哈希 + 创建/重置 admin 账号
│   ├── migrate_schema_drift.py # 数据库 schema 漂移迁移（幂等）
│   └── run_migration.py     # 通用迁移执行器
├── tests/                   # smoke_test.py（端到端）+ 7 个 pytest 文件（**129** 个测试）
├── pytest.ini               # asyncio_mode=auto, testpaths=tests
├── Dockerfile               # 未实际使用，后端本地裸跑
├── requirements.txt
└── .env                     # API Key（已 gitignore）
```

## API 路由（67 个唯一端点）

> 唯一端点 = 唯一路径 + 方法组合。`backend/app/main.py` 注册 12 router，含 `/` 和 `/health` 根路由。

- `POST /profile/reset` / `GET /profile/assessment-status` / `PUT /profile/background`（profile 重置与背景）
- `POST /resource/{id}/favorite`（资源收藏）
- `POST /resource/batch-generate`（批量生成）
- `POST /resource/save-from-chat`（对话保存资源）
- `POST /evaluation/report/{student_id}/regenerate`（强制重生成报告，跳过缓存）
- `POST /auth/send-code` / `POST /auth/verify-code`（手机验证码）
- `DELETE /path/{student_id}/{path_id}`（删除路径）
- `DELETE /chat/sessions/{session_id}`（删除会话）
- `POST /chat/recommend-questions`（推荐问题）
- `POST /profile/update-behavior` / `POST /profile/analyze-behavior` / `POST /profile/force-analyze` / `GET /profile/analysis-status`（行为分析）
- `POST /resource/recommendations` / `GET /resource/learning-package` / `POST /resource/learning-package/generate/stream`（推荐与学习包）
- `GET /admin/stats` / `GET /admin/trends` / `GET /admin/users` / `GET /admin/users/{student_id}` / `PUT /admin/users/{student_id}` / `DELETE /admin/users/{student_id}` / `GET /admin/resources` / `GET /admin/paths` / `GET /admin/chats` / `GET /admin/chats/{session_id}/messages` / `GET /admin/documents` / `GET /admin/agents`（管理端）

### 认证（auth.py）— 8 个端点

| 方法 | 路径 | 门禁 | 说明 |
|------|------|------|------|
| POST | `/api/v1/auth/login` | 无需 | 登录（bcrypt + 记录 last_login + 校验 is_active） |
| POST | `/api/v1/auth/send-code` | 无需 | 发送手机验证码（控制台打印） |
| POST | `/api/v1/auth/verify-code` | 无需 | 验证手机验证码 |
| POST | `/api/v1/auth/register` | 无需 | 注册（bcrypt 存储 + JWT） |
| GET | `/api/v1/auth/me` | ✅ | 获取当前用户信息（含 role） |
| PUT | `/api/v1/auth/me` | ✅ | 更新当前用户（name, email） |
| POST | `/api/v1/auth/change-password` | ✅ | 修改密码 |
| GET | `/api/v1/auth/me/{student_id}` | ✅ | 按 ID 获取用户（仅自己） |

### 学习画像（profile.py）— 9 个端点

| 方法 | 路径 | 门禁 | 说明 |
|------|------|------|------|
| POST | `/api/v1/profile/assess/stream` | ✅ | **SSE 流式 7 维画像评估**（Initial Assessment Agent） |
| GET | `/api/v1/profile/me` | ✅ | 获取当前学生画像 |
| POST | `/api/v1/profile/reset` | ✅ | **重置画像**，允许重新评估 |
| GET | `/api/v1/profile/assessment-status` | ✅ | **获取评估状态**（用于恢复评估） |
| PUT | `/api/v1/profile/background` | ✅ | **更新学习背景信息** |
| POST | `/api/v1/profile/update-behavior` | ✅ | **更新行为画像**（根据学习行为自动更新） |
| POST | `/api/v1/profile/analyze-behavior` | ✅ | **分析行为画像**（触发画像分析） |
| POST | `/api/v1/profile/force-analyze` | ✅ | **强制分析画像**（忽略缓存） |
| GET | `/api/v1/profile/analysis-status` | ✅ | **获取分析状态**（查看分析进度） |

### 资源生成（resource.py）— 13 个端点

| 方法 | 路径 | 门禁 | 说明 |
|------|------|------|------|
| POST | `/api/v1/resource/generate` | ✅ | 生成学习资源（非流式） |
| POST | `/api/v1/resource/generate/stream` | ✅ | SSE 流式资源生成 |
| GET | `/api/v1/resource/list` | ✅ | 列出学生所有资源（含预置 + 用户资源） |
| POST | `/api/v1/resource/exercises/generate` | ✅ | 生成练习题（非流式） |
| POST | `/api/v1/resource/exercises/generate/stream` | ✅ | SSE 流式练习题生成（dual-format） |
| GET | `/api/v1/resource/exercises/{student_id}` | ✅ | 列出学生练习题 |
| GET | `/api/v1/resource/exercises/pool` | ✅ | 获取练习题池（题库 + AI 生成，随机采样） |
| POST | `/api/v1/resource/{resource_id}/favorite` | ✅ | **收藏/取消收藏资源** |
| POST | `/api/v1/resource/batch-generate` | ✅ | **批量生成多个知识点的资源** |
| POST | `/api/v1/resource/save-from-chat` | ✅ | **从对话页保存资源到资源中心** |
| POST | `/api/v1/resource/recommendations` | ✅ | **获取推荐资源**（基于画像/评估/对话/题库/路径） |
| GET | `/api/v1/resource/learning-package` | ✅ | **获取学习包**（三阶段：Learn/Practice/Review） |
| POST | `/api/v1/resource/learning-package/generate/stream` | ✅ | **SSE 流式生成学习包** |

### 学习路径（path.py）— 5 个端点

| 方法 | 路径 | 门禁 | 说明 |
|------|------|------|------|
| POST | `/api/v1/path/generate` | ✅ | 生成学习路径（非流式） |
| POST | `/api/v1/path/generate/stream` | ✅ | SSE 流式路径生成 |
| GET | `/api/v1/path/{student_id}` | ✅ | 列出学生所有路径 |
| GET | `/api/v1/path/{student_id}/{path_id}` | ✅ | 获取路径详情 |
| DELETE | `/api/v1/path/{student_id}/{path_id}` | ✅ | **删除学习路径** |

### 智能辅导（tutor.py）— 1 个端点

| 方法 | 路径 | 门禁 | 说明 |
|------|------|------|------|
| POST | `/api/v1/tutor/ask` | ✅ | RAG 问答 |

### 聊天（chat.py）— 5 个端点

| 方法 | 路径 | 门禁 | 说明 |
|------|------|------|------|
| POST | `/api/v1/chat/stream` | ✅ | SSE 流式聊天（Master Agent 路由） |
| GET | `/api/v1/chat/sessions/{student_id}` | ✅ | 列出会话 |
| GET | `/api/v1/chat/sessions/{session_id}/messages` | ✅ | 获取消息历史 |
| DELETE | `/api/v1/chat/sessions/{session_id}` | ✅ | 删除会话及所有消息 |
| POST | `/api/v1/chat/recommend-questions` | ✅ | **推荐问题**（基于会话上下文） |

### 思维导图（mindmap.py）— 2 个端点

| 方法 | 路径 | 门禁 | 说明 |
|------|------|------|------|
| POST | `/api/v1/mindmap/generate` | ✅ | 生成 Mermaid 思维导图 |
| GET | `/api/v1/mindmap/examples` | 无需 | 示例数据 |

### 仪表盘（dashboard.py）— 2 个端点

| 方法 | 路径 | 门禁 | 说明 |
|------|------|------|------|
| GET | `/api/v1/dashboard/stats` | ✅ | 统计数据聚合 |
| GET | `/api/v1/dashboard/courses` | ✅ | 课程进度 |

### 效果评估（evaluation.py）— 4 个端点

| 方法 | 路径 | 门禁 | 说明 |
|------|------|------|------|
| POST | `/api/v1/evaluation/record` | ✅ | 记录学习行为 |
| GET | `/api/v1/evaluation/stats/{student_id}` | ✅ | 统计分析 |
| GET | `/api/v1/evaluation/report/{student_id}` | ✅ | 评估报告（**优先读 evaluation_reports 缓存，无则实时生成**） |
| POST | `/api/v1/evaluation/report/{student_id}/regenerate` | ✅ | **强制重生成报告**，跳过缓存 |

### 管理端题库（admin_exercises.py）— 6 个端点

| 方法 | 路径 | 门禁 | 说明 |
|------|------|------|------|
| GET | `/api/v1/admin/exercises` | ✅ + admin | 列出题库（分页、筛选） |
| POST | `/api/v1/admin/exercises` | ✅ + admin | 创建单个题目 |
| POST | `/api/v1/admin/exercises/batch` | ✅ + admin | 批量导入（最多 200） |
| PUT | `/api/v1/admin/exercises/{exercise_id}` | ✅ + admin | 编辑题目 |
| DELETE | `/api/v1/admin/exercises/{exercise_id}` | ✅ + admin | 删除题目 |
| GET | `/api/v1/admin/exercises/knowledge-points` | ✅ + admin | 知识点列表（含题目数） |

### 管理端系统（admin.py）— 12 个端点

| 方法 | 路径 | 门禁 | 说明 |
|------|------|------|------|
| GET | `/api/v1/admin/stats` | ✅ + admin | **统计数据**（并行查询 10 个计数） |
| GET | `/api/v1/admin/trends` | ✅ + admin | **周趋势数据**（近 7 天新增） |
| GET | `/api/v1/admin/users` | ✅ + admin | **用户列表**（搜索/筛选/分页） |
| GET | `/api/v1/admin/users/{student_id}` | ✅ + admin | **用户详情** |
| PUT | `/api/v1/admin/users/{student_id}` | ✅ + admin | **更新用户**（角色/状态） |
| DELETE | `/api/v1/admin/users/{student_id}` | ✅ + admin | **删除用户**（级联清理） |
| GET | `/api/v1/admin/resources` | ✅ + admin | **资源列表**（搜索/分页） |
| GET | `/api/v1/admin/paths` | ✅ + admin | **学习路径列表**（搜索/分页） |
| GET | `/api/v1/admin/chats` | ✅ + admin | **对话列表**（搜索/分页） |
| GET | `/api/v1/admin/chats/{session_id}/messages` | ✅ + admin | **对话消息详情** |
| GET | `/api/v1/admin/documents` | ✅ + admin | **知识库文档列表**（搜索/分页） |
| GET | `/api/v1/admin/agents` | ✅ + admin | **Agent 监控**（调用统计/错误率） |

### 根路由（main.py）— 2 个端点

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/` | API 运行状态 |
| GET | `/health` | 健康检查 |

## 服务层

| 文件 | 功能 | 状态 |
|------|------|------|
| `services/minimax_client.py` | httpx 直接调用 MiniMax-M3（OpenAI 兼容格式） | ✅ 可用 |
| `services/minimax_langchain.py` | LangChain BaseChatModel 封装 | ✅ 可用 |
| `services/spark_client.py` | 讯飞星火 V4 客户端（同步 + 流式） | ✅ 已实现 |
| `services/anti_hallucination.py` | 防幻觉三层验证（模式检测+来源验证+LLM语义校验） | ✅ 已实现 |
| `services/content_safety.py` | 内容安全（敏感词过滤 + LLM 语义检查） | ✅ 已实现 |
| `services/document_parser.py` | 文档解析器（PDF/DOCX/PPTX/MD/TXT） | ✅ 已实现 |
| `services/embedding_service.py` | 向量化服务（MiniMax embeddings API） | ✅ 已实现 |
| `services/evaluation_service.py` | 效果评估（**LLM 报告生成 + 趋势 + 知识点统计 + 规则引擎降级**） | ✅ 已实现 |
| `services/json_parser.py` | JSON 解析工具（消除重复代码） | ✅ 已实现 |
| `services/reranker.py` | LLM 语义重排 | ✅ 已实现 |
| `services/text_chunker.py` | 语义切片器（800字限制 + 重叠窗口） | ✅ 已实现 |
| `services/vector_store.py` | pgvector 检索 + JSONB 降级方案 | ✅ 已实现 |
| `services/recommendation_service.py` | 推荐服务（多维度打分推荐） | ✅ 已实现 |
| `services/chat_recommendation_service.py` | 对话推荐服务（基于会话上下文） | ✅ 已实现 |
| `services/llm_factory.py` | LLM 客户端工厂（MiniMax/Spark） | ✅ 已实现 |
| `services/scheduled_analysis_service.py` | 定时画像分析（每日自动分析） | ✅ 已实现 |

## 数据库

**12 张表 + 14 个索引**（开发阶段去掉外键约束）：

| 表名 | 用途 | 索引 |
|------|------|------|
| `students` | **学生/管理员**（student_no + password_hash + role + is_active + last_login） | `student_no` UNIQUE + `idx_students_role` + `idx_students_is_active` |
| `student_profiles` | **7 维** JSONB 画像（comprehension/memory/application/imagination/focus/knowledge_base/learning_goal + confidence） | `idx_student_profiles_student_id` |
| `document_chunks` | RAG 文档分块（embedding JSONB 占位） | — |
| `resources` | 生成的学习资源 | `idx_resources_student_id` |
| `learning_paths` | DAG 学习路径 | `idx_learning_paths_student_id` |
| `exercises` | 练习题（含 source：ai/bank） | `idx_exercises_student_id` |
| `exercise_bank` | 公共题库（admin 创建） | `idx_exercise_bank_kp` + `idx_exercise_bank_type` + `idx_exercise_bank_active` |
| `chat_sessions` | 聊天会话 | `idx_chat_sessions_student_id` |
| `chat_messages` | 聊天消息 | `idx_chat_messages_session_id` |
| `learning_records` | 学习行为记录（F5 评估） | `idx_learning_records_student_id` + `idx_learning_records_action` + `idx_learning_records_created_at` |
| `learning_activity_logs` | 学习行为日志 | — |
| `evaluation_reports` | **预生成评估报告缓存**（Celery daily 4 点跑） | `idx_evaluation_reports_student_id` + 复合索引 `(student_id, report_date)` |

## 认证与权限

- **密码哈希**：`bcrypt`（`core/security.py`）
- **JWT**：HS256，7 天过期，密钥从 `JWT_SECRET` 环境变量读取
- **门禁**：67 个业务端点全部加 `Depends(get_current_user)` + `student_id` 所有权校验
- **角色隔离**：`students.role` 字段（`student` / `admin`），管理员通过 `_require_admin()` 额外校验
- **软删除**：`is_active=false` 时登录返回 403
- **登录审计**：登录成功后自动 `last_login = now()`

## 已知问题

- pgvector PostgreSQL 扩展未安装（Python 包已装），embedding 暂用 JSONB
- Dockerfile 已存在但未实际使用，docker-compose.yml 只配了 postgres/redis/minio，**实际后端本地裸跑**
- Celery 异步任务**已配置**（`app/core/celery_config.py` + `app/tasks/evaluation_tasks.py`），daily 4 点跑 `generate_daily_reports`；当前**未启动 worker**，评估 API 仍走实时生成
- PowerShell `$2b$` 变量插值：bcrypt 哈希不能直接在 PowerShell 命令行传，**用 `scripts/init_admin.py` 绕开**
- `student_profiles.last_analyzed_at` 列缺失会导致 profile/me 等 API 报 500 错误，需执行：`ALTER TABLE student_profiles ADD COLUMN last_analyzed_at TIMESTAMP WITH TIME ZONE DEFAULT NULL`
- 后端端口**必须 8001**（不要 8000：Windows 端口僵尸 socket 坑）。改端口要同步改 `frontend/src/lib/api.ts:5` 的 `BASE_URL`

## 测试

```bash
cd backend

# ⭐ 端到端冒烟测试 (9 API 验证，七次 9/9 PASS)
python -m tests.smoke_test

# 单元 + 集成（**129** 个 pytest 测试）
pytest tests/ -v
```

**实际测试文件**（`backend/tests/`）：

| 文件 | 测试数 |
|------|--------|
| `smoke_test.py` | 端到端冒烟，9 API 全 200 |
| `test_agents.py` | 32 |
| `test_anti_hallucination.py` | 22 |
| `test_api.py` | 10 |
| `test_json_parser.py` | 11 |
| `test_message_bus.py` | 15 |
| `test_state_graph.py` | 27 |
| `test_strip_think.py` | 12 |
| **合计** | **129** |

最新测试报告见 `../SMOKE_TEST_REPORT.md`。

## 端口与前端联调

- 后端默认 `8001`（匹配 `frontend/src/lib/api.ts:5` 的 `BASE_URL`）
- 8000 在 Windows 上有"僵尸 socket"问题（任务停了但端口还占着）
- 改了后端端口要**同步**改前端 `api.ts:5`
- 管理后台前端调后端时用 `zhishu_admin_token`（localStorage 隔离）
- 默认管理员账号：`student_no=admin`, `password=admin123`, `role=admin`（`scripts/init_admin.py` 自动创建）
