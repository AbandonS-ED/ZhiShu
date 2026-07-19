'use client'

import { useState, useCallback } from 'react'
import { resourceApi } from '@/lib/api'
import { getStudentId } from '@/lib/student'
import type { ResourceContent, ExerciseItem, ReviewResult } from '@/app/resources/types'

type ResourceType = 'knowledge' | 'code' | 'mindmap' | 'exercise'

const TYPE_OPTIONS: { key: ResourceType; label: string }[] = [
  { key: 'knowledge', label: '知识讲解' },
  { key: 'code', label: '代码示例' },
  { key: 'mindmap', label: '思维导图' },
  { key: 'exercise', label: '练习题' },
]

const EXERCISE_TYPES: { value: ExerciseItem['type']; label: string }[] = [
  { value: 'choice', label: '选择题' },
  { value: 'judge', label: '判断题' },
  { value: 'short_answer', label: '简答题' },
  { value: 'coding', label: '编程题' },
]

const emptyExercise = (): ExerciseItem => ({
  type: 'choice',
  question: '',
  options: ['', '', '', ''],
  answer: '',
  explanation: '',
})

export default function ManualCreatePanel({ onSaved }: { onSaved?: () => void }) {
  const [resourceType, setResourceType] = useState<ResourceType>('knowledge')
  const [title, setTitle] = useState('')
  const [knowledgePoint, setKnowledgePoint] = useState('')
  const [content, setContent] = useState('')
  const [exercises, setExercises] = useState<ExerciseItem[]>([emptyExercise()])
  const [mermaidPreview, setMermaidPreview] = useState(false)
  const [reviewResult, setReviewResult] = useState<ReviewResult | null>(null)
  const [isReviewing, setIsReviewing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const buildContent = useCallback((): ResourceContent => {
    switch (resourceType) {
      case 'knowledge':
        return { knowledge: content }
      case 'code':
        return { code: content }
      case 'mindmap':
        return { mermaid_code: content }
      case 'exercise':
        return { exercises }
    }
  }, [resourceType, content, exercises])

  const handleReview = async () => {
    if (!knowledgePoint.trim()) {
      setError('请先填写知识点')
      return
    }
    setIsReviewing(true)
    setError('')
    setReviewResult(null)
    try {
      const result = await resourceApi.review({
        content: buildContent(),
        knowledge_point: knowledgePoint,
      })
      setReviewResult(result)
    } catch (e: any) {
      setError(e.message || 'AI审核失败')
    } finally {
      setIsReviewing(false)
    }
  }

  const handleSave = async () => {
    setError('')
    setSuccess('')
    if (!title.trim()) { setError('请填写资源标题'); return }
    if (!knowledgePoint.trim()) { setError('请填写知识点'); return }
    const built = buildContent()
    if (resourceType === 'exercise') {
      if (!exercises.length || exercises.some(ex => !ex.question.trim())) {
        setError('请填写所有题目内容')
        return
      }
    } else if (!content.trim()) {
      setError('请填写内容')
      return
    }

    setIsSaving(true)
    try {
      await resourceApi.createManual({
        student_id: getStudentId(),
        title,
        resource_type: resourceType,
        content: built,
        knowledge_point: knowledgePoint,
      })
      setSuccess('资源保存成功')
      setTitle('')
      setKnowledgePoint('')
      setContent('')
      setExercises([emptyExercise()])
      setReviewResult(null)
      onSaved?.()
    } catch (e: any) {
      setError(e.message || '保存失败')
    } finally {
      setIsSaving(false)
    }
  }

  const updateExercise = (index: number, patch: Partial<ExerciseItem>) => {
    setExercises(prev => prev.map((ex, i) => i === index ? { ...ex, ...patch } : ex))
  }
  const updateOption = (exIdx: number, optIdx: number, value: string) => {
    setExercises(prev => prev.map((ex, i) => {
      if (i !== exIdx || !ex.options) return ex
      const opts = [...ex.options]
      opts[optIdx] = value
      return { ...ex, options: opts }
    }))
  }
  const addOption = (exIdx: number) => {
    setExercises(prev => prev.map((ex, i) =>
      i === exIdx ? { ...ex, options: [...(ex.options || []), ''] } : ex
    ))
  }
  const removeOption = (exIdx: number, optIdx: number) => {
    setExercises(prev => prev.map((ex, i) => {
      if (i !== exIdx || !ex.options) return ex
      return { ...ex, options: ex.options.filter((_: string, j: number) => j !== optIdx) }
    }))
  }

  const scoreColor = (score: number) =>
    score >= 80 ? 'var(--success)' : score >= 60 ? 'var(--warm)' : 'var(--danger)'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 720 }}>
      {/* Type selector */}
      <div>
        <label style={labelStyle}>资源类型</label>
        <div style={{ display: 'flex', gap: 8 }}>
          {TYPE_OPTIONS.map(t => (
            <button
              key={t.key}
              onClick={() => setResourceType(t.key)}
              style={{
                ...typeBtnStyle,
                background: resourceType === t.key ? 'var(--ink)' : 'var(--surface)',
                color: resourceType === t.key ? 'var(--bg)' : 'var(--ink-2)',
                borderColor: resourceType === t.key ? 'var(--ink)' : 'var(--line)',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Title */}
      <div>
        <label style={labelStyle}>资源标题</label>
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="输入资源标题"
          style={inputStyle}
        />
      </div>

      {/* Knowledge point */}
      <div>
        <label style={labelStyle}>知识点</label>
        <input
          value={knowledgePoint}
          onChange={e => setKnowledgePoint(e.target.value)}
          placeholder="输入关联知识点"
          style={inputStyle}
        />
      </div>

      {/* Content editor */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <label style={labelStyle}>
            {resourceType === 'knowledge' && '知识内容（Markdown）'}
            {resourceType === 'code' && '代码内容'}
            {resourceType === 'mindmap' && 'Mermaid 语法'}
            {resourceType === 'exercise' && '题目列表'}
          </label>
          {resourceType === 'mindmap' && (
            <button
              onClick={() => setMermaidPreview(p => !p)}
              style={{ ...typeBtnStyle, fontSize: 11.5, padding: '4px 10px' }}
            >
              {mermaidPreview ? '编辑' : '预览'}
            </button>
          )}
        </div>

        {resourceType !== 'exercise' ? (
          resourceType === 'mindmap' && mermaidPreview ? (
            <div style={previewBoxStyle}>
              <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: 13, color: 'var(--ink-2)' }}>
                {content || '（暂无内容）'}
              </pre>
            </div>
          ) : (
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder={
                resourceType === 'knowledge'
                  ? '输入 Markdown 格式的知识讲解内容…'
                  : resourceType === 'code'
                  ? '输入代码示例…'
                  : '输入 Mermaid 图表语法，如:\ngraph TD\n  A[开始] --> B[结束]'
              }
              style={{
                ...textareaStyle,
                fontFamily: resourceType === 'code' ? "'JetBrains Mono', monospace" : 'inherit',
                minHeight: resourceType === 'code' ? 200 : 260,
              }}
            />
          )
        ) : (
          /* Exercise list */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {exercises.map((ex, exIdx) => (
              <div key={exIdx} style={exerciseCardStyle}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
                    题目 {exIdx + 1}
                  </span>
                  {exercises.length > 1 && (
                    <button
                      onClick={() => setExercises(prev => prev.filter((_, i) => i !== exIdx))}
                      style={{ ...typeBtnStyle, fontSize: 11, padding: '3px 8px', color: 'var(--danger)', borderColor: 'var(--danger)' }}
                    >
                      删除
                    </button>
                  )}
                </div>

                {/* Exercise type */}
                <select
                  value={ex.type}
                  onChange={e => updateExercise(exIdx, { type: e.target.value as ExerciseItem['type'] })}
                  style={selectStyle}
                >
                  {EXERCISE_TYPES.map(et => (
                    <option key={et.value} value={et.value}>{et.label}</option>
                  ))}
                </select>

                {/* Question */}
                <textarea
                  value={ex.question}
                  onChange={e => updateExercise(exIdx, { question: e.target.value })}
                  placeholder="题目内容"
                  style={{ ...textareaStyle, minHeight: 72 }}
                />

                {/* Options for choice type */}
                {ex.type === 'choice' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
                    <label style={{ ...labelStyle, marginBottom: 0 }}>选项</label>
                    {(ex.options || []).map((opt, optIdx) => (
                      <div key={optIdx} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <span style={{ fontSize: 12, color: 'var(--ink-3)', width: 22, textAlign: 'center' }}>
                          {String.fromCharCode(65 + optIdx)}
                        </span>
                        <input
                          value={opt}
                          onChange={e => updateOption(exIdx, optIdx, e.target.value)}
                          placeholder={`选项 ${String.fromCharCode(65 + optIdx)}`}
                          style={{ ...inputStyle, flex: 1, marginBottom: 0 }}
                        />
                        {(ex.options?.length || 0) > 2 && (
                          <button
                            onClick={() => removeOption(exIdx, optIdx)}
                            style={{ ...typeBtnStyle, fontSize: 11, padding: '3px 8px', color: 'var(--danger)', borderColor: 'var(--danger)' }}
                          >
                            -
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      onClick={() => addOption(exIdx)}
                      style={{ ...typeBtnStyle, fontSize: 11, padding: '4px 10px', alignSelf: 'flex-start' }}
                    >
                      + 添加选项
                    </button>
                  </div>
                )}

                {/* Answer */}
                <input
                  value={ex.answer}
                  onChange={e => updateExercise(exIdx, { answer: e.target.value })}
                  placeholder={ex.type === 'choice' ? '正确答案（如 A）' : '参考答案'}
                  style={{ ...inputStyle, marginTop: 4 }}
                />

                {/* Explanation */}
                <input
                  value={ex.explanation || ''}
                  onChange={e => updateExercise(exIdx, { explanation: e.target.value })}
                  placeholder="答案解析（可选）"
                  style={{ ...inputStyle, marginTop: 4 }}
                />
              </div>
            ))}
            <button
              onClick={() => setExercises(prev => [...prev, emptyExercise()])}
              style={addExerciseBtnStyle}
            >
              + 添加题目
            </button>
          </div>
        )}
      </div>

      {/* Review result */}
      {reviewResult && (
        <div style={reviewBoxStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>AI 审核结果</span>
            <span style={{
              fontSize: 18, fontWeight: 700, color: scoreColor(reviewResult.overall_score),
            }}>
              {reviewResult.overall_score}分
            </span>
            <span style={{
              fontSize: 11, padding: '2px 8px', borderRadius: 6, fontWeight: 600,
              background: reviewResult.passed ? 'var(--success-soft)' : 'var(--danger-soft)',
              color: reviewResult.passed ? 'var(--success)' : 'var(--danger)',
            }}>
              {reviewResult.passed ? '通过' : '未通过'}
            </span>
          </div>
          <p style={{ fontSize: 12.5, color: 'var(--ink-2)', margin: '0 0 8px' }}>
            {reviewResult.summary}
          </p>
          {(['content_quality', 'knowledge_accuracy', 'format_check', 'learning_suggestions'] as const).map(key => {
            const dim = reviewResult.dimensions[key]
            const labels: Record<string, string> = {
              content_quality: '内容质量',
              knowledge_accuracy: '知识准确性',
              format_check: '格式检查',
              learning_suggestions: '学习建议',
            }
            return (
              <div key={key} style={{ marginBottom: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-2)' }}>
                  {labels[key]}: <span style={{ color: scoreColor(dim.score) }}>{dim.score}分</span>
                </span>
                {dim.issues.length > 0 && (
                  <ul style={{ margin: '2px 0 0 16px', fontSize: 11.5, color: 'var(--danger)' }}>
                    {dim.issues.map((iss, i) => <li key={i}>{iss}</li>)}
                  </ul>
                )}
                {dim.suggestions.length > 0 && (
                  <ul style={{ margin: '2px 0 0 16px', fontSize: 11.5, color: 'var(--warm)' }}>
                    {dim.suggestions.map((s, i) => <li key={i}>{s}</li>)}
                  </ul>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Messages */}
      {error && <div style={msgStyle('var(--danger)')}>{error}</div>}
      {success && <div style={msgStyle('var(--success)')}>{success}</div>}

      {/* Bottom bar */}
      <div style={bottomBarStyle}>
        <button
          onClick={handleReview}
          disabled={isReviewing || isSaving}
          style={{
            ...typeBtnStyle,
            padding: '8px 20px',
            fontSize: 13,
            opacity: isReviewing ? 0.6 : 1,
          }}
        >
          {isReviewing ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span className="loading-spinner" style={{ width: 14, height: 14 }} />
              审核中…
            </span>
          ) : 'AI审核'}
        </button>

        <button
          onClick={handleSave}
          disabled={isSaving || isReviewing}
          style={{
            ...typeBtnStyle,
            padding: '8px 28px',
            fontSize: 13,
            background: 'var(--ink)',
            color: 'var(--bg)',
            borderColor: 'var(--ink)',
            opacity: isSaving ? 0.6 : 1,
          }}
        >
          {isSaving ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span className="loading-spinner" style={{ width: 14, height: 14, borderTopColor: 'var(--bg)' }} />
              保存中…
            </span>
          ) : '保存'}
        </button>
      </div>
    </div>
  )
}

/* ── Styles ── */

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 12.5,
  fontWeight: 600,
  color: 'var(--ink-2)',
  marginBottom: 6,
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '9px 12px',
  border: '1px solid var(--line)',
  borderRadius: 7,
  background: 'var(--bg)',
  color: 'var(--ink)',
  fontSize: 13,
  fontFamily: "'Inter', sans-serif",
  outline: 'none',
  transition: 'border-color .15s',
  marginBottom: 2,
}

const textareaStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  border: '1px solid var(--line)',
  borderRadius: 7,
  background: 'var(--bg)',
  color: 'var(--ink)',
  fontSize: 13,
  fontFamily: "'Inter', sans-serif",
  outline: 'none',
  resize: 'vertical',
  minHeight: 260,
  lineHeight: 1.6,
  transition: 'border-color .15s',
}

const selectStyle: React.CSSProperties = {
  padding: '7px 10px',
  border: '1px solid var(--line)',
  borderRadius: 7,
  background: 'var(--bg)',
  color: 'var(--ink)',
  fontSize: 12.5,
  fontFamily: "'Inter', sans-serif",
  outline: 'none',
  marginBottom: 6,
  minWidth: 120,
}

const typeBtnStyle: React.CSSProperties = {
  padding: '6px 14px',
  borderRadius: 7,
  border: '1px solid var(--line)',
  background: 'transparent',
  fontSize: 12.5,
  fontFamily: "'Inter', sans-serif",
  fontWeight: 500,
  cursor: 'pointer',
  transition: 'all .2s',
  color: 'var(--ink-2)',
}

const previewBoxStyle: React.CSSProperties = {
  padding: '14px 16px',
  border: '1px solid var(--line)',
  borderRadius: 7,
  background: 'var(--bg-subtle)',
  minHeight: 260,
  overflow: 'auto',
}

const exerciseCardStyle: React.CSSProperties = {
  padding: '14px 16px',
  border: '1px solid var(--line)',
  borderRadius: 10,
  background: 'var(--surface)',
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
}

const addExerciseBtnStyle: React.CSSProperties = {
  padding: '10px 16px',
  borderRadius: 7,
  border: '1px dashed var(--ink-4)',
  background: 'transparent',
  fontSize: 13,
  fontFamily: "'Inter', sans-serif",
  fontWeight: 500,
  cursor: 'pointer',
  color: 'var(--ink-3)',
  transition: 'all .2s',
  textAlign: 'center',
}

const reviewBoxStyle: React.CSSProperties = {
  padding: '14px 18px',
  border: '1px solid var(--line)',
  borderRadius: 10,
  background: 'var(--surface)',
}

const bottomBarStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  gap: 10,
  paddingTop: 8,
  borderTop: '1px solid var(--line)',
}

const msgStyle = (color: string): React.CSSProperties => ({
  fontSize: 12.5,
  color,
  padding: '8px 12px',
  borderRadius: 7,
  background: color === 'var(--success)' ? 'var(--success-soft)' : 'var(--danger-soft)',
})
