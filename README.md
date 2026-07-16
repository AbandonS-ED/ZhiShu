# 智枢 (SmartHub) - 多智能体个性化学习资源生成系统

> 第十五届中国软件杯 A3 赛题。基于大模型的个性化资源生成与学习多智能体系统。

## 项目简介

智枢 (SmartHub) 是一个面向《人工智能导论》课程的多智能体个性化学习系统。通过 15 个 AI Agent 协同工作，为学生提供对话式学习画像评估、个性化学习资源生成、智能学习路径规划、RAG 智能辅导和效果评估等服务。

### 核心功能

- **F1 对话式画像 (35%)** — 7 维学生画像评估（理解力/记忆力/应用转化/想象力/专注力/知识基础/学习目标）
- **F2 多智能体资源生成 (45%)** — 15 Agent 协同生成学习资源（含防幻觉三层验证）
- **F3 学习路径规划** — DAG 可视化路径 + 每日学习计划
- **F4 智能辅导** — RAG 问答 + 多轮对话上下文
- **F5 效果评估** — LLM 生成评估报告 + 趋势分析
- **学习计划** — AI 生成学习路径 + 节点状态管理 + 测验解锁机制 + 综合测试
- **错题本** — AI 错因分析(5类错误) + 同类题推荐 + 掌握度算法 + /tiku 答错自动收录
- **资源中心** — AI 生成 + 手动创建 + 进度动画 + 保存功能 + 我的资源 + 资源详情
- **自习模式 v1.5** — TF.js + MoveNet 浏览器本地姿态检测，番茄钟专注 + 静默巡查 + 报告（专注/低头/离席）
- **管理后台** — 仪表盘 + 用户/资源/题库管理 + Agent 监控 + 手机验证码注册 + 用户删除

## 技术栈

| 层 | 技术选型 | 版本 |
|---|---|---|
| 前端 | Next.js (App Router) + Tailwind CSS + TypeScript | 14.2.5 |
| 后端 | FastAPI + SQLAlchemy 2.0 async + asyncpg | 0.136 |
| Agent | LangGraph StateGraph (10 节点编排 + MessageBus 通信) | - |
| LLM | 三客户端：小米 MiMo v2.5 (当前) / MiniMax-M3 / 讯飞星火 V4 | - |
| 数据库 | PostgreSQL 18 (14 张表) + Redis | - |
| 向量库 | pgvector (JSONB 降级方案) | - |
| 异步任务 | Celery (Redis broker) | - |
| **前端 AI** | **@tensorflow/tfjs 4.22 + @tensorflow-models/pose-detection 2.1（MoveNet Lightning · 自习模式）** | **~3MB 模型 · 浏览器本地推理** |
| 测试 | pytest (110 个测试) + 端到端冒烟测试 | - |

## 项目结构

```
ZhiShu/
├── frontend/                      # Next.js 前端 (28 页面)
│   └── src/
│   ├── app/                   # 页面路由
│   │   ├── layout.tsx         # 根布局 (本地字体 + ClientShell)
│   │   ├── page.tsx           # 仪表盘
│   │   ├── login/             # 登录/注册页 (手机验证码)
│   │   ├── duihua/            # 智能对话页 (SSE 流式)
│   │   ├── profile/           # 学习画像页 (7 维雷达图)
│   │   ├── resources/         # 资源中心
│   │   │   ├── page.tsx       # 资源列表 (AI 生成 + 手动创建)
│   │   │   ├── my-resources/  # 我的资源 (过滤系统自动生成)
│   │   │   ├── [id]/          # 资源详情 (标签页 + 练习题)
│   │   │   ├── learn/[kp]/    # 学习包 (三阶段 Learn/Practice/Review)
│   │   │   └── components/    # 资源组件 (ResourceCard + CreateModal + ResourceProgress)
│   │   ├── path/              # 学习路径页 (DAG 可视化)
│   │   ├── plan/              # 学习计划页 (AI 路径生成 + 节点学习 + 测验 + 综合测试)
│   │   │   ├── page.tsx       # 计划首页 (输入知识点 → AI 生成路径)
│   │   │   └── [pathId]/      # 计划详情
│   │   │       ├── page.tsx   # 知识点依赖图 (DAG)
│   │   │       ├── learn/[nodeId]/     # 单知识点学习
│   │   │       ├── quiz/[nodeId]/      # 知识点测验
│   │   │       └── final-test/         # 综合测试
│   │   ├── tiku/              # 练习题库页
│   │   ├── pinggu/            # 学习评估页
│   │   ├── setting/           # 用户设置页 (个人中心 + 密码 + 每日目标)
│   │   ├── wrong-questions/   # 错题本 (AI 错因 + 同类题 + 复习)
│   │   ├── zixi/              # 自习模式 (TF.js + MoveNet 本地姿态检测)
│   │   └── admin/             # 管理后台 (独立 Shell + 9 页面)
│       ├── components/            # 共享组件
│       │   ├── Icon.tsx           # 40+ SVG 图标集
│       │   ├── RobotIcon.tsx      # 机器人图标
│       │   └── layout/            # Sidebar + Header + ClientShell
│       ├── lib/                   # 工具库
│       │   ├── api.ts             # API 客户端
│       │   ├── sse.ts             # 统一 SSE 流式工具
│       │   ├── student.ts         # 学生 ID 获取工具 + logout()
│       │   ├── utils.ts           # 工具函数
│       │   ├── markdown.ts        # Markdown 转 HTML (marked)
│       │   └── admin/             # 管理后台 Context + 共享组件
│       ├── stores/appStore.ts     # Zustand 全局状态
│       ├── types/index.ts         # TypeScript 类型定义
│       └── hooks/usePageTimer.ts  # 页面停留计时器
├── backend/                       # FastAPI 后端
│   └── app/
│       ├── main.py                # 应用入口 + 路由注册
│       ├── api/                   # 12 个路由模块 (68 端点)
│       ├── agents/                # 15 个 Agent 模块 + StateGraph 编排
│       │   ├── master_agent.py    # LangGraph StateGraph 10 节点
│       │   ├── state.py           # AgentState + IntentType
│       │   ├── communicator.py    # MessageBus pub/sub
│       │   ├── initial_assessment_agent.py  # 画像评估
│       │   ├── document_agent.py  # 知识讲解
│       │   ├── mindmap_agent.py   # 思维导图
│       │   ├── exercise_agent.py  # 练习题生成
│       │   ├── path_agent.py      # 学习路径
│       │   ├── tutor_agent.py     # RAG 问答
│       │   ├── audio_agent.py     # 音频脚本
│       │   ├── behavior_analysis_agent.py # 行为分析
│       │   ├── coordinator_agent.py # 任务协调
│       │   ├── review_agent.py    # 质量审核
│       │   └── resource_creator_agent.py # 资源创建
│       ├── services/              # 17 个服务模块
│       ├── models/                # 13 个数据模型
│       ├── tasks/                 # Celery 异步任务
│       └── core/                  # 核心模块 (配置/数据库/安全/Agent 指标)
├── tests/                         # 110 pytest + 冒烟测试
├── docs/                          # 设计文档
├── scripts/                       # 数据库初始化脚本
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

### 1. 初始化数据库

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

### 2. 配置环境变量

```bash
# 复制环境变量模板
cp backend/.env.example backend/.env

# 编辑 .env 填入你的 API Key
# MIMO_API_KEY=your_key_here  (当前用 MiMo v2.5)
# 或切换到 MiniMax: LLM_PROVIDER=minimax + MINIMAX_API_KEY=your_key_here
# 或切换到讯飞星火: LLM_PROVIDER=spark + SPARK_API_KEY=your_key_here
```

### 3. 启动服务

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

### 4. 访问系统

| 入口 | 地址 | 账号 |
|---|---|---|
| 学生端 | http://localhost:3000 | 注册新账号 |
| 管理端 | http://localhost:3000/admin/login | admin / admin123 |
| API 文档 | http://localhost:8001/docs | - |

## 演示流程

### 学生端

1. `/login` → 注册 → 登录
2. `/profile` → 开始评估 → 回答问题 → 查看 7 维画像
3. `/duihua` → 发送消息 → SSE 流式对话 + 多轮上下文
4. `/resources` → 点击「创建资源」→ 输入需求 → AI 生成 → 预览 → 保存
5. `/resources/my-resources` → 查看我创建的资源
6. `/resources/[id]` → 资源详情 → 标签页切换 → 练习题答案
7. `/plan` → 查看学习计划列表
8. `/plan/[pathId]` → 查看学习路径（节点状态：completed/current/pending）
9. `/plan/[pathId]/learn/[nodeId]` → 学习知识点
10. `/plan/[pathId]/quiz/[nodeId]` → AI 生成测验题 → 作答 → 60分以上解锁下一节点
11. `/plan/[pathId]/final-test` → 综合测试
12. `/tiku` → 查看题库 → AI 生成练习题
13. `/path` → 输入知识点 → 生成学习路径
14. `/pinggu` → 查看 LLM 评估报告
15. `/zixi` → 自习模式 → 选时长/难度 → 可选开摄像头 → 开始番茄钟 → 静默巡查 → 结束看报告
16. `/` → 仪表盘 → 查看统计数据
17. `/setting` → 个人中心（信息编辑 + 密码修改 + 每日目标 + 退出登录）

### 注册体验

1. `/login` → 切换到「注册」标签
2. 填写手机号 → 点「获取验证码」→ 查看后端控制台获取验证码
3. 填写验证码 + 其他信息 → 完成注册

### 管理后台

1. `/admin/login` → admin/admin123 登录
2. `/admin` → 查看统计仪表盘
3. `/admin/users` → 用户管理（搜索/筛选/禁用/删除）
4. `/admin/resources` → 资源管理（后端搜索 + 分页）
5. `/admin/exercises` → 题库管理（CRUD + 批量导入）
6. `/admin/paths` → 学习路径管理
7. `/admin/chats` → 对话记录（消息详情）
8. `/admin/documents` → 知识库文档管理
9. `/admin/agents` → Agent 监控面板（15 Agent 模块实时调用统计 + 30s 自动刷新）

## 测试

```bash
# 单元测试 (110 pytest)
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

- **多智能体编排**: LangGraph StateGraph 10 节点 + 15 Agent 模块协同
- **防幻觉机制**: PatternDetector + SourceValidator + LLMValidator 三层验证
- **流式输出**: 8 个 SSE 端点 (对话/资源/练习/路径/画像评估/学习包/题库出题)
- **RAG 管道**: 文档解析 → 语义切片 → Embedding → 向量检索 → LLM 重排
- **统一 SSE 工具**: 前后端统一流式处理，支持重试 + 指数退避 + 120s 超时
- **评估报告 AI 化**: LLM 生成自然语言报告 + 趋势分析 + 知识点掌握度统计
- **推荐系统**: 基于画像/评估/对话/题库/路径的多维度打分推荐
- **学习计划系统**: AI 生成学习路径 + 节点状态管理（completed/current/pending）+ 测验解锁机制 + 综合测试
- **测验功能**: AI 实时生成题目（选择题/判断题/简答题）+ 自动评分 + 节点解锁 + 答案解析
- **资源中心重构**: AI 生成 + 手动创建 + 进度动画（4步骤+倒计时）+ 保存功能 + 我的资源 + 资源详情
- **管理后台**: 11 个管理端点 + Agent 监控 + 并行查询 + N+1 优化
- **题库系统**: 题库 CRUD + AI 流式出题 + 题池采样 + MiMo 容错解析 (裸数组/缺字段/字符串难度)
- **手机验证码**: 模拟短信服务（控制台输出），5 分钟有效期
- **行为驱动画像**: 对话/练习/资源/路径学习自动更新 7 维画像
- **自习模式**: TF.js + MoveNet 浏览器本地姿态检测（零上传）· 番茄钟专注 + 静默巡查 + 物理摄像头智能过滤 + 联动学习画像 focus 维度

## 环境变量

| 变量 | 说明 | 默认值 |
|---|---|---|
| `MINIMAX_API_KEY` | MiniMax API Key | - |
| `SPARK_API_KEY` | 讯飞星火 API Key | - |
| `MIMO_API_KEY` | 小米 MiMo API Key | - |
| `MIMO_BASE_URL` | MiMo 中国集群地址 | https://token-plan-cn.xiaomimimo.com/v1 |
| `MIMO_MODEL` | MiMo 模型名 | mimo-v2.5 |
| `LLM_PROVIDER` | LLM 选择 (mimo/minimax/spark) | mimo |
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
