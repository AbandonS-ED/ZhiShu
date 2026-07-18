'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { studyPlanApi, exerciseApi, wrongQuestionsApi, type LearningPath, type Exercise } from '@/lib/api'
import { getStudentId } from '@/lib/student'
import { showToast } from '@/lib/utils'
import { usePageTimer } from '@/hooks/usePageTimer'

interface Answer {
  selected: number | boolean | string | null
  correct: boolean | null
  knowledgePoint: string
}

export default function FinalTestPage() {
  const router = useRouter()
  const params = useParams()
  const pathId = params.pathId as string
  usePageTimer('plan-final-test')

  const [path, setPath] = useState<LearningPath | null>(null)
  const [exercises, setExercises] = useState<(Exercise & { knowledge_point: string })[]>([])
  const [answers, setAnswers] = useState<Record<number, Answer>>({})
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [score, setScore] = useState(0)
  const [passed, setPassed] = useState(false)
  const [weakPoints, setWeakPoints] = useState<string[]>([])
  const [showResult, setShowResult] = useState(false)

  useEffect(() => {
    const loadData = async () => {
      try {
        const result = await studyPlanApi.getPaths()
        if (result.success) {
          const found = result.data.find(p => p.id === pathId)
          if (found) {
            setPath(found)
            await generateFinalTest(found)
          }
        }
      } catch (err) {
        console.error('加载数据失败:', err)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [pathId])

  const generateFinalTest = async (pathData: LearningPath) => {
    setGenerating(true)
    try {
      const studentId = getStudentId()
      const allExercises: (Exercise & { knowledge_point: string })[] = []
      for (const node of pathData.nodes) {
        try {
          const result = await exerciseApi.generate(studentId, node.knowledge_point, 2, 'all')
          if (result && result.exercises) {
            result.exercises.forEach(ex => {
              allExercises.push({ ...ex, knowledge_point: node.knowledge_point })
            })
          }
        } catch (err) {
          console.error(`生成${node.knowledge_point}题目失败:`, err)
        }
      }
      setExercises(allExercises)
      const initialAnswers: Record<number, Answer> = {}
      allExercises.forEach((ex, index) => {
        initialAnswers[index] = { selected: null, correct: null, knowledgePoint: ex.knowledge_point }
      })
      setAnswers(initialAnswers)
    } catch (err) {
      console.error('生成综合测试失败:', err)
    } finally {
      setGenerating(false)
    }
  }

  const handleSelectAnswer = (questionIndex: number, answer: number | boolean | string) => {
    if (submitted) return
    setAnswers(prev => ({
      ...prev,
      [questionIndex]: { ...prev[questionIndex], selected: answer }
    }))
  }

  const handleSubmit = useCallback(async () => {
    if (submitted) return
    const allAnswered = exercises.every((_, index) => answers[index]?.selected !== null)
    if (!allAnswered) {
      showToast('请完成所有题目')
      return
    }

    const knowledgeScores: Record<string, { correct: number; total: number }> = {}
    const studentId = getStudentId()
    const wrongExercises: { exercise: Exercise; answer: string }[] = []

    exercises.forEach((exercise, index) => {
      const answer = answers[index]
      const kp = exercise.knowledge_point
      if (!knowledgeScores[kp]) knowledgeScores[kp] = { correct: 0, total: 0 }
      knowledgeScores[kp].total++

      let isCorrect = false
      if (exercise.type === 'choice' && exercise.answer) {
        const correctIndex = exercise.answer.charCodeAt(0) - 65
        isCorrect = answer.selected === correctIndex
      } else if (exercise.type === 'judge' && exercise.answer) {
        const correctBool = exercise.answer === 'true' || exercise.answer === '对'
        isCorrect = answer.selected === correctBool
      }

      if (isCorrect) knowledgeScores[kp].correct++
      setAnswers(prev => ({ ...prev, [index]: { ...prev[index], correct: isCorrect } }))
      if (!isCorrect && studentId && exercise.exercise_id) {
        wrongExercises.push({ exercise, answer: String(answer.selected) })
      }
    })

    if (studentId) {
      const results = await Promise.allSettled(
        wrongExercises.map(({ exercise, answer }) =>
          wrongQuestionsApi.add({ student_id: studentId, exercise_id: exercise.exercise_id, wrong_answer: answer })
        )
      )
      const failed = results.filter(r => r.status === 'rejected').length
      if (wrongExercises.length > 0 && failed === 0) {
        showToast(`已加入错题本 ${wrongExercises.length} 道`)
      } else if (failed > 0) {
        showToast(`错题本：${wrongExercises.length - failed} 道加入成功，${failed} 道失败`)
      }
    }

    let totalCorrect = 0
    const weak: string[] = []
    Object.entries(knowledgeScores).forEach(([kp, scores]) => {
      totalCorrect += scores.correct
      if (Math.round((scores.correct / scores.total) * 100) < 80) weak.push(kp)
    })

    const finalScore = Math.round((totalCorrect / exercises.length) * 100)
    setScore(finalScore)
    setSubmitted(true)
    setWeakPoints(weak)
    setPassed(weak.length === 0 && finalScore >= 80)
    setTimeout(() => setShowResult(true), 600)
  }, [exercises, answers, submitted])

  const answeredCount = useMemo(() =>
    Object.values(answers).filter(a => a.selected !== null).length
  , [answers])

  const getOptState = (qIdx: number, optIdx: number) => {
    if (!submitted) return answers[qIdx]?.selected === optIdx ? 'selected' : ''
    const ex = exercises[qIdx]
    const answer = answers[qIdx]
    const isCorrectOpt = ex.type === 'choice'
      ? optIdx === (ex.answer?.charCodeAt(0) ?? 65) - 65
      : optIdx === (ex.answer === 'true' || ex.answer === '对' ? 0 : 1)
    const isUserOpt = answer?.selected === optIdx
    if (isCorrectOpt) return 'correct-opt'
    if (isUserOpt && !isCorrectOpt) return 'wrong-opt'
    return ''
  }

  const getDotState = (qIdx: number) => {
    if (!submitted) return answers[qIdx]?.selected !== null ? 'answered' : 'unanswered'
    return answers[qIdx]?.correct ? 'correct' : 'wrong'
  }

  const isGenerating = loading || generating

  return (
    <div className="plan-page">
      <div className="plan-container">
        {/* ═══ BACK NAV ═══ */}
        <div className="back-nav">
          <a className="back-link" onClick={() => router.push(`/plan/${pathId}`)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><polyline points="15 18 9 12 15 6"/></svg>
            返回路径详情
          </a>
        </div>

        {isGenerating ? (
          /* ═══ GENERATING STATE ═══ */
          <div className="generating-state">
            <div className="gs-spinner" />
            <h3>AI 正在生成综合测试卷</h3>
            <p>目标：{path?.name || '加载中...'}</p>
            <div className="generating-steps">
              <div className="gs-step done"><div className="gs-dot" />分析知识点分布</div>
              <div className="gs-step active"><div className="gs-dot" />生成练习题目</div>
              <div className="gs-step waiting"><div className="gs-dot" />匹配难度梯度</div>
              <div className="gs-step waiting"><div className="gs-dot" />组卷完成</div>
            </div>
          </div>
        ) : (
          <>
            {/* ═══ QUIZ HEADER ═══ */}
            <div className="quiz-header">
              <div className="qh-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="22" height="22"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
              </div>
              <div className="qh-body">
                <div className="qh-title">综合测试 · {path?.name}</div>
                <div className="qh-desc">涵盖{path?.nodes.map(n => n.knowledge_point).join('、') || '所有知识点'}共 {path?.nodes.length || 0} 个知识点</div>
              </div>
              <div className="qh-stats">
                <div className="qh-stat"><div className="qs-val">{exercises.length}</div><div className="qs-label">总题数</div></div>
                <div className="qh-stat"><div className="qs-val">{path?.nodes.length || 0}</div><div className="qs-label">知识点</div></div>
                <div className="qh-stat"><div className="qs-val">{answeredCount}</div><div className="qs-label">已答</div></div>
              </div>
            </div>

            {/* ═══ PROGRESS DOTS ═══ */}
            <div className="quiz-progress">
              {exercises.map((_, i) => (
                <span key={i}>
                  {i > 0 && <span className="qp-connector" />}
                  <span className={`qp-dot ${getDotState(i)}`}>{i + 1}</span>
                </span>
              ))}
              <span className="qp-label">{answeredCount}/{exercises.length} 已答</span>
            </div>

            {/* ═══ QUESTIONS ═══ */}
            {!submitted && exercises.map((exercise, index) => (
              <div key={index} className={`question-card ${answers[index]?.selected !== null ? 'answered-card' : ''}`}>
                <div className="qc-head">
                  <span className="qc-num">第 {index + 1} 题</span>
                  <span className="qc-kp">{exercise.knowledge_point}</span>
                  <span className="qc-type">{exercise.type === 'choice' ? '选择题' : exercise.type === 'judge' ? '判断题' : '简答题'}</span>
                </div>
                <div className="qc-body">
                  <div className="qc-question">{exercise.question}</div>
                  {exercise.type === 'choice' && exercise.options && (
                    <div className="opt-list">
                      {exercise.options.map((opt, j) => (
                        <button
                          key={j}
                          className={`opt-btn ${answers[index]?.selected === j ? 'selected' : ''}`}
                          onClick={() => handleSelectAnswer(index, j)}
                        >
                          <span className="opt-letter">{String.fromCharCode(65 + j)}</span>
                          <span className="opt-text">{opt}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {exercise.type === 'judge' && (
                    <div className="opt-list judge">
                      <button
                        className={`opt-btn ${answers[index]?.selected === true ? 'selected' : ''}`}
                        onClick={() => handleSelectAnswer(index, true)}
                      >
                        <span className="opt-letter" style={{ background: 'var(--success-soft)', color: 'var(--success)' }}>&#10003;</span>
                        <span className="opt-text">正确</span>
                      </button>
                      <button
                        className={`opt-btn ${answers[index]?.selected === false ? 'selected' : ''}`}
                        onClick={() => handleSelectAnswer(index, false)}
                      >
                        <span className="opt-letter" style={{ background: 'var(--danger-soft)', color: 'var(--danger)' }}>&#10007;</span>
                        <span className="opt-text">错误</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* ═══ SUBMIT BAR ═══ */}
            {!submitted && (
              <div className="submit-bar">
                <div className="sb-info">已答 <b>{answeredCount}</b> / {exercises.length} 题</div>
                <button className="submit-btn" onClick={handleSubmit} disabled={answeredCount < exercises.length}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><polyline points="20 6 9 17 4 12"/></svg>
                  提交答案
                </button>
              </div>
            )}

            {/* ═══ SUBMITTED: show cards with correct/wrong ═══ */}
            {submitted && exercises.map((exercise, index) => (
              <div key={index} className={`question-card ${answers[index]?.correct ? 'correct-card' : 'wrong-card'}`}>
                <div className="qc-head">
                  <span className="qc-num">第 {index + 1} 题</span>
                  <span className="qc-kp">{exercise.knowledge_point}</span>
                  <span className="qc-type">{exercise.type === 'choice' ? '选择题' : exercise.type === 'judge' ? '判断题' : '简答题'}</span>
                  <span className={`qc-result show ${answers[index]?.correct ? 'correct-r' : 'wrong-r'}`}>
                    {answers[index]?.correct ? '\u2713 正确' : '\u2717 错误'}
                  </span>
                </div>
                <div className="qc-body">
                  <div className="qc-question">{exercise.question}</div>
                  {exercise.type === 'choice' && exercise.options && (
                    <div className="opt-list">
                      {exercise.options.map((opt, j) => (
                        <button key={j} className={`opt-btn disabled ${getOptState(index, j)}`}>
                          <span className="opt-letter">{String.fromCharCode(65 + j)}</span>
                          <span className="opt-text">{opt}</span>
                          {j === (exercise.answer?.charCodeAt(0) ?? 65) - 65 && (
                            <span className="opt-badge show badge-correct">正确答案</span>
                          )}
                          {j === answers[index]?.selected && j !== (exercise.answer?.charCodeAt(0) ?? 65) - 65 && (
                            <span className="opt-badge show badge-wrong">你的答案</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                  {exercise.type === 'judge' && (
                    <div className="opt-list judge">
                      {[true, false].map(val => {
                        const isCorrect = val === (exercise.answer === 'true' || exercise.answer === '对')
                        const isUser = val === answers[index]?.selected
                        const cls = isCorrect ? 'correct-opt' : isUser && !isCorrect ? 'wrong-opt' : ''
                        return (
                          <button key={String(val)} className={`opt-btn disabled ${cls}`}>
                            <span className="opt-letter" style={isCorrect ? { background: 'var(--success)', color: '#fff' } : isUser && !isCorrect ? { background: 'var(--danger)', color: '#fff' } : {}}>
                              {val ? '\u2713' : '\u2717'}
                            </span>
                            <span className="opt-text">{val ? '正确' : '错误'}</span>
                            {isCorrect && <span className="opt-badge show badge-correct">正确答案</span>}
                            {isUser && !isCorrect && <span className="opt-badge show badge-wrong">你的答案</span>}
                          </button>
                        )
                      })}
                    </div>
                  )}
                  {exercise.explanation && (
                    <div className="qc-explanation show">
                      <div className="qe-title">解析</div>
                      {exercise.explanation}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </>
        )}

        {/* ═══ RESULT OVERLAY ═══ */}
        <div className={`result-overlay ${showResult ? 'show' : ''}`} onClick={(e) => { if (e.target === e.currentTarget) setShowResult(false) }}>
          <div className="result-card">
            <div className="result-card-head">
              <div className={`rc-icon ${passed ? 'passed' : 'failed'}`}>
                {passed ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="32" height="32"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="32" height="32"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                )}
              </div>
              <h2>{passed ? '恭喜完成学习！' : '还有薄弱点需要加强'}</h2>
              <div className="rc-sub">{passed ? '你已完全掌握所有知识点，学习路径完成！' : '点击下方按钮返回路径，重新学习薄弱知识点。'}</div>
            </div>

            <div className="score-display">
              <span className={`sd-num ${passed ? 'pass' : 'fail'}`}>{score}</span>
              <span className="sd-unit">分</span>
            </div>

            <div className="result-stats">
              <div className="rs-card"><div className="rs-val">{Object.values(answers).filter(a => a.correct).length}</div><div className="rs-label">答对</div></div>
              <div className="rs-card"><div className="rs-val">{exercises.length - Object.values(answers).filter(a => a.correct).length}</div><div className="rs-label">答错</div></div>
              <div className="rs-card"><div className="rs-val">{score}%</div><div className="rs-label">正确率</div></div>
            </div>

            {weakPoints.length > 0 && (
              <div className="weak-section">
                <div className="ws-title">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                  以下知识点需要重新学习
                </div>
                <div className="weak-list">
                  {weakPoints.map((kp, i) => (
                    <div key={i} className="weak-item"><div className="wi-dot" />{kp}</div>
                  ))}
                </div>
              </div>
            )}

            <div className="result-card-foot">
              <button className="btn" onClick={() => router.push(`/plan/${pathId}`)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
                返回路径重新学习
              </button>
              <button className="btn btn-solid" onClick={() => router.push(`/plan/${pathId}`)}>
                完成学习
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><path d="M5 12h14"/><polyline points="12 5 19 12 12 19"/></svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
