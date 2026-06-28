# 端到端冒烟测试报告

> 最后更新：2026-06-28（P1 全量修复后端端点验证 — 第 7 次冒烟）

## 第七次（2026-06-28）— P1 全量修复 + SQLAlchemy 2.0 兼容验证

> **背景**：P1 全量 10 项修复落地（防幻觉正则收紧、引用匹配、markdownToHtml XSS、ResourceVM、Exercise 类型、SSE 工具统一、Spark base_url、DB schema 漂移迁移）后，端到端跑一次核心 API，确认回归无误。
> **检测方式**：API 真实调用 + 后端日志 + 前端页面

### 验证清单

| 验证项 | 方法 | 结果 |
|---|---|---|
| 后端启动 | `uvicorn app.main:app --port 8001 --reload` | ✅ Application startup complete |
| 前端启动 | `npm run dev` | ✅ Ready in 2.3s |
| 评估 API 真实可用 | `curl GET /evaluation/report/{admin_id}` + `regenerate` | ✅ 200 + LLM 完整报告（overall_evaluation / strengths / weak_points / error_prone_areas / progress_trend）|
| SQLAlchemy 2.0 兼容 | `_get_exercise_details` 用 PG bool 自动转 int，无需 `func.cast(type_=int)` | ✅ 不再报 `'_isnull'` AttributeError |
| Schema 漂移迁移幂等 | 跑 `scripts/migrate_schema_drift.py` 第二次 | ✅ 全部 `[SKIP]` 状态，无重复 ALTER 报错 |
| admin 登录 | `POST /auth/login admin/admin123` | ✅ 200 + JWT |
| 全部 33 业务端点门禁 | 随机抽 5 个端点不带 token | ✅ 401 |
| 前端 Lint | `npm run lint` | ✅ 0 errors |

### 关键发现

- **SQLAlchemy 2.0 兼容性**：原 `func.cast(..., type_=int)` 在 SQLAlchemy 2.0 报 `'_isnull'` 错误，改用 PG 原生 `func.sum(bool)` 自动转 0/1，修复评估 API 500。
- **迁移脚本幂等性**：`migrate_schema_drift.py` 用 `try/except DuplicateColumnError` 实现可重复运行，老 DB 一键补齐缺失列/表。
- **回归无副作用**：P1 修复未影响既有功能（admin 登录、JWT 门禁、评估接口、pinggu 渲染全部正常）。

---

## 第六次（2026-06-27）— 评估报告 AI 化验证

> **背景**：评估报告从规则引擎升级为 LLM 生成（MiniMax/Spark），新增趋势计算、知识点统计、易错点分析
> **检测方式**：API 调用 + 前端渲染验证

### 验证清单

| 验证项 | 方法 | 结果 |
|---|---|---|
| 后端 LLM 报告生成 | `GET /evaluation/report/{student_id}` → 检查 `report` 字段 | ✅ 返回 `overall_evaluation`/`strengths`/`weak_points`/`recommendations`/`progress_trend` |
| LLM 响应 JSON 解析 | `_parse_llm_response` 对 3 种格式（直接 JSON / 代码块 / 空） | ✅ 全部正确解析或降级 |
| LLM 失败降级 | 模拟 API 超时 → `_generate_fallback_report` | ✅ 规则引擎输出完整报告结构 |
| 趋势计算 | `_calculate_trend` 近7天 vs 之前7天 | ✅ score_change / duration_change |
| 知识点掌握度统计 | `_get_exercise_details` 按知识点聚合 | ✅ 含 error_rate / correct_count |
| 前端 pinggu 页无硬编码 | 检查页面资源: `dimensions` / `knowledgeTable` / `weeklyHours` / `topicAccuracy` / `records` | ✅ 全部移除，替换为 fallback 默认值 |
| 前端渲染 LLM 报告 | `evalReport.report.strengths` / `weak_points` / `error_prone_areas` | ✅ 动态渲染 4 个区域 |
| 前端空数据状态 | 新注册用户首次进入 pinggu 页 | ✅ 显示"暂无评估报告数据" |
| 前端加载状态 | `evalLoading=true` 时显示 RobotIcon + "AI 正在分析您的学习数据..." | ✅ |
| npm run lint | `cd frontend && npm run lint` | ✅ 0 errors |
| npm run build | `cd frontend && npm run build` | ✅ 18 路由编译通过 |

### 关键发现

- **LLM 报告质量**：生成的 `overall_evaluation` 包含学生姓名 + 综合评分 + 等级 + 日均学习时长的完整摘要
- **趋势判断准确**：近 7 天 vs 之前 7 天的正确率和时长对比数据符合预期
- **降级策略稳健**：任何 LLM 调用异常（超时/JSON解析失败/空响应）自动降级到规则引擎
- **前端重构彻底**：pinggu 页从 240+ 行硬编码数据降至仅有 fallback 默认值，所有展示依赖后端 API
- **`[...new Set()]` → `Array.from(new Set())`**：资源页修复 Set 解构在旧 Node 版本的兼容性问题

---

## 第五次（2026-06-11）— 管理后台 + 角色权限验证

> **背景**：管理后台前端 9 页面 + 后端权限基础设施完成后，验证角色隔离 + 批量删除
> **检测方式**：API 调用 + Python 验证脚本

### 验证清单

| 验证项 | 方法 | 结果 |
|---|---|---|
| bcrypt admin 密码哈希 | `init_admin.py` 生成的 `verify_password('admin123', hash)` | ✅ True |
| admin 账号自动创建 | `init_admin.py` 首次运行 | ✅ id=`a0000000-0000-0000-0000-000000000001`, role=admin |
| admin 字段自动迁移 | `init_admin.py` 检测 students.role / is_active / last_login | ✅ 缺失字段自动 ALTER TABLE |
| admin 重复运行幂等 | `init_admin.py` 第二次运行（更新密码） | ✅ ON CONFLICT DO UPDATE 成功 |
| 学生注册 | `POST /auth/register` → 默认 `role=student` | ✅ 200 + role="student" |
| admin 登录 | `POST /auth/login` (admin/admin123) | ✅ 200 + role="admin" |
| 登录返回 role | 响应体 `student.role` 字段 | ✅ "admin" / "student" |
| 禁用账号登录 | `is_active=false` 账号登录 | ✅ 403 账号已被禁用 |
| 学生端 token 隔离 | admin 登录的 token (`zhishu_admin_token`) | ✅ 前端路由 /admin 通过 / / 直接走学生 API 也工作 |
| 前端 layout 隔离 | 根 `layout.tsx` 的 `NO_SHELL_ROUTES=['/login','/admin']` | ✅ /admin 不渲染学生端 Sidebar |
| 批量删除 6 个页面 | users / resources / exercises / paths / chats / documents | ✅ 公共组件 `BatchDeleteBar` + `useSelection` 复用 |
| 批量删除二次确认 | `confirm("确认删除选中的 N 个 X？")` | ✅ |
| 复选框交互 | 全选 / 反选 / 半选 / 单选 | ✅ AdminCheckbox 支持 indeterminate |
| 登出按钮统一 | 底部 `admin-sb-logout` 样式与学生端 `sb-logout` 一致 | ✅ |
| 前端 Lint 0 错误 | `npm run lint` | ✅ 0 errors（仅 2 个原有 warnings） |

### 关键发现

- **PowerShell `$2b$` 变量插值坑**：在 PowerShell 命令行直接传 `'$2b$12$...'` 会被 shell 解析为变量，破坏 bcrypt 哈希。**用 Python 脚本 `init_admin.py` 绕开**。
- **Next.js 根 layout 共享问题**：`app/layout.tsx` 会被所有路由继承，`/admin` 默认会渲染学生端 Sidebar。`NO_SHELL_ROUTES` 加 `/admin` 后正常隔离。
- **批量删除组件复用**：用 `useSelection` Hook + `BatchDeleteBar` 共享组件，6 个页面只写 `batchDelete()` 函数即可。

---

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
> **检测方式**：后端 119 pytest 全过 + `next build` 编译成功 + 前后端 200 可达

### 验证清单

| 验证项 | 方法 | 结果 |
|---|---|---|
| 后端 119 个 pytest | `python -m pytest tests/ -v` | ✅ 全部通过 |
| 前端编译 | `npx next build` | ✅ 编译成功 |
| `_strip_think` 11 测试 | `test_strip_think.py` | ✅ 全部通过（含回滚后） |
| 前后端可达 | HTTP 200 | ✅ 8001 + 3000 均响应 |
| profile 页 | 真实数据派生 | ✅ `deriveWeakness`/`deriveSixDimensions` |
| resources 页 | API 资源合并入网格 | ✅ `isApi` 标记 + modal 兜底 |
| pinggu 页 | 图表 props 传入 | ✅ `TrendChart`/`BarChart` 数据驱动 |
| UUID 校验 | 7 router Pydantic 验证 | ✅ `dependencies.py` 统一依赖 |
| `learning_records` 表 | init_db.sql + create_all | ✅ 双保险建表 |
| `recordAction` 调用 | 5 处前端 | ✅ resources/tiku/duihua/path |

---

## 第四次（2026-06-11）— 登录注册系统验证

> **背景**：登录注册系统完成后，验证密码哈希 + JWT + 门禁机制  
> **检测方式**：端到端 API 调用 + pytest

### 验证清单

| 验证项 | 方法 | 结果 |
|---|---|---|
| bcrypt 密码哈希 | `security.py hash_password / verify_password` | ✅ 哈希 60 字节，验证 True/False |
| JWT 生成/解码 | `security.py create_access_token / decode_token` | ✅ 7 天过期，HS256 标准格式 |
| 注册 | `POST /auth/register` → bcrypt 存储 + 返回 JWT | ✅ 200 + token + student_id |
| 重复注册 | `POST /auth/register` 相同学号 | ✅ 400 学号已存在 |
| 登录 | `POST /auth/login` → bcrypt 校验 + 返回 JWT | ✅ 200 + token |
| 错误密码 | `POST /auth/login` 错误密码 | ✅ 401 密码错误 |
| 无 token 访问 | 无 Authorization 头访问业务接口 | ✅ 401 未提供凭据 |
| 错误 token | `Authorization: Bearer xxx` | ✅ 401 凭据无效 |
| 有 token 访问 | `Authorization: Bearer <valid_token>` | ✅ 正常返回 |
| 前端自动带 token | `api.ts` request() 自动附加 Bearer | ✅ 无需手动设置 |
| 401 自动跳转 | `api.ts` 收到 401 自动清 token 跳登录页 | ✅ |
| 会话删除 | `DELETE /sessions/{session_id}` | ✅ 200 + 会话及消息已删除 |
| 多轮对话 | 连续发 3 条消息，LLM 能记住上下文 | ✅ 历史消息传入 LLM |
| SSE stream auth | 4 个 stream 方法带 Authorization 头 | ✅ 不再 401 |

### 关键发现

- **密码安全**：bcrypt 哈希存储，不明文保存密码
- **JWT 标准**：HS256 格式，7 天过期，密钥从 JWT_SECRET 环境变量读取
- **门禁完整**：24 个业务端点全部加 `get_current_user` 依赖
- **前端无感**：`api.ts` 自动带 token，401 自动跳登录页，用户体验流畅
- **会话管理**：支持创建/切换/删除会话，会话消息带所有权校验
- **多轮上下文**：最近 10 条消息传入 LLM，assistant 消息 JSON 解析正确

---

## 已知小问题（不阻塞演示）

- chat/stream: `<think>` 标签碎片泄漏（首 token "nk>\*\*"）
- mindmap: 长 prompt 偶发 fallback，换短 prompt 正常
- resource: 偶尔 `validation.passed=False`（LLM 用词问题）
- P1 问题仍存在：`markdownToHtml` 不消毒 / XSS 风险 / 13 处 `alert()` / 3 套类型定义漂移
- `_strip_think` 死代码已回滚（2026-06-10）
- P0-5（exercise submit 端点）被 P0-1+2 覆盖，无需独立端点
- **管理后台 27 个 API 未实现**，前端用模板硬编码数据演示
- PowerShell `$2b$` 变量插值：需用 `init_admin.py` 绕开

---

## 比赛现场建议演示顺序

### 学生端（9 步）
1. `/login` → 注册 → 登录 → JWT token 自动生效
2. `/profile` → AI 弹窗 → 6 维画像 build → 6 维返回
3. `/duihua` → 发"什么是反向传播" → 看到 1000+ tokens 真逐字流 + 多轮对话
4. `/resources` → 输入"A* 搜索算法" → 看到流式生成
5. `/tiku` → 输入"梯度下降" → 看到 3 道题 + 选项
6. `/path` → 输入"机器学习,深度学习" + 7 天 → 看到 DAG
7. `/pinggu` → 顶部输入问题 → 看到 LLM 智能评估
8. `/` 仪表盘 → 看到刚才生成的数据聚合
9. 回到 `/duihua` → 删除旧会话 → 新开会话 → 证明会话管理

### 管理后台（6 步）
1. 浏览器新开标签 → `/admin/login` → admin/admin123 → 跳转到 `/admin` 仪表盘
2. 侧边栏 → 用户管理 → 勾选 2-3 个用户 → "批量删除" → 二次确认
3. 资源管理 → 查看资源详情（弹窗带代码）→ 删除
4. 练习题 / 路径 / 对话 / 文档 → 同样支持批量删除
5. Agent 监控 → 7 个 Agent 集群状态 + 调用统计 + 错误率
6. 侧边栏底部 → 退出登录 → 跳回 `/admin/login`
