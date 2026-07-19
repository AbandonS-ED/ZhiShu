'use client'

import { useEffect, useRef } from 'react'
import { evaluationApi } from '@/lib/api'
import { getStudentId } from '@/lib/student'

/**
 * 页面停留计时器 — 自动记录用户在当前页面的停留时长
 * 组件卸载 / 页面关闭时上报 duration_seconds
 */
export function usePageTimer(action: string, knowledgePoint?: string) {
  const startRef = useRef<number>(Date.now())

  useEffect(() => {
    const report = () => {
      const elapsed = Math.floor((Date.now() - startRef.current) / 1000)
      if (elapsed < 3) return // 少于 3 秒不记录（误触）
      try {
        const studentId = getStudentId()
        if (!studentId) return
        evaluationApi.recordAction({
          student_id: studentId,
          action,
          knowledge_point: knowledgePoint || action,
          duration_seconds: elapsed,
        }).catch(() => {})
      } catch {
        // 静默
      }
    }

    // 页面关闭 / 切换标签页
    window.addEventListener('beforeunload', report)
    // SPA 路由跳走时
    return () => {
      window.removeEventListener('beforeunload', report)
      report()
    }
  }, [action, knowledgePoint])
}
