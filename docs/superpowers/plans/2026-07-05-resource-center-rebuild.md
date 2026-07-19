# 资源中心重建 Implementation Plan

> ⚠️ **未实施**（2026-07-18）：资源中心功能在 2026-07-05 后已有大幅迭代（AI 生成 + 手动创建 + 进度动画 + 我的资源过滤 + 详情标签页 + 收藏 + 批量生成），但具体实现路径与此设计稿不完全一致。本文档保留作为参考。
>
> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 重建资源中心，支持 AI 辅助创建（对话式迭代）+ 手动创建（模板填写）+ 三重智能审核

**Architecture:** 两个新 Agent（resource_creator_agent + review_agent）+ 前端对话式 UI + SSE 流式 + 三重审核流程

**Tech Stack:** Next.js, TypeScript, FastAPI, SQLAlchemy, SSE, MiniMax-M3

---

## 文件结构

```
backend/app/agents/
├── resource_creator_agent.py    # 新建：资源生成 Agent（对话式）
└── review_agent.py              # 新建：智能审核 Agent

backend/app/api/
└── resource.py                  # 新建：资源中心 API（6 个端点）

backend/app/models/
├── resource.py                  # 新建：Resource 模型
├── exercise.py                  # 新建：Exercise 模型
└── exercise_bank.py             # 新建：ExerciseBank 模型

frontend/src/app/resources/
├── page.tsx                     # 重写：主页面
├── types.ts                     # 新建：类型定义
├── components/
│   ├── CreateModal.tsx          # 新建：创建方式选择弹窗
│   ├── AICreatePanel.tsx        # 新建：AI 对话式创建面板
│   ├── ManualCreatePanel.tsx    # 新建：手动模板创建面板
│   ├── ReviewPanel.tsx          # 新建：审核结果展示
│   └── ResourceCard.tsx         # 新建：资源卡片
└── hooks/
    ├── useResourceCreate.ts     # 新建：创建逻辑
    └── useReview.ts             # 新建：审核逻辑
```

---

## Task 1: 数据库模型 — 重建三张表

**Files:**
- Create: `backend/app/models/resource.py`
- Create: `backend/app/models/exercise.py`
- Create: `backend/app/models/exercise_bank.py`
- Modify: `backend/app/models/__init__.py`
- Modify: `backend/scripts/init_db.sql`

- [ ] **Step 1: 创建 Resource 模型**

```python
# backend/app/models/resource.py
import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, Boolean, Integer, ForeignKey, DateTime
from sqlalchemy.dialects.postgresql import UUID, JSONB
from app.core.database import Base

class Resource(Base):
    __tablename__ = "resources"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id"), nullable=False, index=True)
    course_id = Column(UUID(as_uuid=True), ForeignKey("courses.id"), nullable=True)
    title = Column(String(200), nullable=False)
    resource_type = Column(String(20), nullable=False)  # knowledge/code/mindmap/exercise
    content = Column(JSONB, nullable=False, default=dict)
    knowledge_point = Column(String(200), nullable=True, index=True)
    difficulty = Column(Integer, default=50)
    is_favorited = Column(Boolean, default=False)
    is_preset = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
```

- [ ] **Step 2: 创建 Exercise 模型**

```python
# backend/app/models/exercise.py
import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, Boolean, Integer, ForeignKey, DateTime
from sqlalchemy.dialects.postgresql import UUID, JSONB
from app.core.database import Base

class Exercise(Base):
    __tablename__ = "exercises"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id"), nullable=False, index=True)
    resource_id = Column(UUID(as_uuid=True), ForeignKey("resources.id"), nullable=True)
    exercise_type = Column(String(20), nullable=False)  # choice/judge/short_answer/coding
    question = Column(Text, nullable=False)
    options = Column(JSONB, nullable=True)
    answer = Column(Text, nullable=False)
    explanation = Column(Text, nullable=True)
    difficulty = Column(Integer, default=50)
    knowledge_point = Column(String(200), nullable=True)
    student_answer = Column(Text, nullable=True)
    is_correct = Column(Boolean, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
```

- [ ] **Step 3: 创建 ExerciseBank 模型**

```python
# backend/app/models/exercise_bank.py
import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, Boolean, Integer, DateTime
from sqlalchemy.dialects.postgresql import UUID, JSONB
from app.core.database import Base

class ExerciseBank(Base):
    __tablename__ = "exercise_bank"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    question = Column(Text, nullable=False)
    exercise_type = Column(String(20), nullable=False)
    options = Column(JSONB, nullable=True)
    answer = Column(Text, nullable=False)
    explanation = Column(Text, nullable=True)
    difficulty = Column(Integer, default=50)
    knowledge_point = Column(String(200), nullable=True, index=True)
    source = Column(String(50), default="manual")
    is_active = Column(Boolean, default=True)
    created_by = Column(String(50), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
```

- [ ] **Step 4: 更新 __init__.py**

在 `__init__.py` 中添加 Resource, Exercise, ExerciseBank 的导入和 `__all__` 导出。

- [ ] **Step 5: 更新 init_db.sql**

添加 CREATE TABLE 语句：

```sql
CREATE TABLE IF NOT EXISTS resources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES students(id),
    course_id UUID REFERENCES courses(id),
    title VARCHAR(200) NOT NULL,
    resource_type VARCHAR(20) NOT NULL,
    content JSONB NOT NULL DEFAULT '{}',
    knowledge_point VARCHAR(200),
    difficulty INTEGER DEFAULT 50,
    is_favorited BOOLEAN DEFAULT FALSE,
    is_preset BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX idx_resources_student_id ON resources(student_id);
CREATE INDEX idx_resources_knowledge_point ON resources(knowledge_point);

CREATE TABLE IF NOT EXISTS exercises (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES students(id),
    resource_id UUID REFERENCES resources(id),
    exercise_type VARCHAR(20) NOT NULL,
    question TEXT NOT NULL,
    options JSONB,
    answer TEXT NOT NULL,
    explanation TEXT,
    difficulty INTEGER DEFAULT 50,
    knowledge_point VARCHAR(200),
    student_answer TEXT,
    is_correct BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX idx_exercises_student_id ON exercises(student_id);

CREATE TABLE IF NOT EXISTS exercise_bank (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question TEXT NOT NULL,
    exercise_type VARCHAR(20) NOT NULL,
    options JSONB,
    answer TEXT NOT NULL,
    explanation TEXT,
    difficulty INTEGER DEFAULT 50,
    knowledge_point VARCHAR(200),
    source VARCHAR(50) DEFAULT 'manual',
    is_active BOOLEAN DEFAULT TRUE,
    created_by VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX idx_exercise_bank_knowledge_point ON exercise_bank(knowledge_point);
```

---

## Task 2: Review Agent — 智能审核 Agent

**Files:**
- Create: `backend/app/agents/review_agent.py`

- [ ] **Step 1: 创建 ReviewAgent**

```python
# backend/app/agents/review_agent.py
"""智能审核 Agent — 四维度审核：内容质量 + 知识准确性 + 格式规范 + 学习建议"""

import json
import logging
from app.services.llm_factory import get_llm_client
from app.services.json_parser import parse_json_response
from app.services.anti_hallucination import anti_hallucination

logger = logging.getLogger(__name__)

REVIEW_SYSTEM_PROMPT = """你是一个专业的学习资源审核专家。请从以下四个维度审核用户提供的学习资源，给出评分和具体建议。

审核维度：
1. content_quality（内容质量）：逻辑性、完整性、可读性、深度适中
2. knowledge_accuracy（知识准确性）：是否有错误、过时信息、夸大表述
3. format_check（格式规范）：markdown 格式正确、代码可运行、结构清晰
4. learning_suggestions（学习建议）：难度是否合适、哪里需要补充、学习路径建议

请返回 JSON 格式：
{
  "overall_score": 85,
  "passed": true,
  "dimensions": {
    "content_quality": {
      "score": 88,
      "issues": ["issue1", "issue2"],
      "suggestions": ["suggestion1"]
    },
    "knowledge_accuracy": {
      "score": 90,
      "issues": [],
      "suggestions": []
    },
    "format_check": {
      "score": 80,
      "issues": ["代码块缺少语言标注"],
      "suggestions": ["添加语言标识如 ```python"]
    },
    "learning_suggestions": {
      "score": 82,
      "issues": ["难度偏高，建议增加基础解释"],
      "suggestions": ["添加前置知识链接"]
    }
  },
  "summary": "整体质量良好，建议..."
}

规则：
- overall_score 是四个维度的加权平均（各 25%）
- passed = overall_score >= 60
- issues 列出具体问题（空列表表示无问题）
- suggestions 给出改进建议
- 只输出 JSON，不要额外文字"""


class ReviewAgent:
    SYSTEM_PROMPT = REVIEW_SYSTEM_PROMPT

    async def review(
        self,
        content: dict,
        knowledge_point: str,
        student_profile: dict | None = None,
    ) -> dict:
        """审核资源内容"""
        # 1. 先做 anti_hallucination 快速检查
        text_parts = []
        if content.get("knowledge"):
            text_parts.append(content["knowledge"])
        if content.get("code"):
            text_parts.append(content["code"])
        if content.get("exercises"):
            for ex in content["exercises"]:
                text_parts.append(ex.get("question", ""))
                text_parts.append(ex.get("explanation", ""))

        full_text = "\n".join(text_parts)
        hallucination_result = None
        if full_text.strip():
            hallucination_result = await anti_hallucination.validate(
                content=full_text,
                knowledge_point=knowledge_point,
            )

        # 2. 构建审核 prompt
        prompt = self._build_prompt(content, knowledge_point, student_profile, hallucination_result)

        # 3. 调用 LLM 审核
        try:
            response = await get_llm_client().chat(
                messages=[{"role": "user", "content": prompt}],
                system=self.SYSTEM_PROMPT,
                max_tokens=2048,
                temperature=0.3,
            )
            result = parse_json_response(response.get("content", ""), self._default_result())
        except Exception as e:
            logger.error("ReviewAgent LLM call failed: %s", e)
            result = self._default_result()

        # 4. 合并 anti_hallucination 结果
        if hallucination_result and not hallucination_result.passed:
            result["dimensions"]["knowledge_accuracy"]["issues"].extend(
                hallucination_result.issues
            )
            result["dimensions"]["knowledge_accuracy"]["score"] = min(
                result["dimensions"]["knowledge_accuracy"]["score"],
                int(hallucination_result.confidence * 100),
            )
            result["overall_score"] = self._calc_overall(result["dimensions"])
            result["passed"] = result["overall_score"] >= 60

        return result

    def _build_prompt(
        self,
        content: dict,
        knowledge_point: str,
        student_profile: dict | None,
        hallucination_result,
    ) -> str:
        parts = [f"## 知识点\n{knowledge_point}\n"]

        if student_profile:
            dims = student_profile.get("dimensions", {})
            parts.append(f"## 学生画像\n- 知识基础: {dims.get('knowledge_base', {}).get('score', '未知')}")
            parts.append(f"- 理解能力: {dims.get('comprehension', {}).get('score', '未知')}")
            parts.append(f"- 专注度: {dims.get('focus', {}).get('score', '未知')}\n")

        parts.append("## 待审核内容")
        if content.get("knowledge"):
            parts.append(f"\n### 知识讲解\n{content['knowledge']}")
        if content.get("code"):
            parts.append(f"\n### 代码示例\n{content['code']}")
        if content.get("mermaid_code"):
            parts.append(f"\n### 思维导图\n{content['mermaid_code']}")
        if content.get("exercises"):
            parts.append("\n### 练习题")
            for i, ex in enumerate(content["exercises"], 1):
                parts.append(f"\n**{i}.** [{ex.get('type', 'unknown')}] {ex.get('question', '')}")
                if ex.get("options"):
                    for opt in ex["options"]:
                        parts.append(f"  - {opt}")
                parts.append(f"  答案: {ex.get('answer', '')}")
                parts.append(f"  解析: {ex.get('explanation', '')}")

        if hallucination_result:
            parts.append(f"\n## 幻觉检测结果\n- 通过: {hallucination_result.passed}")
            parts.append(f"- 置信度: {hallucination_result.confidence}")
            if hallucination_result.issues:
                parts.append(f"- 问题: {', '.join(hallucination_result.issues)}")

        return "\n".join(parts)

    def _calc_overall(self, dimensions: dict) -> int:
        scores = []
        for dim in dimensions.values():
            if isinstance(dim, dict) and "score" in dim:
                scores.append(dim["score"])
        return int(sum(scores) / len(scores)) if scores else 0

    def _default_result(self) -> dict:
        return {
            "overall_score": 0,
            "passed": False,
            "dimensions": {
                "content_quality": {"score": 0, "issues": ["审核失败"], "suggestions": []},
                "knowledge_accuracy": {"score": 0, "issues": ["审核失败"], "suggestions": []},
                "format_check": {"score": 0, "issues": ["审核失败"], "suggestions": []},
                "learning_suggestions": {"score": 0, "issues": ["审核失败"], "suggestions": []},
            },
            "summary": "审核过程中出现错误，请重试",
        }


review_agent = ReviewAgent()
```

- [ ] **Step 2: 注册到 agents/__init__.py**

在 `__init__.py` 中添加 `from app.agents.review_agent import review_agent`。

---

## Task 3: Resource Creator Agent — 资源生成 Agent

**Files:**
- Create: `backend/app/agents/resource_creator_agent.py`

- [ ] **Step 1: 创建 ResourceCreatorAgent**

该 Agent 支持多轮对话式生成，根据用户需求生成全类型资源，支持修改特定部分。

核心逻辑：
- `_build_prompt()`：根据用户需求 + 对话历史 + 学生画像构建 prompt
- `generate()`：一次性生成全部资源（knowledge + code + mermaid + exercises）
- `modify()`：根据用户反馈修改特定部分（如"把代码改简单点"）
- 复用 document_agent / exercise_agent / mindmap_agent 的 prompt 模板和解析逻辑

---

## Task 4: 后端 API — 资源中心端点

**Files:**
- Create: `backend/app/api/resource.py`
- Modify: `backend/app/main.py`

- [ ] **Step 1: 创建 resource.py 路由**

6 个端点：
1. `POST /create/stream` — AI 辅助创建（SSE 流式，支持多轮对话）
2. `POST /create/manual` — 手动创建保存
3. `POST /review` — 智能审核
4. `GET /list` — 资源列表
5. `POST /{id}/favorite` — 切换收藏
6. `DELETE /{id}` — 删除资源

- [ ] **Step 2: 注册路由到 main.py**

---

## Task 5: 前端类型 + API 函数

**Files:**
- Create: `frontend/src/app/resources/types.ts`
- Modify: `frontend/src/lib/api.ts`

- [ ] **Step 1: 定义 TypeScript 类型**

```typescript
// types.ts
export interface ReviewDimension {
  score: number
  issues: string[]
  suggestions: string[]
}

export interface ReviewResult {
  overall_score: number
  passed: boolean
  dimensions: {
    content_quality: ReviewDimension
    knowledge_accuracy: ReviewDimension
    format_check: ReviewDimension
    learning_suggestions: ReviewDimension
  }
  summary: string
}

export interface ResourceItem {
  resource_id: string
  title: string
  resource_type: string
  knowledge_point: string
  content: Record<string, any>
  difficulty: number
  is_favorited: boolean
  created_at: string
}

export interface CreateMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}
```

- [ ] **Step 2: 添加 API 函数到 api.ts**

```typescript
export const resourceApi = {
  // AI 创建（SSE 流式）
  createStream: (data: { student_id: string; message: string; conversation_history?: any[] }) =>
    fetch(`${BASE_URL}/resource/create/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(data),
    }),

  // 手动创建
  createManual: (data: { student_id: string; title: string; resource_type: string; content: any; knowledge_point: string }) =>
    apiRequest('/resource/create/manual', { method: 'POST', body: JSON.stringify(data) }),

  // 审核
  review: (data: { content: any; knowledge_point: string }) =>
    apiRequest('/resource/review', { method: 'POST', body: JSON.stringify(data) }),

  // 列表
  list: (studentId: string) =>
    apiRequest(`/resource/list?student_id=${studentId}`),

  // 收藏
  toggleFavorite: (resourceId: string) =>
    apiRequest(`/resource/${resourceId}/favorite`, { method: 'POST' }),

  // 删除
  delete: (resourceId: string) =>
    apiRequest(`/resource/${resourceId}`, { method: 'DELETE' }),
}
```

---

## Task 6: 前端页面 — 主页面 + 创建弹窗

**Files:**
- Rewrite: `frontend/src/app/resources/page.tsx`
- Create: `frontend/src/app/resources/types.ts`
- Create: `frontend/src/app/resources/components/CreateModal.tsx`
- Create: `frontend/src/app/resources/components/ResourceCard.tsx`

- [ ] **Step 1: 重写 page.tsx**

主页面包含：
- 顶部工具栏：搜索 + 筛选 + "创建资源"按钮
- 资源列表：卡片网格展示
- 创建弹窗：选择"AI辅助"或"手动创建"

- [ ] **Step 2: 创建 CreateModal.tsx**

弹窗组件，包含两个选项卡：
- "AI 辅助创建" → 打开 AICreatePanel
- "手动创建" → 打开 ManualCreatePanel

- [ ] **Step 3: 创建 ResourceCard.tsx**

资源卡片组件，显示标题、类型、知识点、难度、收藏状态。

---

## Task 7: 前端 — AI 对话式创建面板

**Files:**
- Create: `frontend/src/app/resources/components/AICreatePanel.tsx`
- Create: `frontend/src/app/resources/hooks/useResourceCreate.ts`

- [ ] **Step 1: 创建 useResourceCreate.ts hook**

管理对话状态、SSE 流式接收、资源内容更新。

- [ ] **Step 2: 创建 AICreatePanel.tsx**

对话式 UI：
- 左侧：对话历史（用户消息 + AI 回复）
- 右侧：资源预览（分 tab 显示 knowledge/code/mermaid/exercises）
- 底部：输入框 + 发送按钮 + "AI审核"按钮 + "保存"按钮
- 审核结果以面板形式展示

---

## Task 8: 前端 — 手动创建面板

**Files:**
- Create: `frontend/src/app/resources/components/ManualCreatePanel.tsx`

- [ ] **Step 1: 创建 ManualCreatePanel.tsx**

模板填写式 UI：
- 选择资源类型（知识/代码/导图/题目）
- 根据类型显示对应的编辑模板
- 知识类型：markdown 编辑器
- 代码类型：代码编辑器 + 语言选择
- 导图类型：mermaid 编辑器 + 预览
- 题目类型：题目列表编辑器
- "AI审核"按钮 + "保存"按钮

---

## Task 9: 前端 — 审核结果面板

**Files:**
- Create: `frontend/src/app/resources/components/ReviewPanel.tsx`
- Create: `frontend/src/app/resources/hooks/useReview.ts`

- [ ] **Step 1: 创建 useReview.ts hook**

管理审核状态、API 调用、结果缓存。

- [ ] **Step 2: 创建 ReviewPanel.tsx**

审核结果展示：
- 总分 + 通过/未通过状态
- 四个维度的雷达图或进度条
- 每个维度的具体问题和建议列表
- "重新审核"按钮

---

## Task 10: 验证 + 重启

- [ ] **Step 1: 前端 lint + build**

```powershell
cd frontend && npm run lint && npm run build
```

- [ ] **Step 2: 后端启动检查**

```powershell
cd backend && venv\Scripts\python -c "from app.main import app; print('OK')"
```

- [ ] **Step 3: 执行数据库迁移**

```sql
-- 在 PostgreSQL 中执行
DROP TABLE IF EXISTS exercises CASCADE;
DROP TABLE IF EXISTS exercise_bank CASCADE;
DROP TABLE IF EXISTS resources CASCADE;
-- 然后运行 init_db.sql 中的 CREATE TABLE 语句
```

- [ ] **Step 4: 重启服务**

```powershell
.\stop.ps1 && .\start.ps1
```
