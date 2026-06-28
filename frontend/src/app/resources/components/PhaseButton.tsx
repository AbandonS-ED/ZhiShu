'use client'
import { useRouter } from 'next/navigation'
import type { PhaseType } from '../types'
import Icon from '@/components/Icon'
import type { ReactNode } from 'react'
import { usePhaseGeneration } from '../hooks/usePhaseGeneration'

const PHASE_LABELS: Record<PhaseType, string> = {
  learn: '学习',
  practice: '练习',
  review: '复习',
}

const PHASE_AGENT_LABELS: Record<string, ReactNode> = {
  document: <><Icon name="doc" size={14} className="inline-icon" /> 文档</>,
  exercise: <><Icon name="edit" size={14} className="inline-icon" /> 练习</>,
  validator: <><Icon name="search" size={14} className="inline-icon" /> 验证</>,
  storage: <><Icon name="save" size={14} className="inline-icon" /> 存储</>,
}

interface PhaseButtonProps {
  knowledge_point: string
  phase: PhaseType
  hasResource: boolean  // 该阶段是否已有资源
  onGenerated?: () => void  // 生成完成后刷新父组件
}

export default function PhaseButton({
  knowledge_point,
  phase,
  hasResource,
  onGenerated,
}: PhaseButtonProps) {
  const router = useRouter()
  const { state, start, reset } = usePhaseGeneration()

  const isThisPhase = state.result?.phase === phase
  const isGenerating = state.status === 'generating' && isThisPhase
  const isDone = state.status === 'done' && isThisPhase
  const rawStatus: string = state.status  // avoid TS narrowing

  const handleClick = () => {
    if (hasResource) {
      // 已存在 → 直接跳学习页
      router.push(`/resources/learn/${encodeURIComponent(knowledge_point)}?phase=${phase}`)
      return
    }
    if (isGenerating) {
      // 生成中 → 不可点击
      return
    }
    // 触发生成
    reset()
    start(knowledge_point, phase)
  }

  const handleDone = () => {
    onGenerated?.()
    router.push(`/resources/learn/${encodeURIComponent(knowledge_point)}?phase=${phase}`)
  }

  // idle 状态
  if (state.status === 'idle' || (!isThisPhase && !hasResource)) {
    return (
      <button className="phase-btn phase-btn-idle" onClick={handleClick}>
        <span className="phase-icon">⚡</span>
        <span>{PHASE_LABELS[phase]}</span>
      </button>
    )
  }

  // 有资源但未生成
  if (hasResource && rawStatus === 'idle') {
    return (
      <button className="phase-btn phase-btn-ready" onClick={handleClick}>
        <span className="phase-icon">✓</span>
        <span>{PHASE_LABELS[phase]}</span>
      </button>
    )
  }

  // 生成中
  if (isGenerating) {
    return (
      <div className="phase-btn phase-btn-generating">
        <div className="phase-progress-bar">
          <div
            className="phase-progress-fill"
            style={{ width: `${state.progress}%` }}
          />
        </div>
        <div className="phase-info">
          <span className="phase-agent">
            {PHASE_AGENT_LABELS[state.current_agent] ?? state.current_agent ?? <Icon name="robot" size={14} />}
          </span>
          <span className="phase-msg">{state.message || '生成中...'}</span>
          <span className="phase-pct">{state.progress}%</span>
        </div>
      </div>
    )
  }

  // 完成
  if (isDone) {
    return (
      <button className="phase-btn phase-btn-done" onClick={handleDone}>
        <span className="phase-icon">✓</span>
        <span>进入{PHASE_LABELS[phase]}</span>
      </button>
    )
  }

  // 错误
  if (state.status === 'error' && isThisPhase) {
    return (
      <button className="phase-btn phase-btn-error" onClick={handleClick}>
        <span className="phase-icon"><Icon name="warning" size={14} /></span>
        <span>重试</span>
      </button>
    )
  }

  return (
    <button className="phase-btn phase-btn-idle" onClick={handleClick}>
      <span className="phase-icon">⚡</span>
      <span>{PHASE_LABELS[phase]}</span>
    </button>
  )
}
