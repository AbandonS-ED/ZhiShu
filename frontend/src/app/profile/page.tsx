'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Brain, BookOpen, Wrench, Sparkles, Target,
  ArrowRight, Send, X, ChevronRight,
  ChevronDown, Award
} from 'lucide-react'
import { Chart as ChartJS, RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend } from 'chart.js'
import { Radar } from 'react-chartjs-2'
import { profileApi } from '@/lib/api'
import { getStudentId } from '@/lib/student'

ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend)

// ═══ CONSTANTS ═══

const DIMS: { key: string; label: string; icon: typeof Brain; color: string; desc: string }[] = [
  { key: 'comprehension', label: '理解力', icon: Brain, color: '#6366F1', desc: '快速理解新概念、触类旁通的能力' },
  { key: 'memory', label: '记忆力', icon: BookOpen, color: '#06B6D4', desc: '学习内容的吸收与长期保持能力' },
  { key: 'application', label: '应用转化', icon: Wrench, color: '#10B981', desc: '将知识灵活运用到实际问题中的能力' },
  { key: 'imagination', label: '想象力', icon: Sparkles, color: '#F59E0B', desc: '跳出固定思路、探索创新方案的能力' },
  { key: 'focus', label: '专注力', icon: Target, color: '#EF4444', desc: '持续集中注意力、深度投入的能力' },
]

function dimColor(key: string): string { return DIMS.find(d => d.key === key)?.color || '#78716C' }
function dimLabel(key: string): string { return DIMS.find(d => d.key === key)?.label || key }

function levelMeta(score: number): { label: string; color: string; bg: string } {
  if (score >= 85) return { label: '卓越', color: '#065F46', bg: '#D1FAE5' }
  if (score >= 70) return { label: '良好', color: '#92400E', bg: '#FEF3C7' }
  if (score >= 50) return { label: '中等', color: '#1E40AF', bg: '#DBEAFE' }
  return { label: '需提升', color: '#991B1B', bg: '#FEE2E2' }
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

// ═══ RADAR CHART (Chart.js) ═══

function RadarChart({ scores, size = 340 }: { scores: Record<string, number>; size?: number }) {
  const labels = DIMS.map(d => d.label)
  const dataValues = DIMS.map(d => scores[d.key] || 0)
  const allZero = dataValues.every(v => v === 0)

  const data = {
    labels,
    datasets: [{
      data: allZero ? [10, 10, 10, 10, 10] : dataValues,
      backgroundColor: 'rgba(99,102,241,0.10)',
      borderColor: 'rgba(99,102,241,0.75)',
      borderWidth: 2,
      pointBackgroundColor: DIMS.map(d => d.color),
      pointBorderColor: '#fff',
      pointBorderWidth: 2,
      pointRadius: 5,
      pointHoverRadius: 8,
    }],
  }

  const options = {
    responsive: true,
    maintainAspectRatio: true,
    scales: {
      r: {
        min: 0,
        max: 100,
        ticks: {
          stepSize: 20,
          font: { size: 10, family: "'Inter', sans-serif" },
          color: '#A8A29E',
          backdropColor: 'transparent',
        },
        grid: { color: '#E7E5E4' },
        angleLines: { color: '#E7E5E4' },
        pointLabels: {
          font: { size: 13, weight: 500, family: "'Inter', sans-serif" },
          color: '#57534E',
        },
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(28,25,23,0.92)',
        titleFont: { size: 12, family: "'Inter', sans-serif" },
        bodyFont: { size: 13, family: "'Inter', sans-serif" },
        padding: 10,
        cornerRadius: 8,
        callbacks: {
          label: (ctx: any) => ` ${ctx.raw} 分`,
        },
      },
    },
  }

  return (
    <div style={{ width: size, height: size, margin: '0 auto', position: 'relative' }}>
      <Radar data={data} options={options} />
    </div>
  )
}

// ═══ DIMENSION CARD ═══

function DimensionCard({ dimKey, label, icon: Icon, color, desc, score }: {
  dimKey: string; label: string; icon: typeof Brain; color: string; desc: string; score: number
}) {
  const level = levelMeta(score)
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
          <Icon size={18} color={color} />
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#1C1917' }}>{label}</div>
          <div style={{ fontSize: 10.5, color: '#A8A29E' }}>{desc}</div>
        </div>
        <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
          <ScoreRing score={score} color={color} size={60} strokeW={5} />
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
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
    </div>
  )
}

// ═══ ASSESSMENT CHAT (MODAL) ═══

function AssessmentModal({
  onComplete, onClose,
}: {
  onComplete: (scores: Record<string, number>) => void
  onClose: () => void
}) {
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([])
  const [input, setInput] = useState('')
  const [sessionId, setSessionId] = useState('')
  const [loading, setLoading] = useState(false)
  const [started, setStarted] = useState(false)
  const [done, setDone] = useState(false)
  const [streaming, setStreaming] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const streamingRef = useRef(false)

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])
  useEffect(() => { if (started && !done && !streaming) inputRef.current?.focus() }, [started, done, streaming, messages.length])

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
              if (event.done && event.dimensions) {
                finalScores = {}
                for (const [k, v] of Object.entries(event.dimensions)) {
                  finalScores[k] = (v as { score: number }).score
                }
                setDone(true)
                setTimeout(() => onComplete(finalScores), 800)
              }
            } else if (event.type === 'error') {
              setMessages(prev => [...prev, { role: 'assistant', content: '出错了：' + (event.message || '请重试') }])
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
    await doStream({})
    setStarted(true)
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
              AI 对话式评估 · 约 5-10 分钟
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
              <X size={16} />
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
              <Brain size={32} color="#6366F1" />
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
                {loading ? '准备中...' : '开始对话评估'} <ArrowRight size={16} />
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
                  发送 <Send size={14} />
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

export default function ProfilePage() {
  const [scores, setScores] = useState<Record<string, number>>({
    comprehension: 0, memory: 0, application: 0, imagination: 0, focus: 0,
  })
  const [status, setStatus] = useState<string>('pending')
  const [loading, setLoading] = useState(true)
  const [showAssess, setShowAssess] = useState(false)

  const studentId = getStudentId()

  useEffect(() => {
    if (!studentId) return
    loadProfile()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId])

  async function loadProfile() {
    try {
      const data = await profileApi.getMe()
      if (data.dimensions && Object.keys(data.dimensions).length > 0) {
        setScores(prev => ({ ...prev, ...data.dimensions }))
      }
      setStatus(data.assessment_status || 'pending')
    } catch (e) {
      console.error('Failed to load profile', e)
    } finally {
      setLoading(false)
    }
  }

  const handleComplete = useCallback((finalScores: Record<string, number>) => {
    setScores(prev => ({ ...prev, ...finalScores }))
    setStatus('completed')
    setShowAssess(false)
  }, [])

  const handleClose = useCallback(() => { setShowAssess(false) }, [])

  const hasScores = Object.values(scores).some(v => v > 0)
  const avgScore = hasScores
    ? Math.round(DIMS.reduce((s, d) => s + (scores[d.key] || 0), 0) / DIMS.length)
    : 0
  const avgLevel = levelMeta(avgScore)

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
        <div style={{ fontSize: 14, color: '#A8A29E', animation: 'pulse 1.5s infinite' }}>加载中...</div>
      </div>
    )
  }

  return (
    <>
      {/* ══ ASSESSMENT MODAL ══ */}
      {showAssess && (
        <AssessmentModal onComplete={handleComplete} onClose={handleClose} />
      )}

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
                <Award size={22} color="#A8A29E" />
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

            {!hasScores && (
              <button onClick={() => setShowAssess(true)} style={{
                padding: '10px 24px', background: '#fff', color: '#1C1917',
                border: 'none', borderRadius: 10, fontSize: 13.5, fontWeight: 500,
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
              }}>
                开始评估 <ArrowRight size={15} />
              </button>
            )}
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
          </div>

          {hasScores ? (
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <RadarChart scores={scores} size={320} />
            </div>
          ) : (
            <div style={{
              textAlign: 'center', padding: '50px 20px', color: '#A8A29E',
            }}>
              <Brain size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
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
                  key={d.key} dimKey={d.key} label={d.label} icon={d.icon}
                  color={d.color} desc={d.desc} score={scores[d.key] || 0}
                />
              ))}
            </div>
          </div>
        )}

        {/* ══ KEYFRAMES (added via style tag for modal animation) ══ */}
        <style>{`
          @keyframes modalIn {
            from { opacity: 0; transform: scale(0.96) translateY(10px); }
            to { opacity: 1; transform: scale(1) translateY(0); }
          }
          @keyframes pulse {
            0%, 100% { opacity: 0.4; }
            50% { opacity: 1; }
          }
        `}</style>
      </div>
    </>
  )
}
