# CLAUDE.md

智枢 (SmartHub) —— 第十五届中国软件杯 A3 赛题：基于大模型的个性化资源生成与学习多智能体系统。

## 仓库现状（2026-06-07）

```
SmartHub/
├── frontend/                       # Next.js 14.2.5 + Tailwind + TypeScript
│   ├── src/app/
│   │   ├── page.tsx                # / 仪表盘（无 'use client'）
│   │   ├── duihua/page.tsx         # /duihua 智能对话
│   │   ├── profile/page.tsx        # /profile 学习画像
│   │   ├── resources/page.tsx      # /resources 资源中心
│   │   ├── path/page.tsx           # /path 学习路径
│   │   ├── tiku/page.tsx           # /tiku 练习题库
│   │   ├── pinggu/page.tsx         # /pinggu 学习评估
│   │   └── globals.css             # 所有 7 页 CSS 合并（745 行）
│   ├── src/components/layout/
│   │   ├── Sidebar.tsx             # 通用侧边栏导航
│   │   └── Header.tsx              # 通用页面头部
│   └── .npmrc                      # npmmirror 国内镜像
├── backend/                        # FastAPI 骨架
│   ├── app/
│   │   ├── main.py                 # 入口，5 router 注册
│   │   ├── api/                    # 5 个 router，全部 stub
│   │   ├── core/                   # config.py + database.py（有 bug）
│   │   ├── models/                 # Student / StudentProfile / DocumentChunk
│   │   └── services/               # minimax_client.py + minimax_langchain.py（错的 LLM）
│   └── tests/                      # __init__.py 空
├── docs/                           已分类文档
├── 开发进度.md                      实时进度
├── AGENTS.md                       协作文档
└── docker-compose.yml              postgres+pgvector / redis / minio
```

**实际状态**：
- ✅ 前端 **7 页面完整可跑**（模板 1:1 复刻，`npm run build` + `npm run lint` 通过）
- ⚠️ 后端是骨架——5 个 router 全是占位、3 张表、0 个 Agent、0 测试
- ⚠️ MiniMax LLM 客户端必须替换为讯飞星火 V4
- ⚠️ 5 个已知 bug（见下方）

## 技术栈（已锁定）

| 层 | 选型 | 备注 |
|---|---|---|
| 前端 | Next.js 14.2.5 (App Router) + Tailwind 3.4 + TypeScript | 无 shadcn/ui，纯自定义 CSS |
| 后端 | FastAPI 0.136 + SQLAlchemy 2.0 async + asyncpg | Python 3.11 |
| Agent | LangGraph + LangChain | 待搭建 |
| LLM | 讯飞星火 V4 | **勿用 OpenAI/Claude/MiniMax** |
| 向量库 | pgvector | **实际维度 1024** |
| 数据库 | PostgreSQL 16 + Redis 7 + MinIO | AGPL-3.0 需 LICENSE |

## 中国网络约束

- **Google Fonts / Vercel / Sentry 不可达**。字体用 `frontend/src/app/fonts/` 本地 woff + `next/font/local`
- npm registry: `.npmrc` 已配 `registry.npmmirror.com`
- PyPI: `pip install -i https://pypi.tuna.tsinghua.edu.cn/simple`

## 命令

```bash
# 基础设施
docker-compose up -d

# 后端
cd backend
python -m venv venv; venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# 前端
cd frontend
npm install
npm run dev          # http://localhost:3000
npm run build        # ✅ 已验证通过
npm run lint         # ✅ 通过
```

## 已知 bug（动手前必读）

1. **`backend/app/core/database.py:13`** —— `await conn.execute("CREATE EXTENSION ...")` 缺 `text()` 包装。修法：`from sqlalchemy import text; await conn.execute(text(...))`
2. **`backend/app/models/document_chunk.py:13`** —— `Vector(1536)` 应为 `Vector(1024)`（讯飞 Embedding 实际维度）
3. **`backend/app/services/minimax_*.py`** —— 整个 MiniMax 客户端是错的 LLM，删除后替换为讯飞星火 V4 客户端
4. **`backend/app/core/config.py`** —— 配置指向 `MINIMAX_*`，应改为 `SPARK_*`（讯飞星火）配置
5. **`backend/app/services/minimax_langchain.py`** —— `_stream`/`_generate` 中 `asyncio.run()` 在已有事件循环里死锁，须重写为 async-native

## 架构要点

- **8 子 Agent**：Profile / Document / MindMap / Exercise / Code / Path / Tutor / Video。LangGraph StateGraph 编排，**不要 if-else 串 Prompt**
- **6 维学生画像**（JSONB）：知识掌握 / 学习风格 / 认知水平 / 兴趣 / 薄弱点 / 学习节奏
- **RAG 流程**：文档解析 → 语义切片(800字/100重叠) → Embedding → pgvector HNSW → LLM 重排 → 来源引用 → SourceValidator → 失败重试
- **所有生成场景必须流式输出**：`/api/v1/chat/stream` SSE 骨架已有

## 前端约定

所有页面（除仪表盘）加 `'use client'`。CSS 集中在 `globals.css`。静态数据写在 `page.tsx` 内，不拆分 data 文件。

## 评分优先级

| 优先级 | 模块 | 占比 |
|--------|------|------|
| P0 | F1 对话式画像 | 35% |
| P0 | F2 多智能体资源生成 | 45% |
| P1 | F3 学习路径 / N3 防幻觉+流式 | 必做 |
| P2 | F4 智能辅导 / F5 效果评估 | 加分 |

## 写功能前先看

`docs/设计文档/项目设计文档-完整版.md` —— 有 DB schema、Agent 骨架、API 路由。**直接落地，不要重写。**

## 提交规范

前缀：`feat:` / `fix:` / `refactor:` / `docs:` / `chore:` / `test:`。
涉及评分项的改动附说明。勿提交 `.env` 或 API 密钥。
