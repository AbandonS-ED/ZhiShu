'use client'
import { useState, useEffect } from 'react'
import { resourceApi } from '@/lib/api'
import { getStudentId } from '@/lib/student'
import type { RecItem } from '../types'

export function useRecommendations() {
  const [data, setData] = useState<RecItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch_ = async () => {
    const studentId = getStudentId()
    if (!studentId) {
      setData([])
      setLoading(false)
      return
    }
    try {
      setLoading(true)
      setError(null)
      const res = await resourceApi.getRecommendations(studentId, 10)
      setData(res.recommendations as RecItem[])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetch_()
  }, [])

  return { data, loading, error, mutate: fetch_ }
}
