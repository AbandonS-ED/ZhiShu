# 画像引导对话功能设计文档

> 日期：2026-06-12
> 状态：设计阶段
> 负责人：Claude Code
>
> **状态同步**: 2026-06-28 — 引导对话 5 维画像已实装为 `initial_assessment_agent.py`，详见 `backend/app/agents/`。本设计文档保留作为历史规格参考。

---

## 1. 需求概述

取消传统问卷式画像构建，改用 **AI 引导对话**方式，通过问答引导学生构建自己的学习画像。

### 核心设计原则

1. **学科隔离**：每个学科独立构建画像，不同学科可有不同画像
2. **主画像计算得出**：主画像由所有学科画像综合推导，不通过对话直接创建
3. **AI智能追问**：每个维度固定问题 + AI 根据回答质量智能追问（最多 5 轮）
4. **智能打分**：AI理解用户回答后自动打分，不是简单存储原话

---

## 2. 画像层级结构

### 2.1 两级画像

| 层级 | 作用域 | 生成方式 |
|------|--------|---------|
| **学科画像** | 具体学科（如人工智能导论） | AI 引导对话构建 |
| **主画像** | 全学科通用 | 由所有学科画像综合计算得出 |

### 2.2 学科画像结构

```json
{
  "subject": "人工智能导论",
  "student_id": "uuid",
  "version": 1,
  "dimensions": {
    "knowledge_mastery": {
      "搜索算法": 85,
      "神经网络": 60,
      "反向传播": 40
    },
    "weak_topics": ["反向传播", "梯度下降"]
  },
  "is_current": true,
  "created_at": "2026-06-12"
}
```

### 2.3 主画像结构

```json
{
  "student_id": "uuid",
  "version": 3,
  "dimensions": {
    "knowledge_mastery":65,           // 所有学科综合评分（平均）
    "learning_style": {                // 视觉/听觉/动手型（出现最多）
      "visual": 80,
      "textual": 60,
      "auditory": 50,
      "kinesthetic": 70
    },
    "cognitive_level": {               // 综合分析
      "memory": 65,
      "understand": 75,
      "apply": 60,
      "analyze": 55
    },
    "learning_pace": {                 // 取最完整学科的数据
      "daily_hours": 2.5,
      "preferred_time": "晚上",
      "focus_duration": 45
    },
    "weak_topics": ["反向传播", "梯度消失", "过拟合"],  // 合并所有学科
    "interest": { // 汇总所有学科
      "深度学习": 90,
      "NLP": 80,
      "计算机视觉": 60
    }
  },
  "source_subjects": ["人工智能导论", "机器学习"],  // 来源学科
  "completeness_score": 72.5,
  "updated_at": "2026-06-12"
}
```

---

## 3. 引导对话流程

### 3.1 整体流程

```
用户选择学科
    ↓
启动引导会话（POST /profile/guided/start）
    ↓
循环8 个维度：
  ├─ 固定问题（1个）
  ├─ 用户回答
  ├─ AI 分析回答 → 智能打分
  ├─ AI 判断：需要追问？
  │    ├─ 是 → 追问（最多4次，总共≤5个问题）
  │    └─ 否 → 进入下一维度
  └─ 保存该维度数据
    ↓
8个维度全部完成 → 保存学科画像
    ↓
触发主画像重新计算（汇总所有学科画像）
    ↓
返回完整画像给前端
```

### 3.2 维度轮序

| 顺序 | 维度 | 固定问题 | 最多问题数 |
|------|------|---------|-----------|
| 1 | 学习背景 | "同学你好！请介绍一下你的专业、年级，以及人工智能导论这门课的学习情况？" | 5 |
| 2 | 知识基础 | "人工智能导论里，哪些知识点你觉得掌握得比较好，哪些还比较薄弱？" | 5 |
| 3 | 学习目标 | "你学习这门课的目标是什么？比如考研、就业、竞赛还是课程通过？" | 5 |
| 4 | 学习风格 | "你喜欢怎么学习？比如看视频、读文字、动手写代码，还是喜欢讨论？" | 5 |
| 5 | 学习节奏 | "你每天大概能投入多少时间学习？集中在哪个时间段？" | 5 |
| 6 | 易错难点 | "学习过程中，哪些知识点或概念你觉得最难理解或最容易出错？" | 5 |
| 7 | 认知水平 | "你觉得这门课最难的部分是理解记忆还是实际应用？为什么？" | 5 |
| 8 | 兴趣方向 | "对这门课的哪个方向最感兴趣？比如深度学习、NLP、计算机视觉等？" | 5 |

---

## 4. AI 追问机制

### 4.1 追问触发条件

| 触发条件 | AI 行为示例 |
|---------|------------|
| 回答太简短（<10字） | "能具体说说吗？比如是在公式推导、代码实现还是概念理解上有困难？" |
| 回答涉及关键知识点 | "你提到神经网络，能不能具体说说哪部分感觉最难？" |
| 用户提到薄弱环节 | "反向传播你觉得难在哪方面？是梯度计算还是理解原理？" |
| 回答模糊/笼统 | "你提到'有点难'，具体是哪个环节卡住了？比如……" |
| 维度信息明显缺失 | "你刚才没提到具体的学习时间段，能再说说吗？" |

### 4.2 追问上限

- 每个维度**最多 5 个问题**（1 个固定 + 最多 4 次追问）
- AI 自行判断回答是否足够充分，决定是否追问
- 5 个问题用完或 AI 判断足够 → 进入下一维度

### 4.3 智能判断伪代码

```
if len(answer) < 10:
    ask_followup("能具体说说吗？")
elif has_technical_term(answer) and mastery_level_unknown:
    ask_followup("这个知识点你目前掌握到什么程度？")
elif mentions_weak_point(answer):
    ask_followup("你觉得主要难在哪方面？")
elif is_vague(answer):
    ask_followup("比如？你能举个例子吗？")
elif dimension_data_incomplete:
    ask_followup_targeted_missing_field()
else:
    # 回答充分，进入下一维度
    save_dimension()
```

---

## 5. API 设计

### 5.1 启动引导会话

```
POST /api/v1/profile/guided/start

Request:
{
  "student_id": "uuid",
  "subject": "人工智能导论"
}

Response:
{
  "session_id": "uuid",
  "subject": "人工智能导论",
  "current_dimension": "学习背景",
  "question": "同学你好！请介绍一下你的专业、年级，以及人工智能导论这门课的学习情况？",
  "step": 1,
  "total_steps": 8,
  "dimension_progress": {
    "学习背景": "in_progress",
    "知识基础": "pending",
    ...
  }
}
```

### 5.2 下一轮回答

```
POST /api/v1/profile/guided/next

Request:
{
  "session_id": "uuid",
  "answer": "我是计算机专业大三学生，这门课是必修课，目前学到神经网络了"
}

Response:
{
  "session_id": "uuid",
  "need_followup": true,
  "question": "神经网络学得怎么样？哪些部分感觉还行，哪些觉得难？",
  "step": 1,
  "analysis": {
    "knowledge_mastery": {"神经网络": 50},
    "confidence": 0.75
  }
}

# 如果不需要追问：
Response:
{
  "session_id": "uuid",
  "need_followup": false,
  "current_dimension": "知识基础",
  "completed": false,
  "dimension_result": {
    "dimension": "学习背景",
    "data": {
      "专业背景": "计算机专业大三",
      "课程性质": "必修课",
      "学习阶段": "神经网络",
      "confidence": 0.88
    }
  }
}
```

### 5.3 完成会话

```
Response (when all dimensions complete):
{
  "session_id": "uuid",
  "completed": true,
  "subject_profile": {
    "subject": "人工智能导论",
    "version": 1,
    "dimensions": {
      "knowledge_mastery": {...},
      "weak_topics": [...]
    }
  },
  "master_profile": {
    "version": 1,
    "dimensions": {...},
    "source_subjects": ["人工智能导论"]
  }
}
```

### 5.4 获取会话状态

```
GET /api/v1/profile/guided/status/{session_id}

Response:
{
  "session_id": "uuid",
  "subject": "人工智能导论",
  "current_dimension": "学习节奏",
  "step": 5,
  "total_steps": 8,
  "dimension_progress": {
    "学习背景": "completed",
    "知识基础": "completed",
    "学习目标": "completed",
    "学习风格": "completed",
    "学习节奏": "in_progress",
    "易错难点": "pending",
    "认知水平": "pending",
    "兴趣方向": "pending"
  },
  "answers_so_far": {
    "学习背景": "计算机专业大三，必修课，学到神经网络",
    "知识基础": "搜索算法不错，神经网络刚入门",
    ...
  }
}
```

---

## 6. 数据库设计

### 6.1 新增表

```sql
-- 引导会话表
CREATE TABLE profile_guided_session (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES students(id),
    subject VARCHAR(100) NOT NULL,
    current_dimension VARCHAR(20),
    current_step INT DEFAULT 1,
    status VARCHAR(20) DEFAULT 'active',  -- active / completed / abandoned
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 维度回答记录表
CREATE TABLE profile_guided_answer (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES profile_guided_session(id),
    dimension VARCHAR(20) NOT NULL,
    question TEXT NOT NULL,
    user_answer TEXT NOT NULL,
    ai_analysis JSONB,  -- AI 解析后的结构化数据
    is_followup BOOLEAN DEFAULT FALSE,
    question_order INT NOT NULL,  -- 该维度的第几个问题（1-5）
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 学科画像表
CREATE TABLE subject_profile (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES students(id),
    subject VARCHAR(100) NOT NULL,
    version INT DEFAULT 1,
    dimensions JSONB NOT NULL,
    is_current BOOLEAN DEFAULT TRUE,
    source_sessions UUID[], -- 关联的引导会话
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(student_id, subject)
);
```

### 6.2 主画像计算逻辑

```python
def compute_master_profile(all_subject_profiles: list[dict]) -> dict:
    """由所有学科画像综合计算主画像"""
    if not all_subject_profiles:
        return {}

    result = {
        "knowledge_mastery": compute_avg_mastery(all_subject_profiles),
        "learning_style": compute_mode_style(all_subject_profiles),
        "cognitive_level": compute_avg_cognitive(all_subject_profiles),
        "learning_pace": get_most_complete_pace(all_subject_profiles),
        "weak_topics": merge_weak_topics(all_subject_profiles),
        "interest": merge_interests(all_subject_profiles),
    }
    result["completeness_score"] = calc_completeness(result)
    return result

def compute_avg_mastery(profiles):
    """所有学科的知识点做平均"""
    all_km = {}
    for p in profiles:
        km = p["dimensions"]["knowledge_mastery"]
        for kp, score in km.items():
            if kp not in all_km:
                all_km[kp] = []
            all_km[kp].append(score)
    return {kp: round(sum(scores)/len(scores), 1) for kp, scores in all_km.items()}

def merge_weak_topics(profiles):
    """合并所有学科的易错点，去重 + 按频率排序"""
    topic_count = {}
    for p in profiles:
        for wt in p["dimensions"].get("weak_topics", []):
            topic_count[wt] = topic_count.get(wt, 0) + 1
    return sorted(topic_count.keys(), key=lambda x: topic_count[x], reverse=True)[:10]
```

---

## 7. 前端设计

### 7.1 入口

在 profile 页面增加**"AI 引导画像构建"**入口按钮，点击后：
1. 先弹出**学科选择弹窗**（下拉选择课程）
2. 选完进入**全屏引导对话界面**

### 7.2 引导对话 UI

```
┌─────────────────────────────────────────┐
│ 🤖 AI 引导画像构建 ·人工智能导论      │
│  [进度条:██████░░░░░░░ 2/8]           │
├─────────────────────────────────────────┤
│  AI：同学你好！请介绍一下你的专业、年级 │
│      以及人工智能导论这门课的学习情况？ │
│                              [10:32]   │
├─────────────────────────────────────────┤
│  我：我是计算机专业大三学生，这门课是 │
│      必修课，目前学到神经网络了          │
│                              [10:33]   │
├─────────────────────────────────────────┤
│  AI：神经网络学得怎么样？哪些部分感觉   │
│      还行，哪些觉得难？ │
│                              [10:33]   │
├─────────────────────────────────────────┤
│  [输入框............................] [发送] │
└─────────────────────────────────────────┘
```

### 7.3 进度指示

- 顶部显示 8 个维度的进度（圆点 + 颜色）
- 当前维度高亮，完成的变绿色，未完成的变灰色
- 显示"第 N / 8 个维度"

### 7.4 完成界面

8 个维度全部完成后，显示汇总结果：

```
┌─────────────────────────────────────────┐
│  ✅ 画像构建完成！                      │
│                                         │
│  学科画像：人工智能导论 (v1)             │
│  主画像：综合版 (v1)                    │
│  画像完整度：78.5%                       │
│                                         │
│  [查看雷达图] [开始学习]               │
└─────────────────────────────────────────┘
```

---

## 8. 实现范围

### 本次实现（MVP）

1. ✅ 学科选择 + 启动引导会话 API
2. ✅ 8 个维度的固定问题轮序
3. ✅ AI 智能追问机制（最多 5 个问题/维度）
4. ✅ AI 智能打分（解析回答 → 结构化数据）
5. ✅ 学科画像保存到数据库
6. ✅ 主画像重新计算
7. ✅ 前端引导对话 UI（进度条 + 对话 + 学科选择）
8. ✅ profile页面接入真实数据

### 后续扩展（本次不实现）

- 学习行为自动更新画像
- 对话中实时提取信息更新画像
- 学科画像中途保存/继续
- 上一步/跳过功能

---

## 12. 学习活动信息接收入口

### 12.1 设计原则

GuidedProfileAgent **不主动获取**学生学习数据，只提供**被动的信息接收入口**。
其他模块（练习、对话等）在产生关键学习数据时，调用入口将数据推送给 GuidedProfileAgent。

### 12.2 入口函数

```python
async def receive_learning_activity(
    student_id: str,
    subject: str,
    activity_type: str,   # "exercise_result" | "chat_summary" | "resource_view"
    payload: dict,       # 具体的活动数据
) -> dict:
    """接收学习活动信息，智能更新学科画像和主画像

    Args:
        student_id: 学生 UUID
        subject: 学科名称（如"人工智能导论"）
        activity_type: 活动类型
        payload: 活动数据负载

    Returns:
        更新后的学科画像 + 主画像版本号
    """
```

### 12.3 支持的活动类型

| activity_type | payload 示例 | 处理逻辑 |
|---|---|---|
| `exercise_result` | `{"knowledge_point": "反向传播", "is_correct": false}` | 答错 → 加入 weak_topics；答对 → 提升 knowledge_mastery |
| `chat_summary` | `{"topics": ["梯度下降", "优化器"], "depth": "intermediate"}` | 从对话提取知识点，更新 knowledge_mastery |
| `resource_view` | `{"knowledge_points": ["过拟合", "正则化"]}` | 标记为已学习，设置初始掌握度 |

### 12.4 数据库更新

```sql
-- 新增一张学习活动记录表（用于审计和画像追溯）
CREATE TABLE learning_activity_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES students(id),
    subject VARCHAR(100),
    activity_type VARCHAR(30) NOT NULL,
    payload JSONB NOT NULL,
    triggered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 12.5 API 入口

```
POST /api/v1/profile/guided/activity

Request:
{
  "student_id": "uuid",
  "subject": "人工智能导论",
  "activity_type": "exercise_result",
  "payload": {
    "knowledge_point": "反向传播",
    "is_correct": false
  }
}

Response:
{
  "received": true,
  "subject_profile_version": 2,
  "master_profile_version": 3,
  "updated_dimensions": ["weak_topics", "knowledge_mastery"]
}
```

### 12.6 画像更新逻辑

```
收到活动数据
  → 根据 subject 找到或创建学科画像
  → 根据 activity_type 执行对应更新策略
  → 标记学科画像版本 +1
  → 重新计算主画像
  → 返回更新结果
```

---

**设计完成，待用户确认后进入实现阶段。**

---

## 9. 技术实现要点

### 9.1 ProfileAgent 改造

新增 `GuidedProfileAgent` 替代现有的 `ProfileAgent.analyze()`：

```python
class GuidedProfileAgent:
    """引导式画像构建 Agent"""

    DIMENSIONS = ["学习背景", "知识基础", "学习目标", "学习风格",
                  "学习节奏", "易错难点", "认知水平", "兴趣方向"]

    DIMENSION_PROMPTS = {
        "学习背景": "你是学习画像分析师，询问学生背景信息...",
        "知识基础": "你是学习画像分析师，询问学生知识掌握情况...",
        ...
    }

    FOLLOWUP_TRIGGERS = [...]

    async def generate_question(session_id, dimension, history) -> str
    async def analyze_answer(dimension, question, answer, history) -> dict
    async def should_followup(dimension, question, answer, history) -> bool
```

### 9.2 会话状态管理

使用数据库存储会话状态（不使用 Redis/内存），支持中途退出后继续：

```python
class GuidedSession:
    session_id: UUID
    student_id: UUID
    subject: str
    current_dimension: str
    current_step: int # 1-8
    answers: dict     # {dimension: AnswerRecord}
    status: str # active / completed / abandoned
```

### 9.3 LLM 调用策略

- 每轮回答只调一次 LLM（分析 + 判断是否追问）
- `temperature=0.3`（稳定打分）
- `max_tokens=512`（短回复）
- 加 `anti_hallucination` 校验

---

## 10. 文件变更清单

### 后端新增

| 文件 | 说明 |
|------|------|
| `app/agents/guided_profile_agent.py` | 引导式画像 Agent |
| `app/api/guided_profile.py` | 引导对话 API（start/next/status） |
| `app/models/guided_session.py` |引导会话 Model |
| `app/models/guided_answer.py` | 维度回答 Model |
| `app/models/subject_profile.py` | 学科画像 Model |

### 后端修改

| 文件 | 修改 |
|------|------|
| `app/models/student_profile.py` | 主画像新增 `source_subjects` 字段 |
| `app/api/profile.py` | 增加学科画像查询接口 |

### 前端新增

| 文件 | 说明 |
|------|------|
| `app/profile/GuidedProfileModal.tsx` | 引导对话全屏弹窗 |
| `app/profile/SubjectSelect.tsx` | 学科选择组件 |
| `app/profile/SubjectCard.tsx` | 学科画像展示卡片 |

### 前端修改

| 文件 | 修改 |
|------|------|
| `app/profile/page.tsx` | 接入引导对话入口 + 学科画像展示 |
| `src/lib/api.ts` | 新增 `guidedProfileApi` 接口 |

---

## 11. 验收标准

1. 用户可选学科后进入引导对话
2. AI 逐维度提问，每维度最多 5 个问题
3. AI 能根据回答质量智能追问
4. AI 能从回答中智能解析并打分（不是存储原话）
5. 8 个维度完成后自动保存学科画像
6. 主画像由学科画像计算得出（不通过对话创建）
7. 前端有进度条显示当前第几维度
8. 完成后显示汇总结果

---

**设计完成，待用户确认后进入实现阶段。**