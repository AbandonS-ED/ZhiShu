# 智枢(SmartHub) Backend

基于 FastAPI + 7 Agent 的多智能体学习资源生成系统后端。

## 技术栈

- **框架**: FastAPI 0.136 + SQLAlchemy 2.0 async + asyncpg
- **Agent**: 7 个子 Agent + Master Agent 编排器（直接调用 LLM）
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
│   ├── main.py              # 入口（8 个 router + lifespan 初始化）
│   ├── api/                 # 8 个 router：profile / resource / path / tutor / chat / mindmap / dashboard / evaluation
│   ├── core/
│   │   ├── config.py        # Settings（MINIMAX_* + SPARK_* 预留）
│   │   └── database.py      # async SQLAlchemy + pgvector 可选
│   ├── models/              # 9 个 Model
│   │   ├── student.py       # 学生账户
│   │   ├── student_profile.py # 6 维 JSONB 画像 + 版本控制
│   │   ├── document_chunk.py  # RAG 文档分块（embedding 用 JSONB 占位）
│   │   ├── resource.py      # 学习资源
│   │   ├── learning_path.py # DAG 学习路径
│   │   ├── exercise.py      # 练习题
│   │   ├── chat_session.py  # 聊天会话
│   │   ├── chat_message.py  # 聊天消息
│   │   └── learning_record.py # 学习行为记录（F5 评估）
│   ├── agents/              # 7 个 Agent
│   │   ├── profile_agent.py   # 对话式 6 维画像提取
│   │   ├── document_agent.py  # 知识讲解 + 代码 + 音频脚本 + 防幻觉验证
│   │   ├── exercise_agent.py  # 自适应练习题生成 + 防幻觉验证
│   │   ├── path_agent.py      # 学习路径规划（DAG）
│   │   ├── tutor_agent.py     # RAG 智能问答
│   │   ├── mindmap_agent.py   # 思维导图 Mermaid 生成
│   │   └── master_agent.py    # 多 Agent 编排器（LLM 路由）
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
│       ├── text_chunker.py       # 语义切片器
│       └── vector_store.py       # pgvector 检索 + JSONB 降级方案
├── scripts/init_db.sql      # 手动建库 + 建表 SQL 脚本
├── tests/                   # 空
├── Dockerfile
├── requirements.txt
└── .env                     # API Key（已 gitignore）
```

## API 路由（22 个端点）

| 方法 | 路径 | 标签 | 状态 |
|------|------|------|------|
| GET | `/health` | 健康检查 | ✅ |
| POST | `/api/v1/profile/build` | 学习画像 | ✅ |
| GET | `/api/v1/profile/{student_id}` | 学习画像 | ✅ |
| POST | `/api/v1/resource/generate` | 资源生成 | ✅ |
| **POST** | **`/api/v1/resource/generate/stream`** | **资源生成** | **✅ SSE 流式** |
| GET | `/api/v1/resource/list` | 资源生成 | ✅ |
| POST | `/api/v1/resource/exercises/generate` | 资源生成 | ✅ |
| **POST** | **`/api/v1/resource/exercises/generate/stream`** | **资源生成** | **✅ SSE 流式** |
| GET | `/api/v1/resource/exercises/{student_id}` | 资源生成 | ✅ |
| POST | `/api/v1/path/generate` | 学习路径 | ✅ |
| **POST** | **`/api/v1/path/generate/stream`** | **学习路径** | **✅ SSE 流式** |
| GET | `/api/v1/path/{student_id}` | 学习路径 | ✅ |
| GET | `/api/v1/path/{student_id}/{path_id}` | 学习路径 | ✅ |
| POST | `/api/v1/tutor/ask` | 智能辅导 | ✅ RAG 检索已接入 |
| POST | `/api/v1/tutor/generate` | 智能辅导 | ✅ |
| POST | `/api/v1/chat/stream` | 聊天 | ✅ SSE 流式 |
| GET | `/api/v1/chat/sessions/{student_id}` | 聊天 | ✅ |
| GET | `/api/v1/chat/sessions/{session_id}/messages` | 聊天 | ✅ |
| **POST** | **`/api/v1/mindmap/generate`** | **思维导图** | **✅ MindMap Agent** |
| **GET** | **`/api/v1/mindmap/examples`** | **思维导图** | **✅ 示例数据** |
| GET | `/api/v1/dashboard/stats` | 仪表盘 | ✅ 数据聚合 |
| GET | `/api/v1/dashboard/courses` | 仪表盘 | ✅ 课程进度 |
| POST | `/api/v1/evaluation/record` | 效果评估 | ✅ 行为记录 |
| GET | `/api/v1/evaluation/stats/{student_id}` | 效果评估 | ✅ 统计分析 |
| GET | `/api/v1/evaluation/report/{student_id}` | 效果评估 | ✅ 评估报告 |

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

9 张表（开发阶段去掉外键约束）：

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
| `learning_records` | 学习行为记录（F5 评估） |

## 已知问题

- pgvector PostgreSQL 扩展未安装（Python 包已装），embedding 暂用 JSONB
- `tutor.py /generate` 与 `resource.py /generate` 重复
- `echo=True` 在 database.py，生产需关闭

## 测试

```bash
cd backend
pytest tests/ -v
```
