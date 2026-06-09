# AGENTS.md — 智枢 (ZhiShu)

中国软件杯 A3 · 多智能体个性化学习资源生成系统。设计文档见 `docs/设计文档/项目设计文档-完整版.md`，进度见 `开发进度.md`。

## 硬约束

- **LLM**：开发用 MiniMax-M3（`.env` 配 `MINIMAX_API_KEY`），上线前切讯飞星火 V4（`LLM_PROVIDER=spark`）
- **讯飞鉴权**：`Authorization: Bearer {api_key}`，**不拼 api_secret**
- **禁用** Google Fonts / Vercel / Sentry / OpenAI（中国不可达）。字体走 `frontend/src/app/fonts/` 本地 woff + `next/font/local`
- **pip** 加 `-i https://pypi.tuna.tsinghua.edu.cn/simple`；npm 已配 `npmmirror`（`frontend/.npmrc`）
- **勿提交** `.env` / API 密钥 / `venv/` / `node_modules/`

## 命令

```bash
# 数据库初始化（只需一次）
psql -U postgres -f backend/scripts/init_db.sql

# 后端（Swagger: http://localhost:8000/docs）
cd backend && python -m venv venv && venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# 测试（需后端 venv 激活）
cd backend && python -m pytest tests/ -v

# 前端（http://localhost:3000）
cd frontend && npm install
npm run dev
npm run build   # 会因 TS 错误失败，见"踩过的坑"
npm run lint    # next lint
```

## 踩过的坑

- **`.next` 缓存损坏**：`npm run build` 后切 `npm run dev` 报 `Cannot find module` → 杀 node → `Remove-Item frontend/.next -Recurse` → 重启。不是代码 bug。
- **`resources/page.tsx`**：`r.type` 索引 TS 错误，`npm run build` 失败但 `dev` 正常。需 `as ResourceType` 或类型守卫。
- **pgvector**：Python 包已装，PostgreSQL 扩展未装。`embedding` 暂用 JSONB 占位，向量检索不可用。
- **`echo=True`**：`database.py` SQL 日志硬编码，生产需改为 `echo=settings.DEBUG`。
- **MiniMax base URL**：`https://api.minimax.chat/v1`（没有 `i`，不是 `minimaxi`）
- **`minimax_client.chat_stream`**：部分 chunk 把推理内容放 `delta.reasoning_content`（非 `delta.content`），已兜底取值

## 架构

**后端**：FastAPI + SQLAlchemy async + asyncpg + PostgreSQL。8 张表，无外键约束（开发阶段去掉）。

```
backend/app/
├── main.py              # lifespan 初始化 (minimax/spark_client + init_db) + 8 router 注册
├── api/                 # 8 router: profile / resource / path / tutor / chat / mindmap / dashboard / evaluation
├── agents/              # 7 Agent: Profile / Document / Exercise / Path / Tutor / Master / MindMap
├── models/              # 9 Model: Student / StudentProfile / DocumentChunk / Resource / LearningPath / Exercise / ChatSession / ChatMessage / LearningRecord
├── services/            # minimax_client / spark_client / anti_hallucination / content_safety / document_parser / embedding_service / evaluation_service / json_parser / reranker / text_chunker / vector_store / minimax_langchain
└── core/                # config.py (Settings) + database.py (async engine) + celery_config.py
```

**前端**：Next.js 14 App Router + Tailwind。7 页全部联调后端（/ /profile /resources /tiku /path /pinggu /duihua），通过 `src/lib/api.ts` 统一调用。CSS 集中在 `globals.css`（745+ 行自定义设计系统），无 shadcn/ui。`types/index.ts` 和 `stores/appStore.ts` 已准备但未接入。

## SSE 流式（关键实现细节）

`/api/v1/chat/stream` 请求流（`backend/app/api/chat.py`）：

```
请求进入
  ├─ _quick_route(msg)         # 关键词快速路由（tutor 优先匹配）
  │  └─ 未命中 → master_agent.route(state)  # LLM 意图分类
  ├─ tutor/chat 类型 → minimax_client.chat_stream → 真逐 token 流
  └─ 其他类型 → master_agent.execute → SSE 包装 result
  事件序列：session → progress(0.2) → progress(0.4) → token* → result → done
```

**关键词路由优先级**（`_quick_route`，顺序匹配返回第一个命中）：
tutor > profile > mindmap > exercise > path > document

**`<think>` 标签过滤**：MiniMax-M3 回复包含 `<think>...</think>` 推理过程。`chat.py` 流式路径会过滤掉 think 内容，只把 `</think>` 之后的实际回答发给前端。`<think>` 是 HTML 标签，不过滤会吞掉前端渲染内容。

**`event_generator` 会话隔离**：流式期间不能复用请求的 DB session（会锁表导致写操作 hang），需独立 `async_session()`。

**前端 SSE 解析**（`src/lib/api.ts`）：用 `fetch` + `ReadableStream.getReader()` 逐行解析 `data:` 前缀的 JSON 事件，不是 `EventSource`。

**前端 `markdownToHtml`**（`src/lib/utils.ts`）：自定义 Markdown→HTML 转换器（代码块/表格/标题/加粗/列表/链接/引用），不是第三方库。`extractAnswer()` 处理 LLM 响应（JSON/thinking 标签/花括号匹配）。

## 评分优先级

| 优先级 | 模块 | 占比 | 状态 |
|--------|------|------|------|
| P0 | F1 对话式画像 | 35% | ✅ 后端+前端完成 |
| P0 | F2 多智能体资源生成 | 45% | ✅ MindMap Agent 已实现，前端已联调 |
| P1 | F3 路径 / N3 防幻觉+流式 | 必做 | ✅ 路径完成 + ✅ 防幻觉完成 + ✅ 流式完成 |
| P2 | F4 智能辅导 / F5 效果评估 | 加分 | ✅ Tutor Agent RAG 接入 + ✅ 评估模块完成 |

## 提交规范

`feat:` / `fix:` / `refactor:` / `docs:` / `chore:` / `test:`。涉及评分项（流式/防幻觉/多智能体）的改动附说明。CRLF/LF 警告是 Windows 正常现象，不要修。
