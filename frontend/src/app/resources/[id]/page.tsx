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

  const studentId = getStudentId()
  const resourceId = params.id as string

  useEffect(() => {
    loadResource()
  }, [resourceId])

  const loadResource = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await resourceApi.list(studentId)
      const found = data.find(r => r.resource_id === resourceId)
      if (found) {
        setResource(found)
      } else {
        setError('资源不存在')
      }
    } catch (err: any) {
      setError(err.message || '加载失败')
    } finally {
      setLoading(false)
    }
  }

  const toggleAnswer = (index: number) => {
    setShowAnswers(prev => ({ ...prev, [index]: !prev[index] }))
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

  return (
    <div style={{ padding: '24px 32px 40px', height: 'calc(100vh - var(--header-h))', overflow: 'auto' }}>
      {/* 头部 */}
      <div style={{ marginBottom: 24 }}>
        <button
          onClick={() => router.back()}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--ink-3)', display: 'flex', alignItems: 'center', gap: 6,
            fontSize: 13, marginBottom: 16, padding: 0,
          }}
        >
          <Icon name="arrowLeft" size={16} />
          返回资源列表
        </button>

        <h1 style={{ fontSize: 24, fontWeight: 600, color: 'var(--ink)', marginBottom: 8 }}>
          {resource.title}
        </h1>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span className="tag tag-warm">{resource.resource_type}</span>
          {resource.knowledge_point && (
            <span className="tag tag-dark">{resource.knowledge_point}</span>
          )}
          <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>
            {new Date(resource.created_at).toLocaleDateString('zh-CN')}
          </span>
        </div>
      </div>

      {/* 标签页 */}
      {tabs.length > 1 && (
        <div style={{
          display: 'flex', gap: 0, borderBottom: '1px solid var(--line)',
          marginBottom: 24,
        }}>
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              style={{
                flex: 1, padding: '12px 0', border: 'none', cursor: 'pointer',
                fontSize: 13, fontWeight: activeTab === tab.key ? 600 : 400,
                color: activeTab === tab.key ? 'var(--ink)' : 'var(--ink-3)',
                background: 'transparent',
                borderBottom: activeTab === tab.key ? '2px solid var(--warm)' : '2px solid transparent',
                transition: 'all .2s',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}
            >
              <Icon name={tab.icon} size={14} />
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* 内容区域 */}
      <div style={{ maxWidth: 800 }}>
        {/* 知识讲解 */}
        {activeTab === 'knowledge' && hasKnowledge && (
          <div className="card" style={{ padding: '24px 28px' }}>
            <div style={{ fontSize: 15, lineHeight: 1.8, color: 'var(--ink)' }}>
              {content.knowledge!.split('\n').map((line, i) => (
                <p key={i} style={{ marginBottom: 12 }}>{line}</p>
              ))}
            </div>
          </div>
        )}

        {/* 代码示例 */}
        {activeTab === 'code' && hasCode && (
          <div className="card" style={{ padding: '24px 28px' }}>
            <pre style={{
              background: 'var(--bg)',
              padding: 20,
              borderRadius: 10,
              fontSize: 13,
              lineHeight: 1.6,
              overflow: 'auto',
              fontFamily: "'JetBrains Mono', monospace",
              color: 'var(--ink)',
            }}>
              {content.code}
            </pre>
          </div>
        )}

        {/* 思维导图 */}
        {activeTab === 'mindmap' && hasMindmap && (
          <div className="card" style={{ padding: '24px 28px' }}>
            <div style={{
              background: 'var(--bg)',
              padding: 20,
              borderRadius: 10,
              textAlign: 'center',
            }}>
              <pre style={{
                fontSize: 12,
                lineHeight: 1.6,
                fontFamily: "'JetBrains Mono', monospace",
                color: 'var(--ink)',
                textAlign: 'left',
                display: 'inline-block',
              }}>
                {content.mermaid_code}
              </pre>
              <p style={{ marginTop: 16, fontSize: 12, color: 'var(--ink-3)' }}>
                复制以上 Mermaid 代码到 <a href="https://mermaid.live" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--warm)' }}>mermaid.live</a> 查看导图
              </p>
            </div>
          </div>
        )}

        {/* 练习题 */}
        {activeTab === 'exercises' && hasExercises && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {content.exercises!.map((exercise, index) => (
              <div key={index} className="card" style={{ padding: '24px 28px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
                  <span style={{
                    width: 28, height: 28, borderRadius: '50%',
                    background: 'var(--warm-soft)', color: 'var(--warm)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 13, fontWeight: 600, flexShrink: 0,
                  }}>
                    {index + 1}
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, color: 'var(--ink)', marginBottom: 8, fontWeight: 500 }}>
                      {exercise.question}
                    </div>
                    {exercise.type === 'choice' && exercise.options && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                        {exercise.options.map((option, optIndex) => (
                          <div
                            key={optIndex}
                            style={{
                              padding: '10px 14px',
                              background: 'var(--bg)',
                              borderRadius: 'var(--r-xs)',
                              fontSize: 13,
                              color: 'var(--ink-2)',
                              border: '1px solid var(--line)',
                            }}
                          >
                            {option}
                          </div>
                        ))}
                      </div>
                    )}
                    <button
                      onClick={() => toggleAnswer(index)}
                      style={{
                        background: 'none', border: '1px solid var(--line)',
                        cursor: 'pointer', padding: '8px 16px', borderRadius: 'var(--r-xs)',
                        fontSize: 12, color: 'var(--ink-3)', transition: 'all .2s',
                      }}
                    >
                      {showAnswers[index] ? '隐藏答案' : '查看答案'}
                    </button>
                    {showAnswers[index] && (
                      <div style={{
                        marginTop: 16, padding: '16px 20px',
                        background: 'var(--success-soft)', borderRadius: 'var(--r-xs)',
                      }}>
                        <div style={{ fontSize: 13, color: 'var(--success)', fontWeight: 600, marginBottom: 8 }}>
                          答案：{exercise.answer}
                        </div>
                        {exercise.explanation && (
                          <div style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.6 }}>
                            {exercise.explanation}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 没有内容 */}
        {!hasKnowledge && !hasCode && !hasMindmap && !hasExercises && (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--ink-3)' }}>
            <Icon name="inbox" size={40} style={{ opacity: 0.3 }} />
            <p style={{ marginTop: 12, fontSize: 14 }}>暂无内容</p>
          </div>
        )}
      </div>
    </div>
  )
}
