# 个人底层能力画像重构方案

> **状态同步**: 2026-06-28 — 5 维画像重构已完成。本文档作为重构动机存档。

## 动机

旧的6维画像（knowledge_mastery, learning_style, cognitive_level, interest, weak_topics, learning_pace）存在以下问题：
- learning_style（VARK模型）被教育学证伪
- weak_topics 与 knowledge_mastery 冗余
- learning_pace 数据不可靠、无法落地
- 维度不聚焦于"学生个人能力"，无法激励成长

新方案聚焦5个**全学科通用的底层能力**，旨在做出一个能激励学生看到自己能力成长的能力雷达图。

## 新5维能力模型

| 维度 | JSON key | 含义 |
|------|----------|------|
| 理解力 | `comprehension` | 学新概念的快慢 |
| 记忆力 | `memory` | 记知识点的牢固度 |
| 应用转化 | `application` | 学了能否在不同场景用出来 |
| 想象力 | `imagination` | 不同思路、创新解法 |
| 专注力 | `focus` | 持续学习时长 |

每个维度存储结构：`{ score: 0-100, confidence: 0-1 }`

## 架构变更

### 移除（删除文件）

| 文件 | 原因 |
|------|------|
| `backend/app/models/subject_profile.py` | 学科画像移到后续阶段 |
| `backend/app/models/guided_session.py` | 旧引导问答系统废弃 |
| `backend/app/models/guided_answer.py` | 同上 |
| `backend/app/agents/profile_agent.py` | 旧对话抽取Agent废弃 |
| `backend/app/agents/guided_profile_agent.py` | 旧引导Agent废弃 |
| `backend/app/api/guided_profile.py` | 旧引导路由废弃 |
| `frontend/src/app/profile/GuidedProfileModal.tsx` | 旧引导模态框废弃 |
| `frontend/src/app/profile/SubjectSelect.tsx` | 旧学科选择组件废弃 |
| `frontend/src/app/profile/ChatModal.tsx` | 旧聊天式画像废弃 |

### 修改

| 文件 | 改动 |
|------|------|
| `backend/app/models/student_profile.py` | 重写：dimensions 改为5维+background+assessment_status，去掉completeness_score |
| `backend/app/api/profile.py` | 重写：4个端点 /assess/start, /assess/next, /me, /radar |
| `backend/app/agents/__init__.py` | 注册新 Agent |
| `backend/app/main.py` | 移除 guided_profile router 注册 |
| `backend/app/core/dependencies.py` | 如有 profile 相关依赖则更新 |
| `backend/app/api/chat.py` | 移除旧画像字段引用（knowledge_mastery等） |
| `backend/app/agents/master_agent.py` | 更新 student_profile 传递逻辑 |
| `backend/app/agents/communicator.py` | 更新 profile request |
| `backend/app/agents/document_agent.py` | 移除 old dimension refs |
| `backend/app/agents/exercise_agent.py` | 同上 |
| `backend/app/agents/path_agent.py` | 同上 |
| `backend/app/agents/mindmap_agent.py` | 同上 |
| `backend/app/agents/tutor_agent.py` | 同上 |
| `backend/app/agents/audio_agent.py` | 同上 |
| `backend/app/services/anti_hallucination.py` | 移除旧 profile 验证分支 |
| `frontend/src/app/profile/page.tsx` | 重写：5边形雷达图+初评引导 |
| `frontend/src/lib/api.ts` | 添加新 profile API 方法 |
| `frontend/src/types/index.ts` | 更新 ProfileDimensions 类型 |
| `frontend/src/stores/appStore.ts` | 更新 profile 类型 |
| `backend/scripts/init_db.sql` | 重建 student_profiles 表，移除旧表 |

## 新后端 API 设计

### POST /api/v1/profile/assess/start
- 请求体：`{ student_id }`
- 返回：`{ session_id, dimension: "comprehension", question: "..." }`

### POST /api/v1/profile/assess/next
- 请求体：`{ session_id, answer: "..." }`
- 返回：`{ dimension, question, scores_so_far?, done: boolean }`
- 如果 done=true，同时返回完整维度数据

### GET /api/v1/profile/me
- 返回：当前学生画像（5维分数 + background + assessment_status）

### GET /api/v1/profile/radar
- 返回：`{ dimensions: { comprehension: 72, memory: 55, ... }, history: [...] }`

## 新 InitialAssessmentAgent

一个轻量 Agent，核心逻辑：

1. 预设5个维度的锚定问题（每个维度1个主问题+可选的1个追问）
2. 每轮学生回答后，LLM分析回答质量并给出该维度的 score + confidence
3. confidence < 70 时追加追问
4. 全部5个维度完成后，计算综合结果并保存

系统提示定义5个维度的评估锚点，让 LLM 通过自然对话评估学生能力，而非依赖选择题。

## 新前端画像页

- 顶部：**五边形雷达图**（SVG），每条轴标注维度名称 + 分数
- 中部：assessment_status 如果是 pending/in_progress，显示引导入口
- 下部：background 卡片展示（专业/年级/目标等基本信息）
- 无展开详情、无评语摘要、无旧模态框

## 实施顺序

1. 后端数据模型 → 2. 后端 Agent → 3. 后端 API → 4. 清理旧代码 → 5. 前端类型+API → 6. 前端画像页 → 7. 更新其他 Agent 引用 → 8. 数据库脚本 → 9. 测试
