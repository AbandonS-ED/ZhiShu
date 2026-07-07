# 智枢 (SmartHub) - 前端项目

> 多智能体学习资源生成系统 · 前端部分（学生端 13 页 + 管理后台 9 页）
> 最后更新：2026-07-08（设置页全量重写 + 数值校准）

## 技术栈

- **框架**: Next.js 14.2.5 (App Router) + React 18
- **样式**: Tailwind CSS 3.4 + 自定义 CSS（模板 1:1 复刻）
- **状态管理**: React useState + Context（学生端 + 管理端独立 Context）+ Zustand（setting 页）
- **路由隔离**: `/admin` 路由前缀，独立的 RootLayout 拦截
- **Agent**: 14 个 Agent 模块协同工作

## 项目结构

```
src/
├── app/                    # 路由页面（学生 13 + 管理 9 + 2 布局 + 1 全局 layout）
│   ├── layout.tsx          # 全局布局（Sidebar + Header，/admin /login 跳过）
│   ├── globals.css         # 自定义设计系统（米色/墨黑/琥珀色系 + admin-* 命名空间）
│   ├── page.tsx            # / 仪表盘
│   ├── login/              # 登录/注册页（独立布局）
│   │   ├── layout.tsx      # 无 Sidebar
│   │   └── page.tsx        # Tab 切换 + 密码校验 + 自动跳转
│   ├── duihua/             # /duihua 智能对话（SSE 流式 + Master Agent 路由 + 会话管理）
│   ├── path/               # /path 学习路径
│   ├── pinggu/             # /pinggu 学习评估
│   ├── profile/            # /profile 学习画像（含 ChatModal）
│   ├── resources/          # /resources 资源中心
│   ├── tiku/               # /tiku 练习题库
│   ├── setting/            # /setting 个人中心（学习概览+快捷入口+信息编辑+密码修改+每日目标+退出登录）
│   └── admin/              # ⭐ 管理后台（独立布局 + Token 隔离）
│       ├── layout.tsx      # 管理后台布局（admin-sb + admin-hd + 底部登出）
│       ├── page.tsx        # /admin 仪表盘
│       ├── login/          # /admin/login 管理员登录
│       ├── users/          # /admin/users 用户管理（含批量删除）
│       ├── resources/      # /admin/resources 资源管理
│       ├── exercises/      # /admin/exercises 题库管理（CRUD + 批量导入）
│       ├── paths/          # /admin/paths 学习路径
│       ├── chats/          # /admin/chats 对话记录
│       ├── documents/      # /admin/documents 知识库
│   └── agents/         # /admin/agents Agent 监控（14 Agent 模块）
├── components/
│   ├── layout/                # 学生端 Sidebar + Header
│   └── RobotIcon.tsx          # ⭐ 极简机器人 SVG（替换 🤖 emoji）
├── hooks/                  # ⭐ 页面停留计时器 + 自习模式摄像头巡查
│   ├── usePageTimer.ts        # 页面停留计时器（自动上报 learning_records）
│   └── useCameraPatrol.ts     # ⭐ TF.js + MoveNet 摄像头本地姿态巡查（懒加载 + 30/60/120s 间隔）
├── lib/
│   ├── api.ts                 # API 客户端（auth/chat/resource/path/profile/dashboard/evaluation/tutor/mindmap/admin，自动带 token；SSE 委托 sse.ts）
│   ├── sse.ts                 # ⭐ 统一 SSE 工具（createEventStream + 3 次重试 + 指数退避 + 120s 超时）
│   ├── student.ts             # student_id 本地存储（zhishu_student）+ logout()
│   ├── utils.ts               # cn() + escapeHtml() + showToast() + extractAnswer()
│   ├── markdown.ts            # Markdown 转 HTML（marked 库隔离）
│   ├── admin/context.tsx      # ⭐ 管理后台共享状态（AdminProvider + useAdmin）
│   └── admin/components.tsx   # ⭐ 管理后台共享组件（AdminCheckbox + BatchDeleteBar + useSelection）
├── stores/appStore.ts         # Zustand store（已接入 setting 页）
├── types/index.ts             # TS 13 接口定义
└── fonts/                     # 本地字体（GeistVF, GeistMonoVF）
```

## 快速开始

```bash
npm install
npm run dev       # http://localhost:3000
npm run build     # 验证编译（✅ 通过：24 页面）
npm run lint      # ESLint 检查（✅ 0 errors）
```

> 端口同步：默认连后端 8001。改端口要同步改 `src/lib/api.ts:5` 的 `BASE_URL`。

## 页面说明

### 学生端（13 个页面）

| 路由 | 页面 | 功能 | 后端联调 |
|------|------|------|----------|
| `/` | 仪表盘 | 统计卡片 + 最近活动 + 快速开始 + 课程进度 | ✅ 数据聚合 |
| `/login` | 登录/注册 | Tab 切换 + 密码校验 + 手机验证码 + 自动跳转 | ✅ **JWT 认证** |
| `/duihua` | 智能对话 | 多轮对话 + Agent 进度展示 + 推荐问题 + 会话管理 | ✅ **SSE 流式** (真逐 token) |
| `/profile` | 学习画像 | Chart.js 雷达图 + 7 维详情 + 知识点掌握度 + 薄弱环节 + AI 弹窗 | ✅ AI 流式评估 |
| `/resources` | 资源中心 | 资源卡片 + 搜索/筛选 + 网格/列表视图 + 收藏 + 详情模态框 | ✅ **SSE 流式** |
| `/resources/my-resources` | 我的资源 | 用户创建的资源列表 + 过滤系统自动生成的资源 | ✅ 资源 API |
| `/resources/[id]` | 资源详情 | 完整学习内容 + 标签页切换 + 练习题答案 | ✅ 资源 API |
| `/resources/learn/[kp]` | 学习页 | 学习包三阶段 (Learn/Practice/Review) + SSE 流式生成 | ✅ **SSE 流式** |
| `/path` | 学习路径 | DAG 图谱(SVG 边) + 概览统计 + 详情面板 + 每日计划 | ✅ **SSE 流式** |
| `/tiku` | 练习题库 | 胶囊选择器 + ✏️ 自定义输入 + 超30提示 + AI 流式出题 | ✅ **SSE 流式** (dual-format) |
| `/pinggu` | 学习评估 | 评分环形动画 + 六维进度条 + 趋势折线图 + LLM 评估报告 | ✅ AI 评估 |
| `/setting` | 账号设置 | 个人信息编辑 + 修改密码 | ✅ auth API |
| `/zixi` | 自习模式 | TF.js + MoveNet 摄像头本地姿态检测 + 三状态机 | ✅ evaluation/record |

### 管理后台（9 个页面）

| 路由 | 页面 | 功能 | Token |
|------|------|------|-------|
| `/admin/login` | 管理员登录 | 调用 /auth/login + role 校验 | zhishu_admin_token |
| `/admin` | 仪表盘 | 4 统计卡片 + 2 趋势图 + 活跃用户表 | 硬编码 |
| `/admin/users` | 用户管理 | 表格 + 搜索/筛选/分页 + 详情弹窗 + **批量删除** | 硬编码 |
| `/admin/resources` | 资源管理 | 表格 + 类型筛选 + 详情弹窗 + **批量删除** | 硬编码 |
| `/admin/exercises` | 题库管理 | 表格 + 难度筛选 + **CRUD + 批量导入**（调用 admin_exercises API） | API |
| `/admin/paths` | 学习路径 | 表格 + DAG 详情弹窗 + **批量删除** | 硬编码 |
| `/admin/chats` | 对话记录 | 表格 + 对话详情弹窗 + **批量删除** | 硬编码 |
| `/admin/documents` | 知识库 | 表格 + 类型筛选 + **批量删除** | 硬编码 |
| `/admin/agents` | Agent 监控 | 14 Agent 模块集群卡片 + 调用统计 + 错误率 | 硬编码 |

## 开发规范

- 所有页面加 `'use client'` 指令
- CSS 集中在 `globals.css`（米色/墨黑/琥珀色系，模板 1:1 复刻）
- **CSS 命名空间隔离**：
  - 学生端：`.card` / `.chat-main` / `.stat` / `.btn`
  - 管理端：`.admin-cd` / `.admin-cb` / `.admin-batch-bar` / `.admin-btn`（用 `admin-` 前缀完全隔离）
- 静态数据写在 `page.tsx` 内，不拆分 data 文件
- 每个页面独立管理 state（setting 页使用 Zustand）
- XSS 防护：用户输入使用 `escapeHtml()` 转义（`utils.ts`）
- Markdown 渲染：自定义 `markdownToHtml()`（`utils.ts`），不依赖 react-markdown
- **认证**：`api.ts` 的 `request()` 自动带 `Authorization: Bearer` 头，401 自动跳登录页
- **统一 SSE**：所有流式调用都走 `lib/sse.ts` 的 `createEventStream()`（3 次重试 + 指数退避 + 120s 超时 + AbortController 取消），不再 4 处重复实现
- **student_id**：从 `localStorage.getItem('zhishu_student')` 读取（登录时存入）
- **管理后台认证**：独立 `zhishu_admin_token` 存储，`/admin/login` 页面校验 `role === 'admin'`
- **批量删除复用**：`useSelection` Hook + `BatchDeleteBar` + `AdminCheckbox` 共享组件，6 个列表页统一模式
- **Agent 监控**：9 个 Agent 状态 + 调用统计 + 30s 自动刷新

## 演示入口

```bash
学生端:  http://localhost:3000
管理后台: http://localhost:3000/admin/login  (admin / admin123)
```

## package.json 注意事项

`package.json` 里**装了但未使用**的依赖（接入 API 时可考虑删除以省构建时间）：

- `@radix-ui/react-dialog / tabs / progress / select / avatar / tooltip`（6 个）
- `class-variance-authority`、`clsx`、`tailwind-merge`（cn 工具类）
- `lucide-react`
- `reactflow`、`mermaid`、`recharts`（可视化）
- `react-markdown`、`react-syntax-highlighter`、`rehype-highlight`（Markdown 渲染，未用）
- `zustand`、`swr`（状态/数据，zustand 已接入 setting 页）

实际只用到：`next`、`react`、`react-dom`、`tailwindcss` + 工具链。
