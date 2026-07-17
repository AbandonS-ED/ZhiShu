'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { studyPlanApi, exerciseApi, scoreApi, type LearningPath, type LearningPathNode, type Exercise } from '@/lib/api'
import { getStudentId } from '@/lib/student'
import { usePageTimer } from '@/hooks/usePageTimer'
import Icon from '@/components/Icon'
import QuestionCard from './components/QuestionCard'
import ResultPanel from './components/ResultPanel'
import LoadingState from './components/LoadingState'

interface Answer {
  selected: number | boolean | string | null
  correct: boolean | null
  score?: number
  feedback?: string
  suggestion?: string
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
  const [scoring, setScoring] = useState(false)
  const [scoringProgress, setScoringProgress] = useState({ current: 0, total: 0 })
  const [scoringStatus, setScoringStatus] = useState<Record<number, 'pending' | 'scoring' | 'done'>>({})

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
    if (submitted || scoring) return
    
    const allAnswered = exercises.every((_, index) => {
      const selected = answers[index]?.selected
      return selected !== null && selected !== undefined && selected !== ''
    })
    if (!allAnswered) {
      alert('请完成所有题目')
      return
    }

    // 设置评分状态
    setScoring(true)
    setSubmitted(true)
    
    // 统计简答题数量
    const shortAnswerIndices = exercises.reduce((acc, exercise, index) => {
      if (exercise.type === 'short_answer') acc.push(index)
      return acc
    }, [] as number[])
    
    setScoringProgress({ current: 0, total: shortAnswerIndices.length })
    
    // 初始化评分状态
    const initialScoringStatus: Record<number, 'pending' | 'scoring' | 'done'> = {}
    exercises.forEach((_, index) => {
      initialScoringStatus[index] = exercises[index].type === 'short_answer' ? 'pending' : 'done'
    })
    setScoringStatus(initialScoringStatus)

    // 先处理选择题和判断题（立即显示结果）
    const newAnswers = { ...answers }
    
    exercises.forEach((exercise, index) => {
      const answer = answers[index]
      let isCorrect = false
      
      if (exercise.type === 'choice' && exercise.answer) {
        const correctIndex = exercise.answer.charCodeAt(0) - 65
        isCorrect = answer.selected === correctIndex
      } else if (exercise.type === 'judge' && exercise.answer) {
        const correctBool = exercise.answer === 'true' || exercise.answer === '对'
        isCorrect = answer.selected === correctBool
      }
      
      if (exercise.type !== 'short_answer') {
        newAnswers[index] = { ...newAnswers[index], correct: isCorrect }
      }
    })
    
    // 更新选择题和判断题的结果
    setAnswers(newAnswers)

    // 同时标记所有简答题为评分中
    const scoringStatusUpdate: Record<number, 'pending' | 'scoring' | 'done'> = {}
    shortAnswerIndices.forEach(idx => { scoringStatusUpdate[idx] = 'scoring' })
    setScoringStatus(prev => ({ ...prev, ...scoringStatusUpdate }))

    // 并行调用所有简答题的AI评分API，每完成一个立即更新
    let processedCount = 0
    
    const scoringPromises = shortAnswerIndices.map(async (index) => {
      const exercise = exercises[index]
      const studentAnswer = answers[index]?.selected as string
      
      const processResult = async () => {
        if (studentAnswer && studentAnswer.trim().length > 0) {
          try {
            const scoreResult = await scoreApi.scoreAnswer(
              exercise.question,
              exercise.answer || '',
              studentAnswer,
              exercise.knowledge_point || ''
            )
            return {
              isCorrect: scoreResult.correct,
              score: scoreResult.score,
              feedback: scoreResult.feedback,
              suggestion: scoreResult.suggestion,
            }
          } catch (error) {
            console.error('AI评分失败，使用默认评分:', error)
            return { isCorrect: true, score: 80, feedback: 'AI评分失败，使用默认评分', suggestion: '' }
          }
        } else {
          return { isCorrect: false, score: 0, feedback: '未作答', suggestion: '请作答' }
        }
      }
      
      // 执行评分并立即更新状态
      const result = await processResult()
      
      // 立即更新这道题的结果
      setAnswers(prev => ({
        ...prev,
        [index]: {
          ...prev[index],
          correct: result.isCorrect,
          score: result.score,
          feedback: result.feedback,
          suggestion: result.suggestion,
        }
      }))
      
      // 更新进度
      processedCount++
      setScoringProgress(prev => ({ ...prev, current: processedCount }))
      
      // 标记这道题评分完成
      setScoringStatus(prev => ({ ...prev, [index]: 'done' }))
      
      return { index, ...result }
    })

    // 等待所有评分完成
    await Promise.all(scoringPromises)
    
    // 重新计算总分（使用最新的answers状态）
    let finalTotalScore = 0
    let finalCorrectCount = 0
    exercises.forEach((exercise, index) => {
      const answer = answers[index]
      if (exercise.type !== 'short_answer') {
        if (answer?.correct) finalCorrectCount++
        finalTotalScore += answer?.correct ? 100 : 0
      }
    })
    
    // 加上简答题的分数
    shortAnswerIndices.forEach(index => {
      const answer = answers[index]
      if (answer?.correct) finalCorrectCount++
      finalTotalScore += answer?.score || 0
    })

    // 计算最终分数
    const finalScore = Math.round(finalTotalScore / exercises.length)
    setScore(finalScore)
    setPassed(finalScore >= 60)
    setScoring(false)
    
    // 如果通过，更新节点状态
    if (finalScore >= 60) {
      try {
        await studyPlanApi.completeNode(pathId, nodeId)
        console.log('节点状态已更新')
      } catch (err) {
        console.error('更新节点状态失败:', err)
      }
    }
  }, [exercises, answers, submitted, scoring, pathId, nodeId])

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

        {/* 成绩面板 - 只在评分完成后显示 */}
        {submitted && !scoring && (
          <ResultPanel 
            score={score}
            passed={passed}
            onContinue={handleContinue}
            onRetry={handleRetry}
          />
        )}

        {/* 评分进度条 */}
        {scoring && (
          <div className="scoring-progress">
            <div className="progress-header">
              <span>AI 评分进度</span>
              <span>{scoringProgress.current}/{scoringProgress.total}</span>
            </div>
            <div className="progress-bar">
              <div 
                className="progress-fill" 
                style={{ width: `${(scoringProgress.current / scoringProgress.total) * 100}%` }}
              ></div>
            </div>
            <div className="progress-text">
              正在评分第 {scoringProgress.current + 1} 道简答题...
            </div>
          </div>
        )}

        {/* 题目列表 */}
        <div className="quiz-questions">
          {exercises.map((exercise, index) => (
            <QuestionCard
              key={index}
              exercise={exercise}
              index={index}
              answer={answers[index]}
              submitted={submitted}
              scoringStatus={scoringStatus[index]}
              onSelectAnswer={handleSelectAnswer}
            />
          ))}
          
          {!submitted && !scoring && (
            <div className="quiz-submit">
              <button className="btn-primary" onClick={handleSubmit}>
                <Icon name="check" size={18} />
                提交答案
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}