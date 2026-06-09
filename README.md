# 智枢(SmartHub) - 多智能体个性化学习资源生成系统

> 第十五届中国软件杯 A3 赛题。基于大模型的个性化学习资源生成与学习多智能体系统。  
> **最新状态**：2026-06-09 端到端冒烟测试通过（9/9 API 200 + 真实数据），详情见 [`SMOKE_TEST_REPORT.md`](SMOKE_TEST_REPORT.md)

## 技术栈

- **前端**: Next.js 14.2.5 + Tailwind 3.4 + TypeScript（纯自定义 CSS，无 shadcn/ui）
- **后端**: FastAPI 0.136 + SQLAlchemy 2.0 async + asyncpg
- **Agent**: 7 个子 Agent + Master Agent 编排器（全部实现，直接调用 LLM，不走 LangGraph StateGraph）
- **LLM**: MiniMax-M3（开发）→ 讯飞星火 V4（上线前切换，改 1 个环境变量即可）
- **数据库**: PostgreSQL 18 + Redis（本地安装，无 Docker 跑后端）
- **防幻觉**: PatternDetector + SourceValidator + LLMValidator 三层验证（N3 必做项）
- **RAG**: 文档解析 → 语义切片 → Embedding → 向量检索 → LLM 重排（已实现 5 个 Service）
- **SSE**: 全部 6 个生成接口支持真逐 token 流式（chat/stream 1032 tokens / 31s 实测）

## 项目结构

```
ZhiShu/
├── frontend/              # 7 页面 Next.js 前端（全部已联调后端）
│   └── src/
│       ├── app/             # 7 路由（/  /duihua  /profile  /resources  /path  /tiku  /pinggu）
│       ├── components/layout/  # Sidebar（7 项菜单 + 可折叠）+ Header
│       ├── lib/             # api.ts（SSE 客户端）+ student.ts（UUID）+ utils.ts（markdown）
│       ├── stores/appStore.ts  # Zustand（未使用）
│       └── types/index.ts      # TS 接口（未使用）
├── backend/               # FastAPI 完整后端
│   └── app/
│       ├── main.py          # 8 router + lifespan 初始化 LLM
│       ├── api/             # 8 router: profile/resource/path/tutor/chat/mindmap/dashboard/evaluation
│       ├── agents/          # 7 Agent: profile/document/exercise/path/tutor/mindmap/master
│       ├── models/          # 9 Model（无外键约束）
│       ├── services/        # 11 Service: LLM 客户端×2 / RAG×5 / 防幻觉 / 内容安全 / 评估 / JSON / Celery
│       └── core/            # config.py + database.py + celery_config.py
├── tests/                 # 端到端冒烟测试 (smoke_test.py + 5 个 debug 脚本)
├── docs/                  # 赛题需求 / 设计文档 / 开发流程 / 运维测试 / 交付物
├── 开发进度.md              # 实时进度跟踪
├── AGENTS.md              # 团队协作文档（硬约束 + 命令）
├── CLAUDE.md              # 项目技术文档（架构 + 已知问题）
├── SMOKE_TEST_REPORT.md   # 端到端测试报告
├── docker-compose.yml     # postgres+pgvector / redis / minio（**仅作参考**）
└── .env.example           # MINIMAX_API_KEY / SPARK_API_KEY / LLM_PROVIDER
```

## 快速开始

```bash
# 1. 初始化数据库（只需一次）
psql -U postgres -f backend/scripts/init_db.sql

# 2. 后端（默认 8001，详见 CLAUDE.md "端口现状"）
cd backend
python -m venv venv; venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8001
# Swagger: http://localhost:8001/docs

# 3. 前端
cd frontend
npm install
npm run dev
# 访问 http://localhost:3000

# 4. 端到端冒烟测试（9 API 验证）
cd backend
python -m tests.smoke_test
```

> 端口注意：`frontend/src/lib/api.ts:5` 的 `BASE_URL` 与后端实际端口要一致。当前默认 `8001`。`8000` 在 Windows 上有"僵尸 socket"问题（进程死后端口还被占）。

## 进度

| 模块 | 状态 |
|------|------|
| 前端 7 页面 | ✅ 已完成（模板复刻 + 7 页全部联调后端） |
| 后端 9 表 + 7 Agent + 22 唯一 API + 11 Service | ✅ 已完成 |
| **端到端冒烟测试** | **✅ 9/9 API 200（2026-06-09，见 SMOKE_TEST_REPORT.md）** |
| F1 对话式画像 | ✅ 后端+前端完成 |
| **F2 多智能体资源生成** | **✅ MindMap Agent + Document/Exercise/Path 全部联调；练习题 dual-format 流式 6/9 修复** |
| F3 学习路径 | ✅ 后端+前端完成（7/14/30 天可配） |
| **N3 防幻觉 + 流式** | **✅ 防幻觉三层（resource/exercise 接入）+ 6 个生成接口 SSE 真流式** |
| F4 智能辅导 | ✅ Tutor Agent RAG 接入完成，前端已联调 |
| F5 效果评估 | ✅ 后端+前端完成（行为记录 + 统计 + 报告） |
| 部署与交付 | ⚠️ Docker 配置完成但后端本地裸跑；MinIO / Celery 异步任务未启用 |

## 评分项状态

| 优先级 | 模块 | 占比 | 状态 |
|--------|------|------|------|
| P0 | F1 对话式画像 | 35% | ✅ 后端+前端完成，6 维 JSON |
| P0 | F2 多智能体资源生成 | 45% | ✅ MindMap + Document + Exercise + Path 4 Agent 联调 |
| P1 | F3 路径 / N3 防幻觉+流式 | 必做 | ✅ 全部完成 |
| P2 | F4 智能辅导 / F5 效果评估 | 加分 | ✅ Tutor RAG + 评估报告 |
| 硬约束 | LLM 必须用讯飞星火 V4 | — | ⚠️ 当前 MiniMax-M3 跑通，**比赛前需切换**（改 .env 2 行） |

详情见 [`开发进度.md`](开发进度.md) 和 [`AGENTS.md`](AGENTS.md)，关键技术决策见 [`CLAUDE.md`](CLAUDE.md)，最新端到端测试结果见 [`SMOKE_TEST_REPORT.md`](SMOKE_TEST_REPORT.md)。
