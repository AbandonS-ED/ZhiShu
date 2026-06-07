# AGENTS.md — 智枢 (ZhiShu)

第十五届中国软件杯 A3 赛题 · 多智能体个性化学习资源生成系统。详细仓库状态见 `CLAUDE.md`，进度跟踪见 `开发进度.md`。

## 硬约束（违反即废）

- **LLM 必须用讯飞星火 V4**，禁用 OpenAI / Claude / MiniMax。
- **讯飞鉴权**：HTTP 只做 `Authorization: Bearer {api_key}`，**不要拼 api_secret**。
- **勿用 Google Fonts / Vercel / Sentry**（中国网络不可达）。字体走 `frontend/src/app/fonts/` 本地 woff + `next/font/local`。
- **包管理走国内镜像**：`frontend/.npmrc` 已配 `npmmirror`；pip 超时加 `-i https://pypi.tuna.tsinghua.edu.cn/simple`。
- **勿提交 `.env` / API 密钥**。`MinIO` 是 AGPL-3.0，部署时需附 LICENSE。

## 后端 5 个 bug（已修复 ✅）

| 文件 | 问题 | 修法 |
|------|------|------|
| `backend/app/core/database.py:13` | 裸字符串 SQL | 已用 `text()` 包裹 |
| `backend/app/models/document_chunk.py:13` | `Vector(1536)` | 已改为 `Vector(1024)`，后改为 JSONB 占位 |
| `backend/app/services/minimax_client.py` | 旧客户端用 httpx 手写 | 已重写为 OpenAI 兼容格式 |
| `backend/app/services/minimax_langchain.py` | `asyncio.run()` 死锁 | 已重写为 async-native |
| `backend/app/core/config.py` | 配置结构混乱 | 已整理为 MINIMAX_* 字段 |

## LLM 切换策略（重要）

**开发阶段**: 使用 **MiniMax-M3** (OpenAI 兼容格式)
- `.env` 中配置 `MINIMAX_API_KEY`
- Base URL: `https://api.minimax.chat/v1`（注意没有 `i`）
- `minimax_client.py` / `minimax_langchain.py` 使用 httpx 直接调用
- **已验证可用**：Profile Agent 端到端测试通过
- 文档: `docs/资料/MiniMax-M3使用指南.md`

**上线前**: 替换为 **讯飞星火 V4** (OpenAI 兼容格式)
- `.env` 中配置 `SPARK_API_KEY`
- 重写为 `spark_client.py` / `spark_langchain.py` (httpx 直接调用)
- config.py 中已预留 `SPARK_*` 配置字段（已注释）

## 命令

```bash
# 基础设施（无 Docker，需本地安装）
# PostgreSQL: D:\2026test\PostgreSQL\18 (端口 5432, 密码 123456)
# Redis: D:\2026test\redis_server (端口 6379)

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
- **后端 5 个 bug 已修复**，可直接 `uvicorn` 启动。
- **LLM 切换**: 开发用 MiniMax-M3，上线前切讯飞星火 V4。详见上方「LLM 切换策略」。

## 前端现状（7 页面，模板驱动，全部假数据）

`D:\桌面\muban` 有 7 个同名 HTML 模板，前端是 **1:1 复刻**。

| 路由 | 页面 | 模板 | `'use client'` | API 联调 |
|------|------|------|----------------|----------|
| `/` | 仪表盘 | yibiaopan.html | ❌ Server Component | ❌ 假数据 |
| `/duihua` | 智能对话 | duihua.html | ✅ | ❌ 假数据 |
| `/profile` | 学习画像 | huaxiang.html | ✅ | ❌ 假数据 |
| `/resources` | 资源中心 | zhiyuan.html | ✅ | ❌ 假数据 |
| `/path` | 学习路径 | lujing.html | ✅ | ❌ 假数据 |
| `/tiku` | 练习题库 | tiku.html | ✅ | ❌ 假数据 |
| `/pinggu` | 学习评估 | pinggu.html | ✅ | ❌ 假数据 |

**约定**：所有 CSS 在 `src/app/globals.css`（745 行）。静态数据直接写 `page.tsx` 内，不抽 data 文件。**无 shadcn/ui、无 zustand**，全自定义 CSS + React `useState`。

**共享组件**：`components/layout/Sidebar.tsx`（client，含收起/展开切换按钮，chevron 在 brand 行尾）+ `Header.tsx`（client）。收起时 sidebar 宽度 240→64px，仅显示图标。

**未使用文件**：`types/index.ts`（TS 类型契约）、`stores/appStore.ts`（Zustand store）已准备但未接入任何页面。

## 后端现状（8 表 + 6 Agent + 16 API 端点）

### 数据库表

| 表 | 用途 | 外键 |
|----|------|------|
| `students` | 学生账户 | - |
| `student_profiles` | 6 维 JSONB 画像 + 版本控制 | - |
| `document_chunks` | RAG 文档分块（embedding 用 JSONB 占位） | - |
| `resources` | 生成的学习资源 | - |
| `learning_paths` | DAG 学习路径 + 每日计划 | - |
| `exercises` | 生成的练习题 | - |
| `chat_sessions` | 聊天会话 | - |
| `chat_messages` | 聊天消息 | - |

> 开发阶段去掉外键约束，生产环境需加回。

### Agent 列表

| Agent | 状态 | 功能 |
|-------|------|------|
| Profile Agent | ✅ | 对话式 6 维画像提取 |
| Document Agent | ✅ | 知识讲解 + 代码 + 音频脚本 |
| Exercise Agent | ✅ | 自适应练习题生成 |
| Path Agent | ✅ | 学习路径规划（DAG） |
| Tutor Agent | ✅ | RAG 智能问答 |
| Master Agent | ✅ | 多 Agent 编排器（LLM 路由） |
| ❌ MindMap Agent | 未实现 | 思维导图 Mermaid 生成 |

### API 端点

| 方法 | 路径 | 状态 |
|------|------|------|
| POST | `/api/v1/profile/build` | ✅ 对话→LLM→6 维 JSON→存库 |
| GET | `/api/v1/profile/{student_id}` | ✅ 查询当前画像 |
| POST | `/api/v1/resource/generate` | ✅ Document Agent 生成 |
| GET | `/api/v1/resource/list` | ✅ 资源列表 |
| POST | `/api/v1/resource/exercises/generate` | ✅ Exercise Agent 生成 |
| GET | `/api/v1/resource/exercises/{student_id}` | ✅ 练习题列表 |
| POST | `/api/v1/path/generate` | ✅ Path Agent 生成 |
| GET | `/api/v1/path/{student_id}` | ✅ 路径列表 |
| GET | `/api/v1/path/{student_id}/{path_id}` | ✅ 路径详情 |
| POST | `/api/v1/tutor/ask` | ✅（RAG 检索 TODO） |
| POST | `/api/v1/tutor/generate` | ✅ 资源生成 |
| POST | `/api/v1/chat/stream` | ✅ SSE 流式 + Master Agent 路由 |
| GET | `/api/v1/chat/sessions/{student_id}` | ✅ 会话列表 |
| GET | `/api/v1/chat/sessions/{session_id}/messages` | ✅ 消息历史 |

## 评分优先级（排期用）

| 优先级 | 模块 | 占比 | 当前状态 |
|--------|------|------|----------|
| P0 | F1 对话式画像 | 35% | ✅ 后端完成，❌ 前端未联调 |
| P0 | F2 多智能体资源生成 | 45% | ⚠️ 缺 MindMap Agent，❌ 前端未联调 |
| P1 | F3 学习路径 / N3 防幻觉+流式 | 必做 | ✅ 路径完成，❌ 防幻觉+流式未做 |
| P2 | F4 智能辅导 / F5 效果评估 | 加分 | ⚠️ Agent 有 RAG 空，❌ 评估未做 |

## 下一步（推荐顺序）

1. **前端联调** — 把 7 个页面的假数据换成真实 API 调用
2. **MindMap Agent** — 补全 F2 评分项
3. **防幻觉三层** — N3 必做项
4. **所有生成接口支持 SSE 流式** — N3 评分项
5. **RAG 管道** — F4 核心
6. **F5 效果评估** — 加分项

## 写功能前必看

`docs/设计文档/项目设计文档-完整版.md` —— 含 DB schema、Agent 骨架、API 路由。**直接落地，不要重写。** F1-F5 定义见 `docs/赛题需求/`。

## 提交规范

前缀：`feat:` / `fix:` / `refactor:` / `docs:` / `chore:` / `test:`。
涉及评分项（流式 / 防幻觉 / 多智能体）的改动附一句说明。
