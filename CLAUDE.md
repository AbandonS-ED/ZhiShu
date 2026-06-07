# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目背景

**智枢 (SmartHub)** —— 第十五届中国软件杯 A3 赛题：基于大模型的个性化资源生成与学习多智能体系统。

- **出题方**：科大讯飞。**硬约束**：必须用讯飞星火 V4 / Embedding / TTS
- **评分占比**：F1 对话式画像 35% + F2 多智能体资源生成 45% + F3 路径规划 + F4/F5 加分
- **非功能项**（技术门槛）：流式输出 / 防幻觉(RAG) / 开源合规
- **课程切入点**：人工智能导论
- **主仓库**：<https://github.com/AbandonS-ED/ZhiShu>

## 仓库现状（2026-06-08）

```
SmartHub/
├── frontend/                        # Next.js 14.2.5 + Tailwind 3.4 + TypeScript
│   ├── src/app/                     # 7 页面：/ /duihua /profile /resources /path /tiku /pinggu
│   │   ├── layout.tsx               # 模板风 .app 布局：Sidebar + Main
│   │   ├── page.tsx                 # / 仪表盘（server component，无 'use client'）
│   │   ├── globals.css              # 模板设计系统（米色/墨黑/琥珀 ~500 行有效样式）
│   │   └── [其他 5 个 page.tsx]     # 'use client' + 模板 HTML
│   ├── src/components/layout/
│   │   ├── Sidebar.tsx              # 7 项菜单（仪表盘 + 智能对话 + 学习画像 + 资源 + 路径 + 题库 + 评估），可折叠
│   │   └── Header.tsx               # 60px 玻璃拟态 + 动态页面标题
│   ├── src/stores/appStore.ts       # Zustand store（暂未使用）
│   ├── src/types/index.ts           # TS 类型契约（暂未使用）
│   ├── src/lib/utils.ts             # cn() 工具
│   ├── src/app/fonts/               # GeistVF.woff / GeistMonoVF.woff（本地字体）
│   └── .npmrc                       # npmmirror 国内镜像
├── backend/                         # FastAPI + 8 表 + 6 Agent + 16 API
│   ├── app/main.py                  # 5 router 注册 + lifespan 初始化
│   ├── app/api/                     # 5 router：profile / resource / path / tutor / chat
│   ├── app/core/{config,database}.py
│   ├── app/models/                  # 8 个 Model（Student / Profile / DocumentChunk / Resource / LearningPath / Exercise / ChatSession / ChatMessage）
│   ├── app/agents/                  # 6 个 Agent（Profile / Document / Exercise / Path / Tutor / Master）
│   ├── app/services/                # minimax_client.py + minimax_langchain.py（OpenAI 兼容格式）
│   └── tests/                       # __init__.py 空
├── docs/                            # 已分类：赛题需求 / 设计文档 / 开发流程 / 运维测试 / 交付物
├── 开发进度.md                       # 实时进度跟踪
├── AGENTS.md                        # 团队协作文档
└── docker-compose.yml               # postgres+pgvector / redis / minio（不含 backend）
```

**实际状态**：

- ✅ 前端 7 页面 **1:1 复刻模板**（全部假数据，未联调）
- ✅ 后端完整：8 表 + 6 Agent + 16 API 端点，全部测试通过
- ✅ MiniMax-M3 LLM 端到端验证通过（Profile Agent 验证）
- ⚠️ 缺 MindMap Agent（F2 评分项）
- ⚠️ RAG / 防幻觉 / 流式输出 / F5 效果评估未实现
- ⚠️ 前端 7 页全是假数据，0 个 fetch 调用

## 技术栈（已锁定，不要换）

| 层 | 选型 | 备注 |
|---|---|---|
| 前端 | Next.js 14.2.5 (App Router) + Tailwind 3.4 + TypeScript | 无 shadcn/ui，纯自定义 CSS |
| 后端 | FastAPI 0.136 + SQLAlchemy 2.0 async + asyncpg | Python 3.11 |
| Agent | LangGraph + LangChain（已安装，未使用 StateGraph） | 直接调用 LLM |
| LLM | MiniMax-M3（开发）→ 讯飞星火 V4（上线前切换） | OpenAI 兼容格式 |
| 向量库 | pgvector（Python 包已装，PG 扩展未装） | embedding 用 JSONB 占位 |
| 数据库 | PostgreSQL 18 + Redis（本地安装，无 Docker） | MinIO AGPL-3.0 需 LICENSE |

## 中国网络约束（必读）

**Google 服务不可达**——`next/font/google` / Vercel / Sentry / OpenAI 全部失败。

- **字体**：用 `frontend/src/app/fonts/` 本地 woff + `next/font/local`（**勿用** `next/font/google`）
- **npm registry**：`frontend/.npmrc` 已配 `registry.npmmirror.com`，全队自动生效
- **PyPI**：`pip install -i https://pypi.tuna.tsinghua.edu.cn/simple -r requirements.txt`
- **讯飞鉴权**：HTTP 只做 `Authorization: Bearer {api_key}`，**不要拼 api_secret**
- **`requirements.txt` 末尾的 `anthropic` 依赖已不用**，首次装包后删除

## 命令

```bash
# 后端
cd backend
python -m venv venv; venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
# Swagger: http://localhost:8000/docs

# 前端
cd frontend
npm install
npx next dev          # http://localhost:3000
npx next build        # ✅ 通过（7 路由：/ /duihua /path /pinggu /profile /resources /tiku）
npx next lint         # ✅ 通过
```

## 已知 bug / 隐患（动手前必读）

### P0 — 影响演示/安全的真实问题

- **`duihua/page.tsx:187`** — `dangerouslySetInnerHTML={{ __html: msg.content }}`，**XSS 漏洞**，接通后端后用户输入 `<script>` 直接执行
- **`pinggu/page.tsx:169-180`** — `requestAnimationFrame` 递归链未 `cancelAnimationFrame` 清理，组件卸载后仍 setState，**内存泄漏 + 切页卡顿 3-5 秒**
- **`resources/page.tsx:262`** — filter 数组缺 `'audio'`，**音频类型无法单独筛选**（数据里 id:5 type:audio 存在）
- **`resources/page.tsx:234, 268, 313`** — 3 处多余 `as ResourceType` / `as keyof typeof` 断言，TS strict 已能自动收窄
- **`globals.css:11-43`** — 11 个 CSS 变量偏离"米色/墨黑/琥珀"调色板，`--warm: #c47a3a`(琥珀) 被改成了 `#a09080`(米褐)，设计系统失效

### P1 — 死代码 / 冗余

- **`types/index.ts` + `stores/appStore.ts`** — 9 个 interface + Zustand store 0 引用，和 page 内 local interface 互相漂移，等接 API 时再启用或重写
- **`lib/utils.ts`** — `cn()` 全工程 0 引用
- **`package.json`** — 9 个重量级依赖未用（@radix-ui ×5、reactflow、mermaid、react-syntax-highlighter、recharts、swr）
- **`profile/page.tsx:164-244`** — 雷达图用 `svg.innerHTML = html` 字符串拼接，应改为声明式 JSX
- **`{duihua,resources,pinggu}/page.tsx`** 共 7 处 `key={i}` 配排序/前置插入的列表——会触发 React diff 动画重跑

### P2 — 已知老问题

- **pgvector 扩展未装** — Python 包已装，PostgreSQL 扩展未装，embedding 用 JSONB 占位
- **`echo=True`** — database.py SQL 日志硬编码，生产需改为 `echo=settings.DEBUG`
- **`tutor.py /generate` 与 `resource.py /generate` 重复** — 待清理
- **router 入参未校验** — `{profile,path,resource,tutor}.py` 全用 query string 接收 `student_id: str`，没 UUID 校验，接库前必须改
- **无 Docker 环境** — PostgreSQL/Redis 需本地安装（D:\2026test\）

### 已修复（不必再查）

- ✅ `database.py:16` 缺 `text()` → commit `c837fe3` 加了
- ✅ `anthropic` 依赖 → 已删
- ✅ `Vector(1536)` → 实际代码用 JSONB 占位（无需改）
- ✅ `minimax_langchain.py` `asyncio.get_event_loop()` → `c837fe3` 改 `get_running_loop()`
- ✅ `resources/page.tsx:313` TS 错误 → `4e4ef25` 已修

## 架构与功能要点

### 多智能体协同（Master-Worker）

`Master Agent` 接收请求 → LLM 路由判断意图 → 派给对应子 Agent → 汇总 → SSE 流式返回。

6 个子 Agent：
- **Profile Agent** — 对话式画像提取，输出 6 维结构化 JSON（✅ 已实现）
- **Document Agent** — 知识讲解 + 代码示例 + 音频脚本生成（✅ 已实现）
- **MindMap Agent** — 思维导图生成，输出 Mermaid 代码（❌ 未实现）
- **Exercise Agent** — 练习题生成（选择/判断/简答/编程）（✅ 已实现）
- **Path Agent** — 学习路径规划，输出知识图谱节点 + 边 + 每日计划（✅ 已实现）
- **Tutor Agent** — RAG 问答 + 评估报告生成（✅ 已实现，RAG 检索 TODO）

### 6 维学生画像（F1）

`student_profiles.dimensions` 用 JSONB 存：`knowledge_mastery / learning_style / cognitive_level / interests / weak_topics / learning_pace`。

### RAG + 防幻觉（N3 评分项）— 未实现

文档解析 → 语义切片（800字/100重叠）→ Embedding → pgvector HNSW 检索 → LLM 重排 → **来源引用标注** → SourceValidator 验证（抓"年份+期刊+百分比"类捏造）→ 失败重生成。**这是答辩技术亮点，不可省。**

### 流式输出（N1/N4）— 仅 chat/stream 实现

`/api/v1/chat/stream` SSE 已实现。资源/练习/路径生成接口暂未接 SSE。所有生成场景必须接 `StreamingResponse`。

## 前端约定

- **页面（除 `/`）必须加 `'use client'`**——模板 HTML 含 onClick / useState 等运行时逻辑
- **CSS 集中在 `globals.css`**——不动 `tailwind.config.js`（用模板 CSS 变量比 Tailwind 更准）
- **静态数据写在 page.tsx 内**——不拆分 data 文件（联调后改为 API 调用）
- **Sidebar.tsx** 有折叠功能（`useState` + `.collapsed` class），CSS 里有 `.sidebar.collapsed` 样式定义
- **`.next` 缓存损坏**：每次 `npm run build` 后切回 `npm run dev` 常报 `Cannot find module './<id>.js'`。解法：杀掉 node 进程 → `Remove-Item frontend/.next -Recurse` → 重启 dev server。**不是代码 bug**。

## 评分优先级

| 优先级 | 模块 | 占比 | 当前状态 |
|--------|------|------|----------|
| P0 | F1 对话式画像 | 35% | ✅ 后端完成 |
| P0 | F2 多智能体资源生成 | 45% | ⚠️ 缺 MindMap Agent |
| P1 | F3 学习路径 / N3 防幻觉+流式 | 必做 | ✅ 路径完成，❌ 防幻觉+流式 |
| P2 | F4 智能辅导 / F5 效果评估 | 加分 | ⚠️ Agent 有 RAG 空 |

## 写新功能前先看

- [docs/设计文档/项目设计文档-完整版.md](docs/设计文档/项目设计文档-完整版.md) —— 9225 行设计圣经：DB schema + 6 Agent 骨架 + API + 15 天 Vertical Slice 计划
- [AGENTS.md](AGENTS.md) —— 团队协作文档，命令/锁定技术栈/已知 bug 清单
- [开发进度.md](开发进度.md) —— 团队任务跟踪表

**直接落地设计文档的骨架代码，不要重写。**

## 提交规范

- 前缀：`feat:` / `fix:` / `refactor:` / `docs:` / `chore:` / `test:`
- 涉及评分项的改动附 1-2 句说明，方便答辩时回溯
- 涉及讯飞 API 的改动在 commit 中标注是哪个 API（星火 V4 chat / Embedding / TTS）
- **勿提交** `.env` / `venv/` / `node_modules/`（已 gitignore）
- CRLF/LF 警告是 Windows 正常现象，**不要**试图修
