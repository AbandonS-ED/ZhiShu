# AGENTS.md — 智枢 (ZhiShu)

中国软件杯 A3 赛题：多智能体个性化学习资源生成系统。

**首次进入**: 先读 `CLAUDE.md`（架构 + 已修复 + 技术栈），再看 `开发进度.md`（实时进度）。

## 工作准则

| 荣 | 耻 |
|---|----|
| 以认真查询为荣 | 以瞎猜接口为耻 |
| 以寻求确认为荣 | 以模糊执行为耻 |
| 以人类确认为荣 | 以臆想业务为耻 |
| 以复用现有为荣 | 以创造接口为耻 |
| 以主动测试为荣 | 以跳过验证为耻 |
| 以遵循规范为荣 | 以破坏架构为耻 |
| 以诚实无知为荣 | 以假装理解为耻 |
| 以谨慎重构为荣 | 以盲目修改为耻 |

## 硬约束

- **LLM**: 当前用小米 MiMo v2.5（`LLM_PROVIDER=mimo`，`api-key` 头认证）。备选：MiniMax-M3（`minimax`）/ 讯飞星火 V4（`spark`）。比赛前切星火：`LLM_PROVIDER=spark` + `SPARK_API_KEY=xxx`。讯飞鉴权只用 `Authorization: Bearer {api_key}`，不拼 api_secret。
- **禁用** Google Fonts / Vercel / Sentry / OpenAI（中国不可达）。字体走 `frontend/src/app/fonts/` 本地 woff + `next/font/local`。
- **pip** 加 `-i https://pypi.tuna.tsinghua.edu.cn/simple`；npm 走 `frontend/.npmrc` 的 `registry.npmmirror.com`。
- **端口**: 后端 **8001**（不要 8000），前端 3000。`api.ts:3` 的 `BASE_URL` 已同步。用 `start.ps1` 一键启动，`stop.ps1` 一键停止。
- **bcrypt**: 只用 `import bcrypt`，**不要引入 passlib**（冲突）。
- **勿提交** `.env` / API 密钥 / `venv/` / `node_modules/` / `.service-pids.json`。

## 命令

```bash
# 建库（只需一次）
psql -U postgres -f backend/scripts/init_db.sql

# 初始化管理员（可重复跑，默认 admin / admin123 / role=admin）
cd backend && venv\Scripts\python scripts\init_admin.py

# 一键启停（推荐）
.\start.ps1              # 同时启动后端 8001 + 前端 3000
.\stop.ps1               # 杀所有 python/node 进程

# 或手动启动后端
cd backend && python -m venv venv && venv\Scripts\activate
pip install -i https://pypi.tuna.tsinghua.edu.cn/simple -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8001
# Swagger: http://localhost:8001/docs

# 手动启动前端
cd frontend && npm install && npm run dev
# 管理后台: http://localhost:3000/admin/login（admin / admin123）

# Celery 定时任务
cd backend && celery -A app.core.celery_config worker --loglevel=info
cd backend && celery -A app.core.celery_config beat --loglevel=info

# 测试
cd backend && python -m pytest tests/ -v          # 129 pytest
cd backend && python -m tests.smoke_test           # 端到端 9 API
cd frontend && npm run lint                        # 0 errors
cd frontend && npm run build                       # 22 页面
```

## 关键架构事实

- **路由**: `chat.py` → `_quick_route()` 关键词匹配 → tutor/chat 走真流式，其他走 StateGraph（10 节点 LangGraph）
- **StateGraph**: `intent_recognition → task_planning → conditional_route → 6 Agent → result_aggregation → response_generation`
- **DB JSON 格式**: assistant 消息存 `{"type":"tutor","data":{"answer":"..."}}` 或 `{"type":"multi","data":{"final_response":"..."}}`
- **前端 `loadSession`**: 解析 JSON 提取 `answer` / `final_response`，统一 `rendered=false` 让 `markdownToHtml` 渲染
- **题库出题**: StateGraph exercise 意图 → 保存到 `exercises` 表（去重 + 限容 20 道/知识点）→ 回复追加 `[👉 点击前往题库作答](/tiku?kp=xxx)`
- **MiMo v2.5**: 中国集群 `api-key` 头认证（非 `Authorization: Bearer`），`/chat/completions` 兼容。mimo-v2.5-pro 推理消耗过多 token，降级用 mimo-v2.5
- **防幻觉**: 6 Agent 接 `validate()`（Document/Exercise 走三层，其他走 `skip_llm=True` 快速模式）
- **RAG**: `document_parser → text_chunker → embedding → vector_store.search → reranker`
- **认证**: bcrypt + JWT（HS256，7 天），全 **69** 端点 `Depends(get_current_user)` 门禁
- **手机验证码**: 内存存储 + 5 分钟有效期，控制台 print 模拟短信，注册时校验
- **管理后台**: 独立 token（`zhishu_admin_token`），admin 账号 `role='admin'`，18 管理端点（含 9 Agent 监控 + 文档管理 + 用户删除）
- **Agent 监控**: `agent_metrics.py` 内存计数器 + `threading.Lock` 线程安全，30s 自动刷新
- **并行查询**: `get_stats` 用 `asyncio.gather()` 并行 10 个计数查询，响应速度提升约 50%
- **N+1 优化**: users/resources/paths/chats 列表全部改用 JOIN 子查询
- **页面停留计时**: `hooks/usePageTimer.ts` 自动记录页面停留时长（<3s 不记录），上报到 `learning_records` 表
- **SVG 图标集**: `components/Icon.tsx` 40+ 个图标，统一 `stroke="currentColor"` 风格
- **统一 SSE 工具**: `frontend/src/lib/sse.ts` + `backend/app/core/sse_utils.py`，含 3 次重试 + 指数退避 + 120s 超时
- **评估报告**: 优先读 `evaluation_reports` 缓存表；无缓存则实时调 LLM 生成；Celery 每天 4 点预生成
- **资源中心**: AI 生成 + 手动创建 + 进度动画（4步骤+倒计时）+ 保存功能 + 我的资源（过滤系统自动生成）+ 资源详情（标签页+练习题答案）
- **一键启停**: `start.ps1` + `stop.ps1`，杀所有 python/node 进程解决孤儿 socket

## 踩过的坑（不修会卡住）

| 坑 | 症状 | 解法 |
|---|---|---|
| `.next` 缓存损坏 | `npm run build` 后切 dev 报 `Cannot find module` | 杀 node → 删除 `.next` → 重启 |
| Windows 8000 端口僵尸 | 进程死了端口还占着，taskkill 看不到 | 直接用 8001 |
| PowerShell `$2b$` 插值 | bcrypt 哈希被 shell 解析成变量 | 用 `init_admin.py` 脚本，不要命令行直接传 |
| PowerShell GBK 编码 | LLM 输出 emoji → `UnicodeEncodeError` | `smoke_test.py` 已兜底（`errors="replace"`） |
| pgvector 扩展未装 | Python 包装了但 PG 扩展没装 | embedding 用 JSONB 占位，向量检索降级为 Python 余弦相似度 |
| `chat.py` session 复用 | 流式期间锁住表，写操作 hang | `event_generator` 必须用独立 `async_session()` |
| StateGraph final_state | `astream` 只返回当前节点输出，直接赋值丢之前节点结果 | **必须** `final_state.update(node_output)` 累积 |
| SSE stream 漏 token | 401 全失败 | `chatApi.stream()` / `resourceApi` / `exerciseApi` / `pathApi` 用原生 fetch，**每个都手动加** `Authorization: Bearer ${token}` |
| localStorage key 名 | 登录数据存 `zhishu_student`（JSON 含 `id`），不是 `zhishu_student_id` | `getStudentId()` 从 `zhishu_student` 读取再 `JSON.parse` |
| 对话页刷新丢会话 | `sessionId` 在 React state，刷新即丢 | 已用 localStorage 持久化（`zhishu_chat_session`），挂载时自动恢复 |
| `loadSession` 渲染 | `rendered=true` 跳过 `markdownToHtml`，markdown 原文显示 | 所有历史消息 `rendered=false`，统一走 `markdownToHtml` |
| `chat_messages.content` 截断 | 长回复 JSON 超 10000 字符报错 | 已改 `Text` 类型，迁移：`ALTER TABLE chat_messages ALTER COLUMN content TYPE TEXT` |
| 根 layout 共用 | admin 路由继承学生端 Sidebar/Header | `NO_SHELL_ROUTES` 必须加 `/admin` |
| CSS fadeIn 缺失 | 登录页右侧表单 `opacity:0` 不可见 | `globals.css` 已有 `@keyframes fadeIn` 兜底 |
| DB schema 漂移 | 老 DB 缺 `evaluation_reports` 表 / 新字段 | 跑 `venv\Scripts\python scripts/migrate_schema_drift.py` 幂等修复 |
| regenerate 未删旧缓存 | 重新生成后返回过期数据 | POST 端点必须 `delete where student_id=X and report_date=Y` **再调** LLM |
| Celery import 路径 | `from app.core.celery_config import app` 报错 | celery 必须在 `backend/` 目录下执行 |
| recommendation_service 时区 | `datetime.utcnow()` 与 DB offset-aware 时间比较失败 | 用 `datetime.now(timezone.utc)` 替代 |
| 登录页无法滚动 | body `overflow:hidden` 导致注册表单超长时无法滚动 | `body:has(.login-page){overflow:auto}` CSS 选择器自动解除 |
| 验证码按钮样式丑 | 复用 `.submit-btn` 全黑大按钮与输入框不协调 | 新增 `.code-row` + `.code-btn` 独立样式，深色背景与提交按钮统一 |
| 注册表单展开生硬 | `register-extras` 直接 `display:none/block` 切换无过渡 | 改为 `max-height:0→600px` + `opacity:0→1` 平滑动画 |
| `student_profiles.last_analyzed_at` 列缺失 | 查询 profile 时 500 Internal Server Error | `ALTER TABLE student_profiles ADD COLUMN last_analyzed_at TIMESTAMP WITH TIME ZONE DEFAULT NULL` |
| MiMo `api-key` 头认证 | 用 `Authorization: Bearer` 会 401 | MiMo 中国集群用 `api-key` 头，独立 `mimo_client.py` 实现 |
| MiMo 流式空 choices | `choices[0]` IndexError | `_stream` 方法过滤 `choices is None or len==0` 的 chunk |
| MiMo JSON 输出不完整 | max_tokens 太小导致截断 | exercise_agent max_tokens 2560→4096，_parse_response 加裸数组/缺字段容错 |
| `exercise_bank.created_by` 类型 | UUID vs String(50) 不匹配 | 对齐 DB schema 为 `UUID` 类型 |

## 提交规范

- `feat:` / `fix:` / `refactor:` / `docs:` / `chore:` / `test:` 开头
- 涉及评分项（流式/防幻觉/多智能体/RAG）附 1-2 句说明
- 前端改动需 `npm run lint` 0 errors + `npm run build` 22 页面通过
- 比赛前**必做**：`.env` 改 `LLM_PROVIDER=spark` + 跑 `tests/smoke_test` 验证星火路径
