'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { studyPlanApi, resourceApi, chatApi, type LearningPath, type LearningPathNode, type ChatEvent } from '@/lib/api'
import { getStudentId } from '@/lib/student'
import { markdownToHtml } from '@/lib/markdown'
import { usePageTimer } from '@/hooks/usePageTimer'
import Icon from '@/components/Icon'

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
  
  // 学习模式：chat | resource
  const [mode, setMode] = useState<'chat' | 'resource'>('chat')
  
  // 对话相关
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputMessage, setInputMessage] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  
  // 资源相关
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
            if (node) {
              setCurrentNode(node)
            }
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

  // 发送消息
  const handleSendMessage = useCallback(async () => {
    if (!inputMessage.trim() || chatLoading) return
    
    const userMessage = inputMessage.trim()
    setInputMessage('')
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

  // 生成学习资源
  const handleGenerateResource = useCallback(async () => {
    if (resourceLoading) return
    
    setResourceLoading(true)
    setResourceContent('')
    
    try {
      const studentId = getStudentId()
      const message = `请生成关于"${currentNode?.knowledge_point}"的详细学习资源`
      
      console.log('调用资源生成API:', { studentId, message })
      
      const response = await resourceApi.createStream({
        student_id: studentId,
        message: message
      })
      
      console.log('API响应状态:', response.status, response.ok)
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error('API错误:', errorText)
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
          console.log('收到SSE数据:', chunk.substring(0, 200))
          const lines = chunk.split('\n')
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6))
                console.log('解析SSE事件:', data.type, data)
                if (data.type === 'token' && data.content) {
                  fullContent += data.content
                  setResourceContent(fullContent)
                } else if (data.type === 'result' && data.data) {
                  const knowledge = data.data.content?.knowledge || ''
                  const code = data.data.content?.code || ''
                  const message = data.data.content?.message || ''
                  fullContent = [knowledge, code, message].filter(Boolean).join('\n\n')
                  setResourceContent(fullContent)
                } else if (data.type === 'progress') {
                  console.log('进度:', data.progress, data.message)
                }
              } catch (e) {
                console.log('解析SSE行失败:', line, e)
              }
            }
          }
        }
      }
      
      console.log('最终内容长度:', fullContent.length)
      
      if (fullContent) {
        setResourceGenerated(true)
      } else {
        setResourceContent('未收到资源内容，请重试')
      }
    } catch (err) {
      console.error('生成资源失败:', err)
      setResourceContent('资源生成失败，请重试: ' + (err as Error).message)
    } finally {
      setResourceLoading(false)
    }
  }, [currentNode, resourceLoading])

  // 学习完毕 - 跳转到测验
  const handleFinishLearning = useCallback(() => {
    router.push(`/plan/${pathId}/quiz/${nodeId}`)
  }, [pathId, nodeId, router])

  if (loading) {
    return (
      <div className="plan-page">
        <div className="plan-container">
          <div className="loading-state">
            <div className="loading-spinner" />
            <p>加载中...</p>
          </div>
        </div>
      </div>
    )
  }

  if (!currentNode) {
    return (
      <div className="plan-page">
        <div className="plan-container">
          <div className="error-state">
            <p>知识点不存在</p>
            <button className="btn-secondary" onClick={() => router.push(`/plan/${pathId}`)}>
              返回路径
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="plan-page">
      <div className="plan-container">
        {/* 顶部导航 */}
        <div className="learn-header">
          <button className="back-btn" onClick={() => router.push(`/plan/${pathId}`)}>
            <Icon name="arrowLeft" size={16} />
            返回路径
          </button>
          <h1>{currentNode.knowledge_point}</h1>
          <div className="learn-tabs">
            <button
              className={`tab-btn ${mode === 'chat' ? 'active' : ''}`}
              onClick={() => setMode('chat')}
            >
              <Icon name="chat" size={16} />
              AI 对话
            </button>
            <button
              className={`tab-btn ${mode === 'resource' ? 'active' : ''}`}
              onClick={() => setMode('resource')}
            >
              <Icon name="book" size={16} />
              学习资源
            </button>
          </div>
        </div>

        {/* 内容区域 */}
        <div className="learn-content">
          {/* AI对话模式 */}
          {mode === 'chat' && (
            <div className="chat-container">
              <div className="chat-messages">
                {messages.length === 0 && (
                  <div className="chat-welcome">
                    <Icon name="robot" size={48} />
                    <h3>AI 学习助手</h3>
                    <p>我可以帮你解答关于「{currentNode.knowledge_point}」的任何问题</p>
                    <div className="chat-suggestions">
                      <button onClick={() => { setInputMessage(`什么是${currentNode.knowledge_point}？`); }}>
                        什么是{currentNode.knowledge_point}？
                      </button>
                      <button onClick={() => { setInputMessage(`请给我一个${currentNode.knowledge_point}的例子`); }}>
                        给我一个例子
                      </button>
                      <button onClick={() => { setInputMessage(`${currentNode.knowledge_point}有哪些应用场景？`); }}>
                        应用场景有哪些？
                      </button>
                    </div>
                  </div>
                )}
                
                {messages.map((msg, index) => (
                  <div key={index} className={`chat-message ${msg.role}`}>
                    <div className="message-avatar">
                      {msg.role === 'user' ? '你' : 'AI'}
                    </div>
                    <div 
                      className="message-content"
                      dangerouslySetInnerHTML={{ __html: markdownToHtml(msg.content) }}
                    />
                  </div>
                ))}
                
                {chatLoading && messages[messages.length - 1]?.role !== 'assistant' && (
                  <div className="chat-message assistant">
                    <div className="message-avatar">AI</div>
                    <div className="message-content loading">
                      <div className="loading-dots">
                        <span></span><span></span><span></span>
                      </div>
                    </div>
                  </div>
                )}
                
                <div ref={messagesEndRef} />
              </div>
              
              <div className="chat-input">
                <input
                  type="text"
                  placeholder="输入你的问题..."
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                  disabled={chatLoading}
                />
                <button onClick={handleSendMessage} disabled={chatLoading || !inputMessage.trim()}>
                  <Icon name="send" size={18} />
                </button>
              </div>
            </div>
          )}

          {/* 学习资源模式 */}
          {mode === 'resource' && (
            <div className="resource-container">
              {!resourceGenerated && !resourceLoading && (
                <div className="resource-generate" onClick={handleGenerateResource}>
                  <Icon name="sparkles" size={48} />
                  <h3>生成AI学习资源</h3>
                  <p>点击生成关于「{currentNode.knowledge_point}」的详细学习资料</p>
                </div>
              )}
              
              {resourceLoading && (
                <div className="resource-loading">
                  <div className="loading-spinner" />
                  <p>AI 正在生成学习资源...</p>
                </div>
              )}
              
              {resourceContent && (
                <div className="resource-content">
                  <div dangerouslySetInnerHTML={{ __html: markdownToHtml(resourceContent) }} />
                  {resourceGenerated && (
                    <button className="btn-regenerate" onClick={handleGenerateResource}>
                      <Icon name="refresh" size={14} />
                      重新生成
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 底部操作 */}
        <div className="learn-footer">
          <button className="btn-primary btn-finish" onClick={handleFinishLearning}>
            <Icon name="check" size={18} />
            学习完毕，开始测验
          </button>
        </div>
      </div>
    </div>
  )
}
