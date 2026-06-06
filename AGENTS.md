# AGENTS.md — 智枢 (ZhiShu)

第十五届中国软件杯 A3 赛题 · 多智能体个性化学习资源生成系统。
硬约束、已知 bug 和架构要点。详细仓库状态见 `CLAUDE.md`。

## 硬约束（违反即废）

- **LLM 必须用讯飞星火 V4**，不能用 OpenAI / Claude / MiniMax。
- **讯飞鉴权**：HTTP 只做 `Authorization: Bearer {api_key}`，不要拼 api_secret。
- **勿用 Google Fonts / Vercel / Sentry**（中国网络不可达）。字体用 `frontend/src/app/fonts/` 本地 woff + `next/font/local`。
- **npm/pip 走国内镜像**：`.npmrc` 已配 npmmirror；pip 超时加 `-i https://pypi.tuna.tsinghua.edu.cn/simple`。

## 后端启动前的 5 个 bug（不修即崩）

| 文件 | 问题 | 修法 |
|------|------|------|
| `backend/app/core/database.py:13` | `await conn.execute("CREATE EXTENSION ...")` 裸字符串 | 包 `text()` |
| `backend/app/models/document_chunk.py:13` | `Vector(1536)` 讯飞 Embedding 实际 1024 维 | 改 `Vector(1024)` |
| `backend/app/services/minimax_*.py` | 整个 MiniMax 客户端是错的 LLM | 删掉，重写为讯飞星火 V4 客户端 |
| `backend/app/services/minimax_langchain.py` | `asyncio.run()` 在已有事件循环里死锁 | 重写为 async-native |
| `backend/app/core/config.py` | 配置指向 `MINIMAX_*` 而非讯飞星火 | 改为 `SPARK_*` 配置 |

此外 `requirements.txt` 末尾的 `anthropic` 依赖删掉。

## 常用命令

```bash
# 基础设施
docker-compose up -d                    # postgres:5432 / redis:6379 / minio:9000+9001

# 后端
cd backend
python -m venv venv; venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
# Swagger: http://localhost:8000/docs

# 前端
cd frontend
npm install
npm run dev                             # http://localhost:3000
npm run build                           # 验证编译（清理 .next 后需要重置缓存）
npm run lint                            # ESLint
```

## 前端现状（7 页面，模板驱动）

`D:\桌面\muban` 有 7 个同名 HTML 模板，前端目前是 **1:1 复刻** 这些模板：

| 路由 | 页面 | 模板文件 |
|------|------|----------|
| `/` | 仪表盘 | yibiaopan.html（无 `'use client'`） |
| `/profile` | 学习画像 | huaxiang.html |
| `/resources` | 资源中心 | zhiyuan.html |
| `/path` | 学习路径 | lujing.html |
| `/tiku` | 练习题库 | tiku.html |
| `/duihua` | 智能对话 | duihua.html |
| `/pinggu` | 学习评估 | pinggu.html |

每个页面（除仪表盘）添加 `'use client'`。所有 CSS 集中在 `globals.css`。共享组件 (`Sidebar`, `Header`) 在 `components/layout/`。静态数据写在 `page.tsx` 内。

## 架构要点

- **8 个子 Agent**：Profile / Document / MindMap / Exercise / Code / Path / Tutor / Video。Master Agent 通过 LangGraph StateGraph 编排，State 字段传递数据。**不要写成 if-else 串 Prompt。**
- **6 维学生画像**（JSONB）：知识掌握 / 学习风格 / 认知水平 / 兴趣 / 薄弱点 / 学习节奏。
- **RAG 流程**（N3 评分技术亮点）：文档解析 → 语义切片(800字/100重叠) → Embedding → pgvector HNSW → LLM 重排 → 来源引用标注 → SourceValidator 验证 → 失败重试。
- **所有生成场景必须流式输出**。`/api/v1/chat/stream` SSE 骨架已有，长任务走 Celery + Redis Pub/Sub → WebSocket。

## 评分优先级（用于排期决策）

| 优先级 | 模块 | 占比 |
|--------|------|------|
| P0 | F1 对话式画像 | 35% |
| P0 | F2 多智能体资源生成 | 45% |
| P1 | F3 学习路径 / N3 防幻觉+流式 | 必做 |
| P2 | F4 智能辅导 / F5 效果评估 | 加分 |

## 写功能前必看

`docs/设计文档/项目设计文档-完整版.md` 有 DB schema、Agent 代码骨架、API 路由和前端组件骨架。**直接落地，不要重写。** F1-F5 定义见 `docs/赛题需求/`。

## 提交规范

前缀：`feat:` / `fix:` / `refactor:` / `docs:` / `chore:` / `test:`。
涉及评分项（流式/防幻觉/多智能体）的改动附说明。勿提交 `.env` 或讯飞 API 密钥。
