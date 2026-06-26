# AGENTS.md — 智枢 (ZhiShu)

中国软件杯 A3 赛题：多智能体个性化学习资源生成系统。

**首次进入**：先读 `CLAUDE.md`（架构 + 已修复 + 技术栈），再看 `开发进度.md`（实时进度）。

## 硬约束

- **LLM**：开发用 MiniMax-M3，base_url `https://api.minimax.chat/v1`（**没有 `i`**，不是 `minimaxi`）。比赛前切星火：`LLM_PROVIDER=spark` + `SPARK_API_KEY=xxx`。讯飞鉴权只用 `Authorization: Bearer {api_key}`，不拼 api_secret。
- **禁用** Google Fonts / Vercel / Sentry / OpenAI（中国不可达）。字体走 `frontend/src/app/fonts/` 本地 woff + `next/font/local`。
- **pip** 加 `-i https://pypi.tuna.tsinghua.edu.cn/simple`；npm 走 `frontend/.npmrc` 的 `registry.npmmirror.com`。
- **端口**：后端 **8001**（不要 8000），前端 3000。`api.ts:3` 的 `BASE_URL` 已同步。`start_backend.ps1` 写死了 8000 和旧路径，**不要用**。
- **bcrypt**：只用 `import bcrypt`，**不要引入 passlib**（冲突）。
- **勿提交** `.env` / API 密钥 / `venv/` / `node_modules/`。

## 命令

```bash
# 建库（只需一次）
psql -U postgres -f backend/scripts/init_db.sql

# 初始化管理员（可重复跑，默认 admin / admin123 / role=admin）
cd backend && venv\Scripts\python scripts\init_admin.py

# 后端
cd backend && python -m venv venv && venv\Scripts\activate
pip install -i https://pypi.tuna.tsinghua.edu.cn/simple -r requirements.txt
# 首次安装会自动装 bcrypt>=4.0.0，旧 venv 可能缺
uvicorn app.main:app --reload --host 0.0.0.0 --port 8001
# Swagger: http://localhost:8001/docs

# 前端（必须先起后端，否则登录报网络错误）
cd frontend && npm install && npm run dev
# 管理后台: http://localhost:3000/admin/login（admin / admin123）

# 测试
cd backend && python -m pytest tests/ -v          # 114 pytest
cd backend && python -m tests.smoke_test           # 端到端 9 API（5-10 分钟，需后端已启动 + PG 5432）
cd frontend && npm run lint                        # 0 errors
cd frontend && npm run build                       # 18 页面
```

## 踩过的坑（不修会卡住）

| 坑 | 症状 | 解法 |
|---|---|---|
| `.next` 缓存损坏 | `npm run build` 后切 dev 报 `Cannot find module` | 杀 node → `Remove-Item frontend/.next -Recurse` → 重启 |
| Windows 8000 端口僵尸 | 进程死了端口还占着，taskkill 看不到 | 直接用 8001，同步改 `api.ts:3` 的 `BASE_URL` |
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
| DB schema 漂移 | 老 DB 缺 `exercise_bank` 表 / `exercises.source` 列 / `resources.is_preset` 列 | 删库重建：`DROP DATABASE zhishu` + 重跑 `init_db.sql` |

## 关键架构事实

- **路由**：`chat.py` → `_quick_route()` 关键词匹配 → tutor/chat 走真流式，其他走 StateGraph（10 节点 LangGraph）
- **StateGraph**：`intent_recognition → task_planning → conditional_route → 6 Agent → result_aggregation → response_generation`
- **DB JSON 格式**：assistant 消息存 `{"type":"tutor","data":{"answer":"..."}}` 或 `{"type":"multi","data":{"final_response":"..."}}`
- **前端 `loadSession`**：解析 JSON 提取 `answer` / `final_response`，统一 `rendered=false` 让 `markdownToHtml` 渲染
- **题库出题**：StateGraph exercise 意图 → 保存到 `exercises` 表（去重 + 限容 20 道/知识点）→ 回复追加 `[👉 点击前往题库作答](/tiku?kp=xxx)`
- **防幻觉**：6 Agent 接 `validate()`（Document/Exercise 走三层，其他走 `skip_llm=True` 快速模式）
- **RAG**：`document_parser → text_chunker → embedding → vector_store.search → reranker`
- **认证**：bcrypt + JWT（HS256，7 天），全 33 端点 `Depends(get_current_user)` 门禁
- **管理后台**：独立 token（`zhishu_admin_token`），admin 账号 `role='admin'`，题库 CRUD 6 端点
- **页面停留计时**：`hooks/usePageTimer.ts` 自动记录页面停留时长（<3s 不记录），上报到 `learning_records` 表
- **Robot 图标**：`components/RobotIcon.tsx` 极简 SVG（天线 + 圆眼 + 微笑弧线嘴），用于 AI 生成按钮

## 提交规范

- `feat:` / `fix:` / `refactor:` / `docs:` / `chore:` / `test:` 开头
- 涉及评分项（流式/防幻觉/多智能体/RAG）附 1-2 句说明
- 前端改动需 `npm run lint` 0 errors + `npm run build` 18 页面通过
- 比赛前**必做**：`.env` 改 `LLM_PROVIDER=spark` + 跑 `tests/smoke_test` 验证星火路径
