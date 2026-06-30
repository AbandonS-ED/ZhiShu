'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { exerciseApi, evaluationApi, profileApi } from '@/lib/api'
import { getStudentId } from '@/lib/student'
import { markdownToHtml } from '@/lib/utils'
import RobotIcon from '@/components/RobotIcon'
import { usePageTimer } from '@/hooks/usePageTimer'
import Icon from '@/components/Icon'

const BASE_URL = 'http://localhost:8001/api/v1'
const HIDDEN_KEY = 'zhishu_hidden_exercises'

// 与 api.ts / types/index.ts 保持一致
interface Exercise {
  exercise_id: string
  type: 'choice' | 'judge' | 'short_answer' | 'coding'
  question: string
  options?: string[]
  answer?: string
  explanation?: string
  difficulty: number
  knowledge_point?: string
  source?: string
}

interface Answer {
  selected: number | boolean | string | null
  correct: boolean | null
}

interface RecentItem {
  name: string
  correct: boolean | null
  type: string
  time: string
}

function getTypeLabel(type: string) {
  return { choice: '选择题', judge: '判断题', short_answer: '简答题', coding: '编程题' }[type] || type
}

function getTypeClass(type: string) {
  return { choice: 'type-choice', judge: 'type-judge', short_answer: 'type-short', coding: 'type-code' }[type] || ''
}

function getDiffLabel(d?: number) {
  if (!d && d !== 0) return '中级'
  if (d < 33) return '初级'
  if (d < 66) return '中级'
  return '高级'
}

function getDiffClass(d?: number) {
  if (!d && d !== 0) return 'diff-med'
  if (d < 33) return 'diff-easy'
  if (d < 66) return 'diff-med'
  return 'diff-hard'
}

function parseAnswer(ex: Exercise): number | boolean | string | null {
  if (ex.type === 'choice' && typeof ex.answer === 'string') {
    const letter = ex.answer.trim().toUpperCase().charAt(0)
    if (letter >= 'A' && letter <= 'Z') return letter.charCodeAt(0) - 65
    const num = parseInt(ex.answer, 10)
    if (!isNaN(num)) return num
  }
  if (ex.type === 'judge' && typeof ex.answer === 'string') {
    const v = ex.answer.trim().toLowerCase()
    if (v === 'true' || v === 't' || v === '正确' || v === '对' || v === '✔' || v === '√' || v === '是' || v === '1') return true
    if (v === 'false' || v === 'f' || v === '错误' || v === '错' || v === '✗' || v === '✘' || v === '否' || v === '0') return false
  }
  return ex.answer ?? null
}

function checkChoice(ex: Exercise, selected: number): boolean {
  const ans = parseAnswer(ex)
  return ans === selected
}

function checkJudge(ex: Exercise, selected: boolean): boolean {
  const ans = parseAnswer(ex)
  return ans === selected
}

function ConfirmDialog({ message, onConfirm, onCancel }: { message: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="modal-overlay show" onClick={onCancel}>
      <div className="modal" style={{ maxWidth: 400 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-hd"><h3>确认操作</h3></div>
        <div className="modal-bd" style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--ink)' }}>{message}</div>
        <div className="modal-ft" style={{ justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn btn-sm" onClick={onCancel}>取消</button>
          <button className="btn btn-sm btn-solid" style={{ background: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={onConfirm}>确认</button>
        </div>
      </div>
    </div>
  )
}

export default function TikuPage() {
  const [tab, setTab] = useState<string>('all')
  const [answers, setAnswers] = useState<Record<string, Answer>>({})
  const [recentLog, setRecentLog] = useState<RecentItem[]>([])
  const [revealed, setRevealed] = useState<Set<string>>(new Set())
  const [genInput, setGenInput] = useState('')
  const [genCount, setGenCount] = useState(5)
  const [generating, setGenerating] = useState(false)
  const [genResult, setGenResult] = useState('')
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set())
  const [showHidden, setShowHidden] = useState(false)
  const [loading, setLoading] = useState(true)
  const [confirmDlg, setConfirmDlg] = useState<{ message: string; onConfirm: () => void } | null>(null)

  // 记录页面停留时间
  usePageTimer('exercise')

  // 消息队列：确保每条进度消息至少显示 1.5 秒
  const msgQueueRef = useRef<string[]>([])
  const msgTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastMsgTimeRef = useRef(0)

  // 从 URL 读取 ?kp=xxx，自动填入知识点输入框
  useEffect(() => {
    const kp = new URLSearchParams(window.location.search).get('kp')
    if (kp) setGenInput(kp)
  }, [])

  // 从题池加载 + 读隐藏列表
  useEffect(() => {
    const sid = getStudentId()
    if (!sid) { setLoading(false); return }
    try {
      const raw = localStorage.getItem(HIDDEN_KEY)
      if (raw) setHiddenIds(new Set(JSON.parse(raw)))
    } catch {}
    fetch(`${BASE_URL}/resource/exercises/pool?student_id=${sid}&count=30`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('zhishu_token') || ''}` },
    })
      .then((r) => r.json())
      .then((data) => {
        setExercises(data.exercises || [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const hideExercise = useCallback((id: string) => {
    setHiddenIds((prev) => {
      const next = new Set(prev)
      next.add(id)
      localStorage.setItem(HIDDEN_KEY, JSON.stringify(Array.from(next)))
      return next
    })
  }, [])

  const restoreHidden = useCallback(() => {
    setHiddenIds(new Set())
    setShowHidden(false)
    localStorage.removeItem(HIDDEN_KEY)
  }, [])

  // 处理消息队列：每条消息至少显示 2.5 秒
  const processMsgQueue = useCallback(() => {
    if (msgTimerRef.current) return
    const queue = msgQueueRef.current
    if (queue.length === 0) return

    const msg = queue.shift()!
    setGenResult(msg)
    lastMsgTimeRef.current = Date.now()

    // 如果队列还有消息，2.5 秒后处理下一条
    if (queue.length > 0) {
      msgTimerRef.current = setTimeout(() => {
        msgTimerRef.current = null
        processMsgQueue()
      }, 2500)
    }
  }, [])

  // 清空消息队列
  const clearMsgQueue = useCallback(() => {
    msgQueueRef.current = []
    if (msgTimerRef.current) {
      clearTimeout(msgTimerRef.current)
      msgTimerRef.current = null
    }
  }, [])

  // AI 出题
  const generateExercises = () => {
    if (!genInput.trim() || generating) return
    setGenerating(true)
    setGenResult('正在生成...')
    clearMsgQueue()

    exerciseApi.generateStream(
      getStudentId(),
      genInput.trim(),
      (e) => {
        if (e.type === 'progress' && e.message) {
          // 将消息加入队列
          msgQueueRef.current.push(e.message)
          processMsgQueue()
        }
        if (e.type === 'result' && e.data) {
          const data = e.data as { knowledge_point?: string; exercises?: Array<Record<string, unknown>>; count?: number }
          const newExs: Exercise[] = (data.exercises || []).map((ex: any) => ({
            exercise_id: ex.exercise_id || `ai-${Date.now()}-${Math.random()}`,
            type: ex.type as Exercise['type'],
            question: ex.question || '',
            options: ex.options,
            answer: ex.answer,
            explanation: ex.explanation || '',
            difficulty: ex.difficulty ?? 50,
            knowledge_point: data.knowledge_point || genInput.trim(),
            source: 'ai',
          }))
          setExercises((prev) => [...newExs, ...prev])
          // 不在这里清队列，让 "正在防幻觉验证..." 和 "正在保存..." 显示完
          setGenResult(`已生成 ${data.count || newExs.length} 道「${data.knowledge_point || genInput.trim()}」题目`)
          evaluationApi.recordAction({
            student_id: getStudentId(),
            action: 'generate',
            resource_type: 'exercise',
            knowledge_point: data.knowledge_point || genInput.trim(),
            detail: { count: data.count || newExs.length },
          }).catch(() => {})
        }
        if (e.type === 'error') {
          clearMsgQueue()
          setGenResult(`${e.message || '调用失败'}`)
        }
        if (e.type === 'done') {
          // done 时延迟清队列，让最后的消息显示完
          setTimeout(() => clearMsgQueue(), 3000)
        }
        if (e.type === 'done' || e.type === 'error') {
          setGenerating(false)
        }
      },
      genCount
    )
  }

  const hiddenFiltered = exercises.filter((e) => !hiddenIds.has(e.exercise_id))
  const visibleExercises = showHidden ? exercises : hiddenFiltered
  const filtered = visibleExercises.filter((e) => tab === 'all' || e.type === tab)
  const hiddenCount = exercises.length - hiddenFiltered.length

  // Stats
  const total = visibleExercises.length
  const answeredCount = Object.keys(answers).length
  const correctCount = Object.values(answers).filter((a) => a.correct === true).length
  const pct = answeredCount ? Math.round((correctCount / answeredCount) * 100) : 0
  const answerPct = total ? Math.round((answeredCount / total) * 100) : 0

  // Topics
  const topics: Record<string, { total: number; correct: number; answered: number }> = {}
  visibleExercises.forEach((ex) => {
    const kp = ex.knowledge_point || '未分类'
    if (!topics[kp]) topics[kp] = { total: 0, correct: 0, answered: 0 }
    topics[kp].total++
    if (answers[ex.exercise_id]) {
      topics[kp].answered++
      if (answers[ex.exercise_id].correct === true) topics[kp].correct++
    }
  })

  const addRecent = useCallback((ex: Exercise, correct: boolean | null) => {
    setRecentLog((prev) => {
      const next = [{ name: ex.question.slice(0, 20) + '...', correct, type: ex.type, time: '刚刚' }, ...prev]
      return next.slice(0, 8)
    })
  }, [])

  const answerChoice = useCallback((id: string, selected: number) => {
    if (answers[id]) return
    const ex = exercises.find((e) => e.exercise_id === id)
    if (!ex) return
    const correct = checkChoice(ex, selected)
    setAnswers((prev) => ({ ...prev, [id]: { selected, correct } }))
    addRecent(ex, correct)
    evaluationApi.recordAction({
      student_id: getStudentId(),
      action: 'exercise',
      resource_type: 'exercise',
      knowledge_point: ex.knowledge_point,
      score: correct ? 100 : 0,
    }).catch(() => {})
    // 使用 AI Agent 分析练习行为并更新画像
    profileApi.analyzeBehavior('exercise', {
      knowledge_point: ex.knowledge_point,
      correct: correct,
      question_type: ex.type,
    }).catch(() => {})
  }, [answers, exercises, addRecent])

  const answerJudge = useCallback((id: string, selected: boolean) => {
    if (answers[id]) return
    const ex = exercises.find((e) => e.exercise_id === id)
    if (!ex) return
    const correct = checkJudge(ex, selected)
    setAnswers((prev) => ({ ...prev, [id]: { selected, correct } }))
    addRecent(ex, correct)
    evaluationApi.recordAction({
      student_id: getStudentId(),
      action: 'exercise',
      resource_type: 'exercise',
      knowledge_point: ex.knowledge_point,
      score: correct ? 100 : 0,
    }).catch(() => {})
    // 使用 AI Agent 分析练习行为并更新画像
    profileApi.analyzeBehavior('exercise', {
      knowledge_point: ex.knowledge_point,
      correct: correct,
      question_type: ex.type,
    }).catch(() => {})
  }, [answers, exercises, addRecent])

  const answerShort = useCallback((id: string, value: string) => {
    if (!value.trim()) return
    const ex = exercises.find((e) => e.exercise_id === id)
    setAnswers((prev) => ({ ...prev, [id]: { selected: value, correct: null } }))
    setRevealed((prev) => new Set(prev).add(id))
    if (ex) addRecent(ex, null)
  }, [exercises, addRecent])

  const revealAnswer = useCallback((id: string) => {
    const ex = exercises.find((e) => e.exercise_id === id)
    setAnswers((prev) => ({ ...prev, [id]: { selected: null, correct: null } }))
    setRevealed((prev) => new Set(prev).add(id))
    if (ex) addRecent(ex, null)
  }, [exercises, addRecent])

  const resetOne = useCallback((id: string) => {
    setAnswers((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
    setRevealed((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }, [])

  const doClear = useCallback(() => {
    const ids = visibleExercises.map((e) => e.exercise_id)
    if (!ids.length) return
    setConfirmDlg({
      message: `确定要清空当前列表（${ids.length} 道题）？可以在侧边栏恢复`,
      onConfirm: () => {
        setHiddenIds((prev) => {
          const next = new Set(prev)
          ids.forEach((id) => next.add(id))
          localStorage.setItem(HIDDEN_KEY, JSON.stringify(Array.from(next)))
          return next
        })
        setShowHidden(false)
        setConfirmDlg(null)
      },
    })
  }, [visibleExercises])

  const circ = 364.4
  const ringColor = answerPct >= 80 ? 'var(--success)' : answerPct >= 40 ? 'var(--warm)' : 'var(--ink-3)'

  if (loading) {
    return (
      <div style={{ padding: '12px 0' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16 }}>
          <div className="skeleton" style={{ width: 100, height: 36, borderRadius: 8 }} />
          <div className="skeleton" style={{ width: 60, height: 36, borderRadius: 8 }} />
        </div>
        <div className="skeleton-card">
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <div className="skeleton" style={{ width: 64, height: 64, borderRadius: '50%' }} />
            <div style={{ flex: 1 }}>
              <div className="skeleton skeleton-line w60" style={{ height: 18 }} />
              <div className="skeleton skeleton-line w40" />
            </div>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12, marginTop: 12 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton-card">
              <div className="skeleton skeleton-line w80" />
              <div className="skeleton skeleton-line w60" />
              <div className="skeleton skeleton-line w40" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <>
      {/* AI 生成面板 */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '12px 0', padding: 14, background: 'var(--brand-soft)', borderRadius: 10, border: '1px solid var(--border)' }}>
        <span style={{ fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6 }}><RobotIcon size={18} /> AI 出题</span>
        <input
          value={genInput}
          onChange={e => setGenInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && generateExercises()}
          placeholder="输入知识点（如：反向传播、决策树）"
          disabled={generating}
          style={{
            flex: 1,
            padding: '7px 14px',
            border: '1px solid var(--border)',
            borderRadius: 'var(--r-xs, 6px)',
            background: 'var(--surface)',
            fontSize: 14,
            outline: 'none',
            transition: 'border-color 0.2s',
          }}
        />

        {/* Segmented count selector */}
        <div style={{
          display: 'inline-flex',
          borderRadius: 'var(--r-xs, 6px)',
          border: '1px solid var(--border)',
          overflow: 'hidden',
          background: 'var(--surface)',
          flexShrink: 0,
        }}>
          {[5, 10, 15, 20].map((n, i) => {
            const active = genCount === n
            return (
              <button
                key={n}
                onClick={() => setGenCount(n)}
                disabled={generating}
                style={{
                  padding: '6px 14px',
                  border: 'none',
                  borderRight: i < 3 ? '1px solid var(--border)' : 'none',
                  background: active ? 'var(--brand)' : 'transparent',
                  color: active ? 'white' : 'var(--ink-2)',
                  cursor: generating ? 'not-allowed' : 'pointer',
                  fontSize: 13,
                  fontWeight: active ? 600 : 400,
                  transition: 'all 0.2s ease',
                  outline: 'none',
                  position: 'relative',
                  lineHeight: 1,
                }}
                onMouseEnter={e => {
                  if (!active) e.currentTarget.style.background = 'var(--bg-subtle, rgba(0,0,0,0.04))'
                }}
                onMouseLeave={e => {
                  if (!active) e.currentTarget.style.background = 'transparent'
                }}
              >
                {n} 道
              </button>
            )
          })}
        </div>

        <button
          onClick={generateExercises}
          disabled={generating || !genInput.trim()}
          className="btn btn-solid"
          style={{
            padding: '7px 18px',
            borderRadius: 'var(--r-xs, 6px)',
            whiteSpace: 'nowrap',
            fontSize: 14,
            opacity: (generating || !genInput.trim()) ? 0.6 : 1,
            cursor: (generating || !genInput.trim()) ? 'not-allowed' : 'pointer',
            transition: 'opacity 0.2s',
          }}
        >
          {generating ? '生成中...' : '生成'}
        </button>
      </div>
      {genResult && (
        generating ? (
          <div className="gen-loading">
            <div className="gen-spinner" />
            <span>{genResult}</span>
          </div>
        ) : (
          <div style={{ padding: 12, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, marginBottom: 12, fontSize: 13 }} dangerouslySetInnerHTML={{ __html: markdownToHtml(genResult) }} />
        )
      )}

      {/* Stats */}
      <div className="stats-strip">
        <div className="ss-item">
          <div className="ss-label">总题数</div>
          <div className="ss-val">{total}</div>
          <div className="ss-sub">题池共 {Object.keys(topics).length} 个知识点</div>
        </div>
        <div className="ss-item">
          <div className="ss-label">已作答</div>
          <div className="ss-val" style={{ color: 'var(--warm)' }}>{answeredCount}</div>
          <div className="ss-sub">{total - answeredCount} 题未答</div>
        </div>
        <div className="ss-item">
          <div className="ss-label">正确率</div>
          <div className="ss-val" style={{ color: pct >= 70 ? 'var(--success)' : pct >= 40 ? 'var(--warm)' : 'var(--danger)' }}>{pct}%</div>
          <div className="ss-sub">{correctCount}/{answeredCount} 正确</div>
        </div>
        <div className="ss-item">
          <div className="ss-label">错题</div>
          <div className="ss-val" style={{ color: 'var(--danger)' }}>{answeredCount - correctCount}</div>
          <div className="ss-sub">可回顾重做</div>
        </div>
      </div>

      {/* Layout */}
      <div className="ex-layout" style={{ marginTop: '16px' }}>
        {/* Main */}
        <div className="ex-main">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <div className="ex-tabs">
              {(['all', 'choice', 'judge', 'short_answer', 'coding'] as const).map((t) => (
                <button
                  key={t}
                  className={`ex-tab${tab === t ? ' active' : ''}`}
                  onClick={() => setTab(t)}
                >
                  {t === 'all' ? '全部' : getTypeLabel(t)}
                </button>
              ))}
            </div>
            <button className="btn btn-sm" style={{ marginLeft: 'auto', color: 'var(--danger)' }} onClick={doClear}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
              清空列表
            </button>
          </div>

          {/* Exercises */}
          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--ink-3)' }}>
              <div style={{ marginBottom: '10px' }}><Icon name="book" size={32} /></div>
              <div style={{ fontSize: '14px' }}>暂无题目</div>
              <div style={{ fontSize: 12, marginTop: 8 }}>试试 AI 出题，或让管理员往题库添加题目</div>
            </div>
          ) : (
            filtered.map((ex, i) => {
              const a = answers[ex.exercise_id]
              const isAnswered = !!a
              const isRevealed = revealed.has(ex.exercise_id)
              const cardClass = isAnswered ? (a.correct === true ? 'answered' : a.correct === false ? 'answered-wrong' : '') : ''

              return (
                <div key={ex.exercise_id} className={`ex-card ${cardClass}`} style={{ animationDelay: `${i * 0.04}s` }}>
                  <div className="ex-hd">
                    <div className="qnum">{String(i + 1).padStart(2, '0')}</div>
                    <div className="qmeta">
                      <span className={`qtype ${getTypeClass(ex.type)}`}>{getTypeLabel(ex.type)}</span>
                      <span className={`qdiff ${getDiffClass(ex.difficulty)}`}>{getDiffLabel(ex.difficulty)}</span>
                    </div>
                    <div className="qkp">{ex.knowledge_point || '未分类'}</div>
                    {ex.source === 'bank' && (
                      <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'var(--info-soft)', color: 'var(--info)' }}>题库</span>
                    )}
                  </div>
                  <div className="ex-q" dangerouslySetInnerHTML={{ __html: markdownToHtml(ex.question) }} />

                  {/* Choice options */}
                  {ex.type === 'choice' && ex.options && (
                    <div className="ex-opts">
                      {ex.options.map((o, j) => {
                        const correctAns = parseAnswer(ex)
                        let cls = ''
                        if (isAnswered) {
                          cls = 'disabled'
                          if (j === correctAns) cls += ' correct'
                          if (a.selected === j && j !== correctAns) cls += ' wrong'
                        }
                        return (
                          <div key={j} className={`ex-opt ${cls}`} onClick={() => answerChoice(ex.exercise_id, j)}>
                            <div className="key">{String.fromCharCode(65 + j)}</div>
                            <div className="opt-text">{o}</div>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* Judge buttons */}
                  {ex.type === 'judge' && (
                    <div className="judge-btns">
                      <button
                        className={`judge-btn${isAnswered ? ` disabled${parseAnswer(ex) === true ? ' correct-t' : ' wrong-t'}${a.selected === true ? (parseAnswer(ex) === true ? ' correct-t' : ' wrong-t') : ''}` : ''}`}
                        onClick={() => answerJudge(ex.exercise_id, true)}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="16" height="16"><polyline points="20 6 9 17 4 12" /></svg> 正确
                      </button>
                      <button
                        className={`judge-btn${isAnswered ? ` disabled${parseAnswer(ex) === false ? ' correct-f' : ' wrong-f'}${a.selected === false ? (parseAnswer(ex) === false ? ' correct-f' : ' wrong-f') : ''}` : ''}`}
                        onClick={() => answerJudge(ex.exercise_id, false)}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="16" height="16"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg> 错误
                      </button>
                    </div>
                  )}

                  {/* Short answer / Code */}
                  {(ex.type === 'short_answer' || ex.type === 'coding') && (
                    <>
                      <textarea
                        className="short-area"
                        placeholder={ex.type === 'coding' ? '在此编写你的代码...' : '输入你的答案...'}
                        style={ex.type === 'coding' ? { fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' } : {}}
                        disabled={isAnswered}
                        id={`sa-${ex.exercise_id}`}
                      />
                      {!isAnswered && (
                        <div style={{ marginTop: '8px' }}>
                          <button className="btn btn-solid btn-sm" onClick={() => {
                            const ta = document.getElementById(`sa-${ex.exercise_id}`) as HTMLTextAreaElement
                            if (ta) answerShort(ex.exercise_id, ta.value)
                          }}>提交答案</button>
                          <button className="btn btn-sm" style={{ marginLeft: '8px' }} onClick={() => revealAnswer(ex.exercise_id)}>查看参考答案</button>
                        </div>
                      )}
                    </>
                  )}

                  {/* Explanation */}
                  {(isAnswered || isRevealed) && (
                    <div className="ex-expl show">
                      <div className={`expl-hd ${a?.correct === true ? 'correct-hd' : 'wrong-hd'}`}>
                        {a?.correct === true ? '回答正确' : a?.correct === false ? '回答错误' : '参考答案与解析'} — 解析
                      </div>
                      {(ex.type === 'short_answer' || ex.type === 'coding') && ex.answer && (
                        <div style={{ padding: '10px', background: 'var(--surface)', borderRadius: 'var(--r-xs)', marginBottom: '8px', whiteSpace: 'pre-wrap', fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', lineHeight: 1.7 }}>
                          {ex.answer}
                        </div>
                      )}
                      {ex.explanation}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="ex-acts">
                    {isAnswered && (
                      <span className={`ex-status ${a.correct === true ? 'st-correct' : a.correct === false ? 'st-wrong' : ''}`}>
                        {a.correct === true ? '正确' : a.correct === false ? '错误' : ''}
                      </span>
                    )}
                    {isAnswered && (
                      <button className="btn btn-sm" style={{ marginLeft: 'auto' }} onClick={() => resetOne(ex.exercise_id)}>重做此题</button>
                    )}
                    <button className="btn btn-sm" style={{ color: 'var(--danger)', marginLeft: isAnswered ? 4 : 'auto' }}
                      onClick={() => hideExercise(ex.exercise_id)} title="隐藏此题">✕</button>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Side */}
        <div className="ex-side">
          {/* Progress */}
          <div className="card">
            <div className="card-hd"><h3>答题进度</h3></div>
            <div className="card-bd">
              <div className="progress-ring-wrap">
                <div className="progress-ring">
                  <svg width="140" height="140" viewBox="0 0 140 140">
                    <circle cx="70" cy="70" r="58" fill="none" stroke="var(--bg-subtle)" strokeWidth="8" />
                    <circle cx="70" cy="70" r="58" fill="none" stroke={ringColor} strokeWidth="8"
                      strokeDasharray={circ} strokeDashoffset={circ - (circ * answerPct / 100)} strokeLinecap="round" />
                  </svg>
                  <div className="pr-val"><span className="pr-num">{answerPct}%</span><span className="pr-label">已作答</span></div>
                </div>
              </div>
              <div className="side-stats">
                <div className="side-stat"><div className="sval" style={{ color: 'var(--success)' }}>{correctCount}</div><div className="slbl">正确</div></div>
                <div className="side-stat"><div className="sval" style={{ color: 'var(--danger)' }}>{answeredCount - correctCount}</div><div className="slbl">错误</div></div>
                <div className="side-stat"><div className="sval">{total - answeredCount}</div><div className="slbl">未答</div></div>
                <div className="side-stat"><div className="sval" style={{ color: 'var(--warm)' }}>{pct}%</div><div className="slbl">正确率</div></div>
              </div>
            </div>
          </div>

          {/* Topic breakdown */}
          <div className="card">
            <div className="card-hd"><h3>知识点掌握</h3></div>
            <div className="card-bd">
              {Object.entries(topics).map(([name, d]) => {
                const p = d.answered ? Math.round((d.correct / d.answered) * 100) : 0
                const col = p >= 70 ? 'var(--success)' : p >= 40 ? 'var(--warm)' : 'var(--ink-3)'
                return (
                  <div key={name} className="topic-item">
                    <span className="tk-name">{name}</span>
                    <div className="tk-bar"><div className="tk-bar-fill" style={{ width: `${d.answered ? Math.round((d.answered / d.total) * 100) : 0}%`, background: col }} /></div>
                    <span className="tk-pct" style={{ color: col }}>{d.answered ? `${p}%` : '—'}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Hidden management */}
          {hiddenCount > 0 && (
            <div className="card">
              <div className="card-hd"><h3>已隐藏</h3></div>
              <div className="card-bd">
                <div style={{ fontSize: 13, color: 'var(--ink-3)', marginBottom: 8 }}>
                  共 {hiddenCount} 道题被隐藏
                </div>
                {!showHidden ? (
                  <button className="btn btn-sm" onClick={() => setShowHidden(true)}>
                    显示已隐藏题目
                  </button>
                ) : (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-sm" onClick={() => setShowHidden(false)}>
                      返回正常视图
                    </button>
                    <button className="btn btn-sm" style={{ color: 'var(--danger)' }} onClick={restoreHidden}>
                      全部恢复
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Recent */}
          <div className="card">
            <div className="card-hd"><h3>最近答题</h3></div>
            <div className="card-bd">
              {recentLog.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px 0', fontSize: '12px', color: 'var(--ink-4)' }}>开始答题后显示记录</div>
              ) : (
                recentLog.map((r, i) => {
                  const icon = r.correct === true ? '✓' : r.correct === false ? '✗' : '—'
                  const bg = r.correct === true ? 'var(--success-soft)' : r.correct === false ? 'var(--danger-soft)' : 'var(--accent-soft)'
                  const color = r.correct === true ? 'var(--success)' : r.correct === false ? 'var(--danger)' : 'var(--ink-3)'
                  return (
                    <div key={i} className="recent-item">
                      <div className="ri-icon" style={{ background: bg, color, fontWeight: 700 }}>{icon}</div>
                      <span className="ri-text">{r.name}</span>
                      <span className="ri-time">{r.time}</span>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      </div>
      {confirmDlg && (
        <ConfirmDialog
          message={confirmDlg.message}
          onConfirm={confirmDlg.onConfirm}
          onCancel={() => setConfirmDlg(null)}
        />
      )}
    </>
  )
}
