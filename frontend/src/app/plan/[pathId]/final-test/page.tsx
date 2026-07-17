'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { studyPlanApi, exerciseApi, wrongQuestionsApi, type LearningPath, type Exercise } from '@/lib/api'
import { getStudentId } from '@/lib/student'
import { showToast } from '@/lib/utils'
import { usePageTimer } from '@/hooks/usePageTimer'
import Icon from '@/components/Icon'

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

  useEffect(() => {
    const loadData = async () => {
      try {
        const result = await studyPlanApi.getPaths()
        if (result.success) {
          const found = result.data.find(p => p.id === pathId)
          if (found) {
            setPath(found)
            // 为每个知识点生成题目
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
      
      // 为每个知识点生成2道题
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

    // 计算每个知识点的正确率
    const knowledgeScores: Record<string, { correct: number; total: number }> = {}
    const studentId = getStudentId()
    const wrongExercises: { exercise: Exercise; answer: string }[] = []
    
    exercises.forEach((exercise, index) => {
      const answer = answers[index]
      const kp = exercise.knowledge_point
      
      if (!knowledgeScores[kp]) {
        knowledgeScores[kp] = { correct: 0, total: 0 }
      }
      knowledgeScores[kp].total++
      
      let isCorrect = false
      if (exercise.type === 'choice' && exercise.answer) {
        const correctIndex = exercise.answer.charCodeAt(0) - 65
        isCorrect = answer.selected === correctIndex
      } else if (exercise.type === 'judge' && exercise.answer) {
        const correctBool = exercise.answer === 'true' || exercise.answer === '对'
        isCorrect = answer.selected === correctBool
      }
      
      if (isCorrect) {
        knowledgeScores[kp].correct++
      }
      
      setAnswers(prev => ({
        ...prev,
        [index]: { ...prev[index], correct: isCorrect }
      }))

      // 收集错题，稍后批量加入
      if (!isCorrect && studentId && exercise.exercise_id) {
        wrongExercises.push({ exercise, answer: String(answer.selected) })
      }
    })

    // 批量加入错题本（Promise.allSettled 确保全部完成）
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

    // 计算总分
    let totalCorrect = 0
    const weak: string[] = []
    
    Object.entries(knowledgeScores).forEach(([kp, scores]) => {
      totalCorrect += scores.correct
      const kpScore = Math.round((scores.correct / scores.total) * 100)
      if (kpScore < 80) {
        weak.push(kp)
      }
    })

    const finalScore = Math.round((totalCorrect / exercises.length) * 100)
    setScore(finalScore)
    setSubmitted(true)
    setWeakPoints(weak)
    setPassed(weak.length === 0 && finalScore >= 80)
  }, [exercises, answers, submitted])

  const handleRetryWeakPoints = useCallback(() => {
    // 返回路径页面，标记薄弱知识点需要重学
    router.push(`/plan/${pathId}`)
  }, [pathId, router])

  const handleComplete = useCallback(() => {
    // 完成学习路径
    router.push(`/plan/${pathId}`)
  }, [pathId, router])

  if (loading || generating) {
    return (
      <div className="plan-page">
        <div className="plan-container">
          <div className="loading-state">
            <div className="loading-spinner" />
            <p>{loading ? '加载中...' : 'AI 正在生成综合测试卷...'}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="plan-page">
      <div className="plan-container">
        {/* 顶部导航 */}
        <div className="quiz-header">
          <button className="back-btn" onClick={() => router.push(`/plan/${pathId}`)}>
            <Icon name="arrowLeft" size={16} />
            返回路径
          </button>
          <h1>综合测试 - {path?.name}</h1>
          <div className="quiz-info">
            <span>共 {exercises.length} 题</span>
            <span>涵盖所有知识点</span>
          </div>
        </div>

        {/* 结果页面 */}
        {submitted && (
          <div className={`final-result ${passed ? 'passed' : 'failed'}`}>
            <div className="result-icon">
              {passed ? <Icon name="trophy" size={48} /> : <Icon name="alertTriangle" size={48} />}
            </div>
            <h2>{passed ? '恭喜完成学习！' : '还有薄弱点需要加强'}</h2>
            <div className="result-score">
              <span className="score">{score}</span>
              <span className="label">分</span>
            </div>
            
            {passed ? (
              <p>你已完全掌握所有知识点，学习路径完成！</p>
            ) : (
              <div className="weak-points">
                <p>以下知识点需要重新学习：</p>
                <div className="weak-list">
                  {weakPoints.map((kp, index) => (
                    <div key={index} className="weak-item">
                      <Icon name="alertCircle" size={16} />
                      <span>{kp}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            <div className="result-actions">
              <button className="btn-primary" onClick={passed ? handleComplete : handleRetryWeakPoints}>
                {passed ? '完成学习' : '返回重新学习薄弱知识点'}
              </button>
            </div>
          </div>
        )}

        {/* 题目列表 */}
        {!submitted && (
          <div className="quiz-questions">
            {exercises.map((exercise, index) => (
              <div key={index} className="quiz-question">
                <div className="question-header">
                  <span className="question-number">第 {index + 1} 题</span>
                  <span className="question-kp">{exercise.knowledge_point}</span>
                  <span className="question-type">
                    {exercise.type === 'choice' ? '选择题' : exercise.type === 'judge' ? '判断题' : '简答题'}
                  </span>
                </div>
                
                <div className="question-text">{exercise.question}</div>
                
                {exercise.type === 'choice' && exercise.options && (
                  <div className="question-options">
                    {exercise.options.map((option, optIndex) => (
                      <button
                        key={optIndex}
                        className={`option-btn ${answers[index]?.selected === optIndex ? 'selected' : ''}`}
                        onClick={() => handleSelectAnswer(index, optIndex)}
                      >
                        <span className="option-letter">{String.fromCharCode(65 + optIndex)}</span>
                        <span className="option-text">{option}</span>
                      </button>
                    ))}
                  </div>
                )}
                
                {exercise.type === 'judge' && (
                  <div className="question-options judge">
                    <button
                      className={`option-btn ${answers[index]?.selected === true ? 'selected' : ''}`}
                      onClick={() => handleSelectAnswer(index, true)}
                    >
                      正确
                    </button>
                    <button
                      className={`option-btn ${answers[index]?.selected === false ? 'selected' : ''}`}
                      onClick={() => handleSelectAnswer(index, false)}
                    >
                      错误
                    </button>
                  </div>
                )}
              </div>
            ))}
            
            <div className="quiz-submit">
              <button className="btn-primary" onClick={handleSubmit}>
                <Icon name="check" size={18} />
                提交答案
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
