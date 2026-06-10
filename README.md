# 智枢(SmartHub) - 多智能体个性化学习资源生成系统

> 第十五届中国软件杯 A3 赛题。基于大模型的个性化学习资源生成与学习多智能体系统。  
> **最新状态**：2026-06-11 登录注册系统完成（bcrypt + JWT + 全路由门禁），119 pytest 全过，4 次冒烟验证通过。

## 技术栈

- **前端**: Next.js 14.2.5 + Tailwind 3.4 + TypeScript（纯自定义 CSS）
- **后端**: FastAPI 0.136 + SQLAlchemy 2.0 async + asyncpg + 8 Agent + 27 唯一 API + 12 Service
- **Agent**: LangGraph StateGraph 13 节点编排 + 8 个 Agent（全部实现）
- **LLM**: MiniMax-M3（开发）→ 讯飞星火 V4（上线前切换，改 1 个环境变量）
- **数据库**: PostgreSQL 18 + Redis（本地安装）
- **防幻觉**: PatternDetector + SourceValidator + LLMValidator 三层验证（N3 必做项）
- **RAG**: 文档解析 → 语义切片 → Embedding → 向量检索 → LLM 重排（已实现 5 个 Service）
- **SSE**: 4 个 SSE 流式端点（含 dual-format 协议）

## 项目结构

```
ZhiShu/
├── frontend/              # 8 页面 Next.js 前端（全部已联调后端）
│   └── src/
│       ├── app/             # 8 路由（/ /login /duihua /profile /resources /path /tiku /pinggu）
│       ├── components/layout/  # Sidebar + Header（含退出按钮）
│       ├── lib/             # api.ts（自动带 token）/ student.ts / utils.ts
│       ├── stores/          # Zustand（未使用）
│       └── types/           # TS 接口（未使用）
├── backend/               # FastAPI 完整后端
│   └── app/
│       ├── main.py          # 9 router + lifespan
│       ├── api/             # 9 router（含 auth，27 端点）
│       ├── agents/          # 8 Agent + StateGraph + MessageBus
│       ├── models/          # 9 Model（students 含 password_hash）
│       ├── services/        # 12 Service
│       └── core/            # config.py / database.py / dependencies.py / security.py / celery_config.py
├── tests/                 # smoke_test.py + 7 个 pytest 文件（119 测试）
├── docs/                  # 设计文档 / 开发流程 / 交付物 / 赛题需求
├── 开发进度.md              # 实时进度跟踪
├── AGENTS.md              # 团队协作文档
├── CLAUDE.md              # 项目技术文档
├── SMOKE_TEST_REPORT.md   # 四次冒烟测试记录
├── docker-compose.yml     # postgres+pgvector / redis / minio
└── .env.example           # 环境变量模板
```

## 快速开始

```bash
# 1. 初始化数据库（只需一次）
psql -U postgres -f backend/scripts/init_db.sql

# 2. 后端（默认 8001）
cd backend
python -m venv venv; venv\Scripts\activate
pip install -i https://pypi.tuna.tsinghua.edu.cn/simple -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8001

# 3. 前端
cd frontend
npm install
npm run dev     # http://localhost:3000

# 4. 单元测试（119 pytest）
cd backend
python -m pytest tests/ -v

# 5. 端到端冒烟测试
cd backend
python -m tests.smoke_test
```

## 进度

| 模块 | 状态 |
|------|------|
| 前端 8 页面 | ✅ 已完成（模板复刻 + 全部联调后端，含登录注册页） |
| 后端 9 表 + 8 Agent + 27 唯一 API + 12 Service | ✅ 已完成 |
| **登录注册系统** | **✅ 已完成**（bcrypt 密码哈希 + JWT + 全路由门禁） |
| **P0 全部 10 个问题** | **✅ 已修复（UUID 校验/建表/embed_text/3 页面硬编码）** |
| **单元测试** | **✅ 119 个 pytest 测试 PASS** |
| **端到端冒烟测试** | **✅ 4 次验证：9/9 API 200** |
| F1 对话式画像 | ✅ 后端+前端完成 |
| F2 多智能体资源生成 | ✅ StateGraph 编排 + 4 Agent 联调 + dual-format 流式 |
| F3 学习路径 | ✅ 后端+前端完成（7/14/30 天可配） |
| N3 防幻觉 + 流式 | ✅ 防幻觉三层 + 4 个 SSE 流式端点 |
| F4 智能辅导 | ✅ Tutor Agent RAG 接入完成 |
| F5 效果评估 | ✅ 行为记录 + 统计 + 报告 |
| 部署与交付 | ⚠️ Docker 配置完成但本地裸跑 |

## 评分项状态

| 优先级 | 模块 | 占比 | 状态 |
|--------|------|------|------|
| P0 | F1 对话式画像 | 35% | ✅ |
| P0 | F2 多智能体资源生成 | 45% | ✅ |
| P1 | F3 路径 / N3 防幻觉+流式 | 必做 | ✅ |
| P2 | F4 智能辅导 / F5 效果评估 | 加分 | ✅ |
| 硬约束 | LLM 必须用讯飞星火 V4 | — | ⚠️ 当前 MiniMax-M3，**比赛前需切换** |

详情见 [`开发进度.md`](开发进度.md)、[`AGENTS.md`](AGENTS.md)、[`CLAUDE.md`](CLAUDE.md)、[`SMOKE_TEST_REPORT.md`](SMOKE_TEST_REPORT.md)。
