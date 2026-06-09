# AGENTS.md — 智枢 (ZhiShu)

中国软件杯 A3 · 多智能体个性化学习资源生成系统。设计文档 `docs/设计文档/项目设计文档-完整版.md`，详细架构 + SSE 流式细节见 `CLAUDE.md`，进度见 `开发进度.md`。

## 硬约束

- **LLM**：开发用 MiniMax-M3（`.env` 配 `MINIMAX_API_KEY`），比赛上线前改 2 行切讯飞星火 V4：`LLM_PROVIDER=spark` + `SPARK_API_KEY=xxx`
- **讯飞鉴权**：`Authorization: Bearer {api_key}`，**不拼 api_secret**
- **禁用** Google Fonts / Vercel / Sentry / OpenAI（中国不可达）。字体走 `frontend/src/app/fonts/` 本地 woff + `next/font/local`
- **pip** 加 `-i https://pypi.tuna.tsinghua.edu.cn/simple`；npm 已配 `npmmirror`（`frontend/.npmrc`）
- **勿提交** `.env` / API 密钥 / `venv/` / `node_modules/`

## 命令

```bash
# 数据库初始化（只需一次）
psql -U postgres -f backend/scripts/init_db.sql

# 后端（Swagger: http://localhost:8001/docs）
cd backend && python -m venv venv && venv\Scripts\activate
pip install -i https://pypi.tuna.tsinghua.edu.cn/simple -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8001   # 默认 8001（8000 Windows 僵尸 socket）

# 测试
cd backend && python -m pytest tests/ -v        # 71 个 pytest 单元测试
cd backend && python -m tests.smoke_test        # 端到端冒烟测试 (9 API)

# 前端（http://localhost:3000）
cd frontend && npm install
npm run dev / build / lint
```

跑单文件测试：`python -m pytest tests/test_agents.py -v`（Windows 上不要直接 `pytest tests/`，会报 capture 错误）。

## 踩过的坑（不修会卡住）

- **`.next` 缓存损坏**：`npm run build` 后切 `npm run dev` 报 `Cannot find module` → 杀 node → `Remove-Item frontend/.next -Recurse` → 重启。
- **Windows 8000 端口僵尸 socket**：进程死后端口还被内核占着，taskkill 看不到。**直接用 8001**，同步改 `frontend/src/lib/api.ts:5` BASE_URL。
- **MiniMax base URL**：`https://api.minimax.chat/v1`（没有 `i`，不是 `minimaxi`）。
- **pgvector 扩展未装**：Python 包已装，PostgreSQL 扩展未装。`embedding` 暂用 JSONB 占位，向量检索降级为 Python 余弦相似度。
- **PowerShell 终端 GBK**：LLM 输出含 emoji 会让 `print` 报 `UnicodeEncodeError`。smoke_test 脚本已用 `io.TextIOWrapper(..., errors="replace")` 兜底。
- **CRLF/LF 警告**：Windows 正常现象，不要修。

## 架构要点

- **8 router / 23 唯一 API / 7 Agent / 9 Model / 12 Service / 71 pytest** — 详细结构见 `CLAUDE.md` "仓库现状"。
- **SSE 流式**：4 个真流式端点（`chat/stream` tutor/exercise + `resource/generate/stream` + `resource/exercises/generate/stream`）+ 1 个伪流式（`path/generate/stream`，仅 progress + result）。详见 `CLAUDE.md` SSE 表格。
- **关键词路由**（`chat.py:493`）：`tutor > profile > mindmap > exercise > path > document`，dict 插入顺序即优先级。
- **`<think>` 标签过滤**：流式期间必须用 `chat.py:42-62` 的 `_strip_think` 状态机，否则会吞前端渲染。
- **防幻觉**：6 个 Agent 都接 `anti_hallucination.validate()`（Document/Exercise 走完整三层，Profile/Path/MindMap/Tutor 走 `skip_llm=True` 快速模式）。
- **RAG**：`tutor.py` 的 `/ask` 和 `chat/stream` 的 tutor 分支都走 embedding + vector_store.search + reranker，`document_chunks` 表 embedding 用 JSONB 占位。

## 提交规范

`feat:` / `fix:` / `refactor:` / `docs:` / `chore:` / `test:`。涉及评分项（流式/防幻觉/多智能体）的改动附 1-2 句说明。
