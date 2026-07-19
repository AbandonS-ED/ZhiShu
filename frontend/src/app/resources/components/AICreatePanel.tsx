'use client'

import { useState, useRef, useEffect } from 'react'
import { useResourceCreate } from '../hooks/useResourceCreate'
import type { ResourceContent, ReviewResult } from '../types'
import { resourceApi } from '@/lib/api'
import { getStudentId } from '@/lib/student'

const TABS = [
  { key: 'knowledge', label: '知识讲解' },
  { key: 'code', label: '代码示例' },
  { key: 'mermaid', label: '思维导图' },
  { key: 'exercises', label: '练习题' },
] as const

type TabKey = typeof TABS[number]['key']

interface AICreatePanelProps {
  onSaved?: (resourceId: string) => void
  onClose?: () => void
}

export default function AICreatePanel({ onSaved, onClose }: AICreatePanelProps) {
  const {
    messages,
    currentContent,
    reviewResult,
    isGenerating,
    isReviewing,
    status,
    sendMessage,
    requestReview,
    reset,
  } = useResourceCreate()

  const [input, setInput] = useState('')
  const [activeTab, setActiveTab] = useState<TabKey>('knowledge')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const msgsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (msgsRef.current) {
      msgsRef.current.scrollTop = msgsRef.current.scrollHeight
    }
  }, [messages])

  const handleSend = () => {
    if (!input.trim() || isGenerating) return
    sendMessage(input)
    setInput('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleSave = async () => {
    if (!currentContent) return
    if (!reviewResult?.passed) {
      setSaveError('请先通过 AI 审核再保存')
      return
    }
    setSaving(true)
    setSaveError('')
    try {
      const data = await resourceApi.createManual({
        student_id: getStudentId() || '',
        title: messages.find(m => m.role === 'user')?.content?.slice(0, 50) || 'AI 生成资源',
        resource_type: activeTab,
        content: currentContent,
        knowledge_point: messages.find(m => m.role === 'user')?.content || '',
      })
      onSaved?.(data.resource_id)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const renderPreviewContent = () => {
    if (!currentContent) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--ink-4)', gap: 12 }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" style={{ opacity: 0.4 }}>
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M3 9h18" />
            <path d="M9 21V9" />
          </svg>
          <span style={{ fontSize: 13 }}>发送消息后，AI 生成的资源将在此预览</span>
        </div>
      )
    }

    switch (activeTab) {
      case 'knowledge':
        return currentContent.knowledge ? (
          <div className="preview-content" dangerouslySetInnerHTML={{ __html: simpleMarkdown(currentContent.knowledge) }} />
        ) : <EmptyTab text="暂无知识讲解内容" />

      case 'code':
        return currentContent.code ? (
          <pre style={{ background: 'var(--bg-2, #f7f7f8)', padding: 16, borderRadius: 8, fontSize: 13, lineHeight: 1.6, overflow: 'auto', margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
            {currentContent.code}
          </pre>
        ) : <EmptyTab text="暂无代码示例内容" />

      case 'mermaid':
        return currentContent.mermaid_code ? (
          <div style={{ padding: 16 }}>
            <pre style={{ background: 'var(--bg-2, #f7f7f8)', padding: 16, borderRadius: 8, fontSize: 12, overflow: 'auto', whiteSpace: 'pre-wrap' }}>
              {currentContent.mermaid_code}
            </pre>
          </div>
        ) : <EmptyTab text="暂无思维导图内容" />

      case 'exercises':
        return currentContent.exercises && currentContent.exercises.length > 0 ? (
          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
            {currentContent.exercises.map((ex, i) => (
              <div key={i} style={{ background: 'var(--bg-2, #f7f7f8)', borderRadius: 8, padding: 16 }}>
                <div style={{ fontSize: 12, color: 'var(--ink-4)', marginBottom: 6 }}>
                  {ex.type === 'choice' ? '选择题' : ex.type === 'judge' ? '判断题' : ex.type === 'coding' ? '编程题' : '简答题'}
                  {ex.difficulty ? ` · 难度 ${ex.difficulty}` : ''}
                </div>
                <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 8 }}>{ex.question}</div>
                {ex.options && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
                    {ex.options.map((opt, j) => (
                      <div key={j} style={{ fontSize: 13, color: 'var(--ink-2)', paddingLeft: 8 }}>{opt}</div>
                    ))}
                  </div>
                )}
                <div style={{ fontSize: 12, color: 'var(--brand, #4f6ef7)', fontWeight: 500 }}>
                  答案: {ex.answer}
                </div>
                {ex.explanation && (
                  <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 4 }}>
                    解析: {ex.explanation}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : <EmptyTab text="暂无练习题内容" />
    }
  }

  const renderReviewPanel = () => {
    if (!reviewResult) return null
    return (
      <div style={{
        position: 'absolute', bottom: 56, left: 0, right: 0,
        background: 'var(--bg-1, #fff)', borderTop: '1px solid var(--border, #e5e7eb)',
        padding: 16, maxHeight: 280, overflow: 'auto',
        boxShadow: '0 -4px 12px rgba(0,0,0,.08)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <span style={{ fontSize: 14, fontWeight: 600 }}>AI 审核结果</span>
          <span style={{
            fontSize: 12, fontWeight: 600, padding: '2px 10px', borderRadius: 10,
            background: reviewResult.passed ? 'var(--success-soft, #e8f5e9)' : 'var(--danger-soft, #fdecea)',
            color: reviewResult.passed ? 'var(--success, #2e7d32)' : 'var(--danger, #c62828)',
          }}>
            {reviewResult.passed ? '通过' : '未通过'} · {reviewResult.overall_score}分
          </span>
        </div>
        <div style={{ fontSize: 13, color: 'var(--ink-2)', marginBottom: 10 }}>{reviewResult.summary}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {Object.entries(reviewResult.dimensions).map(([key, dim]) => (
            <div key={key} style={{ background: 'var(--bg-2, #f7f7f8)', borderRadius: 6, padding: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                {key === 'content_quality' ? '内容质量' : key === 'knowledge_accuracy' ? '知识准确性' : key === 'format_check' ? '格式规范' : '学习建议'}
                <span style={{ float: 'right', color: dim.score >= 60 ? 'var(--success)' : 'var(--danger)' }}>{dim.score}分</span>
              </div>
              {dim.issues.length > 0 && (
                <div style={{ fontSize: 11, color: 'var(--danger)', marginBottom: 2 }}>
                  {dim.issues.map((iss, i) => <div key={i}>· {iss}</div>)}
                </div>
              )}
              {dim.suggestions.length > 0 && (
                <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                  {dim.suggestions.map((s, i) => <div key={i}>💡 {s}</div>)}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', height: '100%', background: 'var(--bg-0, #fafafa)', position: 'relative' }}>
      {/* ═══ 左侧：对话区 ═══ */}
      <div style={{ width: '60%', display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--border, #e5e7eb)' }}>
        {/* 消息列表 */}
        <div ref={msgsRef} style={{ flex: 1, overflow: 'auto', padding: 20 }}>
          {messages.length === 0 && (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--ink-4)' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>✨</div>
              <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink-2)' }}>AI 对话创作</p>
              <p style={{ fontSize: 12, marginTop: 6 }}>描述你想生成的学习资源，AI 将为你创建</p>
            </div>
          )}
          {messages.map((msg, i) => (
            <div key={i} style={{
              display: 'flex', gap: 10, marginBottom: 16,
              flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600,
                background: msg.role === 'user' ? 'var(--brand, #4f6ef7)' : 'var(--bg-2, #f0f0f2)',
                color: msg.role === 'user' ? '#fff' : 'var(--ink-2)',
              }}>
                {msg.role === 'user' ? '我' : 'AI'}
              </div>
              <div style={{
                maxWidth: '75%', padding: '10px 14px', borderRadius: 12, fontSize: 14, lineHeight: 1.6,
                background: msg.role === 'user' ? 'var(--brand, #4f6ef7)' : 'var(--bg-1, #fff)',
                color: msg.role === 'user' ? '#fff' : 'var(--ink-1, #1a1a1a)',
                boxShadow: '0 1px 3px rgba(0,0,0,.06)',
                whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              }}>
                {msg.content || (msg.role === 'assistant' && isGenerating && i === messages.length - 1 ? '思考中...' : '')}
              </div>
            </div>
          ))}
          {isGenerating && status && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', color: 'var(--ink-3)', fontSize: 12 }}>
              <div className="loading-spinner" style={{ width: 14, height: 14 }} />
              <span>{status}</span>
            </div>
          )}
        </div>

        {/* 输入框 */}
        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border, #e5e7eb)', background: 'var(--bg-1, #fff)' }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="描述你想生成的学习资源… (Enter 发送)"
              rows={2}
              style={{
                flex: 1, resize: 'none', padding: '10px 12px', borderRadius: 8,
                border: '1px solid var(--border, #e5e7eb)', fontSize: 13, lineHeight: 1.5,
                outline: 'none', fontFamily: 'inherit',
                background: 'var(--bg-0, #fafafa)',
              }}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isGenerating}
              style={{
                alignSelf: 'flex-end', padding: '10px 20px', borderRadius: 8,
                background: input.trim() && !isGenerating ? 'var(--brand, #4f6ef7)' : 'var(--bg-2, #e5e7eb)',
                color: input.trim() && !isGenerating ? '#fff' : 'var(--ink-4)',
                border: 'none', cursor: input.trim() && !isGenerating ? 'pointer' : 'not-allowed',
                fontSize: 13, fontWeight: 600, transition: 'all .2s',
              }}
            >
              发送
            </button>
          </div>
        </div>
      </div>

      {/* ═══ 右侧：预览区 ═══ */}
      <div style={{ width: '40%', display: 'flex', flexDirection: 'column' }}>
        {/* Tab 栏 */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border, #e5e7eb)', background: 'var(--bg-1, #fff)' }}>
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                flex: 1, padding: '10px 0', fontSize: 13, fontWeight: activeTab === tab.key ? 600 : 400,
                color: activeTab === tab.key ? 'var(--brand, #4f6ef7)' : 'var(--ink-3)',
                background: 'none', border: 'none', cursor: 'pointer',
                borderBottom: activeTab === tab.key ? '2px solid var(--brand, #4f6ef7)' : '2px solid transparent',
                transition: 'all .2s',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* 内容区 */}
        <div style={{ flex: 1, overflow: 'auto', position: 'relative' }}>
          {renderPreviewContent()}
        </div>

        {/* 审核面板 */}
        {renderReviewPanel()}

        {/* 底部操作栏 */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px',
          borderTop: '1px solid var(--border, #e5e7eb)', background: 'var(--bg-1, #fff)',
          position: 'relative', zIndex: 2,
        }}>
          <button
            onClick={requestReview}
            disabled={!currentContent || isReviewing || isGenerating}
            style={{
              padding: '8px 16px', borderRadius: 6, fontSize: 13, fontWeight: 500,
              background: currentContent && !isReviewing ? 'var(--brand-soft, #eef1fe)' : 'var(--bg-2, #f0f0f2)',
              color: currentContent && !isReviewing ? 'var(--brand, #4f6ef7)' : 'var(--ink-4)',
              border: 'none', cursor: currentContent && !isReviewing ? 'pointer' : 'not-allowed',
            }}
          >
            {isReviewing ? '审核中...' : 'AI 审核'}
          </button>

          <button
            onClick={handleSave}
            disabled={!currentContent || !reviewResult?.passed || saving}
            style={{
              padding: '8px 20px', borderRadius: 6, fontSize: 13, fontWeight: 600,
              background: currentContent && reviewResult?.passed ? 'var(--brand, #4f6ef7)' : 'var(--bg-2, #e5e7eb)',
              color: currentContent && reviewResult?.passed ? '#fff' : 'var(--ink-4)',
              border: 'none', cursor: currentContent && reviewResult?.passed ? 'pointer' : 'not-allowed',
            }}
          >
            {saving ? '保存中...' : '保存'}
          </button>

          {reviewResult && (
            <span style={{
              fontSize: 12, fontWeight: 500, marginLeft: 'auto',
              color: reviewResult.passed ? 'var(--success, #2e7d32)' : 'var(--danger, #c62828)',
            }}>
              {reviewResult.passed ? '审核通过' : '审核未通过'} · {reviewResult.overall_score}分
            </span>
          )}

          {saveError && (
            <span style={{ fontSize: 12, color: 'var(--danger, #c62828)' }}>{saveError}</span>
          )}
        </div>
      </div>
    </div>
  )
}

function EmptyTab({ text }: { text: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--ink-4)', fontSize: 13 }}>
      {text}
    </div>
  )
}

function simpleMarkdown(md: string): string {
  return md
    .replace(/^### (.+)$/gm, '<h3 style="font-size:16px;font-weight:600;margin:16px 0 8px">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 style="font-size:18px;font-weight:600;margin:20px 0 10px">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 style="font-size:20px;font-weight:700;margin:24px 0 12px">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code style="background:var(--bg-2,#f0f0f2);padding:2px 6px;border-radius:4px;font-size:13px">$1</code>')
    .replace(/^- (.+)$/gm, '<li style="margin-left:16px;list-style:disc">$1</li>')
    .replace(/^\d+\. (.+)$/gm, '<li style="margin-left:16px;list-style:decimal">$1</li>')
    .replace(/\n{2,}/g, '<br/><br/>')
    .replace(/\n/g, '<br/>')
}
