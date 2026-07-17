# 资源中心重建 — 设计文档

> ⚠️ **未实施**（2026-07-18）：本文档是 `remove-resource-center` + `resource-center-rebuild` 两个实施计划的设计稿，未进入主分支。当前资源中心已有 AI 生成 + 手动创建 + 进度动画 + 收藏等功能，但与本文档描述的设计不完全一致。
>
> ## 概述

重建资源中心，支持两种创建方式 + 三重智能审核。

## 两种创建方式

### 方式一：AI 辅助创建（对话式迭代）

1. 用户输入需求描述
2. AI 生成全类型资源（knowledge + code + mermaid + exercises）
3. 自动触发审核，展示结果
4. 用户通过对话修改特定部分（多轮迭代）
5. 每次修改后可手动触发审核
6. 保存前强制审核

### 方式二：手动创建（模板填写 + AI 辅助）

1. 选择资源类型（知识/代码/导图/题目）
2. 系统提供结构化模板，用户填写
3. 用户随时点击"AI 审核"获取反馈
4. AI 可辅助补全内容
5. 保存前强制审核

## 两个新 Agent

### resource_creator_agent.py

- 输入：用户需求 + 学生画像 + 对话历史
- 输出：全类型资源 dict（knowledge, code, mermaid_code, exercises）
- 支持多轮对话，根据用户反馈修改特定部分
- 复用 document_agent / exercise_agent / mindmap_agent 的 prompt 和解析逻辑

### review_agent.py

- 输入：资源内容 + 知识点 + 学生画像
- 输出：四维度审核报告
  - content_quality：逻辑性、完整性、可读性（1-100 分 + issues 列表）
  - knowledge_accuracy：是否有幻觉/错误（复用 anti_hallucination）
  - format_check：markdown 格式、代码格式、结构清晰度
  - learning_suggestions：难度适配、补充建议、学习路径建议

## 审核流程

| 触发时机 | 类型 | 行为 |
|----------|------|------|
| AI 生成完成后 | auto | 后台自动运行，结果直接展示 |
| 用户点击"AI审核" | manual | 用户主动触发，显示详细报告 |
| 点击"保存"时 | mandatory | 未通过则阻止保存，显示问题 |

## 前端页面结构

```
/resources
├── page.tsx                    # 主页：创建方式选择 + 资源列表
├── components/
│   ├── CreateModal.tsx         # 创建弹窗（选择 AI/手动）
│   ├── AICreatePanel.tsx       # AI 辅助创建面板（对话式）
│   ├── ManualCreatePanel.tsx   # 手动创建面板（模板填写）
│   ├── ReviewPanel.tsx         # 审核结果展示面板
│   └── ResourceCard.tsx        # 资源卡片
└── hooks/
    ├── useResourceCreate.ts    # 创建逻辑 hook
    └── useReview.ts            # 审核逻辑 hook
```

## 后端 API

| 方法 | 路径 | 功能 |
|------|------|------|
| POST | /resource/create/stream | AI 辅助创建（SSE 流式） |
| POST | /resource/create/manual | 手动创建保存 |
| POST | /resource/review | 智能审核 |
| GET | /resource/list | 资源列表 |
| POST | /resource/{id}/favorite | 切换收藏 |
| DELETE | /resource/{id} | 删除资源 |

## 数据库

复用已 DROP 的三张表结构，重新创建：

- `resources`：id, student_id, title, resource_type, content (JSONB), knowledge_point, difficulty, is_favorited, is_preset, created_at
- `exercises`：id, student_id, resource_id, exercise_type, question, options, answer, explanation, difficulty, knowledge_point, is_correct, created_at
- `exercise_bank`：公共题库（保留原结构）

## 技术栈

- 前端：Next.js, TypeScript, SSE 流式
- 后端：FastAPI, SQLAlchemy, SSE
- LLM：MiniMax-M3 / Spark
- 审核：anti_hallucination 扩展 + review_agent
