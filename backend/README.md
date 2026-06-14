# 智枢(SmartHub) Backend

基于 FastAPI + 8 Agent 的多智能体学习资源生成系统后端。

## 技术栈

- **框架**: FastAPI 0.136 + SQLAlchemy 2.0 async + asyncpg
- **Agent**: 7 个子 Agent + Master Agent 编排器（LangGraph StateGraph 13 节点）
- **认证**: bcrypt 密码哈希 + JWT（7 天过期）+ 全 33 业务端点门禁
- **角色**: `role` 字段（student / admin）+ `is_active` 软删除 + `last_login` 记录
- **LLM**: MiniMax-M3（开发）→ 讯飞星火 V4（上线前切换 `LLM_PROVIDER=spark`）
- **数据库**: PostgreSQL 18 + 10 张表 + 14 索引 + JSONB（embedding 占位）+ Redis（当前未使用）

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
│   ├── main.py              # 入口（10 个 router + lifespan 初始化）
│   ├── api/                 # 10 个 router：auth / profile / resource / path / tutor / chat / mindmap / dashboard / evaluation / admin_exercises
│   ├── core/
│   │   ├── config.py        # Settings（MINIMAX_* + SPARK_* + JWT_SECRET + LLM_PROVIDER）
│   │   ├── database.py      # async SQLAlchemy + pgvector 可选
│   │   ├── security.py      # 密码哈希（bcrypt）+ JWT 生成/验证
│   │   ├── dependencies.py  # UUID 校验 + get_current_user 门禁
│   │   └── celery_config.py # Celery 配置（未启用）
│   ├── models/              # 10 个 Model
│   │   ├── student.py       # ⭐ 学生/管理员（student_no + password_hash + role + is_active + last_login）
│   │   ├── student_profile.py # 6 维 JSONB 画像 + 版本控制
│   │   ├── document_chunk.py  # RAG 文档分块（embedding 用 JSONB 占位）
│   │   ├── resource.py      # 学习资源
│   │   ├── learning_path.py # DAG 学习路径
│   │   ├── exercise.py      # 练习题（含 source 字段：ai/bank）
│   │   ├── exercise_bank.py # 公共题库（admin 创建）
│   │   ├── chat_session.py  # 聊天会话
│   │   ├── chat_message.py  # 聊天消息
│   │   └── learning_record.py # 学习行为记录（F5 评估）
│   ├── agents/              # 8 个 Agent
│   │   ├── state.py           # AgentState TypedDict + IntentType（11 种意图）
│   │   ├── communicator.py    # MessageBus pub/sub
│   │   ├── profile_agent.py   # 对话式 6 维画像提取
│   │   ├── document_agent.py  # 知识讲解 + 代码 + 音频脚本 + 防幻觉验证
│   │   ├── exercise_agent.py  # 自适应练习题生成 + 防幻觉验证
│   │   ├── path_agent.py      # 学习路径规划（DAG）
│   │   ├── tutor_agent.py     # RAG 智能问答 + 多轮上下文
│   │   ├── mindmap_agent.py   # 思维导图 Mermaid 生成
│   │   ├── audio_agent.py     # 音频脚本生成
│   │   └── master_agent.py    # LangGraph StateGraph 13 节点
│   └── services/
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
│       └── vector_store.py       # pgvector 检索 + JSONB 降级方案
├── scripts/
│   ├── init_db.sql          # 手动建库 + 建表 SQL 脚本（10 张表 + 14 索引 + admin 种子数据）
│   ├── init_admin.py        # ⭐ 自动 ALTER + bcrypt 哈希 + 创建/重置 admin 账号
│   └── migrate_exercise_bank.sql # 练习题库迁移（已合并到 init_db.sql）
├── tests/                   # smoke_test.py（端到端）+ 7 个 pytest 文件（119 个测试）+ 6 个 debug 脚本
├── pytest.ini               # asyncio_mode=auto, testpaths=tests
├── Dockerfile               # ⚠️ 未实际使用，后端本地裸跑
├── requirements.txt
└── .env                     # API Key（已 gitignore）
```

## API 路由（39 个端点）

### 认证（auth.py）— 6 个端点

| 方法 | 路径 | 门禁 | 说明 |
|------|------|------|------|
| POST | `/api/v1/auth/login` | 无需 | 登录（bcrypt + 记录 last_login + 校验 is_active） |
| POST | `/api/v1/auth/register` | 无需 | 注册（bcrypt 存储 + JWT） |
| GET | `/api/v1/auth/me` | ✅ | 获取当前用户信息（含 role） |
| PUT | `/api/v1/auth/me` | ✅ | 更新当前用户（name, email） |
| POST | `/api/v1/auth/change-password` | ✅ | 修改密码 |
| GET | `/api/v1/auth/me/{student_id}` | ✅ | 按 ID 获取用户（仅自己） |

### 学习画像（profile.py）— 2 个端点

| 方法 | 路径 | 门禁 | 说明 |
|------|------|------|------|
| POST | `/api/v1/profile/build` | ✅ | 从对话构建/更新画像 |
| GET | `/api/v1/profile/{student_id}` | ✅ | 获取当前画像 |

### 资源生成（resource.py）— 7 个端点

| 方法 | 路径 | 门禁 | 说明 |
|------|------|------|------|
| POST | `/api/v1/resource/generate` | ✅ | 生成学习资源（非流式） |
| POST | `/api/v1/resource/generate/stream` | ✅ | SSE 流式资源生成 |
| GET | `/api/v1/resource/list` | ✅ | 列出学生所有资源 |
| POST | `/api/v1/resource/exercises/generate` | ✅ | 生成练习题（非流式） |
| POST | `/api/v1/resource/exercises/generate/stream` | ✅ | SSE 流式练习题生成（dual-format） |
| GET | `/api/v1/resource/exercises/{student_id}` | ✅ | 列出学生练习题 |
| GET | `/api/v1/resource/exercises/pool` | ✅ | 获取练习题池（题库 + AI 生成，随机采样） |

### 学习路径（path.py）— 4 个端点

| 方法 | 路径 | 门禁 | 说明 |
|------|------|------|------|
| POST | `/api/v1/path/generate` | ✅ | 生成学习路径（非流式） |
| POST | `/api/v1/path/generate/stream` | ✅ | SSE 流式路径生成 |
| GET | `/api/v1/path/{student_id}` | ✅ | 列出学生所有路径 |
| GET | `/api/v1/path/{student_id}/{path_id}` | ✅ | 获取路径详情 |

### 智能辅导（tutor.py）— 1 个端点

| 方法 | 路径 | 门禁 | 说明 |
|------|------|------|------|
| POST | `/api/v1/tutor/ask` | ✅ | RAG 问答 |

### 聊天（chat.py）— 4 个端点

| 方法 | 路径 | 门禁 | 说明 |
|------|------|------|------|
| POST | `/api/v1/chat/stream` | ✅ | SSE 流式聊天（Master Agent 路由） |
| GET | `/api/v1/chat/sessions/{student_id}` | ✅ | 列出会话 |
| GET | `/api/v1/chat/sessions/{session_id}/messages` | ✅ | 获取消息历史 |
| DELETE | `/api/v1/chat/sessions/{session_id}` | ✅ | 删除会话及所有消息 |

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

### 效果评估（evaluation.py）— 3 个端点

| 方法 | 路径 | 门禁 | 说明 |
|------|------|------|------|
| POST | `/api/v1/evaluation/record` | ✅ | 记录学习行为 |
| GET | `/api/v1/evaluation/stats/{student_id}` | ✅ | 统计分析 |
| GET | `/api/v1/evaluation/report/{student_id}` | ✅ | 评估报告 |

### 管理端题库（admin_exercises.py）— 6 个端点

| 方法 | 路径 | 门禁 | 说明 |
|------|------|------|------|
| GET | `/api/v1/admin/exercises` | ✅ + admin | 列出题库（分页、筛选） |
| POST | `/api/v1/admin/exercises` | ✅ + admin | 创建单个题目 |
| POST | `/api/v1/admin/exercises/batch` | ✅ + admin | 批量导入（最多 200） |
| PUT | `/api/v1/admin/exercises/{exercise_id}` | ✅ + admin | 编辑题目 |
| DELETE | `/api/v1/admin/exercises/{exercise_id}` | ✅ + admin | 删除题目 |
| GET | `/api/v1/admin/exercises/knowledge-points` | ✅ + admin | 知识点列表（含题目数） |

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
| `services/evaluation_service.py` | 效果评估（行为跟踪 + 统计分析） | ✅ 已实现 |
| `services/json_parser.py` | JSON 解析工具（消除重复代码） | ✅ 已实现 |
| `services/reranker.py` | LLM 语义重排 | ✅ 已实现 |
| `services/text_chunker.py` | 语义切片器（800字限制 + 重叠窗口） | ✅ 已实现 |
| `services/vector_store.py` | pgvector 检索 + JSONB 降级方案 | ✅ 已实现 |

## 数据库

10 张表 + 14 个索引（开发阶段去掉外键约束）：

| 表名 | 用途 | 索引 |
|------|------|------|
| `students` | **学生/管理员**（student_no + password_hash + role + is_active + last_login） | `student_no` UNIQUE + `idx_students_role` + `idx_students_is_active` |
| `student_profiles` | 6 维 JSONB 画像 + 版本控制 | `idx_student_profiles_student_id` |
| `document_chunks` | RAG 文档分块（embedding JSONB 占位） | — |
| `resources` | 生成的学习资源 | `idx_resources_student_id` |
| `learning_paths` | DAG 学习路径 | `idx_learning_paths_student_id` |
| `exercises` | 练习题（含 source：ai/bank） | `idx_exercises_student_id` |
| `exercise_bank` | 公共题库（admin 创建） | `idx_exercise_bank_kp` + `idx_exercise_bank_type` + `idx_exercise_bank_active` |
| `chat_sessions` | 聊天会话 | `idx_chat_sessions_student_id` |
| `chat_messages` | 聊天消息 | `idx_chat_messages_session_id` |
| `learning_records` | 学习行为记录（F5 评估） | `idx_learning_records_student_id` + `idx_learning_records_action` + `idx_learning_records_created_at` |

## 认证与权限

- **密码哈希**：`bcrypt`（`core/security.py`）
- **JWT**：HS256，7 天过期，密钥从 `JWT_SECRET` 环境变量读取
- **门禁**：33 个业务端点全部加 `Depends(get_current_user)` + `student_id` 所有权校验
- **角色隔离**：`students.role` 字段（`student` / `admin`），管理员通过 `_require_admin()` 额外校验
- **软删除**：`is_active=false` 时登录返回 403
- **登录审计**：登录成功后自动 `last_login = now()`

## 已知问题

- pgvector PostgreSQL 扩展未安装（Python 包已装），embedding 暂用 JSONB
- Dockerfile 已存在但未实际使用，docker-compose.yml 只配了 postgres/redis/minio，**实际后端本地裸跑**
- Celery 异步任务未启用（`app/core/celery_config.py` 已存在但未跑 worker）
- PowerShell `$2b$` 变量插值：bcrypt 哈希不能直接在 PowerShell 命令行传，**用 `scripts/init_admin.py` 绕开**
- `LearningRecord` 已在 `models/__init__.py` 导出（2026-06-13 修复）

## 测试

```bash
cd backend

# ⭐ 端到端冒烟测试 (9 API 验证，四次 9/9 PASS)
python -m tests.smoke_test

# 单元 + 集成（119 个 pytest 测试）
pytest tests/ -v
```

**实际测试文件**（`backend/tests/`）：

| 文件 | 大小 | 用途 |
|------|------|------|
| ⭐ `smoke_test.py` | 13.3 KB | **端到端冒烟**，9 API 全 200 |
| `test_agents.py` | 7.7 KB | 31 个 Agent 单元测试 |
| `test_anti_hallucination.py` | 4.3 KB | 防幻觉三层（PatternDetector / SourceValidator / LLMValidator） |
| `test_json_parser.py` | 2.1 KB | JSON 解析工具 |
| `test_api.py` | 2.3 KB | API 最小集成测试 |
| `test_state_graph.py` | — | StateGraph 25 个测试 |
| `test_strip_think.py` | — | think 标签过滤 11 个测试 |
| `test_message_bus.py` | — | MessageBus 12 个测试 |
| `debug_*.py` | 6 个 | 调试脚本（exercise / mindmap / path / resource） |

最新测试报告见 `../SMOKE_TEST_REPORT.md`。

## 端口与前端联调

- 后端默认 `8001`（匹配 `frontend/src/lib/api.ts:5` 的 `BASE_URL`）
- 8000 在 Windows 上有"僵尸 socket"问题（任务停了但端口还占着）
- 改了后端端口要**同步**改前端 `api.ts:5`
- 管理后台前端调后端时用 `zhishu_admin_token`（localStorage 隔离）
- 默认管理员账号：`student_no=admin`, `password=admin123`, `role=admin`（`scripts/init_admin.py` 自动创建）
