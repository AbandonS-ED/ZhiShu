# 智学 (ZhiShu) - 前端项目

> 多智能体学习资源生成系统 · 前端部分

## 技术栈

- **框架**: Next.js 14 + React 18
- **样式**: Tailwind CSS + shadcn/ui
- **状态管理**: Zustand
- **数据获取**: SWR
- **图表**: Recharts
- **图可视化**: ReactFlow
- **思维导图**: Mermaid
- **Markdown**: react-markdown

## 项目结构

```
zhishu-frontend/
├── src/
│   ├── app/                    # Next.js 页面路由
│   │   ├── layout.tsx          # 全局布局
│   │   ├── page.tsx            # 仪表盘首页
│   │   ├── profile/            # 学习者画像
│   │   ├── path/               # 学习路径
│   │   ├── resources/          # 学习资源
│   │   ├── mindmap/            # 思维导图
│   │   └── tutor/              # 智能问答
│   ├── components/             # 组件
│   │   ├── layout/             # 布局组件
│   │   │   ├── Sidebar.tsx     # 侧边栏导航
│   │   │   └── Header.tsx      # 顶部导航栏
│   │   ├── dashboard/          # 仪表盘组件
│   │   │   ├── RadarChart.tsx  # 雷达图
│   │   │   ├── ProgressCard.tsx # 进度卡片
│   │   │   └── QuickActions.tsx # 快捷操作
│   │   ├── profile/            # 画像组件
│   │   ├── path/               # 路径组件
│   │   ├── resources/          # 资源组件
│   │   ├── mindmap/            # 导图组件
│   │   └── tutor/              # 问答组件
│   ├── lib/                    # 工具函数
│   │   └── utils.ts
│   ├── stores/                 # Zustand 状态
│   │   └── appStore.ts
│   └── types/                  # TypeScript 类型
│       └── index.ts
├── package.json
├── tsconfig.json
├── tailwind.config.js
└── postcss.config.js
```

## 快速开始

### 安装依赖

```bash
npm install
```

### 启动开发服务器

```bash
npm run dev
```

访问 http://localhost:3000

### 构建生产版本

```bash
npm run build
npm start
```

## 页面说明

### 1. 仪表盘 (Dashboard)
- 欢迎横幅与学习 streak
- 六维画像雷达图
- 学习进度统计
- 快捷操作按钮
- 最近学习活动

### 2. 学习画像 (Profile)
- 六维画像详细展示
- 各维度进度条
- 薄弱环节标签

### 3. 学习路径 (Learning Path)
- ReactFlow 节点图
- 拓扑排序展示
- 节点状态（已完成/学习中/可学习/未解锁）
- 点击查看详情

### 4. 学习资源 (Resources)
- 资源类型筛选
- 卡片式展示
- 难度标签
- 学习状态

### 5. 思维导图 (Mind Map)
- Mermaid 渲染
- 缩放/重置/下载/全屏
- 知识掌握度环形图

### 6. 智能问答 (Tutor)
- Markdown 消息渲染
- 代码高亮
- 来源引用
- 相关话题推荐
- 流式响应支持

## 后端 API 对接

前端通过以下方式与后端通信：

- **REST API**: SWR 数据获取
- **SSE**: 流式响应（资源生成）
- **WebSocket**: 实时任务进度

API 基础路径: `/api/v1`

## 开发规范

- 使用 TypeScript 严格模式
- 组件使用 `'use client'` 指令
- 样式使用 Tailwind CSS
- 状态使用 Zustand
- 类型定义在 `types/` 目录

## 相关文档

- [项目设计文档](./设计文档.md)
- [Next.js 文档](https://nextjs.org/docs)
- [Tailwind CSS 文档](https://tailwindcss.com/docs)
- [ReactFlow 文档](https://reactflow.dev/docs)
