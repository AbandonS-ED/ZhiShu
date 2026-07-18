'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { wrongQuestionsApi } from '@/lib/api'
import { showToast } from '@/lib/utils'
import { usePageTimer } from '@/hooks/usePageTimer'
import Icon from '@/components/Icon'
import type { WrongQuestion } from '@/types'

const ERROR_TYPE_LABEL: Record<string, { label: string; bg: string; fg: string }> = {
  calculation: { label: '计算失误', bg: '#fef3c7', fg: '#92400e' },
  concept: { label: '概念不清', bg: '#fee2e2', fg: '#991b1b' },
  reading: { label: '审题错误', bg: '#ede9fe', fg: '#5b21b6' },
  carelessness: { label: '粗心大意', bg: '#dbeafe', fg: '#1e40af' },
  unknown: { label: '未分析', bg: 'var(--bg-subtle)', fg: 'var(--ink-3)' },
}

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
  const [thinkingLog, setThinkingLog] = useState<Array<{step: number; text: string}>>([])
  const [streamAnalysis, setStreamAnalysis] = useState<{
    error_type: string
    error_analysis: string
    ai_explanation: string
  } | null>(null)
  const [streamSimilar, setStreamSimilar] = useState<Array<{
    type: string
    question: string
    options?: string[]
    answer: string
    explanation?: string
  }>>([])
  const analysingRef = useRef(false)

  const load = async () => {
    if (!id) return
    try {
      const data = await wrongQuestionsApi.get(id)
      setWq(data)
    } catch (err: any) {
      showToast(err.message || '加载失败')
      router.push('/wrong-questions')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [id])

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
          showToast('AI 分析完成')
          load()
        } else if (event.type === 'error') {
          showToast(event.message || '分析失败')
        }
      })
    } catch (err: any) {
      showToast(err.message || '分析请求失败')
    } finally {
      setAnalyzing(false)
      analysingRef.current = false
    }
  }

  const handleReview = async (isCorrect: boolean) => {
    if (!id) return
    setReviewing(true)
    try {
      const result = await wrongQuestionsApi.review(id, isCorrect)
      showToast(isCorrect ? `答对！掌握度 ${result.mastery_level}%` : `继续加油，掌握度 ${result.mastery_level}%`)
      await load()
    } catch (err: any) {
      showToast(err.message || '操作失败')
    } finally {
      setReviewing(false)
    }
  }

  if (loading || !wq) {
    return (
      <div className="wq-page">
        <div className="wq-skeleton">
          <div className="skeleton skeleton-line" style={{ width: '30%', height: 20 }} />
          <div className="skeleton skeleton-card" style={{ height: 200 }} />
          <div className="skeleton skeleton-card" style={{ height: 200 }} />
        </div>
      </div>
    )
  }

  const ex = wq.exercise
  const meta = ERROR_TYPE_LABEL[wq.error_type] || ERROR_TYPE_LABEL.unknown

  return (
    <div className="wq-page">
      <header className="wq-header">
        <Link href="/wrong-questions" className="wq-back">
          ← 返回错题本
        </Link>
      </header>

      <div className="wq-detail-grid">
        {/* 左：原题 + 答案 */}
        <section className="wq-card wq-detail-card">
          <div className="wq-card-head">
            <h2>原题</h2>
            <span className="wq-error-tag" style={{ background: meta.bg, color: meta.fg }}>{meta.label}</span>
          </div>

          <div className="wq-detail-question">{ex?.question}</div>

          {ex?.options && (
            <ul className="wq-detail-options">
              {ex.options.map((opt, i) => {
                const letter = String.fromCharCode(65 + i)
                const isWrong = String(wq.wrong_answer).toUpperCase().includes(letter)
                const isCorrect = String(ex.answer).toUpperCase().includes(letter)
                return (
                  <li
                    key={i}
                    className={`wq-opt ${isCorrect ? 'correct' : ''} ${isWrong && !isCorrect ? 'wrong' : ''}`}
                  >
                    <span className="wq-opt-letter">{letter}.</span>
                    <span>{opt}</span>
                    {isCorrect && <span className="wq-opt-mark">✓</span>}
                    {isWrong && !isCorrect && <span className="wq-opt-mark wrong">✗</span>}
                  </li>
                )
              })}
            </ul>
          )}

          <div className="wq-answer-row">
            <span>你的答案：<b className="wq-wrong-text">{wq.wrong_answer}</b></span>
            <span>正确答案：<b className="wq-correct-text">{ex?.answer || wq.correct_answer}</b></span>
          </div>

          {ex?.explanation && (
            <div className="wq-original-explanation">
              <b>原题解析：</b>{ex.explanation}
            </div>
          )}
        </section>

        {/* 右：AI 分析 */}
        <section className="wq-card wq-detail-card">
          <div className="wq-card-head">
            <h2>AI 智能分析</h2>
            <button
              className="wq-btn primary"
              onClick={handleAnalyze}
              disabled={analyzing}
            >
              {analyzing ? '分析中...' : (wq.error_analysis ? '重新分析' : '一键 AI 分析')}
            </button>
          </div>

          {/* 思考链日志 */}
          {analyzing && thinkingLog.length > 0 && (
            <div className="wq-thinking-log">
              <div className="wq-analysis-label">💭 Agent 思考过程</div>
              {thinkingLog.map((log, i) => (
                <div key={i} className="wq-thinking-step">
                  <span className="wq-thinking-step-num">第{log.step}步</span>
                  <span className="wq-thinking-step-text">{log.text}</span>
                </div>
              ))}
            </div>
          )}

          {/* 错因分析：优先 stream 数据，其次 DB 数据 */}
          {(streamAnalysis || wq.error_analysis) ? (
            <>
              <div className="wq-analysis-section">
                <div className="wq-analysis-label">错因分析</div>
                <div className="wq-analysis-text">
                  {analyzing && !streamAnalysis ? (
                    <span className="wq-loading-dots">分析中</span>
                  ) : (
                    (streamAnalysis?.error_analysis || wq.error_analysis)
                  )}
                </div>
              </div>

              {(streamAnalysis?.ai_explanation || wq.ai_explanation) && (
                <div className="wq-analysis-section">
                  <div className="wq-analysis-label">AI 讲解</div>
                  <div className="wq-analysis-text">
                    {analyzing && !streamAnalysis?.ai_explanation ? (
                      <span className="wq-loading-dots">生成中</span>
                    ) : (
                      (streamAnalysis?.ai_explanation || wq.ai_explanation)
                    )}
                  </div>
                </div>
              )}

              {/* 同类题：优先 stream 数据，其次 DB 数据 */}
              {(() => {
                const similar = streamSimilar.length > 0 ? streamSimilar : (wq.similar_exercises || [])
                return similar.length > 0 ? (
                  <div className="wq-analysis-section">
                    <div className="wq-analysis-label">同类题推荐（{similar.length}）</div>
                    <div className="wq-similar-list">
                      {similar.map((sim, i) => (
                        <div key={i} className="wq-similar-item">
                          <div
                            className="wq-similar-q"
                            onClick={() => setExpandedIdx(expandedIdx === i ? null : i)}
                          >
                            <span className="wq-similar-idx">Q{i + 1}</span>
                            <span>{sim.question}</span>
                            <span className="wq-similar-toggle">{expandedIdx === i ? '−' : '+'}</span>
                          </div>
                          {expandedIdx === i && (
                            <div className="wq-similar-detail">
                              {sim.options && (
                                <ul className="wq-similar-options">
                                  {sim.options.map((opt, j) => {
                                    const letter = String.fromCharCode(65 + j)
                                    const isCorrect = String(sim.answer).toUpperCase().includes(letter)
                                    return (
                                      <li key={j} className={isCorrect ? 'correct' : ''}>
                                        {letter}. {opt}
                                      </li>
                                    )
                                  })}
                                </ul>
                              )}
                              <div className="wq-similar-answer">答案：{sim.answer}</div>
                              {sim.explanation && (
                                <div className="wq-similar-explanation">解析：{sim.explanation}</div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : analyzing ? (
                  <div className="wq-analysis-section">
                    <div className="wq-analysis-label">同类题推荐</div>
                    <div className="wq-loading-dots">生成中</div>
                  </div>
                ) : null
              })()}
            </>
          ) : (
            <div className="wq-empty-mini">
              <Icon name="sparkles" size={32} />
              <p>点击「一键 AI 分析」，AI 会自动：</p>
              <ul>
                <li>识别错误类型（计算失误/概念不清/审题错误/粗心大意）</li>
                <li>生成详细讲解</li>
                <li>推荐 3 道同类练习题</li>
              </ul>
            </div>
          )}
        </section>
      </div>

      {/* 复习区 */}
      <section className="wq-card wq-review-card">
        <div className="wq-review-head">
          <h2>复习巩固</h2>
          <div className="wq-mastery-display">
            <span className="wq-mastery-label">掌握度</span>
            <span className="wq-mastery-value">{wq.mastery_level}%</span>
          </div>
        </div>

        <div className="wq-progress-bar large">
          <div className="wq-progress-fill" style={{ width: `${wq.mastery_level}%` }} />
        </div>

        <div className="wq-review-stats">
          <span>已复习 <b>{wq.review_count}</b> 次</span>
          <span>答对 <b>{wq.correct_count}</b> 次</span>
          {wq.is_mastered && <span className="wq-mastered-tag">🎉 已掌握</span>}
        </div>

        <div className="wq-review-actions">
          <button
            className="wq-btn success"
            onClick={() => handleReview(true)}
            disabled={reviewing}
          >
            ✓ 我会做了
          </button>
          <button
            className="wq-btn danger"
            onClick={() => handleReview(false)}
            disabled={reviewing}
          >
            ✗ 还需练习
          </button>
        </div>
      </section>
    </div>
  )
}