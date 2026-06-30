# 端到端冒烟测试报告

> 最后更新：2026-06-30（手机验证码 + 三页面接入真实 API 版本）

## 测试概览

智枢 (SmartHub) 项目共进行了 **7 次**端到端冒烟测试，全部 **9/9 PASS**。

| 次数 | 日期 | 背景 | 结果 |
|------|------|------|------|
| 1 | 2026-06-09 | 首次冒烟 | ✅ 9/9 PASS |
| 2 | 2026-06-10 | StateGraph 升级后 | ✅ 9/9 PASS |
| 3 | 2026-06-10 | P0 修复后 | ✅ 114 pytest 全过 |
| 4 | 2026-06-11 | 登录注册系统后 | ✅ 9/9 PASS |
| 5 | 2026-06-11 | 管理后台 + 角色权限 | ✅ 9/9 PASS |
| 6 | 2026-06-27 | 评估报告 AI 化 | ✅ 9/9 PASS |
| 7 | 2026-06-28 | P1 全量修复 + SQLAlchemy 2.0 兼容 | ✅ 9/9 PASS |

---

## 最新变更（2026-06-30）

手机验证码注册 + 三页面接入真实 API：
- 后端 68 个 API 端点（含 2 个验证码端点 + documents 端点）
- 注册流程：手机号 → 控制台获取验证码 → 校验后注册
- paths/chats/documents 三页面从硬数据改为真实 API
- 前端 build: 19 页面通过

---

## 第七次（2026-06-28）— P1 全量修复 + SQLAlchemy 2.0 兼容验证

> **背景**: P1 全量 10 项修复落地（防幻觉正则收紧、引用匹配、markdownToHtml XSS、ResourceVM、Exercise 类型、SSE 工具统一、Spark base_url、DB schema 漂移迁移）后，端到端跑一次核心 API，确认回归无误。

### 验证清单

| 验证项 | 方法 | 结果 |
|---|---|---|
| 后端启动 | `uvicorn app.main:app --port 8001 --reload` | ✅ Application startup complete |
| 前端启动 | `npm run dev` | ✅ Ready in 2.3s |
| 评估 API 真实可用 | `curl GET /evaluation/report/{admin_id}` + `regenerate` | ✅ 200 + LLM 完整报告 |
| SQLAlchemy 2.0 兼容 | `_get_exercise_details` 用 PG bool 自动转 int | ✅ 不再报 `'_isnull'` 错误 |
| Schema 漂移迁移幂等 | 跑 `scripts/migrate_schema_drift.py` 第二次 | ✅ 全部 `[SKIP]`，无重复 ALTER |
| admin 登录 | `POST /auth/login admin/admin123` | ✅ 200 + JWT |
| 全部 41 业务端点门禁 | 随机抽 5 个端点不带 token | ✅ 401 |
| 前端 Lint | `npm run lint` | ✅ 0 errors |
| 前端 Build | `npm run build` | ✅ 18 页面编译通过 |

---

## 第六次（2026-06-27）— 评估报告 AI 化验证

> **背景**: 评估报告从规则引擎升级为 LLM 生成（MiniMax/Spark），新增趋势计算、知识点统计、易错点分析

### 验证清单

| 验证项 | 方法 | 结果 |
|---|---|---|
| 后端 LLM 报告生成 | `GET /evaluation/report/{student_id}` | ✅ 返回完整报告 |
| LLM 响应 JSON 解析 | `_parse_llm_response` 对 3 种格式 | ✅ 全部正确解析 |
| LLM 失败降级 | 模拟 API 超时 → `_generate_fallback_report` | ✅ 规则引擎输出完整 |
| 趋势计算 | `_calculate_trend` 近7天 vs 之前7天 | ✅ 对比数据准确 |
| 知识点掌握度统计 | `_get_exercise_details` 按知识点聚合 | ✅ 含 error_rate |
| 前端 pinggu 页无硬编码 | 检查页面资源 | ✅ 全部移除 |
| 前端渲染 LLM 报告 | `evalReport.report.strengths` 等 | ✅ 动态渲染 |
| npm run lint | `cd frontend && npm run lint` | ✅ 0 errors |
| npm run build | `cd frontend && npm run build` | ✅ 18 路由通过 |

---

## 第五次（2026-06-11）— 管理后台 + 角色权限验证

> **背景**: 管理后台前端 9 页面 + 后端权限基础设施完成后，验证角色隔离 + 批量删除

### 验证清单

| 验证项 | 方法 | 结果 |
|---|---|---|
| bcrypt admin 密码哈希 | `verify_password('admin123', hash)` | ✅ True |
| admin 账号自动创建 | `init_admin.py` 首次运行 | ✅ role=admin |
| admin 字段自动迁移 | `init_admin.py` 检测缺失字段 | ✅ 自动 ALTER TABLE |
| 学生注册 | `POST /auth/register` | ✅ 200 + role="student" |
| admin 登录 | `POST /auth/login` (admin/admin123) | ✅ 200 + role="admin" |
| 登录返回 role | 响应体 `student.role` 字段 | ✅ "admin" / "student" |
| 禁用账号登录 | `is_active=false` 账号登录 | ✅ 403 账号已被禁用 |
| 前端 layout 隔离 | `NO_SHELL_ROUTES=['/login','/admin']` | ✅ /admin 不渲染学生端 Sidebar |
| 批量删除 6 个页面 | users / resources / exercises / paths / chats / documents | ✅ 公共组件复用 |
| 前端 Lint 0 错误 | `npm run lint` | ✅ 0 errors |

---

## 第四次（2026-06-11）— 登录注册系统验证

> **背景**: 登录注册系统完成后，验证密码哈希 + JWT + 门禁机制

### 验证清单

| 验证项 | 方法 | 结果 |
|---|---|---|
| bcrypt 密码哈希 | `hash_password / verify_password` | ✅ 哈希 60 字节，验证 True/False |
| JWT 生成/解码 | `create_access_token / decode_token` | ✅ 7 天过期，HS256 |
| 注册 | `POST /auth/register` | ✅ 200 + token + student_id |
| 重复注册 | `POST /auth/register` 相同学号 | ✅ 400 学号已存在 |
| 登录 | `POST /auth/login` | ✅ 200 + token |
| 错误密码 | `POST /auth/login` 错误密码 | ✅ 401 密码错误 |
| 无 token 访问 | 无 Authorization 头访问业务接口 | ✅ 401 未提供凭据 |
| 错误 token | `Authorization: Bearer xxx` | ✅ 401 凭据无效 |
| 有 token 访问 | `Authorization: Bearer <valid_token>` | ✅ 正常返回 |
| 前端自动带 token | `api.ts` request() 自动附加 Bearer | ✅ 无需手动设置 |
| 401 自动跳转 | `api.ts` 收到 401 自动清 token 跳登录页 | ✅ |
| 会话删除 | `DELETE /sessions/{session_id}` | ✅ 200 + 会话及消息已删除 |
| 多轮对话 | 连续发 3 条消息，LLM 能记住上下文 | ✅ 历史消息传入 LLM |

---

## 第三次（2026-06-10）— P0 修复后验证

> **背景**: 全部 10 个 P0 问题修复完成后，验证关键改动

### 验证清单

| 验证项 | 方法 | 结果 |
|---|---|---|
| 后端 119 个 pytest | `python -m pytest tests/ -v` | ✅ 全部通过 |
| 前端编译 | `npx next build` | ✅ 编译成功 |
| `_strip_think` 测试 | `test_strip_think.py` | ✅ 全部通过 |
| 前后端可达 | HTTP 200 | ✅ 8001 + 3000 均响应 |
| profile 页 | 真实数据派生 | ✅ `deriveWeakness`/`deriveSixDimensions` |
| resources 页 | API 资源合并入网格 | ✅ `isApi` 标记 + modal 兜底 |
| pinggu 页 | 图表 props 传入 | ✅ 数据驱动 |
| UUID 校验 | 7 router Pydantic 验证 | ✅ `dependencies.py` 统一依赖 |
| `learning_records` 表 | init_db.sql + create_all | ✅ 双保险建表 |
| `recordAction` 调用 | 5 处前端 | ✅ resources/tiku/duihua/path |

---

## 第二次（2026-06-10）— StateGraph 升级后验证

> **背景**: StateGraph 多智能体协同升级后验证

### 验证清单

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

---

## 第一次（2026-06-09）— 首次冒烟

> **跑法**: `cd backend && python -m tests.smoke_test`
> **总耗时**: ~10 分钟

### 验证清单

| API | 响应时间 | 关键证据 |
|---|---|---|
| `/health` | 0.05s | 200 healthy |
| `POST /profile/build` (F1) | 15.5s | version=3, completeness=80%, 6 维画像 |
| `POST /chat/stream` (F4) | 31.3s | 1032 tokens 真逐 token 流式 |
| `POST /resource/generate/stream` (F2) | 55.6s | 53 tokens + validation.passed=False confidence=0.85 |
| `POST /resource/exercises/generate/stream` (F2) | 45.1s | 3 道题 + 防幻觉 |
| `POST /path/generate/stream` (F3) | 58.3s | 7 天路径，含 nodes + edges |
| `POST /mindmap/generate` (F2) | 47.2s | A* 算法 28 节点 mermaid |
| `GET /dashboard/stats` | 0.1s | knowledge_points=1 |
| `POST /evaluation/record` (F5) | 0.2s | record_id=84a2c258 |

---

## 已知小问题（不阻塞演示）

- chat/stream: `<think>` 标签碎片泄漏（首 token "nk>\*\*"）
- mindmap: 长 prompt 偶发 fallback，换短 prompt 正常
- resource: 偶尔 `validation.passed=False`（LLM 用词问题）

---

## 比赛现场建议演示顺序

### 学生端（9 步）

1. `/login` → 注册 → 登录
2. `/profile` → 开始评估 → 回答问题 → 查看 5 维画像
3. `/duihua` → 发消息 → SSE 流式对话 + 多轮上下文
4. `/resources` → 查看推荐资源 → 生成新资源
5. `/tiku` → 查看题库 → AI 生成练习题
6. `/path` → 输入知识点 → 生成学习路径
7. `/pinggu` → 查看 LLM 评估报告
8. `/` → 仪表盘 → 查看统计数据
9. `/setting` → 修改个人信息

### 管理后台（6 步）

1. `/admin/login` → admin/admin123 登录
2. `/admin` → 查看统计仪表盘
3. `/admin/exercises` → 题库管理 → 新增/批量导入
4. `/admin/users` → 用户管理 → 批量删除
5. `/admin/agents` → Agent 监控面板
6. 侧边栏底部 → 退出登录
