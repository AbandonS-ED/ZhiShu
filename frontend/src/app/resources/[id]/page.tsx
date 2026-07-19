'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Icon from '@/components/Icon'
import { resourceApi } from '@/lib/api'
import { getStudentId } from '@/lib/student'
import type { ResourceItem } from '@/app/resources/types'

export default function ResourceDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [resource, setResource] = useState<ResourceItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<'knowledge' | 'code' | 'mindmap' | 'exercises'>('knowledge')
  const [showAnswers, setShowAnswers] = useState<Record<number, boolean>>({})
  const [copiedCode, setCopiedCode] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)
  const [isFavorited, setIsFavorited] = useState(false)

  const studentId = getStudentId()
  const resourceId = params.id as string

  useEffect(() => {
    loadResource()
  }, [resourceId])

  const loadResource = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await resourceApi.getById(resourceId)
      setResource(data)
      setIsFavorited(data.is_favorited)
    } catch (err: any) {
      setError(err.message || '加载失败')
    } finally {
      setLoading(false)
    }
  }

  const toggleAnswer = (index: number) => {
    setShowAnswers(prev => ({ ...prev, [index]: !prev[index] }))
  }

  const copyCode = async () => {
    if (resource?.content?.code) {
      await navigator.clipboard.writeText(resource.content.code)
      setCopiedCode(true)
      setTimeout(() => setCopiedCode(false), 2000)
    }
  }

  const copyLink = async () => {
    await navigator.clipboard.writeText(window.location.href)
    setCopiedLink(true)
    setTimeout(() => setCopiedLink(false), 2000)
  }

  const toggleFavorite = async () => {
    try {
      await resourceApi.toggleFavorite(resourceId)
      setIsFavorited(!isFavorited)
    } catch (err) {
      console.error('收藏失败', err)
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--ink-3)' }}>
        <div className="loading-spinner" style={{ width: 24, height: 24, marginRight: 12 }} />
        加载中...
      </div>
    )
  }

  if (error || !resource) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--danger)' }}>
        <Icon name="alertTriangle" size={40} style={{ opacity: 0.5 }} />
        <p style={{ marginTop: 12, fontSize: 14 }}>{error || '资源不存在'}</p>
        <button className="btn btn-sm" onClick={() => router.back()} style={{ marginTop: 16 }}>返回</button>
      </div>
    )
  }

  const content = resource.content
  const hasKnowledge = !!content.knowledge
  const hasCode = !!content.code
  const hasMindmap = !!content.mermaid_code
  const hasExercises = content.exercises && content.exercises.length > 0

  const tabs = [
    { key: 'knowledge', label: '知识讲解', icon: 'book', show: hasKnowledge },
    { key: 'code', label: '代码示例', icon: 'code', show: hasCode },
    { key: 'mindmap', label: '思维导图', icon: 'map', show: hasMindmap },
    { key: 'exercises', label: '练习题', icon: 'clipboard', show: hasExercises },
  ].filter(t => t.show)

  const renderKnowledgeContent = (text: string) => {
    return text.split('\n').map((line, i) => {
      let processed = line
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/`(.*?)`/g, '<code>$1</code>')
      return <p key={i} dangerouslySetInnerHTML={{ __html: processed }} />
    })
  }

  const getIconClass = () => {
    switch (resource.resource_type) {
      case '知识': return 'knowledge'
      case '代码': return 'code'
      case '思维导图': return 'mindmap'
      case '练习': return 'exercise'
      default: return 'knowledge'
    }
  }

  return (
    <div style={{ padding: '24px 32px 40px', height: 'calc(100vh - var(--header-h))', overflow: 'auto' }}>
      {/* Back navigation */}
      <div className="back-nav">
        <button
          onClick={() => router.back()}
          className="back-link"
        >
          <Icon name="arrowLeft" size={14} />
          返回资源列表
        </button>
      </div>

      {/* Resource header */}
      <div className="res-header">
        <div className="rh-top">
          <div className={`rh-icon ${getIconClass()}`}>
            <Icon name="fileText" size={24} />
          </div>
          <div className="rh-info">
            <h1 className="rh-title">{resource.title}</h1>
            <div className="rh-tags">
              <span className="tag tag-warm">{resource.resource_type}</span>
              {resource.knowledge_point && (
                <span className="tag tag-info">{resource.knowledge_point}</span>
              )}
              <span className="rh-date">{new Date(resource.created_at).toLocaleDateString('zh-CN')}</span>
            </div>
          </div>
          <div className="rh-actions">
            <button
              className={`rh-action ${isFavorited ? 'fav-active' : ''}`}
              onClick={toggleFavorite}
              title="收藏"
            >
              <Icon name="heart" size={16} />
            </button>
            <button className="rh-action" onClick={copyLink} title="复制链接">
              <Icon name={copiedLink ? "check" : "link"} size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      {tabs.length > 1 && (
        <div className="tabs-bar">
          {tabs.map(tab => (
            <button
              key={tab.key}
              className={`tab-btn ${activeTab === tab.key ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.key as any)}
            >
              <Icon name={tab.icon} size={14} />
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* Content area */}
      <div className="detail-body">
        {/* Knowledge content */}
        {activeTab === 'knowledge' && hasKnowledge && (
          <div className="card">
            <div className="knowledge-content">
              {renderKnowledgeContent(content.knowledge!)}
            </div>
          </div>
        )}

        {/* Code content */}
        {activeTab === 'code' && hasCode && (
          <div className="card">
            <div className="code-content">
              <div className="code-header">
                <span className="ch-label">
                  <Icon name="code" size={13} />
                  Python
                </span>
                <button className="copy-btn" onClick={copyCode}>
                  {copiedCode ? '已复制' : '复制代码'}
                </button>
              </div>
              <div className="code-block">
                {content.code}
              </div>
            </div>
          </div>
        )}

        {/* Mindmap */}
        {activeTab === 'mindmap' && hasMindmap && (
          <div className="card">
            <div className="mindmap-content">
              <div className="mindmap-render">
                <pre style={{
                  fontSize: 12,
                  lineHeight: 1.6,
                  fontFamily: "'JetBrains Mono', monospace",
                  color: 'var(--ink)',
                  textAlign: 'left',
                  width: '100%',
                  margin: 0,
                }}>
                  {content.mermaid_code}
                </pre>
              </div>
              <div className="mindmap-hint">
                <Icon name="info" size={14} />
                <span>
                  如需查看完整交互式导图，可复制 Mermaid 代码到{' '}
                  <a href="https://mermaid.live" target="_blank" rel="noopener noreferrer">
                    mermaid.live
                  </a>{' '}
                  在线渲染。
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Exercises */}
        {activeTab === 'exercises' && hasExercises && (
          <div className="exercise-list">
            {content.exercises!.map((exercise, index) => (
              <div key={index} className="exercise-card">
                <div className="ex-head">
                  <div className="ex-num">{index + 1}</div>
                  <div className="ex-body">
                    <div className="ex-question">{exercise.question}</div>
                    {exercise.type === 'choice' && exercise.options && (
                      <div className="ex-options">
                        {exercise.options.map((option, optIndex) => (
                          <div key={optIndex} className="ex-opt">
                            <span className="ex-letter">{String.fromCharCode(65 + optIndex)}</span>
                            {option}
                          </div>
                        ))}
                      </div>
                    )}
                    <button
                      className="ex-toggle-btn"
                      onClick={() => toggleAnswer(index)}
                    >
                      <Icon name={showAnswers[index] ? "eyeOff" : "eye"} size={13} />
                      {showAnswers[index] ? '隐藏答案' : '查看答案'}
                    </button>
                    <div className={`ex-answer ${showAnswers[index] ? 'show' : ''}`}>
                      <div className="ea-head">
                        <Icon name="checkCircle" size={14} />
                        答案：{exercise.answer}
                      </div>
                      {exercise.explanation && (
                        <div className="ea-explain">{exercise.explanation}</div>
                      )}
                    </div>
                  </div>
                  <span className="ex-type">
                    {exercise.type === 'choice' ? '选择题' : 
                     exercise.type === 'judge' ? '判断题' : 
                     exercise.type === 'short_answer' ? '简答题' : '编程题'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* No content */}
        {!hasKnowledge && !hasCode && !hasMindmap && !hasExercises && (
          <div className="empty-detail">
            <div className="ed-icon">
              <Icon name="inbox" size={26} />
            </div>
            <h3>暂无内容</h3>
            <p>该资源暂无可用内容</p>
          </div>
        )}
      </div>
    </div>
  )
}
