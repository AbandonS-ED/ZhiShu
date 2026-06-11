# 智枢 (SmartHub) - 前端项目

> 多智能体学习资源生成系统 · 前端部分（学生端 8 页 + 管理后台 9 页）

## 技术栈

- **框架**: Next.js 14.2.5 (App Router) + React 18
- **样式**: Tailwind CSS 3.4 + 自定义 CSS（模板 1:1 复刻）
- **状态管理**: React useState + Context（学生端 + 管理端独立 Context）
- **路由隔离**: `/admin` 路由前缀，独立的 RootLayout 拦截

## 项目结构

```
src/
├── app/                    # 路由页面（学生 8 + 管理 9 + 2 布局 + 1 全局 layout）
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
│   └── admin/              # ⭐ 管理后台（独立布局 + Token 隔离）
│       ├── layout.tsx      # 管理后台布局（admin-sb + admin-hd + 底部登出）
│       ├── page.tsx        # /admin 仪表盘
│       ├── login/          # /admin/login 管理员登录
│       ├── users/          # /admin/users 用户管理（含批量删除）
│       ├── resources/      # /admin/resources 资源管理
│       ├── exercises/      # /admin/exercises 练习题
│       ├── paths/          # /admin/paths 学习路径
│       ├── chats/          # /admin/chats 对话记录
│       ├── documents/      # /admin/documents 知识库
│       └── agents/         # /admin/agents Agent 监控
├── components/layout/      # 学生端共享布局组件
│   ├── Sidebar.tsx         # 侧边栏导航（7 项菜单 + 用户信息 + 底部登出按钮）
│   └── Header.tsx          # 顶部导航栏
├── lib/
│   ├── api.ts              # 学生端 API 客户端（9 模块 + auth，自动带 token）
│   ├── student.ts          # student_id 本地存储（zhishu_student）
│   ├── utils.ts            # cn() + escapeHtml() + markdownToHtml() + extractAnswer()
│   ├── admin/context.tsx   # ⭐ 管理后台共享状态（AdminProvider + useAdmin）
│   └── admin/components.tsx # ⭐ 管理后台共享组件（AdminCheckbox + BatchDeleteBar + useSelection）
├── app/profile/ChatModal.tsx  # 对话式画像提取弹窗
├── stores/appStore.ts      # Zustand store（暂未使用）
├── types/index.ts          # TS 类型契约（暂未使用）
└── fonts/                  # 本地字体（GeistVF, GeistMonoVF）
```

## 快速开始

```bash
npm install
npm run dev       # http://localhost:3000
npm run build     # 验证编译（✅ 通过：17 路由）
npm run lint      # ESLint 检查（✅ 0 errors）
```

> 端口同步：默认连后端 8001。改端口要同步改 `src/lib/api.ts:5` 的 `BASE_URL`。

## 页面说明

### 学生端（8 个页面）

| 路由 | 页面 | 功能 | 后端联调 |
|------|------|------|----------|
| `/` | 仪表盘 | 统计卡片 + 最近活动 + 快速开始 + 课程进度 | ✅ 数据聚合 |
| `/login` | 登录/注册 | Tab 切换 + 密码校验 + 自动跳转 | ✅ **JWT 认证** |
| `/duihua` | 智能对话 | 多轮对话 + Agent 进度展示 + 推荐问题 + 会话管理 | ✅ **SSE 流式** (真逐 token) |
| `/profile` | 学习画像 | SVG 雷达图 + 知识点掌握度 + 薄弱环节 + 六维详情(可展开) + AI 弹窗 | ✅ AI 弹窗 |
| `/resources` | 资源中心 | 10 资源卡片 + 搜索/筛选 + 网格/列表视图 + 收藏 + 详情模态框 | ✅ **SSE 流式** |
| `/path` | 学习路径 | 12 节点 DAG 图谱(SVG 边) + 概览统计 + 详情面板 + 5 天每日计划 | ✅ **SSE 流式** |
| `/tiku` | 练习题库 | 10 题(选择/判断/简答/编程) + 即时反馈 + 进度环形图 + 知识点分析 | ✅ **SSE 流式** (dual-format) |
| `/pinggu` | 学习评估 | 评分环形动画 + 六维进度条 + 趋势折线图 + 正确率柱状图 + 评估报告 | ✅ AI 评估 |

### 管理后台（9 个页面，1:1 复刻 houtai.html）

| 路由 | 页面 | 功能 | Token |
|------|------|------|-------|
| `/admin/login` | 管理员登录 | 调用 /auth/login + role 校验 | zhishu_admin_token |
| `/admin` | 仪表盘 | 4 统计卡片 + 2 趋势图 + 活跃用户表 | 硬编码 |
| `/admin/users` | 用户管理 | 表格 + 搜索/筛选/分页 + 详情弹窗 + **批量删除** | 硬编码 |
| `/admin/resources` | 资源管理 | 表格 + 类型筛选 + 详情弹窗 + **批量删除** | 硬编码 |
| `/admin/exercises` | 练习题 | 表格 + 难度筛选 + **批量删除** | 硬编码 |
| `/admin/paths` | 学习路径 | 表格 + DAG 详情弹窗 + **批量删除** | 硬编码 |
| `/admin/chats` | 对话记录 | 表格 + 对话详情弹窗 + **批量删除** | 硬编码 |
| `/admin/documents` | 知识库 | 表格 + 类型筛选 + **批量删除** | 硬编码 |
| `/admin/agents` | Agent 监控 | 7 Agent 集群卡片 + 调用统计 + 错误率 | 硬编码 |

> 管理后台 9 页面的数据**当前是模板硬编码**（演示用），实际后端 27 个 API 在 `docs/设计文档/管理后台设计文档.md`，等后续开发。

端到端测试（4 次 9/9 PASS + 第 5 次管理后台验证）见 `../SMOKE_TEST_REPORT.md`。

## 开发规范

- 所有页面（除仪表盘）加 `'use client'` 指令
- CSS 集中在 `globals.css`（米色/墨黑/琥珀色系，模板 1:1 复刻）
- **CSS 命名空间隔离**：
  - 学生端：`.card` / `.chat-main` / `.stat` / `.btn`
  - 管理端：`.admin-cd` / `.admin-cb` / `.admin-batch-bar` / `.admin-btn`（用 `admin-` 前缀完全隔离）
- 静态数据写在 `page.tsx` 内，不拆分 data 文件
- 每个页面独立管理 state（**不**用 Zustand，虽然 `stores/appStore.ts` 已创建但未接入）
- XSS 防护：用户输入使用 `escapeHtml()` 转义（`utils.ts`）
- Markdown 渲染：自定义 `markdownToHtml()`（`utils.ts`），不依赖 react-markdown
- **认证**：`api.ts` 的 `request()` 自动带 `Authorization: Bearer` 头，401 自动跳登录页
- **student_id**：从 `localStorage.getItem('zhishu_student')` 读取（登录时存入）
- **管理后台认证**：独立 `zhishu_admin_token` 存储，`/admin/login` 页面校验 `role === 'admin'`
- **批量删除复用**：`useSelection` Hook + `BatchDeleteBar` + `AdminCheckbox` 共享组件，6 个列表页统一模式

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
- `zustand`、`swr`（状态/数据，未用）

实际只用到：`next`、`react`、`react-dom`、`tailwindcss` + 工具链。
