# AGENTS.md — 智枢 (ZhiShu)

中国软件杯 A3 赛题：多智能体个性化学习资源生成系统。详细架构见 `CLAUDE.md`，设计文档见 `docs/设计文档/`，进度见 `开发进度.md`。

## 硬约束

- **LLM**：开发用 MiniMax-M3（`.env` 配 `MINIMAX_API_KEY`），比赛上线前切讯飞星火 V4：`LLM_PROVIDER=spark` + `SPARK_API_KEY=xxx`
- **讯飞鉴权**：`Authorization: Bearer {api_key}`，**不拼 api_secret**
- **禁用** Google Fonts / Vercel / Sentry / OpenAI（中国不可达）。字体走 `frontend/src/app/fonts/` 本地 woff + `next/font/local`
- **pip** 加 `-i https://pypi.tuna.tsinghua.edu.cn/simple`；npm 已配 `npmmirror`（`frontend/.npmrc`）
- **勿提交** `.env` / API 密钥 / `venv/` / `node_modules/`

## 命令

```bash
# 数据库初始化（只需一次）
psql -U postgres -f backend/scripts/init_db.sql

# 后端（Swagger: http://localhost:8001/docs）
cd backend && python -m venv venv && venv\Scripts\activate
pip install -i https://pypi.tuna.tsinghua.edu.cn/simple -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8001   # 必须 8001

# 测试（119 pytest，需 PG 5432 + Redis 6379）
cd backend && python -m pytest tests/test_*.py -v

# 端到端冒烟测试 (9 API)
cd backend && python -m tests.smoke_test

# 前端（http://localhost:3000）
cd frontend && npm install && npm run dev / build / lint
```

## 踩过的坑（不修会卡住）

- **`.next` 缓存损坏**：`npm run build` 后切 `npm run dev` 报 `Cannot find module` → 杀 node → `Remove-Item frontend/.next -Recurse` → 重启。
- **Windows 8000 端口僵尸 socket**：进程死后端口还被内核占着，taskkill 看不到。**直接用 8001**，同步改 `frontend/src/lib/api.ts:5` BASE_URL。
- **MiniMax base URL**：`https://api.minimax.chat/v1`（没有 `i`，不是 `minimaxi`）。
- **pgvector 扩展未装**：Python 包已装，PostgreSQL 扩展未装。`embedding` 暂用 JSONB 占位，向量检索降级为 Python 余弦相似度。
- **PowerShell 终端 GBK**：LLM 输出含 emoji 会让 `print` 报 `UnicodeEncodeError`。smoke_test 脚本已用 `io.TextIOWrapper(..., errors="replace")` 兜底。
- **CRLF/LF 警告**：Windows 正常现象，不要修。
- **`chat.py` event_generator 必须独立 `async_session()`**：复用请求 session 会导致流式期间锁住表，写操作 hang。
- **`passlib` + `bcrypt` 版本不兼容**：passlib 的 bcrypt 后端跟新版 bcrypt 冲突。直接用 `bcrypt` 库，不用 passlib。
- **`.next` 缓存 + `.next/static/css` 动画缺失**：`globals.css` 缺 `@keyframes fadeIn` 导致登录页右侧表单 `opacity:0` 不可见。加 keyframes 定义即可。
- **`chat.py` StateGraph `final_state` 累积 bug**：`astream` 只返回每个节点的输出，`final_state = node_output` 会丢失之前节点的结果。必须用 `final_state.update(node_output)` 累积。见 `chat.py:213-229`。
- **SSE stream 方法漏带 token**：`chatApi.stream()` / `resourceApi.generateStream()` / `exerciseApi.generateStream()` / `pathApi.generateStream()` 用原生 `fetch` 没带 `Authorization` 头，401 全部失败。每个 stream 方法都要手动加 `token`。
- **`student.ts` localStorage key**：登录数据存在 `zhishu_student`（JSON 对象含 `id`），不是 `zhishu_student_id`（随机 UUID）。`getStudentId()` 必须从 `zhishu_student` 读取。

## 架构要点

- **9 router / 27 唯一 API / 8 Agent / 9 Model / 12 Service / 119 pytest**
- **请求路由**：`_quick_route()` 关键词匹配 → 匹配到走对应 handler，没匹配到走 StateGraph（Master Agent）。短消息（<15字）默认走 tutor 真流式。
- **StateGraph 多智能体编排**（`backend/app/agents/master_agent.py`）：13 节点 LangGraph StateGraph（intent_recognition → task_planning → conditional_route → 7 子 Agent → result_aggregation → response_generation）。`tutor/chat` 走原路径真逐 token 流式，其他意图走 StateGraph。
- **多轮对话上下文**：`_handle_tutor_chat_stream` 和 `tutor_agent.answer()` 都传 `history`（最近 10 条）给 LLM。assistant 消息在 DB 里是 JSON，需要解析出 `answer` 字段。
- **`<think>` 标签过滤**：流式期间必须用 `_strip_think` 状态机，否则会吞前端渲染。
- **防幻觉**：6 个 Agent 都接 `anti_hallucination.validate()`（Document/Exercise 走完整三层，Profile/Path/MindMap/Tutor 走 `skip_llm=True` 快速模式）。
- **RAG**：`tutor.py` 的 `/ask` 和 `chat/stream` 的 tutor 分支都走 embedding + vector_store.search + reranker，`document_chunks` 表 embedding 用 JSONB 占位。
- **SSE 流式**：4 个真流式端点 + 1 个伪流式端点。所有 stream 方法必须手动加 `Authorization` 头。
- **登录注册**：`bcrypt` 密码哈希 + `JWT` 验证（`core/security.py`），全 24 个业务端点加 `get_current_user` 门禁。前端 `api.ts` 的 `request()` 自动带 token，401 自动跳登录页。`/auth/login` 和 `/auth/register` 不触发 401 自动跳转。
- **会话删除**：`DELETE /chat/sessions/{session_id}` 删会话及所有消息，含所有权校验。

## P1 未修（注意）

- `chat_message.content` 存 JSON 字符串 → 历史消息显示原始 JSON
- `markdownToHtml` 不消毒 → XSS 风险 6 处
- 3 套 `Resource` / `Exercise` 类型定义漂移
- 13 处 `alert()`
- `print()` 代替 logging（10+ 处）
- 防幻觉正则太激进
- `profile_agent` 调 LLM 报 `'HumanMessage' object is not subscriptable`

## 提交规范

`feat:` / `fix:` / `refactor:` / `docs:` / `chore:` / `test:`。涉及评分项（流式/防幻觉/多智能体）的改动附 1-2 句说明。
