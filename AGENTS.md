# AGENTS.md — 智枢 (ZhiShu)

第十五届中国软件杯 A3 赛题 · 多智能体个性化学习资源生成系统。详细仓库状态见 `CLAUDE.md`，进度跟踪见 `开发进度.md`。

## 硬约束（违反即废）

- **LLM 必须用讯飞星火 V4**，禁用 OpenAI / Claude / MiniMax。
- **讯飞鉴权**：HTTP 只做 `Authorization: Bearer {api_key}`，**不要拼 api_secret**。
- **勿用 Google Fonts / Vercel / Sentry**（中国网络不可达）。字体走 `frontend/src/app/fonts/` 本地 woff + `next/font/local`。
- **包管理走国内镜像**：`frontend/.npmrc` 已配 `npmmirror`；pip 超时加 `-i https://pypi.tuna.tsinghua.edu.cn/simple`。
- **勿提交 `.env` / API 密钥**。`MinIO` 是 AGPL-3.0，部署时需附 LICENSE。

## 后端启动前的 5 个 bug（必修）

| 文件 | 问题 | 修法 |
|------|------|------|
| `backend/app/core/database.py:13` | `await conn.execute("CREATE EXTENSION ...")` 裸字符串 | `from sqlalchemy import text` 后包 `text()` |
| `backend/app/models/document_chunk.py:13` | `Vector(1536)` 讯飞 Embedding 实际 1024 维 | 改 `Vector(1024)` |
| `backend/app/services/minimax_*.py` | 整个 MiniMax 客户端是错的 LLM | 删除，重写为讯飞星火 V4 客户端 |
| `backend/app/services/minimax_langchain.py` | `asyncio.run()` 在已有事件循环里死锁 | 重写为 async-native（httpx + async generator） |
| `backend/app/core/config.py` | 配置指向 `MINIMAX_*` 而非讯飞星火 | 改为 `SPARK_*` 字段名 |

`backend/requirements.txt` 末尾的 `anthropic` 依赖一并删掉（已不用）。

## 命令

```bash
# 基础设施
docker-compose up -d                    # postgres+pgvector / redis / minio

# 后端
cd backend && python -m venv venv && venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000   # Swagger: /docs

# 前端
cd frontend && npm install
npm run dev                             # http://localhost:3000
npm run build                           # ⚠ 见下方"陷阱"
npm run lint
```

## 常见陷阱

- **`.next` 缓存损坏**：`npm run build` 后切回 `npm run dev` 经常报 `Cannot find module './<id>.js'`。解法：杀掉 node 进程 → `Remove-Item frontend/.next -Recurse` → 重启 dev server。这是 Next.js 已知问题，**不是代码 bug**。
- **`resources/page.tsx:313` 有预存在 TS 错误**（`r.type` 被推断为 `string` 无法索引 `Record<ResourceType, ...>`）。与本次提交无关，先 `as ResourceType` 或加类型守卫。`npm run build` 会因此失败；`npm run dev` 不影响。
- **后端启动 5 个 bug 未修就崩**。先全修完再 `uvicorn`。
- **不要 pip 装 MiniMax 依赖**。仓库里 `minimax_*.py` 是占位代码，**必须删掉**重写为讯飞。

## 前端现状（7 页面，模板驱动）

`D:\桌面\muban` 有 7 个同名 HTML 模板，前端是 **1:1 复刻**。

| 路由 | 页面 | 模板 |
|------|------|------|
| `/` | 仪表盘 | yibiaopan.html（**无** `'use client'`） |
| `/duihua` `/profile` `/resources` `/path` `/tiku` `/pinggu` | 其余 6 页 | 加 `'use client'` |

**约定**：所有 CSS 在 `src/app/globals.css`（745 行）。静态数据直接写 `page.tsx` 内，不抽 data 文件。**无 shadcn/ui、无 zustand**，全自定义 CSS + React `useState`。

**共享组件**：`components/layout/Sidebar.tsx`（client，含收起/展开切换按钮，chevron 在 brand 行尾）+ `Header.tsx`（client）。收起时 sidebar 宽度 240→64px，仅显示图标。

## 架构要点

- **8 个子 Agent**：Profile / Document / MindMap / Exercise / Code / Path / Tutor / Video。Master Agent 用 LangGraph `StateGraph` 编排，State 字段传递数据。**不要写成 if-else 串 Prompt。**
- **6 维学生画像**（JSONB）：知识掌握 / 学习风格 / 认知水平 / 兴趣 / 薄弱点 / 学习节奏。
- **RAG 流程**（N3 评分技术亮点）：文档解析 → 语义切片(800字/100重叠) → Embedding → pgvector HNSW → LLM 重排 → 来源引用 → SourceValidator 验证 → 失败重试。
- **所有生成场景必须流式输出**。`/api/v1/chat/stream` SSE 骨架已有，长任务走 Celery + Redis Pub/Sub → WebSocket。

## 评分优先级（排期用）

| 优先级 | 模块 | 占比 |
|--------|------|------|
| P0 | F1 对话式画像 | 35% |
| P0 | F2 多智能体资源生成 | 45% |
| P1 | F3 学习路径 / N3 防幻觉+流式 | 必做 |
| P2 | F4 智能辅导 / F5 效果评估 | 加分 |

## 写功能前必看

`docs/设计文档/项目设计文档-完整版.md` —— 含 DB schema、Agent 骨架、API 路由。**直接落地，不要重写。** F1-F5 定义见 `docs/赛题需求/`。

## 提交规范

前缀：`feat:` / `fix:` / `refactor:` / `docs:` / `chore:` / `test:`。
涉及评分项（流式 / 防幻觉 / 多智能体）的改动附一句说明。
