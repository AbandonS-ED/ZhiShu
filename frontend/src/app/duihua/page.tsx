'use client'

import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { chatApi, profileApi, evaluationApi, resourceApi, type StudentProfile } from '@/lib/api'
import { getStudentId } from '@/lib/student'
import { escapeHtml, markdownToHtml, extractAnswer } from '@/lib/utils'

// Mermaid 渲染组件（客户端动态加载）
let mermaid: any = null
let mermaidReady = false

async function initMermaid() {
  if (mermaidReady) return
  try {
    mermaid = (await import('mermaid')).default
    mermaid.initialize({ startOnLoad: false, theme: 'default', securityLevel: 'loose' })
    mermaidReady = true
  } catch {}
}

function MermaidDiagram({ code, id }: { code: string; id: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [svg, setSvg] = useState('')

  useEffect(() => {
    let cancelled = false
    const render = async () => {
      await initMermaid()
      if (!mermaid || cancelled || !ref.current) return
      try {
        const { svg: result } = await mermaid.render(`mermaid-${id}`, code)
        if (!cancelled) setSvg(result)
      } catch {
        if (!cancelled) setSvg(`<pre style="color:red;font-size:12px">${escapeHtml(code)}</pre>`)
      }
    }
    render()
    return () => { cancelled = true }
  }, [code, id])

  return <div ref={ref} dangerouslySetInnerHTML={{ __html: svg }} style={{ overflow: 'auto', margin: '8px 0' }} />
}

interface ChatMsg {
  role: 'user' | 'assistant'
  content: string
  rendered?: boolean
}

interface Session {
  id: string
  title: string
  created_at: string
}

interface GenResource {
  name: string
  status: 'done' | 'running' | 'waiting'
}

const SESSION_STORAGE_KEY = 'zhishu_chat_session'

const defaultSuggestions = [
  { text: '讲解 A* 搜索算法的原理', tag: '搜索', tagClass: 'tag-info' },
  { text: 'CNN 卷积神经网络原理', tag: 'CV', tagClass: 'tag-green' },
  { text: '监督学习 vs 无监督学习', tag: 'ML', tagClass: 'tag-dark' },
  { text: '出 5 道搜索算法练习题', tag: '练习', tagClass: 'tag-warm' },
]

export default function DuihuaPage() {
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [status, setStatus] = useState('')

  const [sessions, setSessions] = useState<Session[]>([])
  const [profile, setProfile] = useState<StudentProfile | null>(null)
  const [genResources, setGenResources] = useState<GenResource[]>([])
  const [dbResources, setDbResources] = useState<Array<{ resource_id: string; title: string; knowledge_point: string; resource_type: string; created_at: string }>>([])

  const msgsRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<(() => void) | null>(null)
  const studentId = getStudentId()
  const loadedSessionRef = useRef(false)

  // 组件卸载时中断 SSE
  useEffect(() => {
    return () => { if (abortRef.current) abortRef.current() }
  }, [])

  // 消息变化时保持在底部（无动画）
  useEffect(() => {
    if (msgsRef.current) {
      msgsRef.current.scrollTop = msgsRef.current.scrollHeight
    }
  }, [messages])

  // 加载会话列表 + 自动恢复上次会话
  useEffect(() => {
    chatApi.getSessions(studentId).then((list) => {
      setSessions(list)
      // 自动恢复上次会话
      if (!loadedSessionRef.current) {
        loadedSessionRef.current = true
        const savedSid = localStorage.getItem(SESSION_STORAGE_KEY)
        if (savedSid && list.some((s) => s.id === savedSid)) {
          loadSession(savedSid)
        }
      }
    }).catch(() => {})
  }, [studentId])

  // 加载画像（右侧知识点）
  useEffect(() => {
    profileApi.getMe().then(setProfile).catch(() => {})
  }, [studentId])

  // 加载资源列表（右侧已生成资源）
  useEffect(() => {
    resourceApi.list(studentId).then(setDbResources).catch(() => {})
  }, [studentId])

  // 切换会话时加载历史消息
  const loadSession = useCallback(async (sid: string) => {
    setSessionId(sid)
    localStorage.setItem(SESSION_STORAGE_KEY, sid)
    setMessages([])
    setGenResources([])
    try {
      const msgs = await chatApi.getMessages(sid)
      setMessages(msgs.map((m) => {
        let content = m.content
        // assistant 消息在 DB 里是 JSON，需要解析出 answer/final_response
        if (m.role === 'assistant') {
          try {
            const data = JSON.parse(content)
            const inner = data.data || data
            if (inner.answer) {
              content = inner.answer
            } else if (inner.final_response) {
              content = inner.final_response
            }
          } catch {
            // JSON 解析失败（截断/格式异常），尝试从纯文本中提取可读内容
            content = content.replace(/<think>[\s\S]*?<\/think>/g, '').trim()
          }
          // 统一 strip <think> 标签残留
          content = content.replace(/<think>[\s\S]*?<\/think>/g, '').replace(/<\/?think>/g, '').trim()
        }
        // rendered 始终 false → 让渲染代码统一走 markdownToHtml
        return { role: m.role as 'user' | 'assistant', content, rendered: false }
      }))
      // 消息加载完成后，延迟滚动到底部
      setTimeout(() => {
        if (msgsRef.current) {
          msgsRef.current.scrollTop = msgsRef.current.scrollHeight
        }
      }, 100)
    } catch {
      // 会话可能没有历史消息
    }
  }, [])

  // 新建会话
  const newSession = () => {
    setSessionId(null)
    localStorage.removeItem(SESSION_STORAGE_KEY)
    setMessages([])
    setGenResources([])
  }

  // 删除会话
  const deleteSession = async (sid: string, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await chatApi.deleteSession(sid)
      setSessions((prev) => prev.filter((s) => s.id !== sid))
      if (sessionId === sid) {
        setSessionId(null)
        setMessages([])
        setGenResources([])
      }
    } catch {}
  }

  const sendMessage = () => {
    if (!input.trim() || streaming) return
    const userMsg = input.trim()
    setMessages((prev) => [...prev, { role: 'user', content: escapeHtml(userMsg) }])
    setInput('')
    setStreaming(true)
    setStatus('正在分析请求...')

    // 添加一个空的 assistant 消息占位，后续 token 逐字追加
    setMessages((prev) => [...prev, { role: 'assistant', content: '' }])

    let resultData: any = null
    let streamContent = ''

    abortRef.current = chatApi.stream(
      studentId,
      userMsg,
      (e) => {
        if (e.type === 'session') {
          const newSid = e.session_id || null
          if (newSid) {
            setSessionId(newSid)
            localStorage.setItem(SESSION_STORAGE_KEY, newSid)
            chatApi.getSessions(studentId).then(setSessions).catch(() => {})
          }
        }
        if (e.type === 'progress' && e.message) setStatus(e.message)

        // 逐 token 追加到当前 assistant 消息（存原始 markdown，显示时再渲染）
        if (e.type === 'token' && e.content) {
          streamContent += e.content
          setMessages((prev) => {
            const arr = [...prev]
            arr[arr.length - 1] = { role: 'assistant', content: streamContent }
            return arr
          })
        }

        if (e.type === 'result') resultData = e.data

        if (e.type === 'done' || e.type === 'error') {
          setStreaming(false)
          setStatus('')
          evaluationApi.recordAction({
            student_id: studentId,
            action: 'chat',
            resource_type: 'chat',
            knowledge_point: userMsg,
          }).catch(() => {})
          if (e.type === 'error') {
            setMessages((prev) => {
              const arr = [...prev]
              arr[arr.length - 1] = { role: 'assistant', content: `<p style="color:red">❌ ${escapeHtml(e.message || '调用失败')}</p>`, rendered: true }
              return arr
            })
          } else if (resultData) {
            // 流式已通过 token 事件渲染完毕，这里只处理非流式结果（document/exercise/path/mindmap）
            const data = resultData.data || resultData
            // 如果没有 token 内容（非流式 Agent），渲染完整结果
            if (!streamContent) {
              let html = ''
              if (resultData.type === 'exercise' || data.exercises) {
                const list = data.exercises || []
                html = `<p>📝 为你生成了 <strong>${list.length}</strong> 道题：</p><ul>${list.map((ex: any) => `<li>${markdownToHtml(ex.question || '')}</li>`).join('')}</ul>`
                if (data.jump_link) {
                  html += `<p style="margin-top:8px">${markdownToHtml(data.jump_link)}</p>`
                }
                setGenResources((prev) => [...prev, { name: `${userMsg} · 练习题`, status: 'done' }])
              } else if (resultData.type === 'tutor' || resultData.type === 'chat' || data.answer) {
                const { answer: ans, suggestion: sug } = extractAnswer(data)
                html = `<div>${markdownToHtml(ans)}${sug ? `<div style="margin-top:8px;padding:8px;background:#f0f8e8;border-radius:6px;font-size:12px">💡 ${markdownToHtml(sug)}</div>` : ''}</div>`
              } else if (resultData.type === 'document' || data.knowledge) {
                html = `<div>${markdownToHtml(data.knowledge || JSON.stringify(data))}</div>`
                setGenResources((prev) => [...prev, { name: `${userMsg} · 文档`, status: 'done' }])
                // 自动保存到资源中心
                resourceApi.saveFromChat(studentId, `${userMsg} 学习材料`, 'knowledge', { knowledge: data.knowledge || '' }, userMsg)
                  .then(() => resourceApi.list(studentId).then(setDbResources))
                  .catch(() => {})
              } else if (resultData.type === 'mindmap') {
                html = `<div><p>🧠 思维导图已生成：</p><pre style="background:#f5f5f5;padding:8px;border-radius:4px;font-size:12px;overflow-x:auto">${data.mermaid || data.code || ''}</pre></div>`
                setGenResources((prev) => [...prev, { name: `${userMsg} · 思维导图`, status: 'done' }])
                // 自动保存到资源中心
                resourceApi.saveFromChat(studentId, `${userMsg} 思维导图`, 'mindmap', { mermaid_code: data.mermaid || data.code || '' }, userMsg)
                  .then(() => resourceApi.list(studentId).then(setDbResources))
                  .catch(() => {})
              } else if (resultData.type === 'path') {
                html = `<p>📚 路径: ${data.title || ''}</p><p>${data.description || ''}</p><p>共 ${data.nodes?.length || 0} 个知识点</p>`
                setGenResources((prev) => [...prev, { name: `${userMsg} · 学习路径`, status: 'done' }])
              } else {
                html = `<pre>${JSON.stringify(data, null, 2)}</pre>`
              }
              setMessages((prev) => {
                const arr = [...prev]
                arr[arr.length - 1] = { role: 'assistant', content: html, rendered: true }
                return arr
              })
            } else if (streamContent) {
              // 流式已完成，把原始 markdown 渲染为 HTML
              let renderedHtml = markdownToHtml(streamContent)
              // 追加跳转链接（exercise 意图）
              if (data.jump_link) {
                renderedHtml += `<p style="margin-top:12px;padding:10px;background:var(--brand-soft);border-radius:6px;border:1px solid var(--brand)">${markdownToHtml(data.jump_link)}</p>`
              }
              if (data.suggestion) {
                const { answer: sugText } = extractAnswer({ answer: data.suggestion })
                setMessages((prev) => {
                  const arr = [...prev]
                  arr[arr.length - 1] = {
                    role: 'assistant',
                    content: renderedHtml + `<div style="margin-top:8px;padding:8px;background:#f0f8e8;border-radius:6px;font-size:12px">💡 ${markdownToHtml(sugText)}</div>`,
                    rendered: true
                  }
                  return arr
                })
              } else {
                setMessages((prev) => {
                  const arr = [...prev]
                  arr[arr.length - 1] = { role: 'assistant', content: renderedHtml, rendered: true }
                  return arr
                })
              }
            }
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

  // 从画像提取知识点列表和薄弱环节
  const knowledgePoints: string[] = profile?.dimensions
    ? Object.entries(profile.dimensions)
        .filter(([, v]) => v && typeof v === 'object' && (v as { score?: number }).score !== undefined)
        .map(([k]) => k)
    : []

  const weakTopics: string[] = profile?.dimensions?.weak_topics
    ? (profile.dimensions.weak_topics as string[])
    : profile?.dimensions
      ? Object.entries(profile.dimensions)
          .filter(([, v]) => v && typeof v === 'object' && (v as { score?: number }).score !== undefined && (v as { score: number }).score < 40)
          .map(([k]) => k)
      : []

  // 根据画像薄弱环节动态生成推荐问题
  const dynamicSuggestions = (() => {
    const base = [
      { text: '讲解 A* 搜索算法的原理', tag: '搜索', tagClass: 'tag-info' },
      { text: 'CNN 卷积神经网络原理', tag: 'CV', tagClass: 'tag-green' },
      { text: '监督学习 vs 无监督学习', tag: 'ML', tagClass: 'tag-dark' },
      { text: '出 5 道搜索算法练习题', tag: '练习', tagClass: 'tag-warm' },
    ]
    if (weakTopics.length > 0) {
      const weakSuggestions = weakTopics.slice(0, 2).map((t) => ({
        text: `讲解${t}的核心概念`,
        tag: '薄弱',
        tagClass: 'tag-warm',
      }))
      return [...weakSuggestions, ...base.slice(0, 4 - weakSuggestions.length)]
    }
    return base
  })()

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

        {/* 会话标签 */}
        <div className="session-bar">
          {sessions.length > 0 ? (
            sessions.slice(0, 5).map((s) => (
              <div
                key={s.id}
                className={`session-tab${sessionId === s.id ? ' active' : ''}`}
                onClick={() => loadSession(s.id)}
              >
                <span className="session-tab-text">{s.title || `对话 ${s.id.slice(0, 6)}`}</span>
                <button
                  className="session-tab-del"
                  onClick={(e) => deleteSession(s.id, e)}
                  title="删除对话"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="12" height="12">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            ))
          ) : (
            <div className="session-tab active">新对话</div>
          )}
          <div className="session-new" title="新建对话" onClick={newSession}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </div>
        </div>

        {/* 消息列表 */}
        <div className="chat-msgs" ref={msgsRef}>
          {messages.length === 0 && (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--ink-4)' }}>
              <div style={{ fontSize: '40px', marginBottom: '12px' }}>💬</div>
              <p style={{ fontSize: '14px', fontWeight: 500, color: 'var(--ink-2)' }}>开始你的学习对话</p>
              <p style={{ fontSize: '12px', marginTop: '6px' }}>输入问题，或从右侧推荐问题中选择</p>
            </div>
          )}
          {messages.map((msg, i) => {
            // 检测 mermaid 代码块
            const mermaidMatch = msg.content?.match(/```mermaid\n([\s\S]*?)```/)
            const hasMermaid = mermaidMatch && msg.role === 'assistant'

            return (
            <div key={i} className={`msg ${msg.role}`}>
              <div className="av">{msg.role === 'assistant' ? 'AI' : '我'}</div>
              <div className="bubble">
                {hasMermaid ? (
                  <>
                    <div dangerouslySetInnerHTML={{ __html: markdownToHtml(msg.content.replace(/```mermaid\n[\s\S]*?```/g, '')) }} />
                    <MermaidDiagram code={mermaidMatch![1]} id={`msg-${i}`} />
                  </>
                ) : (
                  <div dangerouslySetInnerHTML={{ __html: msg.rendered ? msg.content : markdownToHtml(msg.content) }} />
                )}
                {msg.role === 'assistant' && msg.content && (
                  <div className="msg-actions" style={{ display: 'flex', gap: 2, marginTop: 8 }}
                  >
                    <button
                      onClick={() => {
                        const text = msg.content.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim()
                        navigator.clipboard.writeText(text).then(() => {
                          const btn = document.getElementById(`copy-btn-${i}`)
                          if (btn) {
                            btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12"><polyline points="20 6 9 17 4 12"/></svg>'
                            btn.style.color = 'var(--success)'
                            setTimeout(() => {
                              btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>'
                              btn.style.color = ''
                            }, 1500)
                          }
                        })
                      }}
                      id={`copy-btn-${i}`}
                      className="msg-action-btn"
                      title="复制"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12">
                        <rect x="9" y="9" width="13" height="13" rx="2"/>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                      </svg>
                    </button>
                    <button
                      onClick={() => {
                        const btn = document.getElementById(`like-btn-${i}`)
                        const dislikeBtn = document.getElementById(`dislike-btn-${i}`)
                        const isActive = btn?.classList.toggle('active')
                        if (isActive) {
                          btn.style.color = 'var(--brand)'
                          btn.style.background = 'var(--brand-soft)'
                          if (dislikeBtn) { dislikeBtn.style.color = ''; dislikeBtn.style.background = ''; dislikeBtn.classList.remove('active') }
                          evaluationApi.recordAction({ student_id: studentId, action: 'like', resource_type: 'chat', knowledge_point: 'feedback' }).catch(() => {})
                        } else {
                          btn.style.color = ''
                          btn.style.background = ''
                        }
                      }}
                      id={`like-btn-${i}`}
                      className="msg-action-btn"
                      title="有帮助"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12">
                        <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>
                      </svg>
                    </button>
                    <button
                      onClick={() => {
                        const btn = document.getElementById(`dislike-btn-${i}`)
                        const likeBtn = document.getElementById(`like-btn-${i}`)
                        const isActive = btn?.classList.toggle('active')
                        if (isActive) {
                          btn.style.color = 'var(--danger)'
                          btn.style.background = 'var(--danger-soft)'
                          if (likeBtn) { likeBtn.style.color = ''; likeBtn.style.background = ''; likeBtn.classList.remove('active') }
                          evaluationApi.recordAction({ student_id: studentId, action: 'dislike', resource_type: 'chat', knowledge_point: 'feedback' }).catch(() => {})
                        } else {
                          btn.style.color = ''
                          btn.style.background = ''
                        }
                      }}
                      id={`dislike-btn-${i}`}
                      className="msg-action-btn"
                      title="需要改进"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12">
                        <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/>
                      </svg>
                    </button>
                    <button
                      onClick={() => {
                        const userMsg = messages.slice(0, i).reverse().find(m => m.role === 'user')
                        if (userMsg) {
                          setInput(userMsg.content.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' '))
                        }
                      }}
                      className="msg-action-btn"
                      title="重新生成"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12">
                        <polyline points="23 4 23 10 17 10"/>
                        <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            </div>
            )
          })}
          {streaming && status && (
            <div className="status-bar">
              <div className="spinner" style={{ display: 'inline-block', width: 12, height: 12, marginRight: 6 }}></div>
              {status}
            </div>
          )}
        </div>

        {/* 输入框 */}
        <div className="chat-in">
          <textarea
            rows={1}
            placeholder="输入你的问题… (Enter 发送，Shift+Enter 换行)"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            style={{ resize: 'none' }}
          />
          <button className="chat-send" onClick={sendMessage} disabled={!input.trim() || streaming}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
      </div>

      {/* ═══ Right Panel ═══ */}
      <div className="chat-side">
        {/* 推荐问题 */}
        <div className="side-card">
          <div className="sc-hd">
            <h3>推荐问题</h3>
            <span className="tag tag-warm">为你推荐</span>
          </div>
          <div className="sc-bd">
            {dynamicSuggestions.map((s, i) => (
              <div key={i} className="suggest" onClick={() => setInput(s.text)}>
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

        {/* 当前上下文 */}
        <div className="side-card">
          <div className="sc-hd">
            <h3>当前上下文</h3>
          </div>
          <div className="sc-bd">
            {knowledgePoints.length > 0 ? (
              <>
                <div style={{ fontSize: '11px', color: 'var(--ink-4)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '.6px' }}>已掌握知识点</div>
                <div className="knowledge-pills">
                  {knowledgePoints.map((kp) => (
                    <div key={kp} className="kp">{kp}</div>
                  ))}
                </div>
              </>
            ) : (
              <div style={{ fontSize: '12px', color: 'var(--ink-4)' }}>暂无画像数据，完成画像构建后显示</div>
            )}
            {weakTopics.length > 0 && (
              <>
                <div style={{ fontSize: '11px', color: 'var(--ink-4)', margin: '14px 0 8px', textTransform: 'uppercase', letterSpacing: '.6px' }}>薄弱环节</div>
                <div className="knowledge-pills">
                  {weakTopics.map((t) => (
                    <div key={t} className="kp" style={{ background: '#fff0e0', color: 'var(--warm)' }}>{t}</div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* 已生成资源 */}
        <div className="side-card" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div className="sc-hd">
            <h3>已生成资源</h3>
            <span className="tag tag-green">{dbResources.length} 个</span>
          </div>
          <div className="sc-bd" style={{ flex: 1, overflowY: 'auto' }}>
            {dbResources.length === 0 ? (
              <div style={{ fontSize: '12px', color: 'var(--ink-4)' }}>对话中生成的资源将实时显示</div>
            ) : (
              dbResources.slice(0, 10).map((r) => (
                <div key={r.resource_id} className="gen-resource" style={{ cursor: 'pointer' }} onClick={() => window.open('/resources', '_blank')}>
                  <div className="gr-dot" style={{ background: 'var(--success)' }}></div>
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title || r.knowledge_point}</span>
                  <span className="gr-status gs-done" style={{ fontSize: 10 }}>{r.resource_type === 'knowledge' ? '文档' : r.resource_type === 'mindmap' ? '导图' : r.resource_type === 'code' ? '代码' : '资源'}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
