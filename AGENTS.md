# AGENTS.md

## Project Context

Competition project: 第十五届中国软件杯 A3 赛题 — multi-agent personalized learning resource system. **Must use 讯飞星火 V4** as the LLM (硬约束, not optional). Course: 人工智能导论.

## Commands

```bash
# Infra (from repo root)
docker-compose up -d              # postgres:5432 / redis:6379 / minio:9000+9001

# Backend (PowerShell)
cd backend
venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
# Swagger: http://localhost:8000/docs

# Frontend
cd frontend
npm install
npm run dev                       # http://localhost:3000

# Tests (not yet configured — pytest stubs only)
cd backend && pytest tests/ -v
```

## Locked Tech Stack — Do Not Substitute

| Layer | Choice |
|-------|--------|
| Frontend | Next.js 14 (App Router) + Tailwind + shadcn/ui |
| Backend | FastAPI 0.136 + SQLAlchemy 2.0 async + asyncpg, Python 3.11 |
| Agent | LangGraph ≥0.2 + LangChain ≥0.3 |
| LLM | 讯飞星火 V4 (NOT OpenAI/Claude) |
| Vector DB | pgvector (actual dim = 1024, see bug #1) |
| DB | PostgreSQL 16 |
| Cache | Redis 7 + Celery 5.6 |
| Storage | MinIO (AGPL-3.0 — needs LICENSE in repo root) |

## Known Bugs in Current Code (Fix Before Building On)

1. **`backend/app/models/document_chunk.py:13`** — `Vector(1536)` is wrong. 讯飞 Embedding is 1024-dim. Must fix schema + all references before any RAG work.
2. **`backend/app/core/database.py:13`** — `await conn.execute("CREATE EXTENSION ...")` needs `text()` wrapper for SQLAlchemy async. Fix: `from sqlalchemy import text; await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))`.
3. **设计文档里的 SparkLangchain `_stream`/`_generate`** — calls `asyncio.run()` inside an already-running event loop → deadlock in LangGraph. Must rewrite as async-native or use `asyncio.to_thread`.
4. **No `.gitignore`** at repo root — must add before first real commit (ignore `backend/venv/`, `backend/.env`, `frontend/node_modules/`, `frontend/.next/`, `__pycache__/`).
5. **讯飞 HTTP auth** — use `Authorization: Bearer {api_key}` only. Do NOT concatenate `api_key:api_secret`.

## Architecture (Not Obvious From Filenames)

- **8 sub-agents**: Profile / Document / MindMap / Exercise / Code / Path / Tutor / Video. Orchestrated by Master Agent via LangGraph StateGraph. Agent间通信通过 State 字段传递, not raw if-else routing.
- **6-dim student profile** stored as JSONB in `student_profiles.dimensions`: `knowledge_mastery / learning_style / cognitive_level / interests / weak_topics / learning_pace`.
- **RAG pipeline**: doc parse → semantic chunk (800字/100 overlap) → Embedding → pgvector HNSW → LLM rerank → source citation annotation → SourceValidator → retry on failure. This is a scoring highlight — do not skip.
- **Streaming is mandatory** for all generation paths. `/api/v1/chat/stream` SSE skeleton exists in `backend/app/api/chat.py`. Long tasks use Celery + Redis Pub/Sub → WebSocket progress.
- **Frontend ReactFlow/Mermaid components** must use `'use client'` + `dynamic(..., { ssr: false })` or App Router compilation fails.

## Design Documents (Read Before Implementing)

- `docs/设计文档/项目设计文档-完整版.md` — full DB schema, 8 Agent code skeletons, API routes, frontend components, 15-day vertical slice plan. **Read the relevant section before writing any new feature; skeletons are already there.**
- `docs/赛题需求/中国软件杯-A3-赛题开发需求.md` — F1-F5 definitions, scoring rubric, pitfalls.
- `docs/开发流程/开发流程文档.md` — 12-phase V1.0 flow (complements the vertical slice plan).

## Scoring Priority

P0: F1 对话式画像 (35%) + F2 多智能体资源生成 (45%). P1: F3 路径 + N3 防幻觉/流式. P2: F4/F5 bonus. All F1-F5 done → demo video/PPT/open-source声明.

## Commit Convention

Prefix: `feat:` / `fix:` / `refactor:` / `docs:` / `chore:` / `test:`. Changes touching scoring features (streaming/RAG/multi-agent) should include 1-2 sentence justification. Never commit `.env` or 讯飞 API keys.
