# 智枢 (SmartHub) - 前端项目

> 多智能体学习资源生成系统 · 前端部分

## 技术栈

- **框架**: Next.js 14.2.5 (App Router) + React 18
- **样式**: Tailwind CSS 3.4 + 自定义 CSS（模板 1:1 复刻）
- **状态管理**: React useState（无全局状态库）

## 项目结构

```
src/
├── app/                    # 路由页面（7 个）
│   ├── layout.tsx          # 全局布局（Sidebar + Header）
│   ├── page.tsx            # / 仪表盘
│   ├── duihua/page.tsx     # /duihua 智能对话（SSE 流式）
│   ├── path/page.tsx       # /path 学习路径（SSE 流式）
│   ├── pinggu/page.tsx     # /pinggu 学习评估
│   ├── profile/page.tsx    # /profile 学习画像
│   ├── resources/page.tsx  # /resources 资源中心（SSE 流式）
│   └── tiku/page.tsx       # /tiku 练习题库（SSE 流式）
├── components/layout/      # 共享布局组件
│   ├── Sidebar.tsx         # 侧边栏导航
│   └── Header.tsx          # 顶部导航栏
├── lib/
│   ├── api.ts              # API 客户端（7 模块：profile/chat/resource/exercise/path/tutor/dashboard）
│   ├── student.ts          # student_id 本地存储
│   └── utils.ts            # cn() + escapeHtml() 工具
├── app/profile/ChatModal.tsx  # 对话式画像提取弹窗
└── fonts/                  # 本地字体（GeistVF, GeistMonoVF）
```

## 快速开始

```bash
npm install
npm run dev       # http://localhost:3000
npm run build     # 验证编译
npm run lint      # ESLint 检查
```

## 页面说明

| 路由 | 页面 | 功能 | 后端联调 |
|------|------|------|----------|
| `/` | 仪表盘 | 统计卡片 + 最近活动 + 快速开始 + 课程进度 | ✅ 数据聚合 |
| `/duihua` | 智能对话 | 多轮对话 + Agent 进度展示 + 推荐问题 + 生成资源面板 | ✅ SSE 流式 |
| `/profile` | 学习画像 | SVG 雷达图 + 知识点掌握度 + 薄弱环节 + 六维详情(可展开) + 问卷模态框 + 更新历史 | ✅ AI 弹窗 |
| `/resources` | 资源中心 | 10 资源卡片 + 搜索/筛选 + 网格/列表视图 + 收藏 + 详情模态框(含练习/代码/音频) | ✅ SSE 流式 |
| `/path` | 学习路径 | 12 节点 DAG 图谱(SVG 边) + 概览统计 + 详情面板 + 5 天每日计划 | ✅ SSE 流式 |
| `/tiku` | 练习题库 | 10 题(选择/判断/简答/编程) + 即时反馈 + 进度环形图 + 知识点分析 + 最近答题 | ✅ SSE 流式 |
| `/pinggu` | 学习评估 | 评分环形动画 + 六维进度条 + 趋势折线图 + 正确率柱状图 + 评估报告 + 学习记录分页 | ✅ AI 评估 |

## 开发规范

- 所有页面（除仪表盘）加 `'use client'` 指令
- CSS 集中在 `globals.css`（745 行，7 页面合并）
- 静态数据写在 `page.tsx` 内，不拆分 data 文件
- 每个页面独立管理 state，不共享全局状态
- XSS 防护：用户输入使用 `escapeHtml()` 转义
