'use client'

import { useState, useEffect, useRef } from 'react'

interface Step {
  id: string
  label: string
  description: string
  estimatedSeconds: number
}

const STEPS: Step[] = [
  {
    id: 'generating',
    label: 'AI 生成中',
    description: '正在调用大模型生成学习资源...',
    estimatedSeconds: 15,
  },
  {
    id: 'parsing',
    label: '解析结果',
    description: '正在解析生成的内容...',
    estimatedSeconds: 2,
  },
  {
    id: 'reviewing',
    label: '智能审核',
    description: '正在进行四维度质量审核...',
    estimatedSeconds: 8,
  },
  {
    id: 'saving',
    label: '保存资源',
    description: '正在保存到数据库...',
    estimatedSeconds: 1,
  },
]

interface ResourceProgressProps {
  currentStep: string
  progress?: number
  message?: string
  isStreaming?: boolean
  streamContent?: string
}

export default function ResourceProgress({
  currentStep,
  progress = 0,
  message,
  isStreaming = false,
  streamContent = '',
}: ResourceProgressProps) {
  const [elapsedTime, setElapsedTime] = useState(0)
  const [startTime] = useState(Date.now())
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTime) / 1000))
    }, 1000)
    return () => clearInterval(timer)
  }, [startTime])

  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight
    }
  }, [streamContent])

  const currentStepIndex = STEPS.findIndex(s => s.id === currentStep)
  const totalEstimated = STEPS.reduce((sum, s) => sum + s.estimatedSeconds, 0)
  const completedEstimated = STEPS.slice(0, currentStepIndex).reduce(
    (sum, s) => sum + s.estimatedSeconds,
    0
  )
  const remainingEstimate = Math.max(0, totalEstimated - elapsedTime)
  const progressPercent = Math.min(
    100,
    Math.max(
      progress * 100,
      currentStepIndex >= 0 ? ((currentStepIndex + 0.5) / STEPS.length) * 100 : 0
    )
  )

  const formatTime = (seconds: number) => {
    if (seconds <= 0) return '即将完成'
    if (seconds < 60) return `${seconds} 秒`
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins} 分 ${secs} 秒`
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* 步骤指示器 */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
          {STEPS.map((step, index) => {
            const isActive = step.id === currentStep
            const isCompleted = index < currentStepIndex
            const isPending = index > currentStepIndex

            return (
              <div
                key={step.id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  flex: 1,
                  position: 'relative',
                }}
              >
                {/* 连接线 */}
                {index > 0 && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 14,
                      right: '50%',
                      width: '100%',
                      height: 2,
                      background: isCompleted ? 'var(--warm)' : 'var(--line)',
                      zIndex: 0,
                    }}
                  />
                )}

                {/* 圆圈 */}
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: isCompleted
                      ? 'var(--warm)'
                      : isActive
                      ? 'var(--warm)'
                      : 'var(--surface)',
                    border: `2px solid ${
                      isCompleted || isActive ? 'var(--warm)' : 'var(--line)'
                    }`,
                    color: isCompleted || isActive ? '#fff' : 'var(--ink-3)',
                    fontSize: 12,
                    fontWeight: 600,
                    zIndex: 1,
                    transition: 'all 0.3s ease',
                    position: 'relative',
                  }}
                >
                  {isCompleted ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : isActive ? (
                    <div className="step-spinner" />
                  ) : (
                    index + 1
                  )}
                </div>

                {/* 标签 */}
                <div
                  style={{
                    marginTop: 8,
                    fontSize: 11,
                    fontWeight: isActive ? 600 : 400,
                    color: isCompleted || isActive ? 'var(--ink)' : 'var(--ink-3)',
                    textAlign: 'center',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {step.label}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* 进度条 */}
      <div style={{ marginBottom: 20 }}>
        <div
          style={{
            height: 6,
            background: 'var(--line)',
            borderRadius: 3,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${progressPercent}%`,
              background: 'linear-gradient(90deg, var(--warm) 0%, #f59e0b 100%)',
              borderRadius: 3,
              transition: 'width 0.5s ease',
              position: 'relative',
            }}
          >
            <div
              className="progress-shimmer"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
              }}
            />
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginTop: 8,
            fontSize: 11,
            color: 'var(--ink-3)',
          }}
        >
          <span>{message || (currentStepIndex >= 0 ? STEPS[currentStepIndex].description : '准备中...')}</span>
          <span style={{ fontWeight: 500 }}>
            {formatTime(remainingEstimate)}
          </span>
        </div>
      </div>

      {/* 统计信息 */}
      <div
        style={{
          display: 'flex',
          gap: 16,
          marginBottom: 16,
          padding: '12px 16px',
          background: 'var(--bg)',
          borderRadius: 'var(--r-xs)',
        }}
      >
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--warm)' }}>
            {elapsedTime}s
          </div>
          <div style={{ fontSize: 10, color: 'var(--ink-3)', marginTop: 2 }}>
            已用时间
          </div>
        </div>
        <div style={{ width: 1, background: 'var(--line)' }} />
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--ink)' }}>
            {Math.round(progressPercent)}%
          </div>
          <div style={{ fontSize: 10, color: 'var(--ink-3)', marginTop: 2 }}>
            总进度
          </div>
        </div>
        <div style={{ width: 1, background: 'var(--line)' }} />
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--success)' }}>
            {currentStepIndex + 1}/{STEPS.length}
          </div>
          <div style={{ fontSize: 10, color: 'var(--ink-3)', marginTop: 2 }}>
            当前步骤
          </div>
        </div>
      </div>

      {/* 流式内容预览 */}
      {isStreaming && streamContent && (
        <div style={{ flex: 1, minHeight: 0 }}>
          <div
            style={{
              fontSize: 11,
              color: 'var(--ink-3)',
              marginBottom: 6,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <div className="typing-indicator">
              <span></span>
              <span></span>
              <span></span>
            </div>
            AI 正在输出...
          </div>
          <div
            ref={contentRef}
            style={{
              background: 'var(--bg)',
              borderRadius: 'var(--r-xs)',
              padding: 12,
              fontSize: 12,
              lineHeight: 1.6,
              color: 'var(--ink-2)',
              maxHeight: 120,
              overflow: 'auto',
              fontFamily: "'JetBrains Mono', monospace",
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
            }}
          >
            {streamContent.slice(-500)}
          </div>
        </div>
      )}

      {/* 动画样式 */}
      <style jsx>{`
        .step-spinner {
          width: 14px;
          height: 14px;
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-top-color: #fff;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        .progress-shimmer {
          background: linear-gradient(
            90deg,
            transparent 0%,
            rgba(255, 255, 255, 0.4) 50%,
            transparent 100%
          );
          animation: shimmer 1.5s infinite;
        }

        .typing-indicator {
          display: inline-flex;
          gap: 3px;
        }

        .typing-indicator span {
          width: 4px;
          height: 4px;
          background: var(--ink-3);
          border-radius: 50%;
          animation: bounce 1.4s infinite ease-in-out;
        }

        .typing-indicator span:nth-child(1) {
          animation-delay: -0.32s;
        }

        .typing-indicator span:nth-child(2) {
          animation-delay: -0.16s;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        @keyframes shimmer {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }

        @keyframes bounce {
          0%,
          80%,
          100% {
            transform: scale(0);
          }
          40% {
            transform: scale(1);
          }
        }
      `}</style>
    </div>
  )
}
