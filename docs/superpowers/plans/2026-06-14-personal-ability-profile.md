# 个人底层能力画像 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the old 6-dimension learning profile with a new 5-dimension personal ability profile (理解力/记忆力/应用转化/想象力/专注力), with AI-guided initial assessment.

**Architecture:** Backend FastAPI + SQLAlchemy stores one `StudentProfile` row per student with 5-dimension JSONB. A lightweight `InitialAssessmentAgent` guides a conversation-based Q&A to evaluate each dimension. Frontend shows a pentagon radar chart.

**Tech Stack:** Python FastAPI, SQLAlchemy 2.0 async, Next.js 14, SVG radar chart

---

### Task 1: Backend Model — Rewrite StudentProfile

**Files:**
- Rewrite: `backend/app/models/student_profile.py` (entire file)
- Delete: `backend/app/models/subject_profile.py`
- Delete: `backend/app/models/guided_session.py`
- Delete: `backend/app/models/guided_answer.py`

- [ ] **Step 1: Rewrite student_profile.py**

```python
import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Float, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class StudentProfile(Base):
    __tablename__ = "student_profiles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id"), nullable=False, unique=True)
    dimensions = Column(JSONB, nullable=False, server_default='''{
        "comprehension": {"score": 0, "confidence": 0},
        "memory": {"score": 0, "confidence": 0},
        "application": {"score": 0, "confidence": 0},
        "imagination": {"score": 0, "confidence": 0},
        "focus": {"score": 0, "confidence": 0}
    }''')
    background = Column(JSONB, nullable=False, server_default='{}')
    assessment_status = Column(String(20), nullable=False, server_default='pending')
    assess_session_id = Column(UUID(as_uuid=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    student = relationship("Student", back_populates="profile")
```

- [ ] **Step 2: Delete old model files**

Delete these files (just mark them deleted):
- `backend/app/models/subject_profile.py`
- `backend/app/models/guided_session.py`
- `backend/app/models/guided_answer.py`

- [ ] **Step 3: Update models/__init__.py**

Open `backend/app/models/__init__.py` and remove imports of `SubjectProfile`, `GuidedSession`, `GuidedAnswer`. Keep only `StudentProfile` and other remaining models.

---

### Task 2: Backend Agent — Create InitialAssessmentAgent

**Files:**
- Create: `backend/app/agents/initial_assessment_agent.py`
- Modify: `backend/app/agents/__init__.py`

- [ ] **Step 1: Create initial_assessment_agent.py**

```python
"""Initial Assessment Agent — AI-guided conversation to evaluate 5 personal abilities."""
import json
import uuid
import logging
from typing import Optional

from app.services.llm_client import llm_client
from app.services.json_parser import parse_json_response

logger = logging.getLogger(__name__)

DIMENSIONS = ["comprehension", "memory", "application", "imagination", "focus"]
DIMENSION_NAMES = {
    "comprehension": "理解力",
    "memory": "记忆力",
    "application": "应用转化",
    "imagination": "想象力",
    "focus": "专注力"
}

ANCHOR_QUESTIONS = {
    "comprehension": "平时你学习一个新的概念或知识点，一般是怎么上手的？能不能说说你最近学的一个新东西，花了多久才理解它的核心意思？",
    "memory": "记知识点的时候，你是靠理解记忆还是靠重复背诵？一般记住之后能保持多久？有没有什么记东西的方法？",
    "application": "学了一个新知识后，你会尝试把它用在什么地方？能不能举个你把学到的知识用到实际问题中的例子？",
    "imagination": "面对一个问题，你是习惯找一种标准解法，还是会尝试从不同角度去想别的办法？能举个你用过不同思路解决问题的例子吗？",
    "focus": "你一般一次性能专注学多久？学习过程中容易分心吗？有没有什么帮你集中注意力的方法？"
}

SYSTEM_PROMPT = """你是一位学习能力评估专家。你的任务是通过与学生对话，评估学生在5个底层学习能力上的水平。

5个能力维度及评估标准：

1. 理解力 (comprehension, 0-100):
   - 0-30: 需要大量重复和讲解才能理解新概念
   - 30-60: 能通过一定的自学理解概念，但需要较多时间
   - 60-80: 能较快理解新概念，能用自己的话复述
   - 80-100: 触类旁通，能迅速理解并关联已有知识

2. 记忆力 (memory, 0-100):
   - 0-30: 容易遗忘，需要反复背诵
   - 30-60: 能记住主要内容，但细节容易忘
   - 60-80: 记忆较牢固，能长期保持
   - 80-100: 过目不忘，能准确回忆细节

3. 应用转化 (application, 0-100):
   - 0-30: 学了不会用，需要别人告诉怎么用
   - 30-60: 能在类似场景中套用
   - 60-80: 能主动在不同场景中应用
   - 80-100: 能灵活迁移到陌生领域

4. 想象力 (imagination, 0-100):
   - 0-30: 习惯固定思路，不愿尝试新方法
   - 30-60: 能在提示下想出新思路
   - 60-80: 能主动提出不同解法
   - 80-100: 思维活跃，常有独特的见解和创新方案

5. 专注力 (focus, 0-100):
   - 0-30: 很难集中注意力，容易分心
   - 30-60: 能短时间专注，但持续时间不足30分钟
   - 60-80: 能专注30-60分钟
   - 80-100: 能长时间深度专注，且有方法维持专注

评估规则：
- 根据学生的回答，输出对该维度的评估结果
- 如果信息不足以做出判断（confidence < 70），可以建议追问
- 输出格式必须是JSON，不要包含其他文字
- 分数要合理评估，避免极端值（除非确凿证据）
- 对于已完成的维度，不要在后续评估中重复计分"""


class InitialAssessmentAgent:
    """Guides a conversation-based initial assessment across 5 dimensions."""

    def __init__(self):
        self._sessions: dict = {}  # in-memory session store

    async def start_assessment(self, student_id: str) -> dict:
        session_id = str(uuid.uuid4())
        session = {
            "student_id": student_id,
            "current_idx": 0,
            "dimension_results": {},
            "status": "in_progress",
            "history": []
        }
        self._sessions[session_id] = session
        first_dim = DIMENSIONS[0]
        return {
            "session_id": session_id,
            "dimension": first_dim,
            "dimension_name": DIMENSION_NAMES[first_dim],
            "question": ANCHOR_QUESTIONS[first_dim],
            "dimension_index": 0,
            "total_dimensions": len(DIMENSIONS)
        }

    async def process_answer(self, session_id: str, answer: str) -> dict:
        session = self._sessions.get(session_id)
        if not session:
            raise ValueError(f"Session {session_id} not found")

        idx = session["current_idx"]
        dim = DIMENSIONS[idx]

        # Record answer
        session["history"].append({
            "dimension": dim,
            "answer": answer
        })

        # Call LLM to analyze
        analysis = await self._analyze_dimension(
            dim, answer, session["history"]
        )

        score = analysis.get("score", 50)
        confidence = analysis.get("confidence", 0.5)
        need_followup = analysis.get("need_followup", False)
        followup_question = analysis.get("followup_question", "")

        # Save partial result
        session["dimension_results"][dim] = {
            "score": score,
            "confidence": confidence,
            "answers": session["history"][-1:] if not need_followup else [{"answer": answer}]
        }

        if need_followup and followup_question and len([h for h in session["history"] if h["dimension"] == dim]) < 2:
            return {
                "dimension": dim,
                "dimension_name": DIMENSION_NAMES[dim],
                "question": followup_question,
                "is_followup": True,
                "scores_so_far": self._get_scores_so_far(session),
                "done": False
            }

        # Move to next dimension
        next_idx = idx + 1
        session["current_idx"] = next_idx

        if next_idx >= len(DIMENSIONS):
            # All done — compute final
            final_dimensions = await self._compute_final(session)
            session["status"] = "completed"
            return {
                "done": True,
                "dimensions": final_dimensions,
                "scores_so_far": {k: v["score"] for k, v in final_dimensions.items()}
            }

        next_dim = DIMENSIONS[next_idx]
        return {
            "dimension": next_dim,
            "dimension_name": DIMENSION_NAMES[next_dim],
            "question": ANCHOR_QUESTIONS[next_dim],
            "is_followup": False,
            "scores_so_far": self._get_scores_so_far(session),
            "done": False
        }

    def _get_scores_so_far(self, session: dict) -> dict:
        return {
            dim: session["dimension_results"][dim]["score"]
            for dim in DIMENSIONS
            if dim in session["dimension_results"]
        }

    async def _analyze_dimension(self, dimension: str, answer: str, history: list) -> dict:
        """Call LLM to evaluate a single dimension answer."""
        dim_name = DIMENSION_NAMES[dimension]
        user_prompt = f"""正在评估的维度：{dim_name}
学生回答：{answer}

请分析这个回答，输出JSON格式：
{{
    "score": 0-100的分数,
    "confidence": 0-1的置信度,
    "need_followup": true/false（是否还需要追问）,
    "followup_question": "如果需要追问，追问的问题",
    "reason": "评分理由简述"
}}"""

        try:
            response = await llm_client.chat_completion(
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.3,
                max_tokens=500
            )
            content = response.get("choices", [{}])[0].get("message", {}).get("content", "")
            parsed = parse_json_response(content)
            return {
                "score": max(0, min(100, parsed.get("score", 50))),
                "confidence": max(0, min(1, parsed.get("confidence", 0.5))),
                "need_followup": parsed.get("need_followup", False),
                "followup_question": parsed.get("followup_question", ""),
                "reason": parsed.get("reason", "")
            }
        except Exception as e:
            logger.error(f"LLM analysis failed for {dimension}: {e}")
            return {"score": 50, "confidence": 0.3, "need_followup": True,
                    "followup_question": f"能再详细说说你在{dim_name}方面的情况吗？举个例子？"}

    async def _compute_final(self, session: dict) -> dict:
        """Compute final dimensions from all results."""
        dimensions = {}
        for dim in DIMENSIONS:
            result = session["dimension_results"].get(dim, {"score": 50, "confidence": 0})
            dimensions[dim] = {
                "score": result["score"],
                "confidence": result["confidence"]
            }
        return dimensions


# Singleton
initial_assessment_agent = InitialAssessmentAgent()
```

- [ ] **Step 2: Update agents/__init__.py**

Add the import:
```python
from app.agents.initial_assessment_agent import initial_assessment_agent
```

---

### Task 3: Backend API — Rewrite profile.py router

**Files:**
- Rewrite: `backend/app/api/profile.py`
- Modify: `backend/app/main.py`

- [ ] **Step 1: Rewrite profile.py**

```python
"""Profile API — 5-dimension personal ability profile."""
import logging
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_async_session
from app.core.dependencies import get_current_user
from app.models.student import Student
from app.models.student_profile import StudentProfile
from app.agents.initial_assessment_agent import initial_assessment_agent

logger = logging.getLogger(__name__)
router = APIRouter()


class StartRequest(BaseModel):
    pass  # student_id from token


class NextRequest(BaseModel):
    session_id: str
    answer: str


class StartResponse(BaseModel):
    session_id: str
    dimension: str
    dimension_name: str
    question: str
    dimension_index: int
    total_dimensions: int


class NextResponse(BaseModel):
    done: bool = False
    dimension: str = ""
    dimension_name: str = ""
    question: str = ""
    is_followup: bool = False
    scores_so_far: dict = {}
    dimensions: dict = {}
    assessment_status: str = ""


class RadarResponse(BaseModel):
    dimensions: dict
    background: dict = {}
    assessment_status: str = ""


@router.post("/assess/start", response_model=StartResponse)
async def start_assessment(
    current_user: Student = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    # Check existing profile
    result = await db.execute(
        select(StudentProfile).where(StudentProfile.student_id == current_user.id)
    )
    profile = result.scalar_one_or_none()

    if profile and profile.assessment_status == "completed":
        raise HTTPException(status_code=400, detail="Assessment already completed")

    # Start new assessment
    session = await initial_assessment_agent.start_assessment(str(current_user.id))
    return StartResponse(**session)


@router.post("/assess/next", response_model=NextResponse)
async def next_step(
    req: NextRequest,
    current_user: Student = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    result = await initial_assessment_agent.process_answer(req.session_id, req.answer)

    if result.get("done"):
        # Save to DB
        profile_result = await db.execute(
            select(StudentProfile).where(StudentProfile.student_id == current_user.id)
        )
        profile = profile_result.scalar_one_or_none()

        if profile:
            profile.dimensions = result["dimensions"]
            profile.assessment_status = "completed"
        else:
            profile = StudentProfile(
                student_id=current_user.id,
                dimensions=result["dimensions"],
                assessment_status="completed"
            )
            db.add(profile)

        await db.commit()

    return NextResponse(
        done=result.get("done", False),
        dimension=result.get("dimension", ""),
        dimension_name=result.get("dimension_name", ""),
        question=result.get("question", ""),
        is_followup=result.get("is_followup", False),
        scores_so_far=result.get("scores_so_far", {}),
        dimensions=result.get("dimensions", {}),
        assessment_status="completed" if result.get("done") else "in_progress"
    )


@router.get("/me", response_model=RadarResponse)
async def get_my_profile(
    current_user: Student = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    result = await db.execute(
        select(StudentProfile).where(StudentProfile.student_id == current_user.id)
    )
    profile = result.scalar_one_or_none()

    if not profile:
        return RadarResponse(
            dimensions={
                "comprehension": 0,
                "memory": 0,
                "application": 0,
                "imagination": 0,
                "focus": 0
            },
            assessment_status="pending"
        )

    return RadarResponse(
        dimensions={k: v["score"] for k, v in profile.dimensions.items()},
        background=profile.background or {},
        assessment_status=profile.assessment_status
    )
```

- [ ] **Step 2: Update main.py**

Open `backend/app/main.py` and:
- Remove the line: `from app.api import guided_profile`
- Remove the line: `app.include_router(guided_profile.router, ...)`
- Keep `from app.api import profile`

---

### Task 4: Backend — Clean up old references in other agents

**Files:**
- Modify: `backend/app/api/chat.py`
- Modify: `backend/app/agents/master_agent.py`
- Modify: `backend/app/agents/document_agent.py`
- Modify: `backend/app/agents/exercise_agent.py`
- Modify: `backend/app/agents/path_agent.py`
- Modify: `backend/app/agents/mindmap_agent.py`
- Modify: `backend/app/agents/tutor_agent.py`
- Modify: `backend/app/agents/audio_agent.py`
- Modify: `backend/app/agents/communicator.py`
- Modify: `backend/app/services/anti_hallucination.py`

For each agent, the task is the same: find and remove code that reads `knowledge_mastery`, `learning_style`, `cognitive_level`, `weak_topics`, `learning_pace` from `student_profile`. Since these fields no longer exist in the new profile, referencing them will break.

- [ ] **Step 1: audit each agent for old dimension references**

Use grep to find all references to these fields:
```bash
rg -n "knowledge_mastery|learning_style|cognitive_level|weak_topics|learning_pace" backend/app/
```

For each match, either:
- Remove the code block that uses it (if it's not critical)
- Replace with a comment placeholder for future subject-profile integration
- Or keep the `student_profile` passing but don't try to access specific fields

The key rule: `student_profile` will now contain `{comprehension: {score, confidence}, ...}` instead of the old structure. Any code that assumes the old structure must be removed.

- [ ] **Step 2: Update chat.py — remove old dimension processing**

In `backend/app/api/chat.py`:
- Remove any code that extracts specific dimensions from student_profile
- The profile is still passed for context, but agents should not try to destructure old fields
- Update `_handle_tutor_chat_stream` and `_handle_state_graph_stream` to just pass the profile dict as-is

- [ ] **Step 3: Update agent files**

For each agent file, the pattern is similar. Example for `document_agent.py`:

Current code (approximately line 93-107):
```python
if student_profile:
    mastery = student_profile.get("knowledge_mastery", {})
    weak = student_profile.get("weak_topics", [])
    # ... uses them to customize prompt
```

Replace with:
```python
if student_profile:
    # Profile available for future subject-level integration
    # Currently contains 5-dimension personal ability scores
    pass
```

This applies to all 7 agents. Remove the old dimension-specific logic. The agents will still receive the profile, but won't use it for content customization until subject profiles are built later.

---

### Task 5: Frontend — Types and API client

**Files:**
- Modify: `frontend/src/types/index.ts`
- Modify: `frontend/src/lib/api.ts`
- Modify: `frontend/src/stores/appStore.ts`

- [ ] **Step 1: Update types/index.ts**

Replace the old `ProfileDimensions` with the new 5-dimension structure:

```typescript
export interface AbilityDimension {
  score: number
  confidence: number
}

export interface ProfileDimensions {
  comprehension: AbilityDimension
  memory: AbilityDimension
  application: AbilityDimension
  imagination: AbilityDimension
  focus: AbilityDimension
  [key: string]: AbilityDimension
}

export interface StudentProfile {
  student_id: string
  dimensions: ProfileDimensions
  background: Record<string, unknown>
  assessment_status: 'pending' | 'in_progress' | 'completed'
}
```

- [ ] **Step 2: Update api.ts**

Add the new profile API methods:

```typescript
export const profileApi = {
  startAssess: () =>
    request<{
      session_id: string
      dimension: string
      dimension_name: string
      question: string
      dimension_index: number
      total_dimensions: number
    }>('/profile/assess/start', { method: 'POST' }),

  nextAssess: (data: { session_id: string; answer: string }) =>
    request<{
      done: boolean
      dimension?: string
      dimension_name?: string
      question?: string
      is_followup?: boolean
      scores_so_far?: Record<string, number>
      dimensions?: Record<string, { score: number; confidence: number }>
      assessment_status?: string
    }>('/profile/assess/next', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getMe: () =>
    request<{
      dimensions: Record<string, number>
      background: Record<string, unknown>
      assessment_status: string
    }>('/profile/me'),

  getRadar: () =>
    request<{
      dimensions: Record<string, number>
    }>('/profile/radar'),
}
```

- [ ] **Step 3: Update appStore.ts**

Update the profile type reference if needed. The store already uses `ProfileDimensions`, so if the type is updated in `types/index.ts`, it should flow through.

---

### Task 6: Frontend — Rewrite profile page

**Files:**
- Rewrite: `frontend/src/app/profile/page.tsx`
- Delete: `frontend/src/app/profile/GuidedProfileModal.tsx`
- Delete: `frontend/src/app/profile/SubjectSelect.tsx`
- Delete: `frontend/src/app/profile/ChatModal.tsx`

This is the most complex task. The new profile page should have:
1. A pentagon radar chart (SVG) showing 5 dimensions
2. Assessment flow (if status !== 'completed')
3. Background info card

- [ ] **Step 1: Delete old component files**

Delete `GuidedProfileModal.tsx`, `SubjectSelect.tsx`, `ChatModal.tsx`.

- [ ] **Step 2: Rewrite profile/page.tsx**

The key component is the pentagon radar chart. Here's the approach:

```tsx
'use client'

import { useState, useEffect, useRef } from 'react'
import { profileApi } from '@/lib/api'
import { getStudentId } from '@/lib/student'
import styles from './profile.module.css'

const DIMENSION_LABELS: Record<string, string> = {
  comprehension: '理解力',
  memory: '记忆力',
  application: '应用转化',
  imagination: '想象力',
  focus: '专注力',
}

const DIMENSION_COLORS: Record<string, string> = {
  comprehension: '#4F46E5', // indigo
  memory: '#0891B2',        // cyan
  application: '#059669',   // emerald
  imagination: '#D97706',   // amber
  focus: '#DC2626',         // red
}

// Pentagon SVG Radar Chart
function PentagonChart({ scores, size = 280 }: { scores: Record<string, number>; size?: number }) {
  const cx = size / 2
  const cy = size / 2
  const radius = size * 0.38

  const dims = ['comprehension', 'memory', 'application', 'imagination', 'focus']
  const angleStep = (Math.PI * 2) / 5
  const startAngle = -Math.PI / 2 // start from top

  const getPoint = (index: number, r: number) => ({
    x: cx + r * Math.cos(startAngle + index * angleStep),
    y: cy + r * Math.sin(startAngle + index * angleStep),
  })

  // Background grid lines (5 concentric pentagons)
  const gridLevels = [0.2, 0.4, 0.6, 0.8, 1.0]
  const gridLines = gridLevels.map(level =>
    Array.from({ length: 5 }, (_, i) => getPoint(i, radius * level))
  )

  // Data pentagon
  const dataPoints = dims.map((dim, i) => {
    const score = (scores[dim] || 0) / 100
    return getPoint(i, radius * Math.max(score, 0.02))
  })
  const dataPath = dataPoints.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ') + 'Z'

  // Labels
  const labelPoints = dims.map((dim, i) => {
    const p = getPoint(i, radius * 1.25)
    return { ...p, label: DIMENSION_LABELS[dim], dim }
  })

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className={styles.radarSvg}>
      {/* Grid pentagons */}
      {gridLines.map((points, li) => {
        const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ') + 'Z'
        return <path key={li} d={path} fill="none" stroke="#E5E7EB" strokeWidth={1} />
      })}

      {/* Axis lines */}
      {Array.from({ length: 5 }, (_, i) => {
        const p = getPoint(i, radius)
        return <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="#E5E7EB" strokeWidth={1} />
      })}

      {/* Data area */}
      <path d={dataPath} fill="rgba(79, 70, 229, 0.15)" stroke="#4F46E5" strokeWidth={2} />

      {/* Data points */}
      {dataPoints.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={4} fill={DIMENSION_COLORS[dims[i]]} stroke="#fff" strokeWidth={2} />
      ))}

      {/* Labels */}
      {labelPoints.map((p, i) => (
        <text key={i} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="middle"
          fontSize={13} fontWeight={500} fill="#374151">
          {p.label}
        </text>
      ))}
    </svg>
  )
}
```

Then the main page:

```tsx
export default function ProfilePage() {
  const [scores, setScores] = useState<Record<string, number>>({})
  const [status, setStatus] = useState<string>('pending')
  const [loading, setLoading] = useState(true)
  const [showAssess, setShowAssess] = useState(false)
  const [sessionId, setSessionId] = useState('')
  const [currentQuestion, setCurrentQuestion] = useState('')
  const [currentDim, setCurrentDim] = useState('')
  const [currentDimName, setCurrentDimName] = useState('')
  const [isFollowup, setIsFollowup] = useState(false)
  const [dimIndex, setDimIndex] = useState(0)
  const [totalDims, setTotalDims] = useState(5)
  const [input, setInput] = useState('')
  const [chatting, setChatting] = useState(false)
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([])

  const studentId = getStudentId()

  useEffect(() => {
    if (!studentId) return
    loadProfile()
  }, [studentId])

  async function loadProfile() {
    try {
      const data = await profileApi.getMe()
      setScores(data.dimensions)
      setStatus(data.assessment_status)
    } catch (e) {
      console.error('Failed to load profile', e)
    } finally {
      setLoading(false)
    }
  }

  async function startAssessment() {
    setChatting(true)
    setMessages([])
    try {
      const data = await profileApi.startAssess()
      setSessionId(data.session_id)
      setCurrentDim(data.dimension)
      setCurrentDimName(data.dimension_name)
      setCurrentQuestion(data.question)
      setDimIndex(data.dimension_index)
      setTotalDims(data.total_dimensions)
      setIsFollowup(false)
      setMessages([{ role: 'assistant', content: data.question }])
    } catch (e) {
      console.error('Failed to start assessment', e)
      setChatting(false)
    }
  }

  async function sendAnswer() {
    if (!input.trim() || !sessionId) return
    const userMsg = input.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: userMsg }])

    try {
      const data = await profileApi.nextAssess({ session_id: sessionId, answer: userMsg })

      if (data.scores_so_far && Object.keys(data.scores_so_far).length > 0) {
        setScores(prev => ({ ...prev, ...data.scores_so_far }))
      }

      if (data.done) {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: '✅ 初步评估完成！你的能力画像已经生成。'
        }])
        setStatus('completed')
        if (data.dimensions) {
          const finalScores: Record<string, number> = {}
          for (const [k, v] of Object.entries(data.dimensions)) {
            finalScores[k] = (v as { score: number }).score
          }
          setScores(finalScores)
        }
        return
      }

      setCurrentDim(data.dimension || '')
      setCurrentDimName(data.dimension_name || '')
      setCurrentQuestion(data.question || '')
      setIsFollowup(data.is_followup || false)
      setMessages(prev => [...prev, { role: 'assistant', content: data.question || '' }])

    } catch (e) {
      console.error('Assessment error', e)
      setMessages(prev => [...prev, { role: 'assistant', content: '出错了，请重试。' }])
    }
  }

  // ... render
}
```

For the full page rendering:
- If `loading`: show spinner
- If `status === 'completed'`: show the radar chart with scores
- If `status !== 'completed' && !chatting`: show a prompt to start assessment + radar chart (with zeros)
- If `chatting`: show the chat interface for assessment

---

### Task 7: Database scripts

**Files:**
- Modify: `backend/scripts/init_db.sql`

- [ ] **Step 1: Update init_db.sql**

Replace the `student_profiles` table creation and remove old tables:

```sql
-- Remove old tables
DROP TABLE IF EXISTS profile_guided_answers CASCADE;
DROP TABLE IF EXISTS profile_guided_sessions CASCADE;
DROP TABLE IF EXISTS subject_profiles CASCADE;

-- Recreate student_profiles
DROP TABLE IF EXISTS student_profiles CASCADE;
CREATE TABLE student_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL UNIQUE REFERENCES students(id) ON DELETE CASCADE,
    dimensions JSONB NOT NULL DEFAULT '{"comprehension":{"score":0,"confidence":0},"memory":{"score":0,"confidence":0},"application":{"score":0,"confidence":0},"imagination":{"score":0,"confidence":0},"focus":{"score":0,"confidence":0}}',
    background JSONB NOT NULL DEFAULT '{}',
    assessment_status VARCHAR(20) NOT NULL DEFAULT 'pending',
    assess_session_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_student_profiles_student_id ON student_profiles(student_id);
```

---

### Task 8: Verify and test

- [ ] **Step 1: Check backend compiles**

Run: `cd backend && venv\Scripts\python -c "from app.main import app; print('OK')"`

- [ ] **Step 2: Run pytest to verify existing tests still pass (or update them)**

Run: `cd backend && venv\Scripts\python -m pytest tests/ -v --tb=short`

Fix any test failures related to the removed profile models/agents.

- [ ] **Step 3: Frontend build check**

Run: `cd frontend && npm run lint`
Run: `cd frontend && npm run build`

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor: replace 6-dim profile with 5-dim personal ability profile"
```
