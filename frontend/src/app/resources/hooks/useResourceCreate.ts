'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { resourceApi } from '@/lib/api'
import { getStudentId } from '@/lib/student'
import type { CreateMessage, ResourceContent, ReviewResult } from '../types'

export function useResourceCreate() {
  const [messages, setMessages] = useState<CreateMessage[]>([])
  const [currentContent, setCurrentContent] = useState<ResourceContent | null>(null)
  const [reviewResult, setReviewResult] = useState<ReviewResult | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isReviewing, setIsReviewing] = useState(false)
  const [status, setStatus] = useState('')

  const abortRef = useRef<(() => void) | null>(null)
  const studentId = getStudentId()

  useEffect(() => {
    return () => { if (abortRef.current) abortRef.current() }
  }, [])

  const sendMessage = useCallback((text: string) => {
    if (!text.trim() || isGenerating) return

    const userMsg: CreateMessage = { role: 'user', content: text.trim(), timestamp: Date.now() }
    const loadingMsg: CreateMessage = { role: 'assistant', content: '', timestamp: Date.now() }

    setMessages(prev => [...prev, userMsg, loadingMsg])
    setIsGenerating(true)
    setStatus('正在分析请求...')

    let accumulated = ''
    let resultData: any = null

    const res = resourceApi.createStream({
      student_id: studentId,
      message: text.trim(),
      conversation_history: [...messages, userMsg],
    })

    const reader = (res as Promise<Response>).then ? undefined : undefined

    // resourceApi.createStream returns a Promise<Response>
    ;(res as unknown as Promise<Response>).then(response => {
      if (!response.ok || !response.body) {
        throw new Error(`SSE ${response.status}`)
      }
      const streamReader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      function processChunk(): Promise<void> {
        return streamReader.read().then(({ done, value }) => {
          if (done) return
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            try {
              const event = JSON.parse(line.slice(6))

              if (event.type === 'progress' && event.message) {
                setStatus(event.message)
              }

              if (event.type === 'token' && event.content) {
                accumulated += event.content
                setMessages(prev => {
                  const arr = [...prev]
                  arr[arr.length - 1] = { ...arr[arr.length - 1], content: accumulated }
                  return arr
                })
              }

              if (event.type === 'result') {
                resultData = event
                if (event.content) setCurrentContent(event.content)
                if (event.review) setReviewResult(event.review)
              }

              if (event.type === 'error') {
                throw new Error(event.message || '生成失败')
              }
            } catch (parseErr) {
              if (parseErr instanceof Error && parseErr.message !== '生成失败') {
                // ignore malformed JSON
              } else {
                throw parseErr
              }
            }
          }

          return processChunk()
        })
      }

      return processChunk()
    }).then(() => {
      if (resultData) {
        const finalText = resultData.content
          ? (accumulated || JSON.stringify(resultData.content, null, 2))
          : accumulated
        setMessages(prev => {
          const arr = [...prev]
          arr[arr.length - 1] = { ...arr[arr.length - 1], content: finalText }
          return arr
        })
      }
    }).catch(err => {
      if (err instanceof Error && err.name !== 'AbortError') {
        setMessages(prev => {
          const arr = [...prev]
          arr[arr.length - 1] = { ...arr[arr.length - 1], content: `错误: ${err.message}` }
          return arr
        })
      }
    }).finally(() => {
      setIsGenerating(false)
      setStatus('')
    })
  }, [messages, isGenerating, studentId])

  const requestReview = useCallback(async () => {
    if (!currentContent || isReviewing) return
    setIsReviewing(true)
    try {
      const knowledgePoint = messages.find(m => m.role === 'user')?.content || ''
      const result = await resourceApi.review({ content: currentContent, knowledge_point: knowledgePoint })
      setReviewResult(result)
    } catch (err) {
      setReviewResult(null)
    } finally {
      setIsReviewing(false)
    }
  }, [currentContent, isReviewing, messages])

  const reset = useCallback(() => {
    if (abortRef.current) {
      abortRef.current()
      abortRef.current = null
    }
    setMessages([])
    setCurrentContent(null)
    setReviewResult(null)
    setIsGenerating(false)
    setIsReviewing(false)
    setStatus('')
  }, [])

  return {
    messages,
    currentContent,
    reviewResult,
    isGenerating,
    isReviewing,
    status,
    sendMessage,
    requestReview,
    reset,
    setCurrentContent,
    setReviewResult,
  }
}
