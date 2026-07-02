# 智枢 (SmartHub) - 多智能体个性化学习资源生成系统

> 第十五届中国软件杯 A3 赛题。基于大模型的个性化资源生成与学习多智能体系统。

## 项目简介

智枢 (SmartHub) 是一个面向《人工智能导论》课程的多智能体个性化学习系统。通过 9 个 AI Agent 协同工作，为学生提供对话式学习画像评估、个性化学习资源生成、智能学习路径规划、RAG 智能辅导和效果评估等服务。

### 核心功能

- **F1 对话式画像 (35%)** — 7 维学生画像评估（理解力/记忆力/应用转化/想象力/专注力/学习节奏/知识广度）
- **F2 多智能体资源生成 (45%)** — 9 Agent 协同生成学习资源
- **F3 学习路径规划** — DAG 可视化路径 + 每日学习计划
- **F4 智能辅导** — RAG 问答 + 多轮对话上下文
- **F5 效果评估** — LLM 生成评估报告 + 趋势分析
- **管理后台** — 仪表盘 + 用户/资源/题库管理 + Agent 监控 + 手机验证码注册 + 用户删除

## 技术栈

| 层 | 技术选型 | 版本 |
|---|---|---|
| 前端 | Next.js (App Router) + Tailwind CSS + TypeScript | 14.2.5 |
| 后端 | FastAPI + SQLAlchemy 2.0 async + asyncpg | 0.136 |
| Agent | LangGraph StateGraph (10 节点编排 + MessageBus 通信) | - |
| LLM | 双客户端：MiniMax-M3 (开发) / 讯飞星火 V4 (上线) | - |
| 数据库 | PostgreSQL 18 (12 张表) + Redis | - |
| 向量库 | pgvector (JSONB 降级方案) | - |
| 异步任务 | Celery (Redis broker) | - |
| 测试 | pytest (114 个测试) + 端到端冒烟测试 | - |

## 项目结构

```
ZhiShu/
├── frontend/                      # Next.js 前端 (18 页面)
│   └── src/
│       ├── app/                   # 页面路由
│       │   ├── layout.tsx         # 根布局 (本地字体 + ClientShell)
│       │   ├── page.tsx           # 仪表盘
│       │   ├── login/             # 登录/注册页 (手机验证码)
│       │   ├── duihua/            # 智能对话页 (SSE 流式)
│       │   ├── profile/           # 学习画像页 (7 维雷达图)
│       │   ├── resources/         # 资源中心 (推荐 Feed + 三阶段学习包)
│       │   ├── path/              # 学习路径页 (DAG 可视化)
│       │   ├── tiku/              # 练习题库页
│       │   ├── pinggu/            # 学习评估页
│       │   ├── setting/           # 用户设置页
│       │   └── admin/             # 管理后台 (独立 Shell + 9 页面)
│       ├── components/            # 共享组件
│       │   ├── Icon.tsx           # 40+ SVG 图标集
│       │   ├── RobotIcon.tsx      # 机器人图标
│       │   └── layout/            # Sidebar + Header + ClientShell
│       ├── lib/                   # 工具库
│       │   ├── api.ts             # API 客户端 (55+ 接口封装)
│       │   ├── sse.ts             # 统一 SSE 流式工具
│       │   ├── student.ts         # 学生 ID 获取工具
│       │   ├── utils.ts           # 工具函数
│       │   └── admin/             # 管理后台 Context + 共享组件
│       ├── stores/appStore.ts     # Zustand 全局状态
│       ├── types/index.ts         # TypeScript 类型定义
│       └── hooks/                 # 自定义 hooks (4 个)
├── backend/                       # FastAPI 后端
│   └── app/
│       ├── main.py                # 应用入口 + 路由注册
│       ├── api/                   # 12 个路由模块 (67 端点)
│       ├── agents/                # 9 个 Agent + StateGraph 编排
│       │   ├── master_agent.py    # LangGraph StateGraph 10 节点
│       │   ├── state.py           # AgentState + IntentType
│       │   └── communicator.py    # MessageBus pub/sub
│       ├── services/              # 16 个服务模块
│       ├── models/                # 13 个数据模型
│       ├── tasks/                 # Celery 异步任务
│       └── core/                  # 核心模块 (配置/数据库/安全/Agent 指标)
├── tests/                         # 114 pytest + 冒烟测试
├── docs/                          # 设计文档
├── scripts/                       # 数据库初始化脚本 (12 个)
├── docker-compose.yml             # Docker 编排
├── start.ps1                      # Windows 一键启动
└── stop.ps1                       # Windows 一键停止
```

## 快速开始

### 环境要求

- Python 3.11+
- Node.js 18+
- PostgreSQL 16+
- Redis 7+

### 1. 克隆项目

```bash
git clone https://github.com/AbandonS-ED/ZhiShu.git
cd ZhiShu
```

### 2. 初始化数据库

```bash
# 建库 (只需一次)
psql -U postgres -f backend/scripts/init_db.sql

# 初始化管理员账号 (admin / admin123)
cd backend
python -m venv venv
venv\Scripts\activate
pip install -i https://pypi.tuna.tsinghua.edu.cn/simple -r requirements.txt
python scripts/init_admin.py
```

### 3. 配置环境变量

```bash
# 复制环境变量模板
cp .env.example .env

# 编辑 .env 填入你的 API Key
# MINIMAX_API_KEY=your_key_here
# 或切换到讯飞星火: LLM_PROVIDER=spark + SPARK_API_KEY=your_key_here
```

### 4. 启动服务

```bash
# 方式一：一键启停 (推荐)
.\start.ps1    # 同时启动后端 8001 + 前端 3000
.\stop.ps1     # 停止所有服务

# 方式二：手动启动
# 后端 (端口 8001)
cd backend
venv\Scripts\activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8001

# 前端 (端口 3000)
cd frontend
npm install
npm run dev
```

### 5. 访问系统

| 入口 | 地址 | 账号 |
|---|---|---|
| 学生端 | http://localhost:3000 | 注册新账号 |
| 管理端 | http://localhost:3000/admin/login | admin / admin123 |
| API 文档 | http://localhost:8001/docs | - |

## 演示流程

### 学生端

1. `/login` → 注册 → 登录
2. `/profile` → 开始评估 → 回答 3-5 个问题 → 查看 5 维画像
3. `/duihua` → 发送消息 → SSE 流式对话 + 多轮上下文
4. `/resources` → 查看推荐资源 → 输入知识点生成新资源
5. `/tiku` → 查看题库 → AI 生成练习题
6. `/path` → 输入知识点 → 生成学习路径
7. `/pinggu` → 查看 LLM 评估报告
8. `/setting` → 修改个人信息

### 注册体验

1. `/login` → 切换到「注册」标签
2. 填写手机号 → 点「获取验证码」→ 查看后端控制台获取验证码
3. 填写验证码 + 其他信息 → 完成注册

### 管理后台

1. `/admin/login` → admin/admin123 登录
2. `/admin` → 查看统计仪表盘（并行查询 + 骨架屏加载）
3. `/admin/users` → 用户管理（搜索/筛选/禁用/删除）
4. `/admin/resources` → 资源管理（后端搜索 + 分页）
5. `/admin/exercises` → 题库管理（CRUD + 批量导入）
6. `/admin/paths` → 学习路径管理（DAG 可视化）
7. `/admin/chats` → 对话记录（消息详情）
8. `/admin/documents` → 知识库文档管理
9. `/admin/agents` → Agent 监控面板（9 Agent 实时调用统计 + 30s 自动刷新）

## 测试

```bash
# 单元测试 (114 pytest)
cd backend
python -m pytest tests/ -v

# 端到端冒烟测试
cd backend
python -m tests.smoke_test

# 前端 lint
cd frontend
npm run lint

# 前端构建
cd frontend
npm run build
```

## 技术亮点

- **多智能体编排**: LangGraph StateGraph 10 节点 + 9 子 Agent 协同
- **防幻觉机制**: PatternDetector + SourceValidator + LLMValidator 三层验证
- **流式输出**: 7 个 SSE 端点 (对话/资源/练习/路径/画像评估/学习包)
- **RAG 管道**: 文档解析 → 语义切片 → Embedding → 向量检索 → LLM 重排
- **统一 SSE 工具**: 前后端统一流式处理，支持重试 + 指数退避 + 120s 超时
- **评估报告 AI 化**: LLM 生成自然语言报告 + 趋势分析 + 知识点掌握度统计
- **推荐系统**: 基于画像/评估/对话/题库/路径的多维度打分推荐
- **管理后台**: 25 个端点 (含 Agent 监控 + 用户删除) + 并行查询 + N+1 优化
- **手机验证码**: 模拟短信服务（控制台输出），5 分钟有效期
- **行为驱动画像**: 对话/练习/资源/路径学习自动更新 7 维画像

## 环境变量

| 变量 | 说明 | 默认值 |
|---|---|---|
| `MINIMAX_API_KEY` | MiniMax API Key | - |
| `SPARK_API_KEY` | 讯飞星火 API Key | - |
| `LLM_PROVIDER` | LLM 选择 (minimax/spark) | minimax |
| `DATABASE_URL` | PostgreSQL 连接串 | postgresql+asyncpg://postgres:123456@localhost:5432/zhishu |
| `REDIS_URL` | Redis 连接串 | redis://localhost:6379/0 |
| `JWT_SECRET` | JWT 密钥 | your_jwt_secret_here |

## 相关文档

- [CLAUDE.md](CLAUDE.md) — 项目技术文档 (架构 + 已修复 + 技术栈)
- [AGENTS.md](AGENTS.md) — 团队协作文档
- [开发进度.md](开发进度.md) — 实时进度跟踪
- [SMOKE_TEST_REPORT.md](SMOKE_TEST_REPORT.md) — 冒烟测试记录

## 许可证

本项目为第十五届中国软件杯参赛作品。
