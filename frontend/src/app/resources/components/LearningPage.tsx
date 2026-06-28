'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { resourceApi, evaluationApi } from '@/lib/api'
import { getStudentId } from '@/lib/student'
import { markdownToHtml } from '@/lib/utils'
import { usePhaseGeneration } from '../hooks/usePhaseGeneration'
import Icon from '@/components/Icon'
import type { PhaseType, LearningPackage } from '../types'

// ── 内联 Mermaid 渲染（复用 duihua/page.tsx 逻辑）────────────
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
        const { svg: result } = await mermaid.render(`lp-mm-${id}`, code)
        if (!cancelled) setSvg(result)
      } catch { /* 渲染失败 */ }
    }
    render()
    return () => { cancelled = true }
  }, [code, id])
  return svg ? <div dangerouslySetInnerHTML={{ __html: svg }} /> : <pre>{code}</pre>
}

const PHASE_LABELS: Record<PhaseType, string> = {
  learn: '学习',
  practice: '练习',
  review: '复习',
}

export default function LearningPage({ knowledge_point }: { knowledge_point: string }) {
  const searchParams = useSearchParams()
  const phase = (searchParams.get('phase') ?? 'learn') as PhaseType
  const [pkg, setPkg] = useState<LearningPackage | null>(null)
  const [loading, setLoading] = useState(true)
  const [revealedAns, setRevealedAns] = useState<Set<number>>(new Set())
  const [revealedExplan, setRevealedExplan] = useState<Set<number>>(new Set())
  const [practiceAnswers, setPracticeAnswers] = useState<Record<number, number>>({})

  const { state: genState, start: startGen } = usePhaseGeneration()

  const fetchPkg = useCallback(async () => {
    const studentId = getStudentId()
    if (!studentId) return
    try {
      setLoading(true)
      const res = await resourceApi.getLearningPackage(studentId, knowledge_point, phase)
      setPkg(res as unknown as LearningPackage)
    } catch {
      // 学习中可能还没有资源，尝试生成
    } finally {
      setLoading(false)
    }
  }, [knowledge_point, phase])

  useEffect(() => {
    fetchPkg()
  }, [fetchPkg])

  // 记录完成
  const recordComplete = useCallback(async () => {
    const studentId = getStudentId()
    if (!studentId) return
    try {
      await evaluationApi.recordAction({
        student_id: studentId,
        action: `${phase}_complete`,
        resource_type: 'resource_package',
        knowledge_point: knowledge_point,
      })
    } catch {}
  }, [phase, knowledge_point])

  // 学习内容
  if (loading) {
    return <div className="lp-loading"><div className="skeleton-line wide" /><div className="skeleton-line medium" /></div>
  }

  // 未生成 → 显示生成引导
  if (!pkg?.resources?.length) {
    return (
      <div className="lp-empty">
        <p>还没有「{PHASE_LABELS[phase]}」阶段的学习资源</p>
        {genState.status === 'idle' && (
          <button className="btn-primary" onClick={() => startGen(knowledge_point, phase)}>
            ⚡ 开始生成{PHASE_LABELS[phase]}资源
          </button>
        )}
        {genState.status === 'generating' && (
          <div className="lp-gen-progress">
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${genState.progress}%` }} />
            </div>
            <span>{genState.current_agent} · {genState.progress}%</span>
          </div>
        )}
        {genState.status === 'done' && (
          <button className="btn-primary" onClick={fetchPkg}><Icon name="refresh" size={16} className="inline-icon" /> 刷新查看</button>
        )}
      </div>
    )
  }

  const resources = pkg.resources

  // learn 阶段
  if (phase === 'learn') {
    const knowledge = resources.find((r: any) => r.type === 'explanation' || r.type === 'knowledge')
    const mindmap = resources.find((r: any) => r.type === 'mindmap')

    return (
      <div className="lp-content">
        {knowledge && (
          <div className="lp-section">
            <h3><Icon name="book" size={20} /> 知识讲解</h3>
            <div
              className="lp-text"
              dangerouslySetInnerHTML={{ __html: markdownToHtml(String(knowledge.content ?? '')) }}
            />
          </div>
        )}
        {mindmap && mindmap.mermaid && (
          <div className="lp-section">
            <h3><Icon name="map" size={20} /> 思维导图</h3>
            <MermaidDiagram code={mindmap.mermaid} id={knowledge_point} />
          </div>
        )}
        <button className="btn-primary lp-complete" onClick={recordComplete}>
          <Icon name="check" size={16} className="inline-icon" /> 我已完成学习
        </button>
      </div>
    )
  }

  // practice 阶段
  if (phase === 'practice') {
    const exercises = resources.flatMap((r: any) => r.exercises ?? [])
    if (!exercises.length) return <div className="lp-empty"><p>暂无练习题</p></div>

    return (
      <div className="lp-content">
        <h3><Icon name="edit" size={20} /> 练习题</h3>
        <div className="lp-exercises">
          {exercises.map((ex: any, i: number) => (
            <div key={i} className="lp-exercise-card">
              <p className="lp-q"><strong>Q{i + 1}.</strong> {ex.question}</p>
              {ex.options && (
                <div className="lp-options">
                  {ex.options.map((opt: string, oi: number) => (
                    <label key={oi} className={`lp-option ${practiceAnswers[i] === oi ? (practiceAnswers[i] === ex.answer ? 'correct' : 'wrong') : ''}`}>
                      <input
                        type="radio"
                        name={`q-${i}`}
                        onChange={() => {
                          setPracticeAnswers(prev => ({ ...prev, [i]: oi }))
                          setRevealedAns(prev => new Set(Array.from(prev).concat(i)))
                        }}
                      />
                      <span>{opt}</span>
                    </label>
                  ))}
                </div>
              )}
              {revealedAns.has(i) && (
                <div className="lp-reveal">
                  <span className={`lp-ans ${practiceAnswers[i] === ex.answer ? 'correct' : 'wrong'}`}>
                    答案：{ex.answer}
                  </span>
                  <button
                    className="lp-expl-btn"
                    onClick={() => setRevealedExplan(prev => new Set(Array.from(prev).concat(i)))}
                  >
                    查看解析 ▼
                  </button>
                  {revealedExplan.has(i) && ex.explanation && (
                    <p className="lp-explanation">{ex.explanation}</p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
        <button className="btn-primary" onClick={recordComplete}><Icon name="check" size={16} className="inline-icon" /> 完成练习</button>
      </div>
    )
  }

  // review 阶段
  if (phase === 'review') {
    const code = resources.find((r: any) => r.type === 'code')
    const summary = resources.find((r: any) => r.type === 'summary_card' || r.type === 'knowledge')

    return (
      <div className="lp-content">
        {summary && (
          <div className="lp-section">
            <h3><Icon name="clipboard" size={20} /> 总结卡片</h3>
            <div
              className="lp-text"
              dangerouslySetInnerHTML={{ __html: String(summary.content ?? '').replace(/\n/g, '<br>') }}
            />
          </div>
        )}
        {code && (
          <div className="lp-section">
            <h3><Icon name="code" size={20} /> 代码示例</h3>
            <pre className="lp-code"><code>{code.content ?? code.code ?? ''}</code></pre>
          </div>
        )}
        <button className="btn-primary" onClick={recordComplete}><Icon name="check" size={16} className="inline-icon" /> 完成复习</button>
      </div>
    )
  }

  return null
}
