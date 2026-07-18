'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { studyPlanApi, resourceApi, chatApi, type LearningPath, type LearningPathNode, type ChatEvent } from '@/lib/api'
import { getStudentId } from '@/lib/student'
import { markdownToHtml } from '@/lib/markdown'
import { usePageTimer } from '@/hooks/usePageTimer'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  rendered?: boolean
}

export default function LearnNodePage() {
  const router = useRouter()
  const params = useParams()
  const pathId = params.pathId as string
  const nodeId = params.nodeId as string
  usePageTimer('plan-learn')

  const [path, setPath] = useState<LearningPath | null>(null)
  const [currentNode, setCurrentNode] = useState<LearningPathNode | null>(null)
  const [loading, setLoading] = useState(true)

  const [mode, setMode] = useState<'chat' | 'resource'>('chat')

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputMessage, setInputMessage] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const [resourceContent, setResourceContent] = useState('')
  const [resourceLoading, setResourceLoading] = useState(false)
  const [resourceGenerated, setResourceGenerated] = useState(false)

  useEffect(() => {
    const loadData = async () => {
      try {
        const result = await studyPlanApi.getPaths()
        if (result.success) {
          const found = result.data.find(p => p.id === pathId)
          if (found) {
            setPath(found)
            const node = found.nodes.find(n => n.id === nodeId)
            if (node) setCurrentNode(node)
          }
        }
      } catch (err) {
        console.error('加载数据失败:', err)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [pathId, nodeId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const autoResize = useCallback((el: HTMLTextAreaElement) => {
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 120) + 'px'
  }, [])

  const handleSendMessage = useCallback(async () => {
    if (!inputMessage.trim() || chatLoading) return

    const userMessage = inputMessage.trim()
    setInputMessage('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    setMessages(prev => [...prev, { role: 'user', content: userMessage }])
    setChatLoading(true)

    try {
      const studentId = getStudentId()
      const contextMessage = `我在学习"${currentNode?.knowledge_point}"。${userMessage}`

      let assistantMessage = ''
      setMessages(prev => [...prev, { role: 'assistant', content: '', rendered: false }])

      chatApi.stream(
        studentId,
        contextMessage,
        (event: ChatEvent) => {
          if (event.type === 'token' && event.content) {
            assistantMessage += event.content
            setMessages(prev => {
              const newMessages = [...prev]
              newMessages[newMessages.length - 1] = {
                role: 'assistant',
                content: assistantMessage,
                rendered: false
              }
              return newMessages
            })
          }
        }
      )
    } catch (err) {
      console.error('发送消息失败:', err)
    } finally {
      setChatLoading(false)
    }
  }, [inputMessage, chatLoading, currentNode])

  const handleTextareaKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }, [handleSendMessage])

  const handleGenerateResource = useCallback(async () => {
    if (resourceLoading) return

    setResourceLoading(true)
    setResourceContent('')

    try {
      const studentId = getStudentId()
      const message = `请生成关于"${currentNode?.knowledge_point}"的详细学习资源`

      const response = await resourceApi.createStream({
        student_id: studentId,
        message: message
      })

      if (!response.ok) {
        const errorText = await response.text()
        setResourceContent('资源生成失败: ' + errorText)
        return
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let fullContent = ''

      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value, { stream: true })
          const lines = chunk.split('\n')

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6))
                if (data.type === 'token' && data.content) {
                  fullContent += data.content
                  setResourceContent(fullContent)
                } else if (data.type === 'result' && data.data) {
                  const knowledge = data.data.content?.knowledge || ''
                  const code = data.data.content?.code || ''
                  const msg = data.data.content?.message || ''
                  fullContent = [knowledge, code, msg].filter(Boolean).join('\n\n')
                  setResourceContent(fullContent)
                }
              } catch (e) {
                // skip malformed lines
              }
            }
          }
        }
      }

      if (fullContent) {
        setResourceGenerated(true)
      } else {
        setResourceContent('未收到资源内容，请重试')
      }
    } catch (err) {
      setResourceContent('资源生成失败，请重试: ' + (err as Error).message)
    } finally {
      setResourceLoading(false)
    }
  }, [currentNode, resourceLoading])

  const handleFinishLearning = useCallback(() => {
    router.push(`/plan/${pathId}/quiz/${nodeId}`)
  }, [pathId, nodeId, router])

  if (loading) {
    return (
      <div className="loading-state">
        <div className="loading-spinner" />
        <p>加载中...</p>
      </div>
    )
  }

  if (!currentNode) {
    return (
      <div className="error-state">
        <p>知识点不存在</p>
        <button className="btn-secondary" onClick={() => router.push(`/plan/${pathId}`)}>
          返回路径
        </button>
      </div>
    )
  }

  return (
    <>
      {/* ═══ LEARN BAR ═══ */}
      <div className="learn-bar">
        <a className="back-link" onClick={() => router.push(`/plan/${pathId}`)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
          返回路径
        </a>
        <span className="learn-title">{currentNode.knowledge_point}</span>
        <div className="mode-tabs">
          <button className={`mode-tab ${mode === 'chat' ? 'active' : ''}`} onClick={() => setMode('chat')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            AI 对话
          </button>
          <button className={`mode-tab ${mode === 'resource' ? 'active' : ''}`} onClick={() => setMode('resource')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
            学习资源
          </button>
        </div>
      </div>

      {/* ═══ CHAT MODE ═══ */}
      {mode === 'chat' && (
        <div className="learn-chat-mode">
          <div className="learn-chat-messages">
            {messages.length === 0 && (
              <div className="learn-chat-welcome">
                <div className="cw-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 8V4H8"/><rect x="2" y="2" width="20" height="8" rx="2"/><path d="M6 12v4a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-4"/></svg>
                </div>
                <h3>AI 学习助手</h3>
                <p>我可以帮你解答关于「{currentNode.knowledge_point}」的任何问题</p>
                <div className="suggestions">
                  <button className="suggest-btn" onClick={() => setInputMessage(`什么是${currentNode.knowledge_point}？请用通俗的方式讲解`)}>
                    什么是{currentNode.knowledge_point}？
                  </button>
                  <button className="suggest-btn" onClick={() => setInputMessage(`请给我一个${currentNode.knowledge_point}的实际应用例子`)}>
                    给我一个例子
                  </button>
                  <button className="suggest-btn" onClick={() => setInputMessage(`${currentNode.knowledge_point}有哪些应用场景？`)}>
                    应用场景有哪些？
                  </button>
                </div>
              </div>
            )}

            {messages.map((msg, index) => (
              <div key={index} className={`learn-msg ${msg.role}`}>
                <div className="msg-av">{msg.role === 'user' ? '你' : 'AI'}</div>
                <div
                  className="msg-bubble"
                  dangerouslySetInnerHTML={{ __html: markdownToHtml(msg.content) }}
                />
              </div>
            ))}

            {chatLoading && messages[messages.length - 1]?.role !== 'assistant' && (
              <div className="learn-msg assistant">
                <div className="msg-av">AI</div>
                <div className="msg-bubble">
                  <div className="typing"><span></span><span></span><span></span></div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          <div className="learn-chat-input">
            <textarea
              ref={textareaRef}
              rows={1}
              placeholder="输入你的问题…（Enter 发送，Shift+Enter 换行）"
              value={inputMessage}
              onChange={(e) => { setInputMessage(e.target.value); autoResize(e.target) }}
              onKeyDown={handleTextareaKeyDown}
              disabled={chatLoading}
            />
            <button className="learn-chat-send" onClick={handleSendMessage} disabled={chatLoading || !inputMessage.trim()}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            </button>
          </div>
        </div>
      )}

      {/* ═══ RESOURCE MODE ═══ */}
      {mode === 'resource' && (
        <div className="learn-resource-mode">
          {!resourceGenerated && !resourceLoading && (
            <div className="resource-generate-cta" onClick={handleGenerateResource}>
              <div className="rg-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
              </div>
              <h3>生成 AI 学习资源</h3>
              <p>点击生成关于「{currentNode.knowledge_point}」的详细学习资料，包含讲解、示例代码和图解。</p>
            </div>
          )}

          {resourceLoading && (
            <div className="resource-loading-state">
              <div className="rl-spinner"></div>
              <h3>AI 正在生成学习资源</h3>
              <p>正在组织关于「{currentNode.knowledge_point}」的讲解内容，请稍候...</p>
            </div>
          )}

          {resourceContent && (
            <div className="resource-rendered">
              <div className="rc-prose" dangerouslySetInnerHTML={{ __html: markdownToHtml(resourceContent) }} />
              {resourceGenerated && (
                <button className="regenerate-btn" onClick={handleGenerateResource}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
                  重新生成
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* ═══ FOOTER ═══ */}
      <div className="learn-footer">
        <span className="lf-hint">学完后点击右侧按钮进入小测验</span>
        <button className="finish-btn" onClick={handleFinishLearning}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          学习完毕，开始测验
        </button>
      </div>
    </>
  )
}
