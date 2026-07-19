'use client'

import { useState, useRef, useEffect } from 'react'
import Icon from '@/components/Icon'
import { resourceApi } from '@/lib/api'
import { getStudentId } from '@/lib/student'
import { showToast } from '@/lib/utils'
import ResourceProgress from './ResourceProgress'
import type { ResourceItem, CreateMessage } from '@/app/resources/types'

export default function CreateModal({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: (r: ResourceItem) => void
}) {
  const [tab, setTab] = useState<'ai' | 'manual'>('ai')

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(0,0,0,0.45)', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        animation: 'fadeIn .2s ease',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--surface)', borderRadius: 'var(--r)',
          width: 640, maxHeight: '80vh', display: 'flex', flexDirection: 'column',
          boxShadow: 'var(--shadow-lg)', animation: 'emerge .3s var(--ease)',
        }}
      >
        <div style={{
          padding: '18px 22px', borderBottom: '1px solid var(--line)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <h3 style={{ fontSize: 16, fontWeight: 600 }}>创建资源</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)', padding: 4 }}>
            <Icon name="close" size={18} />
          </button>
        </div>

        <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--line)' }}>
          {(['ai', 'manual'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                flex: 1, padding: '12px 0', border: 'none', cursor: 'pointer',
                fontSize: 13, fontWeight: tab === t ? 600 : 400,
                color: tab === t ? 'var(--ink)' : 'var(--ink-3)',
                background: 'transparent',
                borderBottom: tab === t ? '2px solid var(--warm)' : '2px solid transparent',
                transition: 'all .2s',
              }}
            >
              {t === 'ai' ? '✨ AI 辅助创建' : '✏️ 手动创建'}
            </button>
          ))}
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: 22 }}>
          {tab === 'ai' ? <AICreatePanel onCreated={onCreated} onClose={onClose} /> : <ManualCreatePanel onCreated={onCreated} onClose={onClose} />}
        </div>
      </div>
    </div>
  )
}

function AICreatePanel({ onCreated, onClose }: { onCreated: (r: ResourceItem) => void; onClose: () => void }) {
  const [messages, setMessages] = useState<CreateMessage[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [status, setStatus] = useState('')
  const [currentStep, setCurrentStep] = useState('')
  const [progress, setProgress] = useState(0)
  const [showProgress, setShowProgress] = useState(false)
  const [streamContent, setStreamContent] = useState('')
  const [generatedResource, setGeneratedResource] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const msgsRef = useRef<HTMLDivElement>(null)
  const studentId = getStudentId()

  useEffect(() => {
    if (msgsRef.current) msgsRef.current.scrollTop = msgsRef.current.scrollHeight
  }, [messages])

  const send = async () => {
    if (!input.trim() || streaming) return
    const msg = input.trim()
    setMessages(prev => [...prev, { role: 'user', content: msg, timestamp: Date.now() }])
    setInput('')
    setStreaming(true)
    setShowProgress(true)
    setCurrentStep('generating')
    setProgress(0)
    setStreamContent('')
    setGeneratedResource(null)
    setSaved(false)
    setStatus('正在调用大模型生成学习资源...')

    try {
      const res = await resourceApi.createStream({
        student_id: studentId,
        message: msg,
        conversation_history: messages,
      })

      const reader = res.body?.getReader()
      if (!reader) throw new Error('No reader')

      const decoder = new TextDecoder()
      let buffer = ''
      let assistantContent = ''

      setMessages(prev => [...prev, { role: 'assistant', content: '', timestamp: Date.now() }])

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const jsonStr = line.slice(6).trim()
          if (!jsonStr || jsonStr === '[DONE]') continue

          try {
            const evt = JSON.parse(jsonStr)
            if (evt.type === 'token' && evt.content) {
              assistantContent += evt.content
              setStreamContent(assistantContent)
              setMessages(prev => {
                const arr = [...prev]
                arr[arr.length - 1] = { ...arr[arr.length - 1], content: assistantContent }
                return arr
              })
            }
            if (evt.type === 'progress') {
              if (evt.progress) setProgress(evt.progress)
              if (evt.message) setStatus(evt.message)
              if (evt.step) setCurrentStep(evt.step)
            }
            if (evt.type === 'result' && evt.data) {
              setGeneratedResource(evt.data)
              setShowProgress(false)
              setStreaming(false)
              setMessages(prev => [...prev, {
                role: 'assistant',
                content: `✅ 资源生成完成！\n\n请预览内容，确认后点击「保存」按钮保存到资源库。`,
                timestamp: Date.now()
              }])
            }
          } catch {}
        }
      }
    } catch (err: any) {
      setMessages(prev => {
        const arr = [...prev]
        if (arr[arr.length - 1]?.role === 'assistant') {
          arr[arr.length - 1] = { ...arr[arr.length - 1], content: `❌ ${err.message || '生成失败'}` }
        }
        return arr
      })
      setShowProgress(false)
    } finally {
      setStreaming(false)
      setStatus('')
    }
  }

  const handleSave = async () => {
    if (!generatedResource || saving) return
    setSaving(true)
    try {
      const savedResource = await resourceApi.save({
        student_id: studentId,
        title: generatedResource.title,
        resource_type: generatedResource.resource_type,
        content: generatedResource.content,
        knowledge_point: generatedResource.knowledge_point,
        difficulty: generatedResource.difficulty,
      })
      onCreated(savedResource)
      setSaved(true)
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `✅ 资源已保存到资源库！`,
        timestamp: Date.now()
      }])
    } catch (err: any) {
      showToast(err.message || '保存失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 380 }}>
      {showProgress && streaming ? (
        <ResourceProgress
          currentStep={currentStep}
          progress={progress}
          message={status}
          isStreaming={streaming}
          streamContent={streamContent}
        />
      ) : (
        <>
          <div ref={msgsRef} style={{ flex: 1, overflow: 'auto', marginBottom: 12 }}>
            {messages.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--ink-3)' }}>
                <Icon name="sparkles" size={32} style={{ opacity: 0.3 }} />
                <p style={{ fontSize: 13, marginTop: 8 }}>描述你想创建的资源，AI 帮你生成</p>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} style={{
                display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start',
                marginBottom: 10,
              }}>
                <div style={{
                  maxWidth: '80%', padding: '10px 14px', borderRadius: 12,
                  fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap',
                  background: m.role === 'user' ? 'var(--warm)' : 'var(--bg)',
                  color: m.role === 'user' ? '#fff' : 'var(--ink)',
                }}>
                  {m.content || (streaming && i === messages.length - 1 ? '...' : '')}
                </div>
              </div>
            ))}
          </div>
          {generatedResource && !saved ? (
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={send}
                disabled={streaming}
                className="btn btn-dark"
                style={{ flex: 1, padding: '12px' }}
              >
                <Icon name="refresh" size={14} style={{ marginRight: 6 }} />
                重新生成
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="btn btn-solid"
                style={{ flex: 1, padding: '12px' }}
              >
                {saving ? (
                  <>
                    <div className="loading-spinner" style={{ width: 14, height: 14, marginRight: 6 }} />
                    保存中...
                  </>
                ) : (
                  <>
                    <Icon name="save" size={14} style={{ marginRight: 6 }} />
                    保存资源
                  </>
                )}
              </button>
            </div>
          ) : saved ? (
            <button
              onClick={onClose}
              className="btn btn-solid"
              style={{ width: '100%', padding: '12px' }}
            >
              <Icon name="check" size={16} style={{ marginRight: 8 }} />
              完成，查看资源列表
            </button>
          ) : (
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
                placeholder="描述你需要的资源..."
                disabled={streaming}
                style={{
                  flex: 1, padding: '10px 14px', borderRadius: 'var(--r-xs)',
                  border: '1px solid var(--line)', background: 'var(--bg)',
                  fontSize: 13, outline: 'none', color: 'var(--ink)',
                }}
              />
              <button
                onClick={send}
                disabled={!input.trim() || streaming}
                className="btn btn-warm"
                style={{ padding: '10px 16px' }}
              >
                <Icon name="send" size={14} />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 380 }}>
      {showProgress && streaming ? (
        <ResourceProgress
          currentStep={currentStep}
          progress={progress}
          message={status}
          isStreaming={streaming}
          streamContent={streamContent}
        />
      ) : (
        <>
          <div ref={msgsRef} style={{ flex: 1, overflow: 'auto', marginBottom: 12 }}>
            {messages.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--ink-3)' }}>
                <Icon name="sparkles" size={32} style={{ opacity: 0.3 }} />
                <p style={{ fontSize: 13, marginTop: 8 }}>描述你想创建的资源，AI 帮你生成</p>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} style={{
                display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start',
                marginBottom: 10,
              }}>
                <div style={{
                  maxWidth: '80%', padding: '10px 14px', borderRadius: 12,
                  fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap',
                  background: m.role === 'user' ? 'var(--warm)' : 'var(--bg)',
                  color: m.role === 'user' ? '#fff' : 'var(--ink)',
                }}>
                  {m.content || (streaming && i === messages.length - 1 ? '...' : '')}
                </div>
              </div>
            ))}
          </div>
          {generatedResource ? (
            <button
              onClick={onClose}
              className="btn btn-solid"
              style={{ width: '100%', padding: '12px' }}
            >
              <Icon name="check" size={16} style={{ marginRight: 8 }} />
              完成，查看资源列表
            </button>
          ) : (
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
                placeholder="描述你需要的资源..."
                disabled={streaming}
                style={{
                  flex: 1, padding: '10px 14px', borderRadius: 'var(--r-xs)',
                  border: '1px solid var(--line)', background: 'var(--bg)',
                  fontSize: 13, outline: 'none', color: 'var(--ink)',
                }}
              />
              <button
                onClick={send}
                disabled={!input.trim() || streaming}
                className="btn btn-warm"
                style={{ padding: '10px 16px' }}
              >
                <Icon name="send" size={14} />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function ManualCreatePanel({ onCreated, onClose }: { onCreated: (r: ResourceItem) => void; onClose: () => void }) {
  const [title, setTitle] = useState('')
  const [type, setType] = useState('knowledge')
  const [knowledgePoint, setKnowledgePoint] = useState('')
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [created, setCreated] = useState(false)
  const studentId = getStudentId()

  const types = [
    { key: 'knowledge', label: '知识' },
    { key: 'code', label: '代码' },
    { key: 'mindmap', label: '导图' },
    { key: 'exercise', label: '题目' },
  ]

  const submit = async () => {
    if (!title.trim()) return showToast('请输入标题')
    setSubmitting(true)
    try {
      const payload: Record<string, unknown> = {}
      if (type === 'code') payload.code = content
      else if (type === 'mindmap') payload.mermaid_code = content
      else payload.knowledge = content

      const res = await resourceApi.createManual({
        student_id: studentId,
        title,
        resource_type: type,
        content: payload,
        knowledge_point: knowledgePoint,
      })
      onCreated(res)
      setCreated(true)
    } catch (err: any) {
      showToast(err.message || '创建失败')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <label style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 6, display: 'block' }}>标题</label>
        <input
          value={title} onChange={e => setTitle(e.target.value)}
          placeholder="资源标题"
          style={{
            width: '100%', padding: '10px 14px', borderRadius: 'var(--r-xs)',
            border: '1px solid var(--line)', background: 'var(--bg)',
            fontSize: 13, outline: 'none', color: 'var(--ink)',
          }}
        />
      </div>

      <div>
        <label style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 6, display: 'block' }}>类型</label>
        <div style={{ display: 'flex', gap: 8 }}>
          {types.map(t => (
            <button
              key={t.key}
              onClick={() => setType(t.key)}
              className={`tag ${type === t.key ? 'tag-warm' : 'tag-dark'}`}
              style={{ cursor: 'pointer', border: 'none', padding: '6px 14px' }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 6, display: 'block' }}>知识点</label>
        <input
          value={knowledgePoint} onChange={e => setKnowledgePoint(e.target.value)}
          placeholder="关联的知识点"
          style={{
            width: '100%', padding: '10px 14px', borderRadius: 'var(--r-xs)',
            border: '1px solid var(--line)', background: 'var(--bg)',
            fontSize: 13, outline: 'none', color: 'var(--ink)',
          }}
        />
      </div>

      <div>
        <label style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 6, display: 'block' }}>内容</label>
        <textarea
          value={content} onChange={e => setContent(e.target.value)}
          placeholder={type === 'mindmap' ? 'Mermaid 代码...' : type === 'code' ? '代码内容...' : '知识内容...'}
          rows={8}
          style={{
            width: '100%', padding: '10px 14px', borderRadius: 'var(--r-xs)',
            border: '1px solid var(--line)', background: 'var(--bg)',
            fontSize: 13, outline: 'none', color: 'var(--ink)', resize: 'vertical',
            fontFamily: type === 'code' || type === 'mindmap' ? "'JetBrains Mono', monospace" : 'inherit',
          }}
        />
      </div>

      {created ? (
        <button
          onClick={onClose}
          className="btn btn-solid"
          style={{ width: '100%', padding: '12px' }}
        >
          <Icon name="check" size={16} style={{ marginRight: 8 }} />
          完成，查看资源列表
        </button>
      ) : (
        <button
          onClick={submit}
          disabled={submitting}
          className="btn btn-solid"
          style={{ alignSelf: 'flex-end', padding: '10px 24px' }}
        >
          {submitting ? '创建中...' : '创建资源'}
        </button>
      )}
    </div>
  )
}
