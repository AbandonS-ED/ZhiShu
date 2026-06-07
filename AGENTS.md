# AGENTS.md — 智枢 (ZhiShu)

中国软件杯 A3 · 多智能体个性化学习资源生成系统。详细设计见 `docs/设计文档/项目设计文档-完整版.md`，进度见 `开发进度.md`。

## 硬约束

- **LLM 用讯飞星火 V4**（上线前）。开发阶段用 MiniMax-M3（OpenAI 兼容格式，`.env` 配 `MINIMAX_API_KEY`）。
- **讯飞鉴权**：`Authorization: Bearer {api_key}`，**不拼 api_secret**。
- **禁用** Google Fonts / Vercel / Sentry / OpenAI（中国不可达）。字体走 `frontend/src/app/fonts/` 本地 woff + `next/font/local`。
- **pip** 加 `-i https://pypi.tuna.tsinghua.edu.cn/simple`；npm 已配 `npmmirror`。
- **勿提交** `.env` / API 密钥 / `venv/` / `node_modules/`。MinIO 是 AGPL-3.0。

## 命令

```bash
# 数据库初始化（只需一次）
psql -U postgres -f backend/scripts/init_db.sql

# 后端
cd backend && python -m venv venv && venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000   # Swagger: /docs

# 前端
cd frontend && npm install
npm run dev                             # http://localhost:3000
npm run build                           # ⚠ 会因 TS 错误失败，见下方
```

## 踩过的坑

- **`.next` 缓存损坏**：`npm run build` 后切 `npm run dev` 报 `Cannot find module` → 杀 node → `Remove-Item frontend/.next -Recurse` → 重启。不是代码 bug。
- **`resources/page.tsx:313`**：`r.type` 索引 TS 错误，`npm run build` 失败但 `dev` 正常。需 `as ResourceType` 或类型守卫。
- **pgvector**：Python 包已装，PostgreSQL 扩展未装。`embedding` 暂用 JSONB 占位，向量检索不可用。
- **`echo=True`**：`database.py` SQL 日志输出，生产需关。
- **MiniMax base URL**：`https://api.minimax.chat/v1`（注意：没有 `i`，不是 `minimaxi`）。
- **`tutor.py /generate` 与 `resource.py /generate` 重复**，待清理。

## 架构

**后端**：FastAPI + SQLAlchemy async + asyncpg + PostgreSQL 18。8 张表，无外键约束（开发阶段去掉）。

```
backend/app/
├── main.py              # lifespan 初始化 (minimax_client + init_db) + 5 router 注册
├── api/                 # profile / resource / path / tutor / chat
├── agents/              # 6 Agent：Profile / Document / Exercise / Path / Tutor / Master
├── models/              # 8 Model：Student / StudentProfile / DocumentChunk / Resource / LearningPath / Exercise / ChatSession / ChatMessage
├── services/            # minimax_client.py (httpx OpenAI 兼容) + minimax_langchain.py (LangChain wrapper)
└── core/                # config.py (Settings) + database.py (async engine)
```

**Master Agent 编排**：用户消息 → LLM 路由判断意图 → 派给子 Agent → SSE 流式返回。State 用 `MasterState(TypedDict)` 传递。

**前端**：Next.js 14 App Router + Tailwind。7 页面全部假数据，0 个 fetch 调用。CSS 集中在 `globals.css`，无 shadcn/ui。`types/index.ts` 和 `stores/appStore.ts` 已准备但未接入。

## 评分优先级

| 优先级 | 模块 | 占比 | 状态 |
|--------|------|------|------|
| P0 | F1 对话式画像 | 35% | ✅ 后端完成 |
| P0 | F2 多智能体资源生成 | 45% | ⚠ 缺 MindMap Agent |
| P1 | F3 路径 / N3 防幻觉+流式 | 必做 | ✅ 路径完成 |
| P2 | F4 智能辅导 / F5 效果评估 | 加分 | ⚠ RAG 空 |

## 提交规范

`feat:` / `fix:` / `refactor:` / `docs:` / `chore:` / `test:`。涉及评分项（流式/防幻觉/多智能体）的改动附说明。CRLF/LF 警告是 Windows 正常现象，不要修。
