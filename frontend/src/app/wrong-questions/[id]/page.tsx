'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { wrongQuestionsApi } from '@/lib/api'
import { showToast } from '@/lib/utils'
import { usePageTimer } from '@/hooks/usePageTimer'
import Icon from '@/components/Icon'
import type { WrongQuestion } from '@/types'
import { ERROR_TYPE_CONFIG } from '@/lib/wrong-question-config'

export default function WrongQuestionDetailPage() {
  usePageTimer('wrong_question_detail')
  const params = useParams()
  const router = useRouter()
  const id = params?.id as string

  const [wq, setWq] = useState<WrongQuestion | null>(null)
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)
  const [reviewing, setReviewing] = useState(false)
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null)
  const [thinkingLog, setThinkingLog] = useState<Array<{ step: number; text: string }>>([])
  const [streamAnalysis, setStreamAnalysis] = useState<{
    error_type: string; error_analysis: string; ai_explanation: string
  } | null>(null)
  const [streamSimilar, setStreamSimilar] = useState<Array<{
    type: string; question: string; options?: string[]; answer: string; explanation?: string
  }>>([])
  const analysingRef = useRef(false)

  const load = useCallback(async () => {
    if (!id) return
    try { setWq(await wrongQuestionsApi.get(id)) }
    catch (err: any) { showToast(err.message || '加载失败'); router.push('/wrong-questions') }
    finally { setLoading(false) }
  }, [id, router])

  useEffect(() => { load() }, [load])

  const handleAnalyze = async () => {
    if (!id || analysingRef.current) return
    analysingRef.current = true
    setAnalyzing(true)
    setThinkingLog([])
    setStreamAnalysis(null)
    setStreamSimilar([])
    try {
      await wrongQuestionsApi.analyzeStream(id, (event) => {
        if (event.type === 'thinking') {
          setThinkingLog(prev => [...prev, { step: event.step ?? 0, text: event.text ?? '' }])
        } else if (event.type === 'analysis' && event.data) {
          setStreamAnalysis(event.data)
        } else if (event.type === 'similar' && event.data) {
          setStreamSimilar(event.data)
        } else if (event.type === 'done') {
          showToast('AI 分析完成'); load()
        } else if (event.type === 'error') {
          showToast(event.message || '分析失败')
        }
      })
    } catch (err: any) { showToast(err.message || '分析请求失败') }
    finally { setAnalyzing(false); analysingRef.current = false }
  }

  const handleReview = async (isCorrect: boolean) => {
    if (!id) return
    setReviewing(true)
    try {
      const result = await wrongQuestionsApi.review(id, isCorrect)
      showToast(isCorrect ? `答对！掌握度 ${result.mastery_level}%` : `继续加油，掌握度 ${result.mastery_level}%`)
      await load()
    } catch (err: any) { showToast(err.message || '操作失败') }
    finally { setReviewing(false) }
  }

  if (loading || !wq) {
    return (
      <div className="wq-page">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="skeleton skeleton-line" style={{ width: '30%', height: 20 }} />
          <div className="skeleton skeleton-card" style={{ height: 200 }} />
          <div className="skeleton skeleton-card" style={{ height: 200 }} />
        </div>
      </div>
    )
  }

  const ex = wq.exercise
  const meta = ERROR_TYPE_CONFIG[wq.error_type] || ERROR_TYPE_CONFIG.unknown
  const masteryCls = wq.mastery_level >= 80 ? '' : wq.mastery_level >= 40 ? 'mid' : 'low'

  return (
    <div className="wq-page">
      {/* Back nav */}
      <div className="back-nav">
        <Link href="/wrong-questions" className="back-link">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
          返回错题本
        </Link>
        <span className={`error-tag ${meta.cls}`}><span className="et-dot" />{meta.label}</span>
        <span style={{ marginLeft: 'auto', fontSize: 11.5, color: 'var(--ink-4)' }}>
          复习 {wq.review_count} 次
        </span>
      </div>

      <div className="detail-grid">
        {/* LEFT: Original question */}
        <section className="wq-detail-card">
          <div className="card-head">
            <h2>原题</h2>
            <span className="tag tag-info">{ex?.knowledge_point || '综合'}</span>
          </div>
          <div className="card-body">
            <div className="question-text">{ex?.question || '(题目已删除)'}</div>

            {ex?.options && (
              <ul className="options-list">
                {ex.options.map((opt, i) => {
                  const letter = String.fromCharCode(65 + i)
                  const isWrong = String(wq.wrong_answer).toUpperCase().includes(letter)
                  const isCorrect = String(ex.answer).toUpperCase().includes(letter)
                  return (
                    <li key={i} className={`opt-item${isCorrect ? ' correct' : ''}${isWrong && !isCorrect ? ' wrong' : ''}`}>
                      <span className="opt-letter">{letter}</span>
                      <span className="opt-text">{opt}</span>
                      {isCorrect && <span className="opt-badge">正确答案</span>}
                      {isWrong && !isCorrect && <span className="opt-badge">你的答案</span>}
                    </li>
                  )
                })}
              </ul>
            )}

            <div className="answer-compare">
              <div className="answer-chip wrong-ans">
                <span className="ac-label">你的答案</span>
                <span className="ac-value">{wq.wrong_answer}</span>
              </div>
              <div className="answer-chip correct-ans">
                <span className="ac-label">正确答案</span>
                <span className="ac-value">{ex?.answer || wq.correct_answer}</span>
              </div>
            </div>

            {ex?.explanation && (
              <div className="original-expl">
                <div className="oe-title">原题解析</div>
                {ex.explanation}
              </div>
            )}
          </div>
        </section>

        {/* RIGHT: AI Analysis */}
        <section className="wq-detail-card">
          <div className="card-head">
            <h2>AI 智能分析</h2>
            <button className="btn btn-solid btn-sm" onClick={handleAnalyze} disabled={analyzing}>
              <Icon name="sparkles" size={13} />
              {analyzing ? '分析中...' : (wq.error_analysis ? '重新分析' : '一键 AI 分析')}
            </button>
          </div>
          <div className="card-body">
            {/* Thinking log */}
            {analyzing && thinkingLog.length > 0 && (
              <div className="thinking-log">
                <div className="tl-head">
                  <span style={{ fontSize: 14 }}>💭</span> Agent 思考过程
                </div>
                <div className="tl-body">
                  {thinkingLog.map((log, i) => (
                    <div key={i} className="tl-step">
                      <span className="step-num">第{log.step}步</span>
                      <span className="step-text">{log.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Analysis content */}
            {(streamAnalysis || wq.error_analysis) ? (
              <>
                <div className="analysis-block">
                  <div className="ab-head">
                    <div className="ab-icon type">⚠</div>
                    <span className="ab-label">错因分析</span>
                  </div>
                  <div className="ab-text">
                    {analyzing && !streamAnalysis ? (
                      <span className="wq-loading-dots"><span /><span /><span /></span>
                    ) : (streamAnalysis?.error_analysis || wq.error_analysis)}
                  </div>
                </div>

                {(streamAnalysis?.ai_explanation || wq.ai_explanation) && (
                  <div className="analysis-block">
                    <div className="ab-head">
                      <div className="ab-icon explain">📚</div>
                      <span className="ab-label">AI 讲解</span>
                    </div>
                    <div className="ab-text">
                      {analyzing && !streamAnalysis?.ai_explanation ? (
                        <span className="wq-loading-dots"><span /><span /><span /></span>
                      ) : (streamAnalysis?.ai_explanation || wq.ai_explanation)}
                    </div>
                  </div>
                )}

                {/* Similar exercises */}
                {(() => {
                  const similar = streamSimilar.length > 0 ? streamSimilar : (wq.similar_exercises || [])
                  return similar.length > 0 ? (
                    <div className="similar-section">
                      <div className="similar-head">
                        <div className="sh-icon">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12">
                            <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                          </svg>
                        </div>
                        <span>同类题推荐（{similar.length}）</span>
                      </div>
                      <div className="similar-list">
                        {similar.map((sim, i) => (
                          <div key={i} className="similar-item">
                            <div className="similar-q" onClick={() => setExpandedIdx(expandedIdx === i ? null : i)}>
                              <span className="sq-idx">Q{i + 1}</span>
                              <span className="sq-text">{sim.question}</span>
                              <span className="sq-toggle">{expandedIdx === i ? '−' : '+'}</span>
                            </div>
                            {expandedIdx === i && (
                              <div className="similar-detail">
                                {sim.options && (
                                  <ul className="sd-options">
                                    {sim.options.map((opt, j) => {
                                      const letter = String.fromCharCode(65 + j)
                                      const isCorrect = String(sim.answer).toUpperCase().includes(letter)
                                      return (
                                        <li key={j} className={isCorrect ? 'is-correct' : ''}>
                                          {letter}. {opt}
                                        </li>
                                      )
                                    })}
                                  </ul>
                                )}
                                <div className="sd-answer">答案：{sim.answer}</div>
                                {sim.explanation && <div className="sd-explain">{sim.explanation}</div>}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : analyzing ? (
                    <div className="similar-section">
                      <div className="similar-head"><span>同类题推荐</span></div>
                      <div className="wq-loading-dots"><span /><span /><span /></div>
                    </div>
                  ) : null
                })()}
              </>
            ) : (
              <div className="empty-ai">
                <div className="ea-icon">
                  <Icon name="sparkles" size={22} />
                </div>
                <h3>点击「一键 AI 分析」</h3>
                <p>AI 会自动分析这道错题</p>
                <div className="ea-features">
                  {['识别错误类型（计算/概念/审题/粗心）', '生成详细讲解', '推荐 3 道同类练习题'].map((f, i) => (
                    <div key={i} className="ea-feat">
                      <span className="ef-dot" style={{ background: ['var(--warm)', 'var(--info)', 'var(--success)'][i] }} />
                      {f}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Review card */}
      <div className="review-card">
        <div className="card-body">
          <div className="review-top">
            <h2>复习巩固</h2>
            <div className="mastery-display">
              <span className="md-val">{wq.mastery_level}</span>
              <span className="md-unit">%</span>
            </div>
          </div>

          <div className="wq-progress-track-lg">
            <div className={`wq-progress-fill-lg ${masteryCls}`} style={{ width: `${wq.mastery_level}%` }} />
          </div>

          <div className="review-stats">
            <div className="rs-item">已复习 <b>&nbsp;{wq.review_count}&nbsp;</b> 次</div>
            <div className="rs-item">答对 <b>&nbsp;{wq.correct_count}&nbsp;</b> 次</div>
            {wq.is_mastered && <span className="mastered-badge">已掌握</span>}
          </div>

          <div className="review-actions">
            <button className="btn btn-success" onClick={() => handleReview(true)} disabled={reviewing}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="16" height="16"><polyline points="20 6 9 17 4 12"/></svg>
              我会做了
            </button>
            <button className="btn btn-danger" onClick={() => handleReview(false)} disabled={reviewing}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="16" height="16"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              还需练习
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
