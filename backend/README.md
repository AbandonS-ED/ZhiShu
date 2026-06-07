# 智枢(SmartHub) Backend

基于 FastAPI + 6 Agent 的多智能体学习资源生成系统后端。

## 技术栈

- **框架**: FastAPI 0.136 + SQLAlchemy 2.0 async + asyncpg
- **Agent**: 6 个子 Agent + Master Agent 编排器（直接调用 LLM）
- **LLM**: MiniMax-M3（开发）→ 讯飞星火 V4（上线前切换）
- **数据库**: PostgreSQL 18 + Redis

## 快速开始

```bash
# 1. 初始化数据库（只需一次）
psql -U postgres -f backend/scripts/init_db.sql

# 2. 本地开发
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# API 文档
# http://localhost:8000/docs
```

## 项目结构

```
backend/
├── app/
│   ├── main.py              # 入口（5 个 router + lifespan 初始化）
│   ├── api/                 # 5 个 router：profile / resource / path / tutor / chat
│   ├── core/
│   │   ├── config.py        # Settings（MINIMAX_* + SPARK_* 预留）
│   │   └── database.py      # async SQLAlchemy + pgvector 可选
│   ├── models/              # 8 个 Model
│   │   ├── student.py       # 学生账户
│   │   ├── student_profile.py # 6 维 JSONB 画像 + 版本控制
│   │   ├── document_chunk.py  # RAG 文档分块（embedding 用 JSONB 占位）
│   │   ├── resource.py      # 学习资源
│   │   ├── learning_path.py # DAG 学习路径
│   │   ├── exercise.py      # 练习题
│   │   ├── chat_session.py  # 聊天会话
│   │   └── chat_message.py  # 聊天消息
│   ├── agents/              # 6 个 Agent
│   │   ├── profile_agent.py   # 对话式 6 维画像提取
│   │   ├── document_agent.py  # 知识讲解 + 代码 + 音频脚本
│   │   ├── exercise_agent.py  # 自适应练习题生成
│   │   ├── path_agent.py      # 学习路径规划（DAG）
│   │   ├── tutor_agent.py     # RAG 智能问答
│   │   └── master_agent.py    # 多 Agent 编排器（LLM 路由）
│   └── services/
│       ├── minimax_client.py     # httpx OpenAI 兼容格式客户端
│       └── minimax_langchain.py  # LangChain BaseChatModel 封装
├── scripts/init_db.sql      # 手动建库 + 建表 SQL 脚本
├── tests/                   # 空
├── Dockerfile
├── requirements.txt
└── .env                     # API Key（已 gitignore）
```

## API 路由（16 个端点）

| 方法 | 路径 | 标签 | 状态 |
|------|------|------|------|
| GET | `/health` | 健康检查 | ✅ |
| POST | `/api/v1/profile/build` | 学习画像 | ✅ |
| GET | `/api/v1/profile/{student_id}` | 学习画像 | ✅ |
| POST | `/api/v1/resource/generate` | 资源生成 | ✅ |
| GET | `/api/v1/resource/list` | 资源生成 | ✅ |
| POST | `/api/v1/resource/exercises/generate` | 资源生成 | ✅ |
| GET | `/api/v1/resource/exercises/{student_id}` | 资源生成 | ✅ |
| POST | `/api/v1/path/generate` | 学习路径 | ✅ |
| GET | `/api/v1/path/{student_id}` | 学习路径 | ✅ |
| GET | `/api/v1/path/{student_id}/{path_id}` | 学习路径 | ✅ |
| POST | `/api/v1/tutor/ask` | 智能辅导 | ✅（RAG TODO） |
| POST | `/api/v1/tutor/generate` | 智能辅导 | ✅ |
| POST | `/api/v1/chat/stream` | 聊天 | ✅ SSE 流式 |
| GET | `/api/v1/chat/sessions/{student_id}` | 聊天 | ✅ |
| GET | `/api/v1/chat/sessions/{session_id}/messages` | 聊天 | ✅ |

## 数据库

8 张表（开发阶段去掉外键约束）：

| 表名 | 用途 |
|------|------|
| `students` | 学生账户 |
| `student_profiles` | 6 维 JSONB 画像 + 版本控制 |
| `document_chunks` | RAG 文档分块 |
| `resources` | 生成的学习资源 |
| `learning_paths` | DAG 学习路径 |
| `exercises` | 练习题 |
| `chat_sessions` | 聊天会话 |
| `chat_messages` | 聊天消息 |

## 已知问题

- pgvector PostgreSQL 扩展未安装（Python 包已装），embedding 暂用 JSONB
- `tutor.py /generate` 与 `resource.py /generate` 重复
- `echo=True` 在 database.py，生产需关闭

## 测试

```bash
cd backend
pytest tests/ -v
```
