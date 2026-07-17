'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { studyPlanApi, exerciseApi, wrongQuestionsApi, type LearningPath, type LearningPathNode, type Exercise } from '@/lib/api'
import { getStudentId } from '@/lib/student'
import { usePageTimer } from '@/hooks/usePageTimer'
import Icon from '@/components/Icon'
import QuestionCard from './components/QuestionCard'
import ResultPanel from './components/ResultPanel'
import LoadingState from './components/LoadingState'

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
      console.log('Student ID:', studentId)
      if (!studentId) {
        console.error('用户未登录')
        window.location.href = '/login'
        return
      }
      console.log('开始生成测验题, 知识点:', knowledgePoint)
      const result = await exerciseApi.generate(studentId, knowledgePoint, 5, 'all')
      console.log('API 返回结果:', result)
      if (result && result.exercises && result.exercises.length > 0) {
        setExercises(result.exercises)
        const initialAnswers: Record<number, Answer> = {}
        result.exercises.forEach((_, index) => {
          initialAnswers[index] = { selected: null, correct: null }
        })
        setAnswers(initialAnswers)
      } else {
        console.error('API 返回数据格式错误:', result)
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
      alert('请完成所有题目')
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

      // 收集错题，稍后批量加入
      if (!isCorrect && studentId && exercise.exercise_id) {
        wrongExercises.push({ exercise, answer: String(answer.selected) })
      }
    })

    // 批量加入错题本（不阻塞主流程）
    if (studentId) {
      wrongExercises.forEach(async ({ exercise, answer }) => {
        try {
          await wrongQuestionsApi.add({
            student_id: studentId,
            exercise_id: exercise.exercise_id,
            wrong_answer: answer,
          })
        } catch (err) {
          console.error('加入错题本失败:', err)
        }
      })
    }

    const finalScore = Math.round(totalScore / exercises.length)
    setScore(finalScore)
    setSubmitted(true)
    setPassed(finalScore >= 60)
    
    // 如果通过，更新节点状态
    if (finalScore >= 60) {
      try {
        await studyPlanApi.completeNode(pathId, nodeId)
        console.log('节点状态已更新')
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

  if (loading || generating) {
    return <LoadingState loading={loading} generating={generating} />
  }

  if (error) {
    return (
      <div className="plan-page">
        <div className="plan-container">
          <div className="error-state">
            <p>{error}</p>
            <div className="error-actions">
              <button className="btn-primary" onClick={() => window.location.reload()}>
                重试
              </button>
              <button className="btn-secondary" onClick={() => router.push(`/plan/${pathId}`)}>
                返回路径
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (exercises.length === 0) {
    return (
      <div className="plan-page">
        <div className="plan-container">
          <div className="error-state">
            <p>生成测验题失败</p>
            <button className="btn-secondary" onClick={() => router.push(`/plan/${pathId}`)}>
              返回路径
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="plan-page">
      <div className="plan-container">
        <div className="quiz-header">
          <button className="back-btn" onClick={() => router.push(`/plan/${pathId}/learn/${nodeId}`)}>
            <Icon name="arrowLeft" size={16} />
            返回学习
          </button>
          <h1>{currentNode?.knowledge_point} - 测验</h1>
          <div className="quiz-info">
            <span>共 {exercises.length} 题</span>
            <span>60分以上通过</span>
          </div>
        </div>

        {submitted && (
          <ResultPanel 
            score={score}
            passed={passed}
            onContinue={handleContinue}
            onRetry={handleRetry}
          />
        )}

        {!submitted && (
          <div className="quiz-questions">
            {exercises.map((exercise, index) => (
              <QuestionCard
                key={index}
                exercise={exercise}
                index={index}
                answer={answers[index]}
                submitted={submitted}
                onSelectAnswer={handleSelectAnswer}
              />
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