'use client'

import type { ReviewResult, ReviewDimension } from '../types'

interface ReviewPanelProps {
  result: ReviewResult | null
  isReviewing: boolean
  onReReview: () => void
  onClose: () => void
}

const DIMENSION_CONFIG: { key: keyof ReviewResult['dimensions']; label: string }[] = [
  { key: 'content_quality', label: '内容质量' },
  { key: 'knowledge_accuracy', label: '知识准确性' },
  { key: 'format_check', label: '格式规范' },
  { key: 'learning_suggestions', label: '学习建议' },
]

function scoreColor(score: number): string {
  if (score >= 80) return '#22c55e'
  if (score >= 60) return '#eab308'
  return '#ef4444'
}

function DimensionCard({ label, dim }: { label: string; dim: ReviewDimension }) {
  const color = scoreColor(dim.score)
  return (
    <div style={{
      background: '#fff',
      border: '1px solid #e5e7eb',
      borderRadius: 12,
      padding: '16px 20px',
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 600, fontSize: 15, color: '#1e293b' }}>{label}</span>
        <span style={{ fontWeight: 700, fontSize: 20, color }}>{dim.score}</span>
      </div>
      <div style={{ height: 6, background: '#f1f5f9', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${dim.score}%`, height: '100%', background: color, borderRadius: 3, transition: 'width 0.4s ease' }} />
      </div>
      {dim.issues.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {dim.issues.map((issue, i) => (
            <div key={i} style={{ fontSize: 13, color: '#dc2626', display: 'flex', gap: 6, alignItems: 'flex-start' }}>
              <span style={{ flexShrink: 0 }}>⚠️</span>
              <span>{issue}</span>
            </div>
          ))}
        </div>
      )}
      {dim.suggestions.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {dim.suggestions.map((s, i) => (
            <div key={i} style={{ fontSize: 13, color: '#2563eb', display: 'flex', gap: 6, alignItems: 'flex-start' }}>
              <span style={{ flexShrink: 0 }}>💡</span>
              <span>{s}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function ReviewPanel({ result, isReviewing, onReReview, onClose }: ReviewPanelProps) {
  if (isReviewing) {
    return (
      <div style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
      }}>
        <div style={{
          background: '#fff', borderRadius: 16, padding: '48px 64px',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
        }}>
          <div style={{
            width: 40, height: 40, border: '4px solid #e5e7eb',
            borderTopColor: '#3b82f6', borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }} />
          <span style={{ fontSize: 16, color: '#475569' }}>正在审核中...</span>
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </div>
      </div>
    )
  }

  if (!result) return null

  const passed = result.passed
  const headerColor = passed ? '#22c55e' : '#ef4444'

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }}>
      <div style={{
        background: '#f8fafc', borderRadius: 16, padding: 32,
        width: '100%', maxWidth: 640, maxHeight: '90vh', overflowY: 'auto',
        display: 'flex', flexDirection: 'column', gap: 24,
        boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 56, fontWeight: 800, color: headerColor, lineHeight: 1 }}>
            {result.overall_score}
          </div>
          <span style={{
            display: 'inline-block', padding: '4px 16px', borderRadius: 20,
            fontSize: 14, fontWeight: 600, color: '#fff',
            background: headerColor, alignSelf: 'center',
          }}>
            {passed ? '通过' : '未通过'}
          </span>
          {result.summary && (
            <p style={{ fontSize: 14, color: '#64748b', marginTop: 4, lineHeight: 1.6 }}>
              {result.summary}
            </p>
          )}
        </div>

        {/* Dimension cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {DIMENSION_CONFIG.map(({ key, label }) => (
            <DimensionCard key={key} label={label} dim={result.dimensions[key]} />
          ))}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
          <button
            onClick={onReReview}
            style={{
              padding: '10px 28px', borderRadius: 8, border: '1px solid #3b82f6',
              background: '#3b82f6', color: '#fff', fontWeight: 600, fontSize: 14,
              cursor: 'pointer',
            }}
          >
            重新审核
          </button>
          <button
            onClick={onClose}
            style={{
              padding: '10px 28px', borderRadius: 8, border: '1px solid #d1d5db',
              background: '#fff', color: '#374151', fontWeight: 600, fontSize: 14,
              cursor: 'pointer',
            }}
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  )
}
