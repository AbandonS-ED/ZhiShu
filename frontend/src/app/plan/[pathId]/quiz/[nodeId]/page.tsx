'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { studyPlanApi, exerciseApi, wrongQuestionsApi, type LearningPath, type LearningPathNode, type Exercise } from '@/lib/api'
import { getStudentId } from '@/lib/student'
import { showToast } from '@/lib/utils'
import { usePageTimer } from '@/hooks/usePageTimer'

interface Answer {
  selected: number | boolean | string | null
  correct: boolean | null
}

export default function QuizNodePage() {
  const router = useRouter()
  const params = useParams()
  const pathId = params.pathId as string
  const nodeId = params.nodeId as string
  usePageTimer('plan-quiz')

  const [path, setPath] = useState<LearningPath | null>(null)
  const [currentNode, setCurrentNode] = useState<LearningPathNode | null>(null)
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [answers, setAnswers] = useState<Record<number, Answer>>({})
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [score, setScore] = useState(0)
  const [passed, setPassed] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadData = async () => {
      try {
        const result = await studyPlanApi.getPaths()
        if (result.success) {
          const found = result.data.find(p => p.id === pathId)
          if (found) {
            setPath(found)
            const node = found.nodes.find(n => n.id === nodeId)
            if (node) {
              setCurrentNode(node)
              await generateExercises(node.knowledge_point)
            } else {
              setError('未找到该学习节点')
            }
          } else {
            setError('未找到该学习路径')
          }
        } else {
          setError('获取学习路径失败')
        }
      } catch (err) {
        console.error('加载数据失败:', err)
        setError('加载数据失败，请重试')
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [pathId, nodeId])

  const generateExercises = async (knowledgePoint: string) => {
    setGenerating(true)
    setError(null)
    try {
      const studentId = getStudentId()
      if (!studentId) {
        window.location.href = '/login'
        return
      }
      const result = await exerciseApi.generate(studentId, knowledgePoint, 5, 'all')
      if (result && result.exercises && result.exercises.length > 0) {
        setExercises(result.exercises)
        const initialAnswers: Record<number, Answer> = {}
        result.exercises.forEach((_, index) => {
          initialAnswers[index] = { selected: null, correct: null }
        })
        setAnswers(initialAnswers)
      } else {
        setError('生成测验题失败，请重试')
      }
    } catch (err) {
      console.error('生成测验题失败:', err)
      setError(`生成测验题失败: ${err instanceof Error ? err.message : '未知错误'}`)
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

    const allAnswered = exercises.every((_, index) => {
      const selected = answers[index]?.selected
      return selected !== null && selected !== undefined && selected !== ''
    })
    if (!allAnswered) {
      showToast('请完成所有题目')
      return
    }

    let correctCount = 0
    let totalScore = 0
    const studentId = getStudentId()
    const wrongExercises: { exercise: Exercise; answer: string }[] = []

    exercises.forEach((exercise, index) => {
      const answer = answers[index]
      let isCorrect = false
      let exerciseScore = 0

      if (exercise.type === 'choice' && exercise.answer) {
        const correctIndex = exercise.answer.charCodeAt(0) - 65
        isCorrect = answer.selected === correctIndex
        exerciseScore = isCorrect ? 100 : 0
      } else if (exercise.type === 'judge' && exercise.answer) {
        const correctBool = exercise.answer === 'true' || exercise.answer === '对'
        isCorrect = answer.selected === correctBool
        exerciseScore = isCorrect ? 100 : 0
      } else if (exercise.type === 'short_answer') {
        const hasAnswer = !!(answer.selected && (answer.selected as string).trim().length > 0)
        isCorrect = hasAnswer
        exerciseScore = hasAnswer ? 80 : 0
      }

      if (isCorrect) correctCount++
      totalScore += exerciseScore

      setAnswers(prev => ({
        ...prev,
        [index]: { ...prev[index], correct: isCorrect }
      }))

      if (!isCorrect && studentId && exercise.exercise_id) {
        const wrongLabel = exercise.type === 'choice'
          ? String.fromCharCode(65 + (answer.selected as number))
          : String(answer.selected)
        wrongExercises.push({ exercise, answer: wrongLabel })
      }
    })

    if (studentId) {
      const results = await Promise.allSettled(
        wrongExercises.map(({ exercise, answer }) =>
          wrongQuestionsApi.add({
            student_id: studentId,
            exercise_id: exercise.exercise_id,
            wrong_answer: answer,
          })
        )
      )
      const failed = results.filter(r => r.status === 'rejected').length
      if (wrongExercises.length > 0 && failed === 0) {
        showToast(`已加入错题本 ${wrongExercises.length} 道`)
      } else if (failed > 0) {
        showToast(`错题本：${wrongExercises.length - failed} 道加入成功，${failed} 道失败`)
      }
    }

    const finalScore = Math.round(totalScore / exercises.length)
    setScore(finalScore)
    setSubmitted(true)
    setPassed(finalScore >= 60)

    if (finalScore >= 60) {
      try {
        await studyPlanApi.completeNode(pathId, nodeId)
      } catch (err) {
        console.error('更新节点状态失败:', err)
      }
    }
  }, [exercises, answers, submitted, pathId, nodeId])

  const handleRetry = useCallback(() => {
    setSubmitted(false)
    setScore(0)
    setPassed(false)
    const resetAnswers: Record<number, Answer> = {}
    exercises.forEach((_, index) => {
      resetAnswers[index] = { selected: null, correct: null }
    })
    setAnswers(resetAnswers)
  }, [exercises])

  const handleContinue = useCallback(() => {
    if (passed) {
      router.push(`/plan/${pathId}`)
    } else {
      router.push(`/plan/${pathId}/learn/${nodeId}`)
    }
  }, [passed, pathId, nodeId, router])

  const answeredCount = Object.values(answers).filter(a => a.selected !== null && a.selected !== undefined && a.selected !== '').length
  const correctCount = Object.values(answers).filter(a => a.correct === true).length

  if (loading || generating) {
    return (
      <div className="quiz-gen-state">
        <div className="quiz-gen-spinner"></div>
        <h3>{loading ? '加载中...' : 'AI 正在生成测验题'}</h3>
        <p>{generating ? '正在调用 AI 生成题目，请稍候...' : '正在获取学习数据...'}</p>
        {generating && (
          <div className="quiz-gen-steps">
            <div className="gs-step done"><div className="gs-dot"></div>加载学习节点</div>
            <div className="gs-step active"><div className="gs-dot"></div>AI 生成题目</div>
            <div className="gs-step waiting"><div className="gs-dot"></div>准备测验</div>
          </div>
        )}
      </div>
    )
  }

  if (error) {
    return (
      <>
        <div className="quiz-back-nav">
          <a className="back-link" onClick={() => router.push(`/plan/${pathId}`)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
            返回路径
          </a>
        </div>
        <div className="quiz-header">
          <div className="qh-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
          </div>
          <div className="qh-body">
            <div className="qh-title">{currentNode?.knowledge_point || '测验'} — 加载失败</div>
            <div className="qh-desc">{error}</div>
          </div>
          <div className="qh-badges">
            <button className="quiz-submit-btn" onClick={() => window.location.reload()}>重试</button>
          </div>
        </div>
      </>
    )
  }

  if (exercises.length === 0) {
    return (
      <>
        <div className="quiz-back-nav">
          <a className="back-link" onClick={() => router.push(`/plan/${pathId}`)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
            返回路径
          </a>
        </div>
        <div className="quiz-header">
          <div className="qh-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
          </div>
          <div className="qh-body">
            <div className="qh-title">{currentNode?.knowledge_point || '测验'}</div>
            <div className="qh-desc">未生成题目</div>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      {/* Back nav */}
      <div className="quiz-back-nav">
        <a className="back-link" onClick={() => router.push(`/plan/${pathId}/learn/${nodeId}`)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
          返回学习
        </a>
      </div>

      {/* Quiz header */}
      <div className="quiz-header">
        <div className="qh-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
        </div>
        <div className="qh-body">
          <div className="qh-title">{currentNode?.knowledge_point} — 课堂测验</div>
          <div className="qh-desc">共 {exercises.length} 题，涵盖核心概念与应用</div>
        </div>
        <div className="qh-badges">
          <span className="tag tag-info">{exercises.length} 题</span>
          <span className="tag tag-warm">60 分通过</span>
        </div>
      </div>

      {/* Progress dots */}
      <div className="quiz-progress">
        {exercises.map((_, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {i > 0 && <div className="qp-line"></div>}
            <div className={`qp-dot ${
              submitted
                ? (answers[i]?.correct ? 'correct' : 'wrong')
                : (answers[i]?.selected !== null && answers[i]?.selected !== undefined ? 'answered' : 'pending')
            }`}>
              {i + 1}
            </div>
          </div>
        ))}
        <span className="qp-info">{answeredCount}/{exercises.length}</span>
      </div>

      {/* Result panel */}
      {submitted && (
        <div className="result-panel">
          <div className="rp-top">
            <div className={`rp-icon ${passed ? 'pass' : 'fail'}`}>
              {passed ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              )}
            </div>
            <h2>{passed ? '测验通过！' : '未通过，继续加油'}</h2>
            <div className="rp-sub">{passed ? '你已掌握该知识点的核心概念，可以进入下一个知识点。' : '建议回顾学习内容后重新测验，60 分以上即可通过。'}</div>
          </div>
          <div className="rp-score">
            <span className={`rs-num ${passed ? 'pass' : 'fail'}`}>{score}</span>
            <span className="rs-unit">分</span>
          </div>
          <div className="rp-stats">
            <div className="rp-stat"><div className="rps-val">{correctCount}</div><div className="rps-label">答对</div></div>
            <div className="rp-stat"><div className="rps-val">{exercises.length - correctCount}</div><div className="rps-label">答错</div></div>
            <div className="rp-stat"><div className="rps-val">{score}%</div><div className="rps-label">正确率</div></div>
          </div>
          {!passed && (
            <div className="rp-wrong-msg">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              <span>错题已自动加入错题本，建议复习后重新挑战。</span>
            </div>
          )}
          <div className="rp-foot">
            <button className={`btn ${passed ? '' : 'btn-warm'}`} onClick={passed ? handleContinue : handleRetry}>
              {passed ? (
                <><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><polyline points="15 18 9 12 15 6"/></svg> 返回路径</>
              ) : (
                <><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg> 重新测验</>
              )}
            </button>
            {passed ? (
              <button className="btn btn-solid" onClick={handleContinue}>
                下一步
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            ) : (
              <button className="btn" onClick={handleContinue}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
                返回学习
              </button>
            )}
          </div>
        </div>
      )}

      {/* Questions */}
      {!submitted && exercises.map((exercise, index) => {
        const answer = answers[index]
        const typeLabels: Record<string, string> = { choice: '选择题', judge: '判断题', short_answer: '简答题', coding: '编程题' }
        const correctIndex = exercise.answer ? exercise.answer.charCodeAt(0) - 65 : -1
        const correctBool = exercise.answer === 'true' || exercise.answer === '对'

        return (
          <div key={index} className="q-card">
            <div className="q-head">
              <span className="q-num">第 {index + 1} 题</span>
              <span className="q-kp">{exercise.knowledge_point || currentNode?.knowledge_point}</span>
              <span className="q-type">{typeLabels[exercise.type] || exercise.type}</span>
            </div>
            <div className="q-body">
              <div className="q-text">{exercise.question}</div>

              {exercise.type === 'choice' && exercise.options && (
                <div className="opt-list">
                  {exercise.options.map((opt, j) => {
                    const letter = String.fromCharCode(65 + j)
                    const isSelected = answer?.selected === j
                    return (
                      <button key={j} className={`opt-btn ${isSelected ? 'selected' : ''}`} onClick={() => handleSelectAnswer(index, j)}>
                        <span className="opt-letter">{letter}</span>
                        <span className="opt-text">{opt}</span>
                      </button>
                    )
                  })}
                </div>
              )}

              {exercise.type === 'judge' && (
                <div className="opt-list judge">
                  <button className={`opt-btn ${answer?.selected === true ? 'selected' : ''}`} onClick={() => handleSelectAnswer(index, true)}>
                    <span className="opt-letter" style={{ background: 'var(--success-soft)', color: 'var(--success)' }}>✓</span>
                    <span className="opt-text">正确</span>
                  </button>
                  <button className={`opt-btn ${answer?.selected === false ? 'selected' : ''}`} onClick={() => handleSelectAnswer(index, false)}>
                    <span className="opt-letter" style={{ background: 'var(--danger-soft)', color: 'var(--danger)' }}>✗</span>
                    <span className="opt-text">错误</span>
                  </button>
                </div>
              )}

              {exercise.type === 'short_answer' && (
                <textarea
                  style={{ width: '100%', minHeight: 120, padding: 14, border: '1.5px solid var(--line)', borderRadius: 'var(--r-sm)', fontSize: 14, fontFamily: 'Inter, sans-serif', resize: 'vertical', background: 'var(--bg)', color: 'var(--ink)', outline: 'none' }}
                  placeholder="请输入你的答案..."
                  value={(answer?.selected as string) || ''}
                  onChange={(e) => handleSelectAnswer(index, e.target.value)}
                />
              )}
            </div>
          </div>
        )
      })}

      {/* Submit bar */}
      {!submitted && (
        <div className="quiz-submit-bar">
          <div className="sb-left">已答 <b>{answeredCount}</b> / {exercises.length} 题</div>
          <button className="quiz-submit-btn" onClick={handleSubmit} disabled={answeredCount < exercises.length}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            提交答案
          </button>
        </div>
      )}
    </>
  )
}
