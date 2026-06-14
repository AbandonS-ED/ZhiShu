'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { chatApi, profileApi, evaluationApi, type StudentProfile } from '@/lib/api'
import { getStudentId } from '@/lib/student'
import { escapeHtml, markdownToHtml, extractAnswer } from '@/lib/utils'

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

  const msgsRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<(() => void) | null>(null)
  const studentId = getStudentId()
  const loadedSessionRef = useRef(false)

  // 组件卸载时中断 SSE
  useEffect(() => {
    return () => { if (abortRef.current) abortRef.current() }
  }, [])

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
                setGenResources((prev) => [...prev, { name: `${userMsg} · 练习题`, status: 'done' }])
              } else if (resultData.type === 'tutor' || resultData.type === 'chat' || data.answer) {
                const { answer: ans, suggestion: sug } = extractAnswer(data)
                html = `<div>${markdownToHtml(ans)}${sug ? `<div style="margin-top:8px;padding:8px;background:#f0f8e8;border-radius:6px;font-size:12px">💡 ${markdownToHtml(sug)}</div>` : ''}</div>`
              } else if (resultData.type === 'document' || data.knowledge) {
                html = `<div>${markdownToHtml(data.knowledge || JSON.stringify(data))}</div>`
                setGenResources((prev) => [...prev, { name: `${userMsg} · 文档`, status: 'done' }])
              } else if (resultData.type === 'mindmap') {
                html = `<div><p>🧠 思维导图已生成：</p><pre style="background:#f5f5f5;padding:8px;border-radius:4px;font-size:12px;overflow-x:auto">${data.mermaid || data.code || ''}</pre></div>`
                setGenResources((prev) => [...prev, { name: `${userMsg} · 思维导图`, status: 'done' }])
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
              const renderedHtml = markdownToHtml(streamContent)
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

  // 从画像提取知识点列表（暂不可用，待学科画像实现后启用）
  const knowledgePoints: string[] = []

  const weakTopics: string[] = []

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
          {messages.map((msg, i) => (
            <div key={i} className={`msg ${msg.role}`}>
              <div className="av">{msg.role === 'assistant' ? 'AI' : '我'}</div>
              <div className="bubble" dangerouslySetInnerHTML={{ __html: msg.rendered ? msg.content : markdownToHtml(msg.content) }} />
            </div>
          ))}
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
            {defaultSuggestions.map((s, i) => (
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
            <span className="tag tag-green">实时</span>
          </div>
          <div className="sc-bd" style={{ flex: 1, overflowY: 'auto' }}>
            {genResources.length === 0 ? (
              <div style={{ fontSize: '12px', color: 'var(--ink-4)' }}>对话中生成的资源将实时显示</div>
            ) : (
              genResources.map((r, i) => (
                <div key={i} className="gen-resource">
                  <div
                    className="gr-dot"
                    style={{
                      background:
                        r.status === 'done' ? 'var(--success)' : r.status === 'running' ? 'var(--warm)' : undefined,
                    }}
                  ></div>
                  <span>{r.name}</span>
                  <span className={`gr-status gs-${r.status}`}>
                    {r.status === 'done' ? '完成' : r.status === 'running' ? '生成中' : '等待'}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
