'use client'

import { useState, useRef, useEffect } from 'react'
import { chatApi } from '@/lib/api'
import { getStudentId } from '@/lib/student'

const initialMessages = [
  {
    role: 'assistant' as const,
    content: `<p>你好，明远。我是<strong>智枢助手</strong>，由多个 AI Agent 协作为你提供学习支持。</p>
<p>我可以帮你：</p>
<ul>
  <li>讲解课程概念，结合你的<strong>学习画像</strong>个性化定制</li>
  <li>生成<strong>思维导图</strong>、<strong>练习题</strong>、<strong>代码示例</strong>等学习资源</li>
  <li>从知识库中<strong>精确检索</strong>并引用教材原文</li>
  <li>规划<strong>个性化学习路径</strong></li>
</ul>
<p style="margin-top:6px;font-size:12px;color:var(--ink-3)">输入问题开始对话，或从右侧推荐问题中选择。</p>`,
  },
  {
    role: 'user' as const,
    content: '什么是 A* 算法？它和 Dijkstra 算法有什么区别？请结合教材内容讲解。',
  },
  {
    role: 'assistant' as const,
    content: `<div class="agent-progress-grid">
  <div class="agent-prog ap-done"><div class="agent-dot"></div><div class="agent-name">RAG 检索</div><div class="agent-status">完成</div></div>
  <div class="agent-prog ap-done"><div class="agent-dot"></div><div class="agent-name">画像分析</div><div class="agent-status">完成</div></div>
  <div class="agent-prog ap-done"><div class="agent-dot"></div><div class="agent-name">文档 Agent</div><div class="agent-status">完成</div></div>
  <div class="agent-prog ap-done"><div class="agent-dot"></div><div class="agent-name">出题 Agent</div><div class="agent-status">完成</div></div>
</div>
<p><strong>A* 算法</strong>是一种启发式搜索算法，用于在加权图中寻找从起点到目标的最优路径。它是对 Dijkstra 算法的优化，通过引入<strong>启发函数</strong>引导搜索方向。</p>
<p><strong>核心公式</strong>：</p>
<div class="codeblk">
  <div class="code-header"><span>数学公式</span></div>
  f(n) = g(n) + h(n)
  其中：
  - g(n)：起点到节点 n 的实际代价
  - h(n)：节点 n 到目标的启发式估计（启发函数）
  - f(n)：节点 n 的综合评估值
</div>
<p><strong>A* 与 Dijkstra 的关键区别</strong>：</p>
<ul>
  <li><strong>搜索策略</strong>：Dijkstra 是"盲目搜索"，均匀向外扩展；A* 通过 h(n) 引导向目标方向搜索</li>
  <li><strong>效率</strong>：在 h(n) 可采纳时，A* 搜索的节点数远少于 Dijkstra</li>
  <li><strong>等价关系</strong>：当 h(n) = 0 时，A* 退化为 Dijkstra 算法</li>
  <li><strong>最优性</strong>：两者都保证最优解（A* 要求 h(n) 是可采纳的）</li>
</ul>
<div class="codeblk">
  <div class="code-header"><span>Python</span><button class="copy-btn">复制</button></div>
<span style="color:#c586c0">import</span> heapq

<span style="color:#c586c0">def</span> <span style="color:#dcdcaa">a_star</span>(graph, start, goal, h):
    open_set = [(h(start), start)]
    came_from = {}
    g_score = {start: <span style="color:#b5cea8">0</span>}

    <span style="color:#c586c0">while</span> open_set:
        _, current = heapq.heappop(open_set)
        <span style="color:#c586c0">if</span> current == goal:
            <span style="color:#c586c0">return</span> reconstruct(came_from, current)

        <span style="color:#c586c0">for</span> neighbor, cost <span style="color:#c586c0">in</span> graph[current]:
            tent_g = g_score[current] + cost
            <span style="color:#c586c0">if</span> tent_g &lt; g_score.get(neighbor, <span style="color:#b5cea8">float</span>(<span style="color:#ce9178">'inf'</span>)):
                came_from[neighbor] = current
                g_score[neighbor] = tent_g
                f = tent_g + h(neighbor)
                heapq.heappush(open_set, (f, neighbor))

    <span style="color:#c586c0">return</span> <span style="color:#ce9178">None</span></div>
<div class="cite">
  引用 — <em>[1]</em> 人工智能导论 · 教材 第3章 搜索算法 P.87-92 &nbsp;
  <em>[2]</em> 人工智能导论 · 课件 第3讲 启发式搜索 &nbsp;
  <em>[3]</em> Russell &amp; Norvig, AIMA, Chapter 3
</div>
<div class="res-chips">
  <div class="res-chip"><div class="chip-icon chip-explain"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div>A* 算法详解</div>
  <div class="res-chip"><div class="chip-icon chip-code"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg></div>A* Python 实现</div>
  <div class="res-chip"><div class="chip-icon chip-exercise"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg></div>配套练习 3 题</div>
</div>
<div class="msg-actions">
  <button class="msg-action-btn" title="复制"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="11" height="11"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> 复制</button>
  <button class="msg-action-btn" title="点赞"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="11" height="11"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"/><path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg></button>
  <button class="msg-action-btn" title="点踩"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="11" height="11"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3H10z"/><path d="M17 2h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/></svg></button>
  <button class="msg-action-btn" title="重新生成"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="11" height="11"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg> 重新生成</button>
</div>`,
  },
  {
    role: 'user' as const,
    content: '帮我生成一个 Transformer 架构的思维导图，再出 3 道相关练习题。',
  },
  {
    role: 'assistant' as const,
    content: `<div class="agent-progress-grid">
  <div class="agent-prog ap-done"><div class="agent-dot"></div><div class="agent-name">RAG 检索</div><div class="agent-status">完成</div></div>
  <div class="agent-prog ap-done"><div class="agent-dot"></div><div class="agent-name">画像分析</div><div class="agent-status">完成</div></div>
  <div class="agent-prog ap-running"><div class="agent-dot"></div><div class="agent-name">思维导图 Agent</div><div class="agent-status">生成中</div></div>
  <div class="agent-prog ap-waiting"><div class="agent-dot"></div><div class="agent-name">出题 Agent</div><div class="agent-status">等待中</div></div>
</div>
<div class="stream-progress">
  <div class="sp-top"><span>思维导图 Agent</span><span>65%</span></div>
  <div class="sp-track"><div class="sp-fill" style="width:65%"></div></div>
  <div class="sp-step"><div class="spinner"></div>正在构建 Transformer 架构知识图谱...</div>
</div>
<p><strong>Transformer</strong> 是由 Vaswani 等人于 2017 年提出的基于<strong>自注意力机制</strong>的序列到序列模型，彻底改变了 NLP 领域。</p>
<p>核心结构包括：<span class="typing"><span></span><span></span><span></span></span></p>`,
  },
]

const suggestions = [
  { text: 'Transformer 自注意力机制', tag: 'NLP', tagClass: 'tag-info' },
  { text: 'CNN 卷积神经网络原理', tag: 'CV', tagClass: 'tag-green' },
  { text: '监督学习 vs 无监督学习', tag: 'ML', tagClass: 'tag-dark' },
  { text: '机器学习练习题', tag: '练习', tagClass: 'tag-warm' },
]

const genResources = [
  { name: 'A* 算法详解 · 文档', status: 'done' },
  { name: 'A* Python 实现 · 代码', status: 'done' },
  { name: '搜索算法练习 · 出题', status: 'done' },
  { name: 'Transformer 思维导图', status: 'running' },
  { name: 'Transformer 练习题', status: 'waiting' },
]

export default function DuihuaPage() {
  const [messages, setMessages] = useState(initialMessages)
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [status, setStatus] = useState('')
  const msgsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (msgsRef.current) {
      msgsRef.current.scrollTop = msgsRef.current.scrollHeight
    }
  }, [messages])

  const sendMessage = () => {
    if (!input.trim() || streaming) return
    const userMsg = input.trim()
    setMessages((prev) => [...prev, { role: 'user', content: userMsg }, { role: 'assistant', content: '<i style="color:#999">思考中...</i>' }])
    setInput('')
    setStreaming(true)
    setStatus('正在分析请求...')

    let resultData: any = null
    chatApi.stream(
      getStudentId(),
      userMsg,
      (e) => {
        if (e.type === 'session') setSessionId(e.session_id || null)
        if (e.type === 'progress' && e.message) setStatus(e.message)
        if (e.type === 'result') resultData = e.data
        if (e.type === 'done' || e.type === 'error') {
          setStreaming(false)
          setStatus('')
          if (e.type === 'error') {
            setMessages((prev) => {
              const arr = [...prev]
              arr[arr.length - 1] = { role: 'assistant', content: `<p style="color:red">❌ ${e.message || '调用失败'}</p>` }
              return arr
            })
          } else if (resultData) {
            // 把结果渲染成 HTML
            const data = resultData.data || resultData
            let html = ''
            if (resultData.type === 'tutor' || data.answer) {
              html = `<div><p>${data.answer || ''}</p>${data.suggestion ? `<div style="margin-top:8px;padding:8px;background:#f0f8e8;border-radius:6px;font-size:12px">💡 ${data.suggestion}</div>` : ''}</div>`
            } else if (resultData.type === 'exercise' || data.exercises) {
              const list = data.exercises || []
              html = `<p>📝 为你生成了 <strong>${list.length}</strong> 道题：</p><ul>${list.map((e: any) => `<li>${e.question}</li>`).join('')}</ul>`
            } else if (resultData.type === 'document' || data.knowledge) {
              html = `<div>${data.knowledge || JSON.stringify(data)}</div>`
            } else if (resultData.type === 'path') {
              html = `<p>📚 路径: ${data.title || ''}</p><p>${data.description || ''}</p><p>共 ${data.nodes?.length || 0} 个知识点</p>`
            } else if (resultData.type === 'chat' || data.answer) {
              html = `<p>${data.answer || ''}</p>`
            } else {
              html = `<pre>${JSON.stringify(data, null, 2)}</pre>`
            }
            setMessages((prev) => {
              const arr = [...prev]
              arr[arr.length - 1] = { role: 'assistant', content: html }
              return arr
            })
          }
        }
      },
      { session_id: sessionId || undefined }
    )
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="chat-page" style={{ padding: '16px 20px', height: 'calc(100vh - var(--header-h))' }}>
      {/* ═══ Chat Main ═══ */}
      <div className="chat-main">
        <div className="chat-hd">
          <div className="agent-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 8V4H8" />
              <rect x="2" y="2" width="20" height="8" rx="2" />
              <path d="M6 12v4a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-4" />
            </svg>
          </div>
          <div className="meta">
            <h4>智枢助手</h4>
            <p>多智能体 · 画像驱动 · RAG 检索增强</p>
          </div>
          <div className="status">
            <div className="status-dot"></div>在线
          </div>
        </div>

        <div className="session-bar">
          <div className="session-tab active">对话 1 · A*算法</div>
          <div className="session-tab">对话 2 · Transformer</div>
          <div className="session-tab">对话 3 · CNN导图</div>
          <div className="session-new" title="新建对话">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </div>
        </div>

        <div className="chat-msgs" ref={msgsRef}>
          {messages.map((msg, i) => (
            <div key={i} className={`msg ${msg.role}`}>
              <div className="av">{msg.role === 'assistant' ? 'AI' : '张'}</div>
              <div
                className="bubble"
                dangerouslySetInnerHTML={{ __html: msg.content }}
              />
            </div>
          ))}
        </div>

        <div className="chat-in">
          <textarea
            rows={1}
            placeholder="输入你的问题… (Enter 发送，Shift+Enter 换行)"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            style={{ resize: 'none' }}
          />
          <button
            className="chat-send"
            onClick={sendMessage}
            disabled={!input.trim()}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
      </div>

      {/* ═══ Right Panel ═══ */}
      <div className="chat-side">
        <div className="side-card">
          <div className="sc-hd">
            <h3>推荐问题</h3>
            <span className="tag tag-warm">为你推荐</span>
          </div>
          <div className="sc-bd">
            {suggestions.map((s, i) => (
              <div
                key={i}
                className="suggest"
                onClick={() => setInput(s.text)}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <span className="sug-text">{s.text}</span>
                <span className={`sug-tag ${s.tagClass}`}>{s.tag}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="side-card">
          <div className="sc-hd">
            <h3>当前上下文</h3>
          </div>
          <div className="sc-bd">
            <div style={{ fontSize: '11px', color: 'var(--ink-4)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '.6px' }}>关联知识点</div>
            <div className="knowledge-pills">
              <div className="kp">搜索算法</div>
              <div className="kp">A* 算法</div>
              <div className="kp">启发函数</div>
              <div className="kp">最短路径</div>
              <div className="kp">图搜索</div>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--ink-4)', margin: '14px 0 8px', textTransform: 'uppercase', letterSpacing: '.6px' }}>学习画像匹配</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--ink-2)' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--warm)' }}></div>
              <span>你的搜索算法掌握度 <strong>72%</strong></span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--ink-2)', marginTop: '6px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--success)' }}></div>
              <span>已生成 3 份相关资源</span>
            </div>
          </div>
        </div>

        <div className="side-card" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div className="sc-hd">
            <h3>已生成资源</h3>
            <span className="tag tag-green">实时</span>
          </div>
          <div className="sc-bd" style={{ flex: 1, overflowY: 'auto' }}>
            {genResources.map((r, i) => (
              <div key={i} className="gen-resource">
                <div
                  className="gr-dot"
                  style={{
                    background:
                      r.status === 'done'
                        ? 'var(--success)'
                        : r.status === 'running'
                        ? 'var(--warm)'
                        : undefined,
                  }}
                ></div>
                <span>{r.name}</span>
                <span className={`gr-status gs-${r.status}`}>
                  {r.status === 'done' ? '完成' : r.status === 'running' ? '生成中' : '等待'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
