# 智枢(SmartHub) - 多智能体个性化学习资源生成系统

> 第十五届中国软件杯 A3 赛题。基于大模型的个性化资源生成与学习多智能体系统。
> **最新状态（2026-06-15）**：对话页刷新修复（session持久化+渲染修复+DB content列改Text）+ 对话页出题→题库页做题 + 题库隐藏/清空 + AI出题数量可选 + 答案格式三层防护 + 题库去重限容。114 pytest 全过，**5 次**冒烟验证 9/9 PASS，管理员账号 `admin/admin123` 已就绪。

## 技术栈

- **前端**: Next.js 14.2.5 + Tailwind 3.4 + TypeScript（纯自定义 CSS，无 UI 组件库）
- **后端**: FastAPI 0.136 + SQLAlchemy 2.0 async + asyncpg + 8 Agent + 10 Router + **12 Service + MessageBus**
- **Agent**: LangGraph StateGraph **10 节点** 编排 + 7 子 Agent（Initial Assessment / Document / Exercise / Path / Tutor / MindMap / Audio + Master 调度）
- **LLM**: MiniMax-M3（开发）→ 讯飞星火 V4（上线前切换，改 1 个环境变量 `LLM_PROVIDER=spark`）
- **数据库**: PostgreSQL 18 + **11 张表** + 14 索引 + JSONB（向量用 JSONB 占位，pgvector 扩展未安装）
- **认证**: bcrypt 密码哈希 + JWT（HS256，7 天过期）+ 全 33 个业务端点门禁
- **学生画像**: 5 维（理解力/记忆力/应用转化/想象力/专注力 + confidence），由 `initial_assessment_agent` 对话式评估
- **防幻觉（N3 必做项）**: PatternDetector + SourceValidator + LLMValidator 三层验证
- **RAG**: 文档解析 → 语义切片 → Embedding → 向量检索 → LLM 重排（5 个 Service）
- **SSE**: 4 个真流式端点（含 dual-format 协议，markdown + JSON 同传）
- **管理后台**: `/admin` 路由前缀，独立布局、独立 token（`zhishu_admin_token`），与学生端完全隔离；题库 CRUD 6 个端点

## 项目结构

```
ZhiShu/
├── frontend/                      # Next.js 前端（9 学生页 + 9 管理页 + 2 布局 + 3 lib + 1 store）
│   └── src/
│       ├── app/
│       │   ├── layout.tsx           # 全局布局（Sidebar + Header，/admin /login 跳过）
│       │   ├── globals.css          # 设计系统（米色/墨黑/琥珀，含 admin + set- 样式）
│       │   ├── page.tsx             # / 仪表盘
│       │   ├── login/               # 登录注册页（独立布局）
│       │   ├── duihua/ profile/ resources/ path/ tiku/ pinggu/ setting/  # 7 个学生页面
│       │   └── admin/               # ⭐ 管理后台（独立布局 + 权限拦截）
│       │       ├── layout.tsx       # 管理后台布局（侧边栏 + Header + 登出）
│       │       ├── page.tsx         # 仪表盘
│       │       ├── login/           # 管理员登录
│       │       ├── users/  resources/  exercises/  paths/  chats/  documents/  agents/
│       ├── components/layout/        # 学生端 Sidebar + Header
│       ├── lib/                     # api.ts（自动带 token）/ student.ts / utils.ts
│       │                            # admin/context.tsx + admin/components.tsx
│       ├── stores/appStore.ts       # Zustand（已接入 Sidebar 实时刷新）
│       └── types/index.ts           # TS 13 接口定义
├── backend/                       # FastAPI 完整后端
│   └── app/
│       ├── main.py                 # 10 router + lifespan
│       ├── api/                    # 10 router（auth / profile / resource / path / tutor / chat / mindmap / dashboard / evaluation / admin_exercises）= 33 唯一端点
│       ├── agents/                 # 8 Agent + StateGraph 10 节点 + MessageBus
│       ├── models/                 # 11 Model（含 exercise_bank + learning_record + learning_activity_log）
│       ├── services/               # 12 Service
│       └── core/                   # config / database / dependencies / security / celery_config
├── tests/                         # smoke_test.py + 7 个 pytest（114 测试）+ 6 个 debug
├── docs/                          # 设计文档 / 开发流程 / 运维测试 / 交付物 / 赛题需求
├── scripts/                       # init_db.sql + init_admin.py + migrate_exercise_bank.sql + run_migration.py
├── 开发进度.md                      # 实时进度跟踪
├── AGENTS.md                      # 团队协作文档
├── CLAUDE.md                      # 项目技术文档
├── SMOKE_TEST_REPORT.md           # 冒烟测试记录（5 次）
├── docker-compose.yml             # postgres+pgvector / redis / minio
└── .env.example                   # 环境变量模板
```

## 快速开始

```bash
# 1. 初始化数据库 + 管理员账号（只需一次）
psql -U postgres -f backend/scripts/init_db.sql
cd backend && venv\Scripts\python scripts\init_admin.py

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
cd backend && python -m pytest tests/ -v

# 5. 端到端冒烟测试（4 次 9/9 PASS）
cd backend && python -m tests.smoke_test
```

## 演示入口

```bash
学生端:  http://localhost:3000            （注册 → 登录 → 使用全部功能）
管理端:  http://localhost:3000/admin/login  （admin / admin123 登录）
API 文档: http://localhost:8001/docs
```

## 进度总览

| 模块 | 状态 |
|------|------|
| **前端 9 学生页** | ✅ 已完成（模板 1:1 复刻 + 全部联调后端，含设置页） |
| **前端 9 管理页** | ✅ 已完成（含批量删除、搜索筛选、详情弹窗、题库 CRUD、DAG 可视化） |
| **后端 11 表 + 8 Agent + 10 Router + 12 Service + MessageBus** | ✅ 已完成 |
| **登录注册系统** | ✅ 已完成（bcrypt + JWT + 全 33 业务端点门禁） |
| **管理后台权限** | ✅ 已完成（role 字段 + is_active + last_login + bcrypt） |
| **P0 全部 10 个问题** | ✅ 已修复 |
| **单元测试** | ✅ **114** 个 pytest 全 PASS |
| **端到端冒烟测试** | ✅ **5** 次验证 9/9 API 200 |
| F1 对话式画像 | ✅ 后端+前端完成（**5 维**，35% 评分项） |
| F2 多智能体资源生成 | ✅ StateGraph **10 节点** + 7 子 Agent（45% 评分项） |
| F3 学习路径 | ✅ 后端+前端完成（7/14/30 天可配，DAG 可视化） |
| N3 防幻觉 + 流式 | ✅ 三层防幻觉 + 4 个 SSE 流式端点 |
| F4 智能辅导 | ✅ Tutor Agent RAG 接入（embedding + vector_store + reranker） |
| F5 效果评估 | ✅ learning_records + 统计 + 报告 |
| **对话→题库联动** | ✅ StateGraph exercise 保存 DB + 跳转链接 + ?kp= 自动聚焦 |
| **题库页增强** | ✅ 隐藏/清空 + AI 出题数量可选 + 答案格式三层防护 + 去重限容 |
| **对话页刷新修复** | ✅ sessionId 持久化 + loadSession 渲染修复 + DB content 列改 TEXT |
| 部署与交付 | ⚠️ Docker 配置完成但本地裸跑，LLM 比赛前需切讯飞星火 V4 |

## 评分项状态

| 优先级 | 模块 | 占比 | 状态 |
|--------|------|------|------|
| P0 | F1 对话式画像 | 35% | ✅ |
| P0 | F2 多智能体资源生成 | 45% | ✅ |
| P1 | F3 路径 / N3 防幻觉+流式 | 必做 | ✅ |
| P2 | F4 智能辅导 / F5 效果评估 | 加分 | ✅ |
| 加分 | 管理后台 | 加分 | ✅ |
| 硬约束 | LLM 必须用讯飞星火 V4 | — | ⚠️ 当前 MiniMax-M3，**比赛前 1 个环境变量切换** |

详情见 [`开发进度.md`](开发进度.md)、[`AGENTS.md`](AGENTS.md)、[`CLAUDE.md`](CLAUDE.md)、[`SMOKE_TEST_REPORT.md`](SMOKE_TEST_REPORT.md)、[`docs/设计文档/管理后台设计文档.md`](docs/设计文档/管理后台设计文档.md)。
