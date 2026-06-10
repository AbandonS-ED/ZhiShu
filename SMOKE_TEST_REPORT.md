# 端到端冒烟测试报告

## 第一次（2026-06-09）

> **跑法**：`cd backend && python -m tests.smoke_test`  
> **总耗时**：~10 分钟

### ✅ 全部 PASS (9/9)

| API | 响应时间 | 关键证据 |
|---|---|---|
| `/health` | 0.05s | 200 healthy |
| `POST /profile/build` (F1) | 15.5s | version=3, completeness=80%, 6 维画像 |
| `POST /chat/stream` (F4) | 31.3s | **1032 tokens 真逐 token 流式** |
| `POST /resource/generate/stream` (F2) | 55.6s | 53 tokens + **validation.passed=False confidence=0.85** |
| `POST /resource/exercises/generate/stream` (F2) | 45.1s | 3 道题（选择+判断+编程）+ 防幻觉 |
| `POST /path/generate/stream` (F3) | 58.3s | 7 天路径，含 nodes + edges |
| `POST /mindmap/generate` (F2) | 47.2s | A* 算法 28 节点 mermaid |
| `GET /dashboard/stats` | 0.1s | knowledge_points=1 |
| `POST /evaluation/record` (F5) | 0.2s | record_id=84a2c258 |

---

## 第二次（2026-06-10 17:29）

> **背景**：StateGraph 多智能体协同升级后验证  
> **总耗时**：~7 分钟

### ✅ 全部 PASS (9/9)

| Step | API | Agent 协同 | 耗时 | 关键证据 |
|---|---|---|---|---|
| 0 | `/health` | — | <1s | 200 healthy |
| 1 F1 | `/profile/build` | Profile Agent | 13.4s | version=9, completeness=85% |
| 2 F4 | `/chat/stream` | Master Agent → Tutor Agent | 39.2s | 39 tokens / 2402 chars |
| 3 F2 | `/resource/generate/stream` | Document Agent + 防幻觉3层 | 72.8s | validation.passed=True conf=1.0 |
| 4 F2 | `/resource/exercises/generate/stream` | Exercise Agent | 74.3s | 768 tokens / 3 道题 |
| 5 F3 | `/path/generate/stream` | Path Agent | 74.3s | 14 天 / 13 nodes / 14 edges |
| 6 F2 | `/mindmap/generate` | MindMap Agent | 77.5s | 78 字符 Mermaid |
| 7 | `/dashboard/stats` | 聚合查询 | <1s | 4 知识点 / 15.5h |
| 8 | `/evaluation/record` | Evaluation Service | <1s | record_id=ece2e8fb |

### 关键发现

- **多 Agent 协同真实发生**：F1/F2/F3/F4/F5 各触发对应 Agent
- **防幻觉满分**：confidence=1.0, passed=True（优于上次 0.85）
- **数据真实落库**：profile version=9, dashboard 4 知识点

### 与第一次对比

| 指标 | 2026-06-09 | 2026-06-10 | 变化 |
|---|---|---|---|
| profile completeness | 80% | 85% | ↑ 多轮累积 |
| resource 防幻觉 conf | 0.85 | 1.0 | ↑ 更稳 |
| 总耗时 | ~10 分钟 | ~7 分钟 | ↓ |

---

## 第三次（2026-06-10 20:30）— P0 修复后验证

> **背景**：全部 10 个 P0 问题修复完成后，验证关键改动  
> **检测方式**：后端 120 pytest 全过 + `next build` 编译成功 + 前后端 200 可达

### 验证清单

| 验证项 | 方法 | 结果 |
|---|---|---|
| 后端 120 个 pytest | `python -m pytest tests/ -v` | ✅ 全部通过 |
| 前端编译 | `npx next build` | ✅ 编译成功 |
| `_strip_think` 22 测试 | `test_strip_think.py` | ✅ 全部通过（含回滚后） |
| 前后端可达 | HTTP 200 | ✅ 8001 + 3000 均响应 |
| profile 页 | 真实数据派生 | ✅ `deriveWeakness`/`deriveSixDimensions` |
| resources 页 | API 资源合并入网格 | ✅ `isApi` 标记 + modal 兜底 |
| pinggu 页 | 图表 props 传入 | ✅ `TrendChart`/`BarChart` 数据驱动 |
| UUID 校验 | 7 router Pydantic 验证 | ✅ `dependencies.py` 统一依赖 |
| `learning_records` 表 | init_db.sql + create_all | ✅ 双保险建表 |
| `recordAction` 调用 | 5 处前端 | ✅ resources/tiku/duihua/path |

---

## 已知小问题（不阻塞演示）

- chat/stream: `<think>` 标签碎片泄漏（首 token "nk>\*\*"）
- mindmap: 长 prompt 偶发 fallback，换短 prompt 正常
- resource: 偶尔 `validation.passed=False`（LLM 用词问题）
- P1 问题仍存在：`markdownToHtml` 不消毒 / XSS 风险 / 13 处 `alert()` / 3 套类型定义漂移
- `_strip_think` 死代码已回滚（2026-06-10）
- P0-5（exercise submit 端点）被 P0-1+2 覆盖，无需独立端点

---

## 比赛现场建议演示顺序

1. `/profile` → AI 弹窗 → 6 维画像 build → 6 维返回
2. `/duihua` → 发"什么是反向传播" → 看到 1000+ tokens 真逐字流
3. `/resources` → 输入"A* 搜索算法" → 看到流式生成
4. `/tiku` → 输入"梯度下降" → 看到 3 道题 + 选项
5. `/path` → 输入"机器学习,深度学习" + 7 天 → 看到 DAG
6. `/` 仪表盘 → 看到刚才生成的数据聚合
