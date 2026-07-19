'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import dynamic from 'next/dynamic'
import Icon from '@/components/Icon'
import { profileApi, type AssessmentStatus } from '@/lib/api'
import { getStudentId } from '@/lib/student'

// 动态导入 RadarChart 组件
const RadarChart = dynamic(() => import('./components/RadarChart'), {
  loading: () => <div className="skeleton" style={{ width: 320, height: 320, borderRadius: '50%', margin: '0 auto' }} />,
  ssr: false
})

// ═══ CONSTANTS ═══

const DIMS: { key: string; label: string; iconName: string; color: string; desc: string }[] = [
  { key: 'comprehension', label: '理解力', iconName: 'brain', color: '#6366F1', desc: '快速理解新概念、触类旁通的能力' },
  { key: 'memory', label: '记忆力', iconName: 'book', color: '#06B6D4', desc: '学习内容的吸收与长期保持能力' },
  { key: 'application', label: '应用转化', iconName: 'wrench', color: '#10B981', desc: '将知识灵活运用到实际问题中的能力' },
  { key: 'imagination', label: '想象力', iconName: 'sparkles', color: '#F59E0B', desc: '跳出固定思路、探索创新方案的能力' },
  { key: 'focus', label: '专注力', iconName: 'target', color: '#EF4444', desc: '持续集中注意力、深度投入的能力' },
  { key: 'knowledge_base', label: '知识基础', iconName: 'book', color: '#8B5CF6', desc: '先修知识掌握程度、当前学习水平' },
  { key: 'learning_goal', label: '学习目标', iconName: 'target', color: '#EC4899', desc: '学习目的——考研/工作/竞赛/兴趣爱好' },
]

const DIM_CN: Record<string, string> = {
  comprehension: '理解力',
  memory: '记忆力',
  application: '应用转化',
  imagination: '想象力',
  focus: '专注力',
  knowledge_base: '知识基础',
  learning_goal: '学习目标',
}

function dimColor(key: string): string { return DIMS.find(d => d.key === key)?.color || '#78716C' }
function dimLabel(key: string): string { return DIMS.find(d => d.key === key)?.label || key }

function levelMeta(score: number): { label: string; color: string; bg: string; advice: string } {
  if (score >= 85) return { label: '卓越', color: '#065F46', bg: '#D1FAE5', advice: '保持优秀表现，可以挑战更高难度的内容' }
  if (score >= 70) return { label: '良好', color: '#92400E', bg: '#FEF3C7', advice: '基础扎实，可以通过实践进一步提升' }
  if (score >= 50) return { label: '中等', color: '#1E40AF', bg: '#DBEAFE', advice: '有提升空间，建议加强练习和总结' }
  return { label: '需提升', color: '#991B1B', bg: '#FEE2E2', advice: '建议从基础开始，循序渐进地学习' }
}

function confidenceMeta(conf: number): { label: string; color: string } {
  if (conf >= 0.8) return { label: '高置信', color: '#065F46' }
  if (conf >= 0.6) return { label: '较置信', color: '#92400E' }
  if (conf >= 0.4) return { label: '一般', color: '#1E40AF' }
  return { label: '待补充', color: '#991B1B' }
}

// ═══ CUSTOM DIALOG COMPONENTS ═══

interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  type?: 'danger' | 'warning' | 'info'
  onConfirm: () => void
  onCancel: () => void
}

function ConfirmDialog({
  open, title, message, confirmText = '确认', cancelText = '取消',
  type = 'danger', onConfirm, onCancel
}: ConfirmDialogProps) {
  if (!open) return null

  const iconMap = {
    danger: <Icon name="alertTriangle" size={26} className="text-[#b09191]" />,
    warning: <Icon name="alertTriangle" size={26} className="text-[#c47a3a]" />,
    info: <Icon name="info" size={26} className="text-[#8a9ba8]" />
  }

  const bgColorMap = {
    danger: 'rgba(176,145,145,0.12)',
    warning: 'rgba(196,122,58,0.12)',
    info: 'rgba(138,155,168,0.12)'
  }

  const btnColorMap = {
    danger: { bg: '#b09191', hover: '#9a7b7b' },
    warning: { bg: '#c47a3a', hover: '#a86830' },
    info: { bg: '#8a9ba8', hover: '#738591' }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(28,25,23,0.3)', backdropFilter: 'blur(6px)',
      animation: 'fadeIn 0.2s ease',
    }}>
      <div style={{
        width: 380, maxWidth: '90vw',
        background: '#ffffff', borderRadius: 'var(--r, 14px)',
        boxShadow: 'var(--shadow-lg, 0 20px 60px rgba(0,0,0,0.08))',
        overflow: 'hidden', animation: 'modalIn 0.25s ease',
        border: '1px solid var(--line, #e7e5e4)',
      }}>
        {/* Icon */}
        <div style={{
          padding: '32px 32px 0', display: 'flex', justifyContent: 'center',
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: 'var(--r-sm, 10px)',
            background: bgColorMap[type],
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {iconMap[type]}
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: '20px 32px', textAlign: 'center' }}>
          <h3 style={{
            fontSize: 17, fontWeight: 600, color: 'var(--ink, #1c1917)',
            marginBottom: 8, fontFamily: "'Inter', sans-serif",
          }}>
            {title}
          </h3>
          <p style={{
            fontSize: 13.5, color: 'var(--ink-2, #57534e)', lineHeight: 1.6,
            margin: 0,
          }}>
            {message}
          </p>
        </div>

        {/* Actions */}
        <div style={{
          padding: '0 24px 24px', display: 'flex', gap: 10,
          justifyContent: 'center',
        }}>
          <button
            onClick={onCancel}
            style={{
              flex: 1, padding: '11px 18px',
              background: 'var(--bg, #f5f5f4)', color: 'var(--ink-2, #57534e)',
              border: '1px solid var(--line, #e7e5e4)',
              borderRadius: 'var(--r-xs, 7px)', fontSize: 13.5, fontWeight: 500,
              cursor: 'pointer', transition: 'all 0.2s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'var(--line, #e7e5e4)'
              e.currentTarget.style.borderColor = 'var(--ink-4, #d6d3d1)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'var(--bg, #f5f5f4)'
              e.currentTarget.style.borderColor = 'var(--line, #e7e5e4)'
            }}
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            style={{
              flex: 1, padding: '11px 18px',
              background: btnColorMap[type].bg, color: '#fff',
              border: 'none',
              borderRadius: 'var(--r-xs, 7px)', fontSize: 13.5, fontWeight: 500,
              cursor: 'pointer', transition: 'all 0.2s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = btnColorMap[type].hover}
            onMouseLeave={e => e.currentTarget.style.background = btnColorMap[type].bg}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}

interface AlertDialogProps {
  open: boolean
  title: string
  message: string
  type?: 'success' | 'error' | 'info'
  onClose: () => void
}

function AlertDialog({ open, title, message, type = 'info', onClose }: AlertDialogProps) {
  if (!open) return null

  const iconMap = {
    success: <Icon name="checkCircle" size={26} className="text-[#059669]" />,
    error: <Icon name="xCircle" size={26} className="text-[#b09191]" />,
    info: <Icon name="info" size={26} className="text-[#8a9ba8]" />
  }

  const bgColorMap = {
    success: 'rgba(5,150,105,0.10)',
    error: 'rgba(176,145,145,0.12)',
    info: 'rgba(138,155,168,0.12)'
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(28,25,23,0.3)', backdropFilter: 'blur(6px)',
      animation: 'fadeIn 0.2s ease',
    }}>
      <div style={{
        width: 360, maxWidth: '90vw',
        background: '#ffffff', borderRadius: 'var(--r, 14px)',
        boxShadow: 'var(--shadow-lg, 0 20px 60px rgba(0,0,0,0.08))',
        overflow: 'hidden', animation: 'modalIn 0.25s ease',
        border: '1px solid var(--line, #e7e5e4)',
      }}>
        {/* Icon */}
        <div style={{
          padding: '32px 32px 0', display: 'flex', justifyContent: 'center',
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: 'var(--r-sm, 10px)',
            background: bgColorMap[type],
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {iconMap[type]}
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: '20px 32px', textAlign: 'center' }}>
          <h3 style={{
            fontSize: 17, fontWeight: 600, color: 'var(--ink, #1c1917)',
            marginBottom: 8, fontFamily: "'Inter', sans-serif",
          }}>
            {title}
          </h3>
          <p style={{
            fontSize: 13.5, color: 'var(--ink-2, #57534e)', lineHeight: 1.6,
            margin: 0,
          }}>
            {message}
          </p>
        </div>

        {/* Actions */}
        <div style={{
          padding: '0 24px 24px',
        }}>
          <button
            onClick={onClose}
            style={{
              width: '100%', padding: '11px 18px',
              background: 'var(--ink, #1c1917)', color: '#fff',
              border: 'none',
              borderRadius: 'var(--r-xs, 7px)', fontSize: 13.5, fontWeight: 500,
              cursor: 'pointer', transition: 'all 0.2s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--ink-2, #57534e)'}
            onMouseLeave={e => e.currentTarget.style.background = 'var(--ink, #1c1917)'}
          >
            知道了
          </button>
        </div>
      </div>
    </div>
  )
}

// ═══ SVG CIRCLE PROGRESS ═══

function ScoreRing({ score, color, size = 88, strokeW = 6 }: { score: number; color: string; size?: number; strokeW?: number }) {
  const r = (size - strokeW) / 2
  const circ = 2 * Math.PI * r
  const offset = circ - (score / 100) * circ
  const cx = size / 2
  const cy = size / 2
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#E7E5E4" strokeWidth={strokeW} />
      <circle
        cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={strokeW}
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.16,1,0.3,1)' }}
      />
      <text
        x={cx} y={cy} textAnchor="middle" dominantBaseline="central"
        fill={color} fontSize={size * 0.28} fontWeight={700}
        style={{ transform: 'rotate(90deg)', transformOrigin: `${cx}px ${cy}px` }}
      >
        {score}
      </text>
    </svg>
  )
}

// ═══ ANALYSIS REPORT ═══

function AnalysisReport({ scores, confidence }: { scores: Record<string, number>; confidence: Record<string, number> }) {
  const avgScore = Math.round(DIMS.reduce((s, d) => s + (scores[d.key] || 0), 0) / DIMS.length)

  // 找出最强和最弱的维度
  const sorted = DIMS.map(d => ({ key: d.key, score: scores[d.key] || 0, conf: confidence[d.key] || 0 }))
    .sort((a, b) => b.score - a.score)
  const strongest = sorted[0]
  const weakest = sorted[sorted.length - 1]

  // 计算需要补充评估的维度
  const lowConfDims = sorted.filter(s => s.conf < 0.5)

  return (
    <div style={{
      background: '#fff', borderRadius: 16, border: '1px solid #E7E5E4',
      padding: '24px', marginBottom: 20,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <Icon name="trendingUp" size={18} className="text-[#6366F1]" />
        <h3 style={{ fontSize: 16, fontWeight: 600, color: '#1C1917', margin: 0 }}>
          能力分析报告
        </h3>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
        <div style={{ padding: 12, background: '#F5F5F4', borderRadius: 10 }}>
          <div style={{ fontSize: 11, color: '#A8A29E', marginBottom: 4 }}>综合评分</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#1C1917' }}>{avgScore}</div>
          <div style={{ fontSize: 11, color: levelMeta(avgScore).color }}>{levelMeta(avgScore).label}</div>
        </div>
        <div style={{ padding: 12, background: '#D1FAE5', borderRadius: 10 }}>
          <div style={{ fontSize: 11, color: '#065F46', marginBottom: 4 }}>最强维度</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#065F46' }}>{dimLabel(strongest.key)}</div>
          <div style={{ fontSize: 11, color: '#065F46' }}>{strongest.score}分</div>
        </div>
        <div style={{ padding: 12, background: '#FEE2E2', borderRadius: 10 }}>
          <div style={{ fontSize: 11, color: '#991B1B', marginBottom: 4 }}>待提升</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#991B1B' }}>{dimLabel(weakest.key)}</div>
          <div style={{ fontSize: 11, color: '#991B1B' }}>{weakest.score}分</div>
        </div>
      </div>

      <div style={{ fontSize: 13, color: '#57534E', lineHeight: 1.7 }}>
        <p style={{ marginBottom: 8 }}>
          <strong>整体评价：</strong>{levelMeta(avgScore).advice}
        </p>
        <p style={{ marginBottom: 8 }}>
          <strong>优势领域：</strong>你的{dimLabel(strongest.key)}表现优秀（{strongest.score}分），
          {levelMeta(strongest.score).advice}
        </p>
        <p style={{ marginBottom: 8 }}>
          <strong>提升建议：</strong>{dimLabel(weakest.key)}是目前的薄弱环节（{weakest.score}分），
          {levelMeta(weakest.score).advice}
        </p>
        {lowConfDims.length > 0 && (
          <p style={{ marginBottom: 0, color: '#92400E' }}>
            <Icon name="info" size={14} className="inline align-middle mr-1" />
            以下维度评估置信度较低，建议重新评估：{lowConfDims.map(d => dimLabel(d.key)).join('、')}
          </p>
        )}
      </div>
    </div>
  )
}

// ═══ LEARNING RECOMMENDATIONS ═══

function LearningRecommendations({ scores, confidence, background }: {
  scores: Record<string, number>; confidence: Record<string, number>; background: Record<string, unknown>
}) {
  // 根据7个维度生成个性化学习建议
  const recommendations = []

  // 理解力建议
  if (scores.comprehension < 50) {
    recommendations.push({
      dimension: '理解力',
      color: '#6366F1',
      iconName: 'brain',
      title: '提升理解力',
      items: [
        '预习新内容时先看目录和标题，建立整体框架',
        '遇到难懂的概念，尝试用自己的话复述',
        '多看不同来源的讲解（视频、文章、图解）',
      ]
    })
  } else if (scores.comprehension >= 70) {
    recommendations.push({
      dimension: '理解力',
      color: '#6366F1',
      iconName: 'brain',
      title: '保持理解力优势',
      items: [
        '尝试学习更高级的内容，挑战自己',
        '帮助同学讲解，教是最好的学',
        '探索跨学科知识，拓展理解边界',
      ]
    })
  }

  // 记忆力建议
  if (scores.memory < 50) {
    recommendations.push({
      dimension: '记忆力',
      color: '#06B6D4',
      iconName: 'book',
      title: '提升记忆力',
      items: [
        '使用间隔重复法复习（当天→3天→7天→15天）',
        '学习后立即做笔记或思维导图',
        '睡前回顾当天学习内容',
      ]
    })
  }

  // 应用转化建议
  if (scores.application < 50) {
    recommendations.push({
      dimension: '应用转化',
      color: '#10B981',
      iconName: 'wrench',
      title: '提升应用能力',
      items: [
        '每学一个知识点，立刻找一个实际例子',
        '参与项目实践，做中学',
        '尝试用新知识解决旧问题',
      ]
    })
  }

  // 专注力建议
  if (scores.focus < 50) {
    recommendations.push({
      dimension: '专注力',
      color: '#EF4444',
      iconName: 'target',
      title: '提升专注力',
      items: [
        '使用番茄工作法：25分钟专注 + 5分钟休息',
        '学习时手机静音或放到另一个房间',
        '选择固定的学习环境，减少干扰',
      ]
    })
  }

  // 知识基础建议
  if (scores.knowledge_base < 50) {
    recommendations.push({
      dimension: '知识基础',
      color: '#8B5CF6',
      iconName: 'book',
      title: '补充基础知识',
      items: [
        '回顾先修课程的核心概念',
        '找到知识薄弱点，针对性补习',
        '建立知识之间的联系，形成体系',
      ]
    })
  }

  // 学习目标建议
  if (scores.learning_goal < 50) {
    recommendations.push({
      dimension: '学习目标',
      color: '#EC4899',
      iconName: 'target',
      title: '明确学习目标',
      items: [
        '思考学习这门课程的长期价值',
        '设定具体、可衡量的学习目标',
        '将大目标拆解为每周小目标',
      ]
    })
  }

  // 如果没有需要提升的维度
  if (recommendations.length === 0) {
    recommendations.push({
      dimension: '综合',
      color: '#10B981',
      iconName: 'trendingUp',
      title: '保持优秀状态',
      items: [
        '你的各项能力都很均衡，继续保持',
        '可以尝试更高级的内容挑战自己',
        '帮助他人学习，巩固自己的知识',
      ]
    })
  }

  return (
    <div style={{
      background: '#fff', borderRadius: 16, border: '1px solid #E7E5E4',
      padding: '24px', marginBottom: 20,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <Icon name="trendingUp" size={18} className="text-[#10B981]" />
        <h3 style={{ fontSize: 16, fontWeight: 600, color: '#1C1917', margin: 0 }}>
          个性化学习建议
        </h3>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
        {recommendations.map((rec, idx) => {
          return (
            <div key={idx} style={{
              padding: 16, borderRadius: 12,
              border: `1px solid ${rec.color}20`,
              background: `${rec.color}08`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 8,
                  background: `${rec.color}20`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon name={rec.iconName} size={14} style={{ color: rec.color }} />
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: rec.color }}>
                  {rec.title}
                </div>
              </div>
              <ul style={{
                margin: 0, paddingLeft: 16, fontSize: 12, color: '#57534E',
                lineHeight: 1.8,
              }}>
                {rec.items.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ═══ DIMENSION CARD ═══

function DimensionCard({ dimKey, label, iconName, color, desc, score, confidence }: {
  dimKey: string; label: string; iconName: string; color: string; desc: string; score: number; confidence: number
}) {
  const level = levelMeta(score)
  const conf = confidenceMeta(confidence)

  return (
    <div style={{
      background: '#fff',
      borderRadius: 14,
      border: '1px solid #E7E5E4',
      padding: '18px 16px 16px',
      transition: 'box-shadow 0.25s, transform 0.25s',
      cursor: 'default',
    }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--shadow-md)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'none' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: `${color}14`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon name={iconName} size={18} style={{ color }} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#1C1917' }}>{label}</div>
          <div style={{ fontSize: 10.5, color: '#A8A29E' }}>{desc}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <ScoreRing score={score} color={color} size={60} strokeW={5} />
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ fontSize: 12, color: '#57534E' }}>
          水平：<span style={{ color: level.color, fontWeight: 600 }}>{level.label}</span>
        </div>
        <div style={{
          height: 4, flex: 1, marginLeft: 12, borderRadius: 2,
          background: '#E7E5E4', overflow: 'hidden',
        }}>
          <div style={{
            height: '100%', borderRadius: 2,
            width: `${score}%`,
            background: `linear-gradient(90deg, ${color}88, ${color})`,
            transition: 'width 0.6s cubic-bezier(0.16,1,0.3,1)',
          }} />
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 11, color: '#A8A29E' }}>
          {level.advice}
        </div>
        <div style={{
          fontSize: 10, padding: '2px 8px', borderRadius: 10,
          background: `${conf.color}14`, color: conf.color, fontWeight: 500,
        }}>
          {conf.label} ({Math.round(confidence * 100)}%)
        </div>
      </div>
    </div>
  )
}

// ═══ ASSESSMENT CHAT (MODAL) ═══

function AssessmentModal({
  onComplete, onClose, resumeSessionId, existingDims,
}: {
  onComplete: (scores: Record<string, number>) => void
  onClose: () => void
  resumeSessionId?: string
  existingDims?: Record<string, { score: number; confidence: number }>
}) {
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([])
  const [input, setInput] = useState('')
  const [sessionId, setSessionId] = useState(resumeSessionId || '')
  const [loading, setLoading] = useState(false)
  const [started, setStarted] = useState(!!resumeSessionId)
  const [done, setDone] = useState(false)
  const [streaming, setStreaming] = useState(false)
  const [round, setRound] = useState(0)
  const [maxRounds] = useState(15)
  const [assessedDims, setAssessedDims] = useState<string[]>([])
  const chatEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const streamingRef = useRef(false)

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])
  useEffect(() => { if (started && !done && !streaming) inputRef.current?.focus() }, [started, done, streaming, messages.length])

  // 如果是恢复评估，显示已有信息摘要
  useEffect(() => {
    if (existingDims && Object.keys(existingDims).length > 0) {
      const summary = Object.entries(existingDims)
        .map(([k, v]) => `${DIM_CN[k]}: ${v.score}分`)
        .join('、')
      setMessages([{
        role: 'assistant',
        content: `我看到你之前已经做了一部分评估（${summary}），让我们继续完成剩余部分。`
      }])
    }
  }, [existingDims])

  async function doStream(body: Record<string, string>) {
    streamingRef.current = true
    setStreaming(true)
    try {
      const resp = await profileApi.assessStream(body)
      if (!resp.ok || !resp.body) {
        setMessages(prev => [...prev, { role: 'assistant', content: '请求失败' }])
        return
      }

      const reader = resp.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let assistantMsg = ''
      let finalScores: Record<string, number> = {}

      while (true) {
        const { done: readDone, value } = await reader.read()
        if (readDone) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const dataStr = line.slice(6).trim()
          if (!dataStr) continue
          try {
            const event = JSON.parse(dataStr)

            if (event.type === 'session') {
              setSessionId(event.session_id)
              if (event.round) setRound(event.round)
            } else if (event.type === 'token') {
              assistantMsg += event.content
              setMessages(prev => {
                const copy = [...prev]
                if (copy.length > 0 && copy[copy.length - 1].role === 'assistant') {
                  copy[copy.length - 1] = { ...copy[copy.length - 1], content: assistantMsg }
                } else {
                  copy.push({ role: 'assistant', content: assistantMsg })
                }
                return copy
              })
            } else if (event.type === 'result') {
              if (event.round) setRound(event.round)
              if (event.assessed_dimensions) setAssessedDims(event.assessed_dimensions)

              if (event.done && event.dimensions) {
                finalScores = {}
                for (const [k, v] of Object.entries(event.dimensions)) {
                  finalScores[k] = (v as { score: number }).score
                }
                setDone(true)
                setTimeout(() => onComplete(finalScores), 800)
              }
            } else if (event.type === 'error') {
              // 处理会话不存在的情况
              const errorMsg = event.message || '请重试'
              if (errorMsg.includes('Session not found') || errorMsg.includes('会话不存在')) {
                setMessages(prev => [...prev, { role: 'assistant', content: '评估会话已过期，请点击"重新评估"开始新的评估。' }])
                // 清除本地存储的 session_id
                localStorage.removeItem('assessment_session_id')
              } else {
                setMessages(prev => [...prev, { role: 'assistant', content: '出错了：' + errorMsg }])
              }
            } else if (event.type === 'done') {
              break
            }
          } catch { }
        }
      }
    } catch (e: any) {
      setMessages(prev => [...prev, { role: 'assistant', content: '出错了：' + (e.message || '请重试') }])
    } finally {
      streamingRef.current = false
      setStreaming(false)
    }
  }

  async function start() {
    setLoading(true)
    setStarted(true)  // 先设置 started，让进度显示
    await doStream({})
    setLoading(false)
  }

  async function sendAnswer() {
    if (!input.trim() || !sessionId) return
    const userMsg = input.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: userMsg }])
    await doStream({ session_id: sessionId, answer: userMsg })
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendAnswer() }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 50,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(4px)',
    }}>
      <div style={{
        width: 560, maxWidth: '92vw', height: '80vh', maxHeight: 640,
        background: '#fff', borderRadius: 20,
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 25px 60px rgba(0,0,0,0.15)',
        overflow: 'hidden', animation: 'modalIn 0.25s ease',
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px', borderBottom: '1px solid #E7E5E4',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#1C1917' }}>个人能力评估</div>
            <div style={{ fontSize: 12, color: '#A8A29E', marginTop: 2 }}>
              {started && round > 0
                ? `第 ${round}/${maxRounds} 轮 · 已了解 ${assessedDims.length}/7 个维度`
                : 'AI 对话式评估 · 约 5-10 分钟'
              }
            </div>
          </div>
          {!loading && (
            <button onClick={onClose} style={{
              width: 32, height: 32, borderRadius: 8, border: 'none',
              background: '#F5F5F4', cursor: 'pointer', display: 'flex',
              alignItems: 'center', justifyContent: 'center', color: '#A8A29E',
              transition: 'background 0.2s',
            }}
              onMouseEnter={e => e.currentTarget.style.background = '#E7E5E4'}
              onMouseLeave={e => e.currentTarget.style.background = '#F5F5F4'}
            >
              <Icon name="close" size={16} />
            </button>
          )}
        </div>

        {!started ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 40, textAlign: 'center' }}>
            <div style={{
              width: 64, height: 64, borderRadius: 16,
              background: '#EEF2FF', display: 'flex',
              alignItems: 'center', justifyContent: 'center', marginBottom: 20,
            }}>
              <Icon name="brain" size={32} className="text-[#6366F1]" />
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 600, color: '#1C1917', marginBottom: 8 }}>
              开始评估你的学习能力
            </h3>
            <p style={{ fontSize: 13.5, color: '#A8A29E', maxWidth: 380, lineHeight: 1.7, marginBottom: 28 }}>
              系统将通过自然对话了解你的学习习惯和思维方式，从而生成个人能力画像。就像和朋友聊天一样，放松回答就好。
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={start} disabled={loading} style={{
                padding: '11px 28px', background: '#1C1917', color: '#fff', border: 'none',
                borderRadius: 10, fontSize: 14, fontWeight: 500, cursor: loading ? 'default' : 'pointer',
                opacity: loading ? 0.6 : 1, display: 'flex', alignItems: 'center', gap: 8,
              }}>
                {loading ? '准备中...' : '开始对话评估'} <Icon name="arrowRight" size={16} />
              </button>
              <button onClick={onClose} style={{
                padding: '11px 20px', background: 'transparent', color: '#A8A29E',
                border: '1px solid #E7E5E4', borderRadius: 10, fontSize: 14, cursor: 'pointer',
              }}>
                稍后再说
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Progress indicator */}
            {started && round > 0 && !done && (
              <div style={{
                padding: '8px 20px', background: '#F5F5F4',
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <div style={{ display: 'flex', gap: 4 }}>
                  {DIMS.map(d => (
                    <div
                      key={d.key}
                      style={{
                        width: 8, height: 8, borderRadius: '50%',
                        background: assessedDims.includes(d.key) ? d.color : '#E7E5E4',
                        transition: 'background 0.3s',
                      }}
                      title={d.label}
                    />
                  ))}
                </div>
                <div style={{ fontSize: 11, color: '#A8A29E' }}>
                  {assessedDims.length}/7 维度已收集
                </div>
              </div>
            )}

            {/* Messages */}
            <div style={{
              flex: 1, overflowY: 'auto', padding: '16px 20px',
              display: 'flex', flexDirection: 'column', gap: 12,
            }}>
              {messages.map((msg, i) => (
                <div key={i} style={{
                  alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '80%',
                  padding: '10px 16px',
                  borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                  background: msg.role === 'user' ? '#1C1917' : '#F5F5F4',
                  color: msg.role === 'user' ? '#fff' : '#1C1917',
                  fontSize: 13.5,
                  lineHeight: 1.6,
                  whiteSpace: 'pre-wrap',
                }}>
                  {msg.content}
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            {/* Input */}
            {!done && (
              <div style={{ padding: '12px 20px 16px', borderTop: '1px solid #E7E5E4', display: 'flex', gap: 8 }}>
                <input
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="输入你的回答..."
                  style={{
                    flex: 1, padding: '10px 14px', border: '1px solid #E7E5E4',
                    borderRadius: 10, fontSize: 13.5, outline: 'none',
                    background: '#FAFAF9',
                  }}
                  onFocus={e => e.currentTarget.style.borderColor = '#1C1917'}
                  onBlur={e => e.currentTarget.style.borderColor = '#E7E5E4'}
                />
                <button onClick={sendAnswer} disabled={!input.trim()} style={{
                  padding: '10px 18px',
                  background: input.trim() ? '#1C1917' : '#E7E5E4',
                  color: input.trim() ? '#fff' : '#A8A29E',
                  border: 'none', borderRadius: 10, fontSize: 14,
                  cursor: input.trim() ? 'pointer' : 'default',
                  display: 'flex', alignItems: 'center', gap: 6, fontWeight: 500,
                }}>
                  发送 <Icon name="send" size={14} />
                </button>
              </div>
            )}

            {done && (
              <div style={{ padding: '14px 20px', borderTop: '1px solid #E7E5E4', textAlign: 'center' }}>
                <button onClick={onClose} style={{
                  padding: '10px 32px', background: '#1C1917', color: '#fff',
                  border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 500, cursor: 'pointer',
                }}>
                  查看能力画像
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ═══ MAIN PAGE ═══

function clearProfileCache() {
  try {
    const raw = localStorage.getItem('zhishu_student')
    if (raw) {
      const sid = JSON.parse(raw)?.id
      if (sid) {
        localStorage.removeItem(`profile_${sid}`)
        localStorage.removeItem(`profile_time_${sid}`)
      }
    }
  } catch { /* ignore */ }
}

export default function ProfilePage() {
  const [scores, setScores] = useState<Record<string, number>>({
    comprehension: 0, memory: 0, application: 0, imagination: 0, focus: 0, knowledge_base: 0, learning_goal: 0,
  })
  const [confidence, setConfidence] = useState<Record<string, number>>({
    comprehension: 0, memory: 0, application: 0, imagination: 0, focus: 0, knowledge_base: 0, learning_goal: 0,
  })
  const [background, setBackground] = useState<Record<string, string>>({})
  const [status, setStatus] = useState<string>('pending')
  const [loading, setLoading] = useState(true)
  const [showAssess, setShowAssess] = useState(false)
  const [assessmentStatus, setAssessmentStatus] = useState<AssessmentStatus | null>(null)
  const [resetting, setResetting] = useState(false)
  const [lastAnalyzedAt, setLastAnalyzedAt] = useState<string | null>(null)
  const [analyzing, setAnalyzing] = useState(false)

  // Dialog states
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [showAlertDialog, setShowAlertDialog] = useState(false)
  const [alertDialog, setAlertDialog] = useState<{ title: string; message: string; type: 'success' | 'error' | 'info' }>({
    title: '', message: '', type: 'info'
  })

  const studentId = getStudentId()

  useEffect(() => {
    if (!studentId) return

    // 检查缓存：5 分钟内已有数据，直接使用
    const cacheKey = `profile_${studentId}`
    const cacheTimeKey = `profile_time_${studentId}`
    const cachedTime = localStorage.getItem(cacheTimeKey)
    const cacheAge = cachedTime ? Date.now() - parseInt(cachedTime) : Infinity
    const FIVE_MINUTES = 5 * 60 * 1000

    if (cacheAge < FIVE_MINUTES) {
      const cached = localStorage.getItem(cacheKey)
      if (cached) {
        try {
          const data = JSON.parse(cached)
          if (data.dimensions && Object.keys(data.dimensions).length > 0) {
            setScores(prev => ({ ...prev, ...data.dimensions }))
          }
          if (data.confidence) {
            setConfidence(prev => ({ ...prev, ...data.confidence }))
          }
          setLastAnalyzedAt(cachedTime)
          loadAssessmentStatus()
          loadAnalysisStatus()
          setLoading(false)
          return
        } catch { /* ignore */ }
      }
    }

    // 缓存过期，请求新数据
    loadProfile()
    loadAssessmentStatus()
    loadAnalysisStatus()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId])

  async function loadProfile() {
    try {
      const data = await profileApi.getMe()
      if (data.dimensions && Object.keys(data.dimensions).length > 0) {
        setScores(prev => ({ ...prev, ...data.dimensions }))
      }
      if (data.confidence) {
        setConfidence(prev => ({ ...prev, ...data.confidence }))
      }
      if (data.background) {
        setBackground(data.background as Record<string, string>)
      }
      setStatus(data.assessment_status || 'pending')
      // 缓存数据
      const sid = getStudentId()
      if (sid) {
        localStorage.setItem(`profile_${sid}`, JSON.stringify(data))
        const now = Date.now().toString()
        localStorage.setItem(`profile_time_${sid}`, now)
        setLastAnalyzedAt(now)
      }
    } catch (e) {
      console.error('Failed to load profile', e)
    } finally {
      setLoading(false)
    }
  }

  async function loadAnalysisStatus() {
    try {
      const data = await profileApi.getAnalysisStatus()
      setLastAnalyzedAt(data.last_analyzed_at)
    } catch (e) {
      console.error('Failed to load analysis status', e)
    }
  }

  async function loadAssessmentStatus() {
    try {
      const data = await profileApi.getAssessmentStatus()
      setAssessmentStatus(data)
    } catch (e) {
      console.error('Failed to load assessment status', e)
    }
  }

  const handleForceAnalyze = useCallback(async () => {
    setAnalyzing(true)
    try {
      const result = await profileApi.forceAnalyze()
      if (result.status === 'updated') {
        setAlertDialog({
          title: '分析完成',
          message: `AI 已更新 ${result.updated_count || 0} 个维度。${result.summary || ''}`,
          type: 'success'
        })
        // 刷新画像并更新缓存
        await loadProfile()
      } else {
        setAlertDialog({
          title: '分析完成',
          message: result.summary || '暂无更新',
          type: 'info'
        })
        // 更新缓存时间
        const sid = getStudentId()
        if (sid) {
          const now = Date.now().toString()
          localStorage.setItem(`profile_time_${sid}`, now)
          setLastAnalyzedAt(now)
        }
      }
    } catch (e) {
      setAlertDialog({
        title: '分析失败',
        message: '请稍后重试',
        type: 'error'
      })
    } finally {
      setAnalyzing(false)
      setShowAlertDialog(true)
    }
  }, [])

  const handleComplete = useCallback((finalScores: Record<string, number>) => {
    setScores(prev => ({ ...prev, ...finalScores }))
    setStatus('completed')
    setShowAssess(false)
    clearProfileCache()
    // 重新加载置信度
    loadProfile()
    loadAssessmentStatus()
  }, [])

  const handleClose = useCallback(() => {
    setShowAssess(false)
    // 刷新评估状态
    loadAssessmentStatus()
  }, [])

  const handleReset = useCallback(async () => {
    setShowResetConfirm(true)
  }, [])

  const confirmReset = useCallback(async () => {
    setShowResetConfirm(false)
    setResetting(true)
    try {
      await profileApi.reset()
      clearProfileCache()
      setScores({ comprehension: 0, memory: 0, application: 0, imagination: 0, focus: 0, knowledge_base: 0, learning_goal: 0 })
      setConfidence({ comprehension: 0, memory: 0, application: 0, imagination: 0, focus: 0, knowledge_base: 0, learning_goal: 0 })
      setStatus('pending')
      setAssessmentStatus(null)
      setShowAssess(true)
    } catch (e) {
      console.error('Failed to reset profile', e)
      setAlertDialog({
        title: '重置失败',
        message: '画像重置失败，请稍后重试',
        type: 'error'
      })
      setShowAlertDialog(true)
    } finally {
      setResetting(false)
    }
  }, [])

  const hasScores = Object.values(scores).some(v => v > 0)
  const avgScore = hasScores
    ? Math.round(DIMS.reduce((s, d) => s + (scores[d.key] || 0), 0) / DIMS.length)
    : 0
  const avgLevel = levelMeta(avgScore)

  // 判断是否可以恢复评估
  const canResume = assessmentStatus?.can_resume && assessmentStatus?.status === 'in_progress'

  if (loading) {
    return (
      <div style={{ padding: '12px 0' }}>
        <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
          <div className="skeleton" style={{ width: 80, height: 80, borderRadius: '50%' }} />
          <div style={{ flex: 1 }}>
            <div className="skeleton skeleton-line w60" style={{ height: 20 }} />
            <div className="skeleton skeleton-line w40" />
          </div>
        </div>
        <div className="skeleton-card">
          <div className="skeleton skeleton-line w60" style={{ height: 18 }} />
          <div className="skeleton skeleton-line w100" />
          <div className="skeleton skeleton-line w80" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginTop: 12 }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="skeleton-card" style={{ textAlign: 'center' }}>
              <div className="skeleton" style={{ width: 48, height: 48, borderRadius: '50%', margin: '0 auto 8px' }} />
              <div className="skeleton skeleton-line w40" style={{ margin: '0 auto' }} />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <>
      {/* ══ ASSESSMENT MODAL ══ */}
      {showAssess && (
        <AssessmentModal
          onComplete={handleComplete}
          onClose={handleClose}
          resumeSessionId={canResume ? assessmentStatus?.session_id ?? undefined : undefined}
          existingDims={canResume ? assessmentStatus?.dimensions : undefined}
        />
      )}

      {/* ══ CONFIRM DIALOG ══ */}
      <ConfirmDialog
        open={showResetConfirm}
        title="重新评估"
        message="确定要重新评估吗？这将清除当前的所有评估数据，无法恢复。"
        confirmText="确认重置"
        cancelText="取消"
        type="danger"
        onConfirm={confirmReset}
        onCancel={() => setShowResetConfirm(false)}
      />

      {/* ══ ALERT DIALOG ══ */}
      <AlertDialog
        open={showAlertDialog}
        title={alertDialog.title}
        message={alertDialog.message}
        type={alertDialog.type}
        onClose={() => setShowAlertDialog(false)}
      />

      <div style={{ maxWidth: 840, margin: '0 auto', padding: '8px 0 40px' }}>

        {/* ══ HEADER ══ */}
        <div style={{
          background: 'linear-gradient(135deg, #1C1917 0%, #292524 100%)',
          borderRadius: 16, padding: '28px 32px', marginBottom: 20,
          position: 'relative', overflow: 'hidden',
        }}>
          {/* Decorative circles */}
          <div style={{
            position: 'absolute', top: -40, right: -30, width: 180, height: 180,
            borderRadius: '50%', background: 'rgba(255,255,255,0.03)',
          }} />
          <div style={{
            position: 'absolute', bottom: -50, right: 80, width: 140, height: 140,
            borderRadius: '50%', background: 'rgba(255,255,255,0.02)',
          }} />

          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                <Icon name="award" size={22} className="text-[#A8A29E]" />
                <h2 style={{ color: '#fff', fontSize: 20, fontWeight: 600, margin: 0, fontFamily: "'Inter', sans-serif" }}>
                  个人能力画像
                </h2>
              </div>
              <p style={{ color: '#A8A29E', fontSize: 13, marginTop: 4 }}>
                {hasScores
                  ? '基于 AI 对话评估生成的底层学习能力分析'
                  : '完成初步评估以生成你的个人能力画像'}
              </p>
            </div>

            {hasScores && (
              <div style={{
                textAlign: 'center', background: 'rgba(255,255,255,0.06)',
                borderRadius: 12, padding: '10px 22px',
              }}>
                <div style={{ fontSize: 11, color: '#A8A29E', marginBottom: 2 }}>综合能力</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: '#fff', lineHeight: 1.2 }}>{avgScore}</div>
                <div style={{ fontSize: 11, color: avgLevel.color, marginTop: 2, fontWeight: 500 }}>{avgLevel.label}</div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {!hasScores && (
                <button onClick={() => setShowAssess(true)} style={{
                  padding: '10px 24px', background: '#fff', color: '#1C1917',
                  border: 'none', borderRadius: 10, fontSize: 13.5, fontWeight: 500,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  开始评估 <Icon name="arrowRight" size={15} />
                </button>
              )}
              {canResume && (
                <button onClick={() => setShowAssess(true)} style={{
                  padding: '10px 24px', background: '#F59E0B', color: '#fff',
                  border: 'none', borderRadius: 10, fontSize: 13.5, fontWeight: 500,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  继续评估 <Icon name="arrowRight" size={15} />
                </button>
              )}
              {hasScores && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <button onClick={handleForceAnalyze} disabled={analyzing} style={{
                      padding: '10px 16px', background: 'rgba(99,102,241,0.2)', color: '#fff',
                      border: '1px solid rgba(99,102,241,0.3)', borderRadius: 10, fontSize: 13,
                      cursor: analyzing ? 'default' : 'pointer',
                      display: 'flex', alignItems: 'center', gap: 6,
                      opacity: analyzing ? 0.6 : 1,
                    }}>
                      <Icon name="brain" size={14} className={analyzing ? 'animate-spin' : ''} />
                      {analyzing ? '分析中...' : 'AI 分析'}
                    </button>
                    <button onClick={handleReset} disabled={resetting} style={{
                      padding: '10px 16px', background: 'rgba(255,255,255,0.1)', color: '#fff',
                      border: '1px solid rgba(255,255,255,0.2)', borderRadius: 10, fontSize: 13,
                      cursor: resetting ? 'default' : 'pointer',
                      display: 'flex', alignItems: 'center', gap: 6,
                      opacity: resetting ? 0.6 : 1,
                    }}>
                      <Icon name="refresh" size={14} className={resetting ? 'animate-spin' : ''} />
                      重新评估
                    </button>
                  </div>
                  {lastAnalyzedAt && (
                    <span style={{ fontSize: 10, color: '#78716C', marginTop: 4, display: 'flex', alignItems: 'center', gap: 3, marginLeft: 2 }}>
                      <Icon name="clock" size={10} />
                      {new Date(lastAnalyzedAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ══ RADAR CHART + SCORE OVERVIEW ══ */}
        <div style={{
          background: '#fff', borderRadius: 16, border: '1px solid #E7E5E4',
          padding: '24px', marginBottom: 20,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: '#1C1917', margin: 0, fontFamily: "'Inter', sans-serif" }}>
              能力雷达图
            </h3>
            {status === 'completed' && (
              <span style={{
                fontSize: 11.5, padding: '4px 12px', borderRadius: 20,
                background: '#D1FAE5', color: '#065F46', fontWeight: 500,
                display: 'flex', alignItems: 'center', gap: 4,
              }}>
                已评估
              </span>
            )}
            {status === 'in_progress' && (
              <span style={{
                fontSize: 11.5, padding: '4px 12px', borderRadius: 20,
                background: '#FEF3C7', color: '#92400E', fontWeight: 500,
                display: 'flex', alignItems: 'center', gap: 4,
              }}>
                评估中
              </span>
            )}
          </div>

          {hasScores ? (
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <RadarChart scores={scores} size={320} />
            </div>
          ) : (
            <div style={{
              textAlign: 'center', padding: '50px 20px', color: '#A8A29E',
            }}>
              <Icon name="brain" size={40} className="opacity-30 mb-3" />
              <div style={{ fontSize: 14, marginBottom: 6, color: '#57534E', fontWeight: 500 }}>暂无能力数据</div>
              <div style={{ fontSize: 12.5, marginBottom: 20 }}>完成 AI 对话评估后，你的能力雷达图将在此展示</div>
              <button onClick={() => setShowAssess(true)} style={{
                padding: '9px 22px', background: '#1C1917', color: '#fff',
                border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500,
                cursor: 'pointer',
              }}>
                开始评估
              </button>
            </div>
          )}
        </div>

        {/* ══ DIMENSION DETAIL CARDS ══ */}
        {hasScores && (
          <div style={{ marginBottom: 20 }}>
            <h3 style={{
              fontSize: 16, fontWeight: 600, color: '#1C1917', margin: '0 0 12px 4px',
              fontFamily: "'Inter', sans-serif",
            }}>
              各维度详解
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
              {DIMS.map(d => (
                <DimensionCard
                  key={d.key} dimKey={d.key} label={d.label} iconName={d.iconName}
                  color={d.color} desc={d.desc} score={scores[d.key] || 0}
                  confidence={confidence[d.key] || 0}
                />
              ))}
            </div>
          </div>
        )}

        {/* ══ ANALYSIS REPORT ══ */}
        {hasScores && (
          <AnalysisReport scores={scores} confidence={confidence} />
        )}

        {/* ══ BACKGROUND INFO ══ */}
        {hasScores && background && Object.keys(background).length > 0 && (
          <div style={{
            background: '#fff', borderRadius: 16, border: '1px solid #E7E5E4',
            padding: '24px', marginBottom: 20,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <Icon name="info" size={18} className="text-[#6366F1]" />
              <h3 style={{ fontSize: 16, fontWeight: 600, color: '#1C1917', margin: 0 }}>
                学习背景
              </h3>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              {background.major && (
                <div style={{ padding: 12, background: '#F5F5F4', borderRadius: 10 }}>
                  <div style={{ fontSize: 11, color: '#A8A29E', marginBottom: 4 }}>专业</div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: '#1C1917' }}>{String(background.major)}</div>
                </div>
              )}
              {background.grade && (
                <div style={{ padding: 12, background: '#F5F5F4', borderRadius: 10 }}>
                  <div style={{ fontSize: 11, color: '#A8A29E', marginBottom: 4 }}>年级</div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: '#1C1917' }}>{String(background.grade)}</div>
                </div>
              )}
              {background.goal && (
                <div style={{ padding: 12, background: '#F5F5F4', borderRadius: 10 }}>
                  <div style={{ fontSize: 11, color: '#A8A29E', marginBottom: 4 }}>学习目标</div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: '#1C1917' }}>{String(background.goal)}</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══ PERSONALIZED LEARNING RECOMMENDATIONS ══ */}
        {hasScores && (
          <LearningRecommendations scores={scores} confidence={confidence} background={background} />
        )}

        {/* ══ KEYFRAMES (added via style tag for modal animation) ══ */}
        <style>{`
          @keyframes modalIn {
            from { opacity: 0; transform: scale(0.96) translateY(10px); }
            to { opacity: 1; transform: scale(1) translateY(0); }
          }
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes pulse {
            0%, 100% { opacity: 0.4; }
            50% { opacity: 1; }
          }
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          .animate-spin {
            animation: spin 1s linear infinite;
          }
        `}</style>
      </div>
    </>
  )
}
