'use client'
import { useState } from 'react'
import type { RecItem, PhaseType } from '../types'
import PhaseButton from './PhaseButton'

const REASON_COLORS: Record<string, { bg: string; color: string; label: string }> = {
  evaluation: { bg: 'var(--danger-soft)', color: 'var(--danger)', label: '📊 评估' },
  chat:       { bg: 'var(--info-soft)',   color: 'var(--info)',   label: '💬 对话' },
  tiku:       { bg: 'var(--warm-soft)',   color: 'var(--warm)',   label: '📝 练习' },
  path:       { bg: 'var(--success-soft)',color: 'var(--success)', label: '🗺️ 路径' },
  profile:    { bg: 'var(--accent-soft)', color: 'var(--ink-2)',  label: '👤 画像' },
  cold_start: { bg: 'var(--bg)',          color: 'var(--ink-3)',  label: '❄️ 冷启动' },
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
            {reasonStyle.label}
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
            {p === 'learn' ? '📖' : p === 'practice' ? '📝' : '🔁'}
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
              {item.existing_resources.learn ? '✅' : '⬜'} 学习
            </span>
            <span className={`rec-phase-status ${item.existing_resources.practice ? 'done' : 'pending'}`}>
              {item.existing_resources.practice ? '✅' : '⬜'} 练习
            </span>
            <span className={`rec-phase-status ${item.existing_resources.review ? 'done' : 'pending'}`}>
              {item.existing_resources.review ? '✅' : '⬜'} 复习
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
