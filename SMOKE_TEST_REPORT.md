# 端到端冒烟测试报告 (2026-06-09)

> **跑法**：`cd backend && python -m tests.smoke_test`  
> **背景**：项目后端运行在 8001，PostgreSQL 5432，Redis 6379，前端 3000  
> **总耗时**：~10 分钟

## ✅ 全部 PASS (9/9)

| API | 响应时间 | 关键证据 |
|---|---|---|
| `/health` | 0.05s | 200 healthy |
| `POST /profile/build` (F1) | 15.5s | version=3, completeness=80%, 6 维画像 |
| `POST /chat/stream` (F4) | 31.3s | **1032 tokens 真逐 token 流式** |
| `POST /resource/generate/stream` (F2) | 55.6s | 53 tokens + **validation.passed=False confidence=0.85**（防幻觉抓出 1 个用词不当） |
| `POST /resource/exercises/generate/stream` (F2) | 45.1s | 3 道题（选择+判断+编程）+ 防幻觉 |
| `POST /path/generate/stream` (F3) | 58.3s | 7 天路径，含 nodes + edges |
| `POST /mindmap/generate` (F2) | 47.2s | A* 算法 28 节点 mermaid |
| `GET /dashboard/stats` | 0.1s | 200, knowledge_points=1, recent_activities=1 |
| `POST /evaluation/record` (F5) | 0.2s | record_id=84a2c258 |

## 已知小问题（不阻塞演示）

- chat/stream: `<think>` 标签碎片泄漏（首 token "nk>**"）
- mindmap: 长 prompt（"Transformer 架构"）偶发 fallback，换短 prompt 正常
- resource: 偶尔 `validation.passed=False`（LLM 用词问题，可接 `validate_and_correct` 自动重写）

## 📝 结论

**项目可以演示**。所有评分项（F1/F2/F3/F4/F5）核心 API 都返回 200 + 真实数据 + 正确格式。SSE 真流式（1032 tokens / 31s）确认可用。防幻觉三层验证确实在跑（resource 接口验证后返回 issues 列表）。

**比赛现场建议演示顺序**：
1. `/profile` → AI 弹窗 → 6 维画像 build → 6 维返回
2. `/duihua` → 发"什么是反向传播" → 看到 1000+ tokens 真逐字流
3. `/resources` → 输入"A* 搜索算法" → 看到 53 tokens 流 + 末尾 `validation` 字段
4. `/tiku` → 输入"梯度下降" + 出 3 题 → 看到 3 道题 + 选项 + 答案
5. `/path` → 输入"机器学习,深度学习" + 7 天 → 看到 DAG
6. `/` 仪表盘 → 看到刚才生成的数据聚合
