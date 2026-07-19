'use client'
import { useState, useEffect, useCallback } from 'react'
import { resourceApi } from '@/lib/api'
import { getStudentId } from '@/lib/student'
import type { LearningPackage, PhaseType } from '../types'

export function useLearningPackage(knowledge_point: string, phase: PhaseType) {
  const [pkg, setPkg] = useState<LearningPackage | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetch_ = useCallback(async () => {
    const studentId = getStudentId()
    if (!studentId || !knowledge_point) return
    try {
      setLoading(true)
      setError(null)
      const res = await resourceApi.getLearningPackage(studentId, knowledge_point, phase)
      setPkg(res as unknown as LearningPackage)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [knowledge_point, phase])

  // 如果资源为空，轮询等待生成
  useEffect(() => {
    fetch_()
    // 不自动轮询，让 PhaseButton 触发 SSE 后再刷新
  }, [fetch_])

  return { data: pkg, loading, error, mutate: fetch_ }
}
