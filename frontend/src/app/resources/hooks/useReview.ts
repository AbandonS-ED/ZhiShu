'use client'

import { useState, useCallback } from 'react'
import { resourceApi } from '@/lib/api'
import type { ReviewResult, ResourceContent } from '../types'

export function useReview() {
  const [reviewResult, setReviewResult] = useState<ReviewResult | null>(null)
  const [isReviewing, setIsReviewing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const requestReview = useCallback(async (content: ResourceContent, knowledgePoint: string) => {
    setIsReviewing(true)
    setError(null)
    try {
      const result = await resourceApi.review({ content, knowledge_point: knowledgePoint })
      setReviewResult(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : '审核请求失败')
    } finally {
      setIsReviewing(false)
    }
  }, [])

  const clearReview = useCallback(() => {
    setReviewResult(null)
    setError(null)
    setIsReviewing(false)
  }, [])

  return { reviewResult, isReviewing, error, requestReview, clearReview }
}
