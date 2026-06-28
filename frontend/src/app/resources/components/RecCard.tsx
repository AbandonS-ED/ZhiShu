'use client'
import { useState } from 'react'
import type { RecItem, PhaseType } from '../types'
import PhaseButton from './PhaseButton'
import Icon from '@/components/Icon'

const REASON_COLORS: Record<string, { bg: string; color: string; label: string; icon: string }> = {
  evaluation: { bg: 'var(--danger-soft)', color: 'var(--danger)', label: '评估', icon: 'chart' },
  chat:       { bg: 'var(--info-soft)',   color: 'var(--info)',   label: '对话', icon: 'chat' },
  tiku:       { bg: 'var(--warm-soft)',   color: 'var(--warm)',   label: '练习', icon: 'edit' },
  path:       { bg: 'var(--success-soft)',color: 'var(--success)', label: '路径', icon: 'map' },
  profile:    { bg: 'var(--accent-soft)', color: 'var(--ink-2)',  label: '画像', icon: 'user' },
  cold_start: { bg: 'var(--bg)',          color: 'var(--ink-3)',  label: '冷启动', icon: 'cold' },
}

interface RecCardProps {
  item: RecItem
  onRefresh?: () => void
}

export default function RecCard({ item, onRefresh }: RecCardProps) {
  const [expanded, setExpanded] = useState(false)
  const reasonStyle = REASON_COLORS[item.reason_type] ?? REASON_COLORS.evaluation

  const phases: PhaseType[] = ['learn', 'practice', 'review']

  return (
    <div className="rec-card">
      <div className="rec-card-header">
        <div className="rec-kp-wrap">
          <span className="rec-kp">{item.knowledge_point}</span>
          <span className="rec-badge" style={{ background: reasonStyle.bg, color: reasonStyle.color }}>
            <Icon name={reasonStyle.icon as any} size={12} className="inline-icon" />{reasonStyle.label}
          </span>
        </div>
        <div className="rec-meta">
          <span className="rec-score" title="优先级分数">
            ★ {item.priority_score.toFixed(2)}
          </span>
          <span className="rec-time">⏱ {item.estimated_minutes}分钟</span>
        </div>
      </div>

      <p className="rec-reason">{item.reason}</p>

      {/* 已有资源指示 */}
      <div className="rec-phases-existing">
        {phases.map(p => (
          <span
            key={p}
            className={`rec-phase-dot ${item.existing_resources[p] ? 'done' : 'empty'}`}
            title={p}
          >
            {p === 'learn' ? <Icon name="book" size={14} /> : p === 'practice' ? <Icon name="edit" size={14} /> : <Icon name="review" size={14} />}
          </span>
        ))}
      </div>

      {/* 三个阶段按钮 */}
      <div className="rec-phases">
        {phases.map(p => (
          <PhaseButton
            key={p}
            knowledge_point={item.knowledge_point}
            phase={p}
            hasResource={item.existing_resources[p]}
            onGenerated={onRefresh}
          />
        ))}
      </div>

      {expanded && (
        <div className="rec-detail">
          <div className="rec-progress-row">
            <span className={`rec-phase-status ${item.existing_resources.learn ? 'done' : 'pending'}`}>
              {item.existing_resources.learn ? <Icon name="check" size={14} className="inline-icon" /> : <Icon name="unchecked" size={14} className="inline-icon" />} 学习
            </span>
            <span className={`rec-phase-status ${item.existing_resources.practice ? 'done' : 'pending'}`}>
              {item.existing_resources.practice ? <Icon name="check" size={14} className="inline-icon" /> : <Icon name="unchecked" size={14} className="inline-icon" />} 练习
            </span>
            <span className={`rec-phase-status ${item.existing_resources.review ? 'done' : 'pending'}`}>
              {item.existing_resources.review ? <Icon name="check" size={14} className="inline-icon" /> : <Icon name="unchecked" size={14} className="inline-icon" />} 复习
            </span>
          </div>
        </div>
      )}

      <button className="rec-expand-btn" onClick={() => setExpanded(!expanded)}>
        {expanded ? '收起 ▲' : '展开 ▼'}
      </button>
    </div>
  )
}
