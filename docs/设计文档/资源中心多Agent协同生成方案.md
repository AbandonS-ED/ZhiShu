# 资源中心多 Agent 协同生成方案

> 日期：2026-07-02
> 状态：**草稿** — 待评审后实施

---

## 1. 背景与目标

### 1.1 现状问题

| 问题 | 现状 | 影响 |
|------|------|------|
| 内容单薄 | 单 LLM 调用一次性生成，深度/广度无法控制 | 学习资料缺乏营养 |
| 生成速度慢 | 串行等待，10-30s 无反馈 | 无法作为上架产品的竞争优势 |
| 无差异化 | 直接调 LLM 的效果，和 ChatGPT 无区别 | 没有产品护城河 |
| 无拓展空间 | 生成完就结束，用户没有深入探索的入口 | 留存率低 |
| 单 Agent 生成 | 一个通用 prompt 生成所有类型 | 内容质量平庸 |

### 1.2 改良目标

1. **速度领先**：首个内容 3-5 秒露出，全程流式
2. **质量专业化**：每个资源类型由专门 Agent 生成，prompt 高度定制
3. **深度分层**：同一知识点生成入门/进阶/挑战三个版本，用户自选
4. **拓展闭环**：生成完毕提供多个拓展入口，形成持续学习路径
5. **ZhiShu 特色**：输出格式按产品风格定制，不是通用 LLM 输出

---

## 2. 整体架构

### 2.1 多 Agent 协同流程

```
用户输入: "梯度下降"
    │
    ▼
[Coordinator Agent]  ─── 理解需求，拆解任务，制定生成计划
    │
    ├──────────────────────────────────────────────┐
    │                                              │
    ▼                                              ▼
[Explanation Agent]                    [Code Agent]
  生成知识点讲解                        生成代码示例（多实现）
  ・深度讲解版                          ・基础实现
  ・简化速记版                          ・向量化实现
                                          ・numpy 实现
    │                                              │
    ▼                                              ▼
[Mindmap Agent]                       [Exercise Agent]
  生成思维导图结构                       生成练习题
  ・概念节点图                           ・入门题 ×3
  ・知识点关联图                          ・进阶题 ×3
    │                                              │
    └──────────────────────────────────────────────┘
                        │
                        ▼
              [Audio Script Agent]
                生成音频讲解稿
                ・2 分钟精讲版
                ・30 秒极简版
                        │
                        ▼
              [Coordinator Agent] 汇总 → 触发前端展示拓展菜单
```

### 2.2 与现有架构的关系

- **复用**：`document_agent`、`exercise_agent`、`mindmap_agent`、`audio_agent` 作为子 Agent 保留
- **新增**：`coordinator_agent`（编排器）、各 Agent 的「深度版本」变体
- **废弃**：`/resource/generate/stream` 的旧单 Agent 逻辑
- **SSE 协议**：复用现有 `type=progress` / `type=token` / `type=result` / `type=done` 协议，扩展 `current_agent` 字段

---

## 3. Agent 设计

### 3.1 Coordinator Agent（编排器）

**职责**：
1. 接收用户输入（知识点 + 学习阶段 learn/practice/review）
2. 解析知识点复杂度，判断需要的资源深度
3. 并行分发任务给各专门 Agent
4. 汇总结果，过滤重复，触发前端展示
5. 管理整体超时（30s）和部分失败降级

**系统提示核心逻辑**：
```
你是一个学习资源编排专家。
用户要学习知识点 "{knowledge_point}"，当前阶段为 {phase}。
你的任务：
1. 判断该知识点复杂度（简单/中等/困难），影响生成深度
2. 决定需要生成哪些资源类型（讲解/代码/思维导图/练习/音频）
3. 为每个资源类型生成专属提示词
4. 以 JSON 格式返回任务清单
```

**输出格式**：
```json
{
  "complexity": "medium",
  "tasks": [
    {"agent": "explanation", "variant": "deep", "priority": 1},
    {"agent": "code", "variant": "multi_impl", "priority": 2},
    {"agent": "mindmap", "variant": "concept_map", "priority": 3},
    {"agent": "exercise", "variant": "mixed_difficulty", "priority": 4},
    {"agent": "audio", "variant": "concise", "priority": 5}
  ],
  "estimated_time": "25s"
}
```

### 3.2 Explanation Agent（讲解 Agent）

**两个版本**：

| 版本 | 用途 | prompt 特点 | max_tokens |
|------|------|-------------|------------|
| `deep` | 入门学习 | 详细类比 + 原理推导 + 示例 | 2048 |
| `concise` | 快速回顾 | 3 句话核心 + 关键公式 | 512 |

**特色**：
- 输出格式固定：`(概念定义) → (核心原理) → (生活类比) → (典型例题) → (记忆口诀)`
- 不输出 markdown 标题，纯文本段落，适合前端多态渲染

### 3.3 Code Agent（代码 Agent）

**两个版本**：

| 版本 | 用途 | prompt 特点 | max_tokens |
|------|------|-------------|------------|
| `basic` | 入门 | 单一实现 + 逐行注释 | 1536 |
| `multi_impl` | 进阶 | 3 种实现对比（纯 Python / NumPy / 面向对象） | 2560 |

**特色**：
- 每种实现必须有：代码块 + 时间复杂度说明 + 适用场景
- 3 种实现用 `---IMPLEMENTATION_SEP---` 分隔，方便前端拆分渲染

### 3.4 Mindmap Agent（思维导图 Agent）

**两个版本**：

| 版本 | 用途 | prompt 特点 |
|------|------|-------------|
| `concept_map` | 入门 | 概念节点 + 层级关系，适合初学者 |
| `relation_graph` | 进阶 | 知识点之间逻辑关系 + 推导路径 |

**输出格式**：Mermaid 语法思维导图
```
mindmap
  root((梯度下降))
    分类
      批量梯度下降
      随机梯度下降
      小批量梯度下降
    核心公式
      θ = θ - α∇J(θ)
    收敛判断
      损失函数变化
      梯度范数阈值
```

### 3.5 Exercise Agent（练习 Agent）

**两个版本**：

| 版本 | 用途 | prompt 特点 | count |
|------|------|-------------|-------|
| `mixed` | 入门 | 2 入门 + 1 进阶，附解析 | 3 |
| `challenge` | 挑战 | 2 进阶 + 1 竞赛难度，无解析 | 3 |

**输出格式**：
```json
{
  "exercises": [
    {
      "type": "choice",
      "difficulty": 40,
      "question": "...",
      "options": ["A: ...", "B: ...", "C: ...", "D: ..."],
      "answer": "B",
      "explanation": "因为..."
    }
  ]
}
```

### 3.6 Audio Script Agent（音频 Agent）

**两个版本**：

| 版本 | 时长 | prompt 特点 | max_tokens |
|------|------|-------------|------------|
| `standard` | ~2 分钟 | 完整讲解，有过渡语 | 1024 |
| `concise` | ~30 秒 | 核心要点，口语化 | 384 |

**特色**：
- 输出为纯文本讲稿，不是 TTS 直接调用
- 前端可选择「标准版」或「极简版」，再调用 TTS

---

## 4. 拓展机制

### 4.1 生成完毕后自动展示拓展菜单

当所有 Agent 完成生成后，前端底部弹出「你还想深入了解什么？」菜单：

| 拓展选项 | 触发动作 | 说明 |
|---------|---------|------|
| 🔍 深化讲解 | 重新调用 Explanation Agent（variant=deep），聚焦难点 | 追问机制 |
| 📚 相关知识点 | 调用 Path Agent 生成前置/后续知识点路径 | 路径规划 |
| 💻 代码实现 | 调用 Code Agent 生成另一种实现方式 | 追加生成 |
| 🎯 出题挑战 | 调用 Exercise Agent（variant=challenge） | AI 出题考你 |
| 🔄 换个角度 | Coordinator 重新生成（不同 complexity） | 刷新重来 |

### 4.2 追问机制（深化讲解）

- 前端记录用户点击「深化讲解」后的追问输入
- 将追问 + 原知识点 + 已生成讲解传给 Explanation Agent
- 生成聚焦用户困惑点的深度解析
- 不覆盖原资源，追加一个新版本 resource

---

## 5. 流式协议扩展

### 5.1 SSE 事件扩展

在现有协议基础上扩展 `current_agent` 字段：

```json
// progress 事件新增 current_agent
{"type": "progress", "progress": 0.3, "message": "正在生成代码示例...", "current_agent": "code"}

// token 事件保留
{"type": "token", "content": "θ = θ - α∇J(θ)"}

// result 事件扩展，支持多资源
{
  "type": "result",
  "data": {
    "explanation": {"resource_id": "xxx", "content": "..."},
    "code": {"resource_id": "yyy", "content": "..."},
    "mindmap": {"resource_id": "zzz", "mermaid": "..."},
    "exercises": {"resource_id": "www", "items": [...]},
    "audio": {"resource_id": "vvv", "script": "..."}
  }
}

// 新增 extend 事件，表示可拓展
{"type": "extend_menu", "options": ["deep_explain", "related_kp", "challenge"]}

// done 事件不变
{"type": "done"}
```

### 5.2 前端进度展示

| 状态 | 显示 |
|------|------|
| 编排中 | "正在分析学习需求..." + 骨架屏 |
| Explanation 完成 | 讲解卡片第一个出现，其他保持骨架 |
| Code 完成 | 代码卡片出现 |
| 全部完成 | 所有卡片到位 + 底部弹出拓展菜单 |
| 部分失败 | 成功资源展示，失败资源显示「生成失败，点击重试」 |

---

## 6. 数据库变更

### 6.1 Resource 表扩展

```sql
ALTER TABLE resources ADD COLUMN parent_id UUID REFERENCES resources(id);
ALTER TABLE resources ADD COLUMN generation_variant VARCHAR(20);  -- 'deep' | 'concise' | 'basic' | 'multi_impl' | ...
ALTER TABLE resources ADD COLUMN is_extended BOOLEAN DEFAULT FALSE;
```

### 6.2 资源关联结构

```
用户首次生成: "梯度下降" → 5 个资源（parent_id = NULL, generation_variant = 'initial')
  ├─ explanation (deep)        ← parent_id: NULL, generation_variant: 'initial'
  ├─ code (basic)             ← parent_id: NULL, generation_variant: 'initial'
  ├─ mindmap (concept_map)    ← parent_id: NULL, generation_variant: 'initial'
  ├─ exercise (mixed)         ← parent_id: NULL, generation_variant: 'initial'
  └─ audio (standard)         ← parent_id: NULL, generation_variant: 'initial'

用户点击「深化讲解」→ 新增:
  └─ explanation (deeper)     ← parent_id: explanation.id, generation_variant: 'extended_deep'

用户点击「换个角度」→ 重新生成一套（替换原 5 个）:
  └─ (新 5 个 resources, parent_id 指向旧 5 个)
```

---

## 7. 前端改造

### 7.1 usePhaseGeneration 改造

```typescript
// 原有模拟进度 → 真实多 Agent 状态
interface AgentState {
  explanation: 'pending' | 'streaming' | 'done' | 'error'
  code: 'pending' | 'streaming' | 'done' | 'error'
  mindmap: 'pending' | 'streaming' | 'done' | 'error'
  exercise: 'pending' | 'streaming' | 'done' | 'error'
  audio: 'pending' | 'streaming' | 'done' | 'error'
}

interface GenerationEvent {
  type: 'progress' | 'token' | 'result' | 'extend_menu' | 'done' | 'error'
  current_agent?: string      // 新增
  progress?: number
  content?: string
  data?: Record<string, ResourceData>
  options?: string[]
}
```

### 7.2 RecCard 改造

- 每个资源卡片加「拓展」图标按钮
- 点击后下拉显示 5 个拓展选项
- 拓展加载中显示在该卡片下方的小加载条

### 7.3 PhaseButton 改造

- 状态机简化：idle / loading（真实进度）/ done / error
- loading 时显示当前 Agent 名称："正在生成代码..."
- 不再是模拟的百分比进度条

### 7.4 资源 Modal 改造

- 底部加「拓展菜单」栏（生成完毕后才显示）
- 「深化讲解」输入框：用户输入困惑点，发送后追加新版本
- 「相关知识点」：点击后跳转路径规划页面并带入目标 KP

---

## 8. 后端实现步骤

### Phase 1：基础重构（不破坏现有接口）

1. 新建 `app/agents/coordinator_agent.py`
2. 各子 Agent 增加 variant 参数支持（`deep` / `concise` / `basic` / `multi_impl` 等）
3. 新增 `POST /resource/multi-agent/stream` SSE 端点，复用 `/resource/generate/stream` 的协议
4. 前端 `usePhaseGeneration` 支持新的 `current_agent` 和 `extend_menu` 事件

### Phase 2：拓展机制

5. 数据库增加 `parent_id`、`generation_variant`、`is_extended` 字段
6. 实现「深化讲解」追问流程（追加生成，不覆盖）
7. 实现「相关知识点」调用 Path Agent

### Phase 3：细节打磨

8. Code Agent 多实现分隔符解析，前端按实现分栏展示
9. Audio Script Agent 双版本（standard / concise）
10. 各 Agent prompt 调优，针对 ZhiShu 风格定制输出格式

---

## 9. 验收标准

1. ✅ 知识点输入后 3-5 秒内首个资源卡片出现（stream 真实反馈）
2. ✅ 5 种资源并行生成，全套资源 30s 内全部就绪
3. ✅ 生成完毕底部显示 5 个拓展选项
4. ✅ 点击「深化讲解」可输入追问，追加新版本资源（不覆盖原资源）
5. ✅ 点击「相关知识点」能展示前置/后续知识点的路径
6. ✅ 资源卡片展示时明确标注版本（入门版/进阶版/挑战版）
7. ✅ 部分 Agent 失败时其他 Agent 继续，不整体崩溃
8. ✅ 整体生成质量明显优于单 Agent 通用 prompt 效果

---

## 10. 文件变更清单

### 后端新增

| 文件 | 说明 |
|------|------|
| `app/agents/coordinator_agent.py` | 编排器 Agent |
| `app/api/resource_multi.py` | 多 Agent 生成 API（含 SSE） |

### 后端修改

| 文件 | 修改 |
|------|------|
| `app/agents/document_agent.py` | 增加 variant 参数支持 |
| `app/agents/code_agent.py` | 新建（或从 document_agent 拆分） |
| `app/agents/mindmap_agent.py` | 增加 variant 参数支持 |
| `app/agents/exercise_agent.py` | 增加 variant 参数支持 |
| `app/agents/audio_agent.py` | 增加 variant 参数支持 |
| `app/models/resource.py` | 新增 parent_id / generation_variant / is_extended 字段 |
| `backend/scripts/init_db.sql` | 新增字段的 ALTER 语句 |

### 前端修改

| 文件 | 修改 |
|------|------|
| `app/resources/hooks/usePhaseGeneration.ts` | 真实多 Agent 状态 + extend_menu 支持 |
| `app/resources/components/PhaseButton.tsx` | 显示当前 Agent 名称 |
| `app/resources/components/RecCard.tsx` | 拓展按钮 + 版本标注 |
| `app/resources/types.ts` | 新增 GenerationEvent 类型 |
| `app/resources/components/LearningPage.tsx` | 拓展菜单 UI |
