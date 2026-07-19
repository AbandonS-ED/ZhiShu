'use client'
import { useState, useCallback, useRef } from 'react'
import { resourceApi } from '@/lib/api'
import { getStudentId } from '@/lib/student'

interface PhaseGenerationState {
  status: 'idle' | 'generating' | 'done' | 'error'
  progress: number
  current_agent: string
  message: string
  error: string | null
  result: {
    resource_id: string
    knowledge_point: string
    phase: string
    content: Record<string, unknown>
  } | null
}

export function usePhaseGeneration() {
  const [state, setState] = useState<PhaseGenerationState>({
    status: 'idle',
    progress: 0,
    current_agent: '',
    message: '',
    error: null,
    result: null,
  })

  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const start = useCallback(async (knowledge_point: string, phase: string) => {
    const studentId = getStudentId()
    if (!studentId) return

    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current)
      progressTimerRef.current = null
    }

    setState({
      status: 'generating',
      progress: 10,
      current_agent: 'document',
      message: '正在生成学习资源...',
      error: null,
      result: null,
    })

    let simulatedProgress = 10
    progressTimerRef.current = setInterval(() => {
      simulatedProgress = Math.min(simulatedProgress + Math.random() * 8 + 4, 80)
      setState(prev => {
        if (prev.status !== 'generating') return prev
        const agents = ['document', 'exercise', 'validator', 'storage']
        const agentIdx = Math.floor(simulatedProgress / 20)
        const messages = [
          '正在分析知识点...',
          '正在生成学习内容...',
          '正在进行防幻觉验证...',
          '正在保存资源...',
        ]
        return {
          ...prev,
          progress: Math.round(simulatedProgress),
          current_agent: agents[Math.min(agentIdx, agents.length - 1)],
          message: messages[Math.min(agentIdx, messages.length - 1)],
        }
      })
    }, 2000)

    try {
      const data = await resourceApi.generateLearningPackage(studentId, knowledge_point, phase)

      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current)
        progressTimerRef.current = null
      }

      setState({
        status: 'done',
        progress: 100,
        current_agent: '',
        message: '生成完成',
        error: null,
        result: data as PhaseGenerationState['result'],
      })
    } catch (err: any) {
      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current)
        progressTimerRef.current = null
      }
      setState({
        status: 'error',
        progress: 0,
        current_agent: '',
        message: '',
        error: err?.message ?? '生成失败，请重试',
        result: null,
      })
    }
  }, [])

  const reset = useCallback(() => {
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current)
      progressTimerRef.current = null
    }
    setState({
      status: 'idle',
      progress: 0,
      current_agent: '',
      message: '',
      error: null,
      result: null,
    })
  }, [])

  return { state, start, reset }
}
