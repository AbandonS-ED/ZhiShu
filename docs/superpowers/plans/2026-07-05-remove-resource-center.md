# 资源中心功能删除 & 重建准备 实施计划

> ⚠️ **未实施**（2026-07-18）：资源中心未被删除，当前版本保留 AI 生成 + 手动创建 + 我的资源 + 详情弹窗 + 学习进度动画 + 收藏功能。本文档是 2026-07-05 的研究分支方案，未进入主分支。
>
> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 彻底删除资源中心功能，保留 sidebar 导航入口（显示占位页），DROP 三张数据库表，清理所有模块中的资源引用代码。

**Architecture:** 分 4 阶段执行：①前端清理 → ②后端清理 → ③数据库清理 → ④验证。每阶段独立可测试。

**Tech Stack:** Next.js (frontend), FastAPI + SQLAlchemy (backend), PostgreSQL (database)

---

## 影响范围总览

| 类别 | 文件数 | 说明 |
|------|--------|------|
| 前端资源页面 | 12 | `frontend/src/app/resources/` 整目录 |
| 前端其他引用 | 9 | api.ts, duihua, tiku, pinggu, path, admin 页面, globals.css |
| 后端 API | 1 | `backend/app/api/resource.py` (14 个端点) |
| 后端模型 | 4 | Resource, Exercise, ExerciseBank, `__init__.py` |
| 后端其他引用 | 7 | admin, dashboard, chat, evaluation, recommendation, agents |
| 数据库脚本 | 5 | init_db.sql, 迁移脚本等 |
| 测试文件 | 6 | smoke_test, test_api, debug 脚本等 |

---

## Task 1: 前端 — 资源页面替换为空壳占位页

**Files:**
- Delete: `frontend/src/app/resources/page.tsx` (701行)
- Delete: `frontend/src/app/resources/loading.tsx` (38行)
- Delete: `frontend/src/app/resources/types.ts` (107行)
- Delete: `frontend/src/app/resources/hooks/useRecommendations.ts`
- Delete: `frontend/src/app/resources/hooks/usePhaseGeneration.ts`
- Delete: `frontend/src/app/resources/hooks/useLearningPackage.ts`
- Delete: `frontend/src/app/resources/components/SmartInput.tsx`
- Delete: `frontend/src/app/resources/components/RecFeed.tsx`
- Delete: `frontend/src/app/resources/components/RecCard.tsx`
- Delete: `frontend/src/app/resources/components/PhaseButton.tsx`
- Delete: `frontend/src/app/resources/components/LearningPage.tsx`
- Delete: `frontend/src/app/resources/learn/[kp]/page.tsx`
- Create: `frontend/src/app/resources/page.tsx` (新占位页)

- [ ] **Step 1: 删除 resources 目录下所有子文件（保留目录本身）**

```powershell
Remove-Item -Recurse -Force "D:\桌面\软件杯项目\ZhiShu\frontend\src\app\resources\hooks"
Remove-Item -Recurse -Force "D:\桌面\软件杯项目\ZhiShu\frontend\src\app\resources\components"
Remove-Item -Recurse -Force "D:\桌面\软件杯项目\ZhiShu\frontend\src\app\resources\learn"
Remove-Item -Force "D:\桌面\软件杯项目\ZhiShu\frontend\src\app\resources\loading.tsx"
Remove-Item -Force "D:\桌面\软件杯项目\ZhiShu\frontend\src\app\resources\types.ts"
```

- [ ] **Step 2: 用占位页替换 page.tsx**

```tsx
// frontend/src/app/resources/page.tsx
export default function ResourcesPage() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '60vh',
      gap: '16px',
      color: 'var(--muted, #888)',
    }}>
      <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.4 }}>
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      </svg>
      <h2 style={{ fontSize: '20px', fontWeight: 600, margin: 0 }}>资源中心</h2>
      <p style={{ fontSize: '14px', opacity: 0.6 }}>功能重建中，敬请期待</p>
    </div>
  )
}
```

- [ ] **Step 3: 验证页面可访问**

访问 `http://localhost:3000/resources` 应显示占位页，无 JS 报错。

---

## Task 2: 前端 — 清理 api.ts 中的资源 API

**Files:**
- Modify: `frontend/src/lib/api.ts:183-384` (删除 resourceApi + exerciseApi)

- [ ] **Step 1: 删除 resourceApi 对象**

删除 `api.ts` 中 `resourceApi` 对象（约 183-355 行）和 `exerciseApi` 对象（约 357-384 行）。

- [ ] **Step 2: 删除 AdminResource 类型和相关 admin 资源方法**

删除 `AdminResource` 接口定义（约 687-696 行），以及 `adminApi.getResources()` 等资源相关方法（约 756-760 行）。保留 adminApi 中其他非资源方法。

- [ ] **Step 3: 删除资源相关的类型定义**

删除 `EvaluationReport` 中的 `total_resources` 字段（约 507 行），`recordAction` 中的 `resource_type`/`resource_id` 字段（约 550-551 行），admin 类型中的 `total_resources`/`today_new_resources`/`resource_count` 等字段（约 659-681 行）。

---

## Task 3: 前端 — 清理对话页（duihua）中的资源引用

**Files:**
- Modify: `frontend/src/app/duihua/page.tsx` (大量 resourceApi 引用)

- [ ] **Step 1: 删除 resourceApi 导入**

删除 `import { resourceApi, ... } from '@/lib/api'` 中的 resourceApi。

- [ ] **Step 2: 删除保存资源相关函数**

删除 `handleSaveResource`、`handleSaveToResource` 等资源保存函数。

- [ ] **Step 3: 删除 UI 中的资源保存按钮/链接**

删除对话结果中的"保存到资源中心"按钮、`/resources` 链接等。

- [ ] **Step 4: 删除资源生成相关的 state 和 handler**

删除 `generatedResources` state、资源生成 SSE 相关代码。

---

## Task 4: 前端 — 清理题库页（tiku）中的资源引用

**Files:**
- Modify: `frontend/src/app/tiku/page.tsx`

- [ ] **Step 1: 将 exerciseApi 调用替换为直接 fetch 或移除**

题库页从 `/resource/exercises/pool` 获取题目。需要：
- 要么将题库功能整体保留（创建独立的 exercises API）
- 要么删除题库页中的练习题获取逻辑

由于 exercises 表也要 DROP，删除题库中依赖 exercises 的逻辑，保留页面为占位或简化版。

---

## Task 5: 前端 — 清理其他页面引用

**Files:**
- Modify: `frontend/src/app/pinggu/page.tsx` (删除 total_resources 显示)
- Modify: `frontend/src/app/path/page.tsx` (删除 resource_type/resource_id 引用)
- Modify: `frontend/src/app/page.tsx:161` (删除 `/resources` 链接)
- Modify: `frontend/src/components/layout/Header.tsx:15-18` (保留标题映射)
- Modify: `frontend/src/app/admin/resources/page.tsx` (删除整个文件或替换为占位)
- Modify: `frontend/src/app/admin/page.tsx` (删除资源统计)
- Modify: `frontend/src/app/admin/users/page.tsx` (删除 resource_count)
- Modify: `frontend/src/app/admin/layout.tsx` (删除 resources 导航项)
- Modify: `frontend/src/app/globals.css` (删除资源相关 CSS 类)

- [ ] **Step 1: 清理 pinggu 页面**

删除 `evalReport.summary.total_resources` 显示。

- [ ] **Step 2: 清理 path 页面**

删除 `recordAction` 中的 `resource_type: 'path'` 和 `resource_id`。

- [ ] **Step 3: 清理首页**

删除 `href="/resources"` 链接，改为 `href="/duihua"` 或其他。

- [ ] **Step 4: 清理 admin 页面**

删除 `admin/resources/page.tsx`（或替换为占位）。清理 admin/page.tsx 中的资源统计卡片。清理 admin/users/page.tsx 中的 resource_count 显示。

- [ ] **Step 5: 清理 admin layout**

删除 `resources: 'pRes'` 映射和对应的导航按钮。

- [ ] **Step 6: 清理 globals.css**

删除 `.res-toolbar`, `.res-grid`, `.res-card`, `.res-chip`, `.gen-resource`, `.resources-tabs`, `.dp-resources` 等 CSS 类。

---

## Task 6: 后端 — 删除 resource.py 路由文件

**Files:**
- Delete: `backend/app/api/resource.py` (1459行)
- Modify: `backend/app/main.py:4,53`

- [ ] **Step 1: 删除 resource.py**

```powershell
Remove-Item -Force "D:\桌面\软件杯项目\ZhiShu\backend\app\api\resource.py"
```

- [ ] **Step 2: 从 main.py 移除 resource 路由注册**

在 `main.py` 中删除：
```python
from app.api import ... resource ...
app.include_router(resource.router, prefix="/api/v1/resource", tags=["资源生成"])
```

---

## Task 7: 后端 — 删除模型文件

**Files:**
- Delete: `backend/app/models/resource.py`
- Delete: `backend/app/models/exercise.py`
- Delete: `backend/app/models/exercise_bank.py`
- Modify: `backend/app/models/__init__.py`

- [ ] **Step 1: 删除三个模型文件**

```powershell
Remove-Item -Force "D:\桌面\软件杯项目\ZhiShu\backend\app\models\resource.py"
Remove-Item -Force "D:\桌面\软件杯项目\ZhiShu\backend\app\models\exercise.py"
Remove-Item -Force "D:\桌面\软件杯项目\ZhiShu\backend\app\models\exercise_bank.py"
```

- [ ] **Step 2: 清理 __init__.py**

```python
# backend/app/models/__init__.py
from app.models.student import Student
from app.models.student_profile import StudentProfile
from app.models.document_chunk import DocumentChunk
from app.models.learning_path import LearningPath
from app.models.chat_session import ChatSession
from app.models.chat_message import ChatMessage
from app.models.learning_record import LearningRecord
from app.models.learning_activity_log import LearningActivityLog
from app.models.evaluation_report import EvaluationReport

__all__ = [
    "Student", "StudentProfile", "DocumentChunk",
    "LearningPath",
    "ChatSession", "ChatMessage", "LearningRecord",
    "LearningActivityLog", "EvaluationReport",
]
```

---

## Task 8: 后端 — 清理 dashboard.py

**Files:**
- Modify: `backend/app/api/dashboard.py`

- [ ] **Step 1: 删除 Resource/Exercise 导入和相关查询**

删除：
- `from app.models.resource import Resource`
- `from app.models.exercise import Exercise`
- `resource_count` 查询（45-48行）
- `exercise_result` 查询（66-74行）
- `recent_resources_result` 查询（78-84行）
- `recent_activities` 中的资源列表

- [ ] **Step 2: 重写 get_dashboard_stats**

将 statistics 改为基于 LearningPath + ChatMessage 的统计，移除对 Resource/Exercise 的依赖。返回结构保持兼容但数据来源改变。

---

## Task 9: 后端 — 清理 admin.py

**Files:**
- Modify: `backend/app/api/admin.py`

- [ ] **Step 1: 删除 Resource/Exercise/ExerciseBank 导入**

- [ ] **Step 2: 删除资源相关端点**

删除：admin 资源列表、搜索、分页端点。删除用户详情中的 resource_count。删除用户删除时的资源清理。

- [ ] **Step 3: 删除 get_stats 中的资源统计**

删除 `total_resources`、`today_new_resources`、资源趋势数据等查询。

---

## Task 10: 后端 — 清理 chat.py

**Files:**
- Modify: `backend/app/api/chat.py`

- [ ] **Step 1: 删除 Resource 导入和保存资源逻辑**

删除 chat 中保存资源到 resources 表的代码（约 378-379, 416, 585 行）。

- [ ] **Step 2: 删除 Exercise 导入和练习题保存逻辑**

删除 chat 中保存练习题的代码（约 479 行）。

---

## Task 11: 后端 — 清理其他服务

**Files:**
- Modify: `backend/app/services/evaluation_service.py`
- Modify: `backend/app/services/recommendation_service.py`
- Modify: `backend/app/services/chat_recommendation_service.py`
- Modify: `backend/app/services/scheduled_analysis_service.py`
- Modify: `backend/app/agents/behavior_analysis_agent.py`
- Modify: `backend/app/agents/state.py`
- Modify: `backend/app/agents/master_agent.py`
- Modify: `backend/app/agents/document_agent.py`

- [ ] **Step 1: 清理 evaluation_service.py**

删除 Resource/Exercise 导入和资源计数逻辑。

- [ ] **Step 2: 清理 recommendation_service.py**

删除 Resource/Exercise 导入和资源查询逻辑。

- [ ] **Step 3: 清理其他 agents 和 services**

删除所有 Resource/Exercise/ExerciseBank 的导入和引用。

---

## Task 12: 后端 — 清理 admin_exercises.py

**Files:**
- Delete: `backend/app/api/admin_exercises.py`
- Modify: `backend/app/main.py:5,62`

- [ ] **Step 1: 删除 admin_exercises.py**

```powershell
Remove-Item -Force "D:\桌面\软件杯项目\ZhiShu\backend\app\api\admin_exercises.py"
```

- [ ] **Step 2: 从 main.py 移除路由注册**

删除：
```python
from app.api import admin_exercises
app.include_router(admin_exercises.router, prefix="/api/v1/admin/exercises", tags=["管理端-题库"])
```

---

## Task 13: 后端 — 清理 agents 中的 resource_generate 意图

**Files:**
- Modify: `backend/app/agents/state.py` (删除 RESOURCE_GENERATE)
- Modify: `backend/app/agents/master_agent.py` (删除 resource_generate 路由)

- [ ] **Step 1: 从 state.py 删除 RESOURCE_GENERATE 枚举值**

- [ ] **Step 2: 从 master_agent.py 删除 resource_generate 任务模板和路由逻辑**

---

## Task 14: 数据库 — DROP TABLE

**Files:**
- Modify: `backend/scripts/init_db.sql`

- [ ] **Step 1: 执行 DROP TABLE**

```sql
DROP TABLE IF EXISTS exercises CASCADE;
DROP TABLE IF EXISTS exercise_bank CASCADE;
DROP TABLE IF EXISTS resources CASCADE;
```

- [ ] **Step 2: 清理 init_db.sql**

删除 `CREATE TABLE resources`、`CREATE TABLE exercises`、`CREATE TABLE exercise_bank` 及相关索引定义。

---

## Task 15: 清理数据库迁移脚本

**Files:**
- Delete: `backend/scripts/init_preset_resources.py`
- Delete: `backend/scripts/init_preset_resources.sql`
- Delete: `backend/scripts/migrate_resource_favorite.sql`
- Modify: `backend/scripts/migrate_constraints.sql` (删除 resources 外键)
- Modify: `backend/scripts/migrate_schema_drift.py` (删除 resources 相关修复)

- [ ] **Step 1: 删除预置资源脚本**

```powershell
Remove-Item -Force "D:\桌面\软件杯项目\ZhiShu\backend\scripts\init_preset_resources.py"
Remove-Item -Force "D:\桌面\软件杯项目\ZhiShu\backend\scripts\init_preset_resources.sql"
Remove-Item -Force "D:\桌面\软件杯项目\ZhiShu\backend\scripts\migrate_resource_favorite.sql"
```

- [ ] **Step 2: 清理迁移脚本中的资源相关内容**

---

## Task 16: 清理测试文件

**Files:**
- Modify: `backend/tests/smoke_test.py` (删除资源相关测试)
- Modify: `backend/tests/test_api.py` (删除资源相关测试)
- Modify: `backend/tests/test_state_graph.py` (删除 RESOURCE_GENERATE 测试)
- Delete: `backend/tests/debug_resource.py`
- Delete: `backend/tests/debug_exercise.py`
- Modify: `backend/tests/test_strip_think.py` (删除 resource.py 的 _strip_think 测试)

- [ ] **Step 1: 删除 debug 脚本**

```powershell
Remove-Item -Force "D:\桌面\软件杯项目\ZhiShu\backend\tests\debug_resource.py"
Remove-Item -Force "D:\桌面\软件杯项目\ZhiShu\backend\tests\debug_exercise.py"
```

- [ ] **Step 2: 清理 smoke_test.py 和 test_api.py 中的资源测试**

---

## Task 17: 验证 — 编译 & 启动

- [ ] **Step 1: 前端编译检查**

```powershell
cd "D:\桌面\软件杯项目\ZhiShu\frontend"
npm run lint
npm run build
```

预期：0 errors, 17 页面（原 18 页面，减去 admin/resources 页面）

- [ ] **Step 2: 后端启动检查**

```powershell
cd "D:\桌面\软件杯项目\ZhiShu\backend"
venv\Scripts\python -c "from app.main import app; print('OK')"
```

预期：无 ImportError

- [ ] **Step 3: 端到端访问测试**

访问 `http://localhost:3000/resources` 应显示占位页。
访问 `http://localhost:8001/docs` 应不再列出 resource 相关端点。

---

## 执行顺序建议

1. **Task 1-5** (前端) → Task 17 Step 1 验证
2. **Task 6-13** (后端) → Task 17 Step 2 验证
3. **Task 14-15** (数据库) 
4. **Task 16** (测试清理)
5. **Task 17** (完整验证)
