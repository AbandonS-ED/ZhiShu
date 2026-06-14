'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { tutorApi, evaluationApi, type EvaluationReport } from '@/lib/api'
import { getStudentId } from '@/lib/student'

// ═══ DATA ═══

const dimensions = [
  { name: '知识基础', icon: '📚', bg: 'var(--info-soft)', color: 'var(--info)', score: 72, detail: '掌握搜索算法和 ML 基础，深度学习需加强' },
  { name: '认知风格', icon: '🧠', bg: 'var(--success-soft)', color: 'var(--success)', score: 80, detail: '视觉学习偏好，理解力强' },
  { name: '学习目标', icon: '🎯', bg: 'var(--warm-soft)', color: 'var(--warm)', score: 90, detail: '目标明确，执行度高' },
  { name: '易错点', icon: '⚠️', bg: 'var(--danger-soft)', color: 'var(--danger)', score: 55, detail: '梯度计算和正则化常出错' },
  { name: '学习节奏', icon: '⏱️', bg: 'var(--info-soft)', color: 'var(--info)', score: 70, detail: '日均 2.4h，节奏稳定' },
  { name: '兴趣方向', icon: '💡', bg: 'var(--success-soft)', color: 'var(--success)', score: 85, detail: 'NLP 和大模型方向兴趣浓厚' },
]

const weeklyHours = [
  { day: '周一', val: 2.0 }, { day: '周二', val: 3.2 }, { day: '周三', val: 1.5 },
  { day: '周四', val: 2.8 }, { day: '周五', val: 4.2 }, { day: '周六', val: 3.5 },
  { day: '周日', val: 0 },
]

const topicAccuracy = [
  { name: '搜索算法', pct: 85 }, { name: '知识表示', pct: 72 }, { name: 'ML基础', pct: 62 },
  { name: 'CNN', pct: 55 }, { name: 'NLP', pct: 48 }, { name: 'RNN', pct: 35 },
  { name: '强化学习', pct: 22 },
]

const knowledgeTable = [
  { name: 'A* 搜索算法', mastery: 85, attempts: 12, accuracy: 92 },
  { name: 'Dijkstra 算法', mastery: 78, attempts: 8, accuracy: 88 },
  { name: '知识表示方法', mastery: 72, attempts: 6, accuracy: 83 },
  { name: '机器学习基础', mastery: 62, attempts: 15, accuracy: 67 },
  { name: 'CNN 卷积网络', mastery: 55, attempts: 10, accuracy: 60 },
  { name: 'Transformer', mastery: 48, attempts: 7, accuracy: 57 },
  { name: '反向传播', mastery: 40, attempts: 5, accuracy: 50 },
  { name: 'RNN 与 LSTM', mastery: 35, attempts: 4, accuracy: 45 },
  { name: '强化学习', mastery: 22, attempts: 3, accuracy: 33 },
]

const records = [
  { time: '06-06 16:42', icon: '✅', bg: 'var(--success-soft)', color: 'var(--success)', text: '完成 <strong>A* 算法</strong> 练习', score: '92' },
  { time: '06-06 15:30', icon: '📄', bg: 'var(--info-soft)', color: 'var(--info)', text: '查看 <strong>反向传播推导</strong> 文档' },
  { time: '06-06 14:15', icon: '🗺️', bg: 'var(--success-soft)', color: 'var(--success)', text: '生成 <strong>Transformer</strong> 思维导图' },
  { time: '06-06 11:20', icon: '✅', bg: 'var(--success-soft)', color: 'var(--success)', text: '完成 <strong>ML 基础</strong> 练习', score: '78' },
  { time: '06-05 21:40', icon: '💬', bg: 'var(--warm-soft)', color: 'var(--warm)', text: '对话学习 <strong>CNN 卷积网络</strong>' },
  { time: '06-05 20:10', icon: '✅', bg: 'var(--success-soft)', color: 'var(--success)', text: '完成 <strong>搜索算法</strong> 练习', score: '88' },
  { time: '06-05 18:30', icon: '🗺️', bg: 'var(--success-soft)', color: 'var(--success)', text: '生成 <strong>CNN</strong> 思维导图' },
  { time: '06-05 15:00', icon: '📄', bg: 'var(--info-soft)', color: 'var(--info)', text: '查看 <strong>A* 算法详解</strong> 文档' },
  { time: '06-04 22:15', icon: '✅', bg: 'var(--success-soft)', color: 'var(--success)', text: '完成 <strong>知识表示</strong> 练习', score: '83' },
  { time: '06-04 20:00', icon: '💬', bg: 'var(--warm-soft)', color: 'var(--warm)', text: '对话学习 <strong>Transformer 注意力</strong>' },
  { time: '06-04 17:30', icon: '💻', bg: 'var(--accent-soft)', color: 'var(--ink-2)', text: '学习 <strong>决策树 Python 实现</strong> 代码' },
  { time: '06-04 14:00', icon: '✅', bg: 'var(--success-soft)', color: 'var(--success)', text: '完成 <strong>判断题</strong> 专项练习', score: '70' },
  { time: '06-03 21:30', icon: '📄', bg: 'var(--info-soft)', color: 'var(--info)', text: '查看 <strong>RNN 与 LSTM 对比</strong>' },
  { time: '06-03 19:00', icon: '💬', bg: 'var(--warm-soft)', color: 'var(--warm)', text: '对话学习 <strong>梯度下降法</strong>' },
  { time: '06-03 16:00', icon: '✅', bg: 'var(--success-soft)', color: 'var(--success)', text: '完成 <strong>ML 选择题</strong> 练习', score: '65' },
  { time: '06-02 22:00', icon: '🗺️', bg: 'var(--success-soft)', color: 'var(--success)', text: '生成 <strong>知识表示</strong> 思维导图' },
  { time: '06-02 20:15', icon: '✅', bg: 'var(--success-soft)', color: 'var(--success)', text: '完成 <strong>强化学习概念</strong> 练习', score: '45' },
  { time: '06-02 17:00', icon: '🎧', bg: 'var(--danger-soft)', color: 'var(--danger)', text: '收听 <strong>强化学习概念速听</strong> 音频' },
  { time: '06-01 21:30', icon: '💬', bg: 'var(--warm-soft)', color: 'var(--warm)', text: '对话学习 <strong>反向传播算法</strong>' },
  { time: '06-01 18:00', icon: '📄', bg: 'var(--info-soft)', color: 'var(--info)', text: '查看 <strong>CNN 图像分类</strong> 文档' },
  { time: '06-01 15:30', icon: '✅', bg: 'var(--success-soft)', color: 'var(--success)', text: '完成 <strong>Dijkstra</strong> 练习', score: '90' },
  { time: '06-01 13:00', icon: '💻', bg: 'var(--accent-soft)', color: 'var(--ink-2)', text: '学习 <strong>CNN PyTorch 实战</strong> 代码' },
  { time: '05-31 22:00', icon: '🗺️', bg: 'var(--success-soft)', color: 'var(--success)', text: '生成 <strong>强化学习</strong> 思维导图' },
  { time: '05-31 19:30', icon: '💬', bg: 'var(--warm-soft)', color: 'var(--warm)', text: '初始学习画像生成' },
]

// ═══ HELPERS ═══
function scoreColor(s: number) {
  return s >= 70 ? 'var(--success)' : s >= 40 ? 'var(--warm)' : 'var(--danger)'
}

// 把后端 EvaluationReport 派生为页面所需的展示数据
function deriveDimensions(report: EvaluationReport | null) {
  if (!report) return dimensions
  const km = report.knowledge_mastery || {}
  const entries = Object.entries(km)
  if (entries.length === 0) return dimensions
  // 取前 6 个知识点 → 6 个维度卡
  return entries.slice(0, 6).map(([name, info], i) => ({
    name: name.length > 8 ? name.slice(0, 8) + '…' : name,
    icon: ['📚', '🧠', '🎯', '⚠️', '⏱️', '💡'][i] || '📌',
    bg: 'var(--info-soft)',
    color: 'var(--info)',
    score: Math.round(info.avg_score),
    detail: `练习 ${info.attempt_count} 次，平均 ${Math.round(info.avg_score)} 分`,
  }))
}

function deriveKnowledgeTable(report: EvaluationReport | null) {
  if (!report) return knowledgeTable
  const km = report.knowledge_mastery || {}
  const entries = Object.entries(km)
  if (entries.length === 0) return knowledgeTable
  return entries.map(([name, info]) => ({
    name,
    mastery: Math.round(info.avg_score),
    attempts: info.attempt_count,
    accuracy: Math.round(info.avg_score),
  }))
}

function deriveWeeklyHours(report: EvaluationReport | null) {
  if (!report) return weeklyHours
  const daily = report.daily_activity || []
  if (daily.length === 0) return weeklyHours
  const dayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  // 取最近 7 天，按日期排序
  return daily.slice(0, 7).reverse().map((d) => {
    const dt = new Date(d.date)
    return { day: dayNames[dt.getDay()], val: d.duration_minutes / 60 }
  })
}

function deriveTopicAccuracy(report: EvaluationReport | null) {
  if (!report) return topicAccuracy
  const km = report.knowledge_mastery || {}
  return Object.entries(km).slice(0, 7).map(([name, info]) => ({
    name: name.length > 6 ? name.slice(0, 6) + '…' : name,
    pct: Math.round(info.avg_score),
  }))
}

// ═══ LINE CHART COMPONENT ═══
function TrendChart({ data }: { data: { day: string; val: number }[] }) {
  const W = 520, H = 220
  const pad = { t: 20, r: 20, b: 30, l: 40 }
  const cw = W - pad.l - pad.r, ch = H - pad.t - pad.b

  // 处理空数据或单点数据
  if (!data || data.length === 0) {
    return (
      <svg className="line-chart" viewBox={`0 0 ${W} ${H}`}>
        <text x={W / 2} y={H / 2} textAnchor="middle" fill="#A8A29E" fontSize="14">暂无数据</text>
      </svg>
    )
  }

  const maxVal = Math.max(...data.map((d) => d.val), 0.1) * 1.2
  const xStep = data.length > 1 ? cw / (data.length - 1) : cw

  const points = data.map((d, i) => ({
    x: pad.l + xStep * i,
    y: pad.t + ch - (ch * d.val / maxVal),
  }))

  return (
    <svg className="line-chart" viewBox={`0 0 ${W} ${H}`}>
      {/* Grid */}
      {[0, 1, 2, 3, 4].map((i) => {
        const y = pad.t + ch - (ch * i / 4)
        return (
          <g key={i}>
            <line x1={pad.l} y1={y} x2={W - pad.r} y2={y} className="lc-grid" />
            <text x={pad.l - 8} y={y + 3} textAnchor="end" className="lc-axis">{(maxVal * i / 4).toFixed(1)}</text>
          </g>
        )
      })}

      {/* X labels */}
      {data.map((d, i) => (
        <text key={i} x={points[i].x} y={H - 6} textAnchor="middle" className="lc-axis">{d.day}</text>
      ))}

      {/* Area */}
      <path d={`M${points[0].x},${pad.t + ch} ${points.map((p) => `L${p.x},${p.y}`).join(' ')} L${points[points.length - 1].x},${pad.t + ch} Z`} className="lc-area" fill="var(--info)" />

      {/* Line */}
      <path d={points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')} className="lc-line" stroke="var(--info)" />

      {/* Dots */}
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="3.5" fill="var(--info)" className="lc-dot" />
      ))}
    </svg>
  )
}

// ═══ BAR CHART COMPONENT ═══
function BarChart({ data }: { data: Array<{ name: string; pct: number }> }) {
  const W = 520, H = 220
  const pad = { t: 15, r: 20, b: 45, l: 10 }
  const cw = W - pad.l - pad.r, ch = H - pad.t - pad.b
  const barW = Math.min(40, (cw / data.length) - 12)
  const gap = (cw - barW * data.length) / (data.length + 1)

  return (
    <svg className="bar-chart" viewBox={`0 0 ${W} ${H}`}>
      {/* Grid */}
      {[0, 1, 2, 3, 4].map((i) => {
        const y = pad.t + ch - (ch * i / 4)
        return (
          <g key={i}>
            <line x1={pad.l} y1={y} x2={W - pad.r} y2={y} className="lc-grid" />
            <text x={W - pad.r + 6} y={y + 3} className="lc-axis">{i * 25}%</text>
          </g>
        )
      })}

      {/* Bars */}
      {data.map((d, i) => {
        const x = pad.l + gap + i * (barW + gap)
        const barH = ch * d.pct / 100
        const y = pad.t + ch - barH
        const color = d.pct >= 70 ? 'var(--success)' : d.pct >= 40 ? 'var(--warm)' : 'var(--danger)'

        return (
          <g key={i}>
            <rect x={x} y={y} width={barW} height={barH} rx="3" fill={color} className="bc-bar" opacity=".8">
              <animate attributeName="height" from="0" to={barH} dur="0.6s" fill="freeze" begin={`${i * 0.06}s`} />
              <animate attributeName="y" from={pad.t + ch} to={y} dur="0.6s" fill="freeze" begin={`${i * 0.06}s`} />
            </rect>
            <text x={x + barW / 2} y={H - 24} textAnchor="middle" className="bc-label">{d.name}</text>
            <text x={x + barW / 2} y={y - 6} textAnchor="middle" className="bc-val" fill={color}>{d.pct}%</text>
          </g>
        )
      })}
    </svg>
  )
}

// ═══ MAIN PAGE ═══
export default function PingguPage() {
  const [currentScore, setCurrentScore] = useState(0)
  const [timePeriod, setTimePeriod] = useState('week')
  const [recordPage, setRecordPage] = useState(1)
  const [animatedBars, setAnimatedBars] = useState(false)
  const recordsPerPage = 10
  const [askInput, setAskInput] = useState('')
  const [askLoading, setAskLoading] = useState(false)
  const [askResult, setAskResult] = useState<{ question: string; answer: string; suggestion: string } | null>(null)
  const [evalReport, setEvalReport] = useState<EvaluationReport | null>(null)

  const displayDimensions = useMemo(() => deriveDimensions(evalReport), [evalReport])
  const displayKnowledgeTable = useMemo(() => deriveKnowledgeTable(evalReport), [evalReport])
  const displayWeeklyHours = useMemo(() => deriveWeeklyHours(evalReport), [evalReport])
  const displayTopicAccuracy = useMemo(() => deriveTopicAccuracy(evalReport), [evalReport])
  const [evalLoading, setEvalLoading] = useState(true)

  useEffect(() => {
    evaluationApi.getReport(getStudentId())
      .then((r) => { setEvalReport(r); setCurrentScore(r.overall_score) })
      .catch(() => {})
      .finally(() => setEvalLoading(false))
  }, [])

  const askAi = async () => {
    if (!askInput.trim() || askLoading) return
    setAskLoading(true)
    setAskResult(null)
    try {
      const r = await tutorApi.ask(getStudentId(), askInput.trim())
      setAskResult({ question: r.question, answer: r.answer, suggestion: r.suggestion })
    } catch (e: any) {
      setAskResult({ question: askInput, answer: `❌ 调用失败: ${e.message}`, suggestion: '' })
    } finally {
      setAskLoading(false)
    }
  }

  // Animate score ring
  useEffect(() => {
    let current = 0
    let animFrameId: number
      const target = evalReport?.overall_score ?? 78
    const step = () => {
      current += 2
      if (current > target) current = target
      setCurrentScore(current)
      if (current < target) {
        animFrameId = requestAnimationFrame(step)
      }
    }
    animFrameId = requestAnimationFrame(step)
    setTimeout(() => setAnimatedBars(true), 300)
    return () => {
      cancelAnimationFrame(animFrameId)
    }
  }, [])

  // Records pagination
  const totalPages = Math.ceil(records.length / recordsPerPage)
  const start = (recordPage - 1) * recordsPerPage
  const pageRecords = records.slice(start, start + recordsPerPage)

  const level = currentScore >= 85 ? '优秀' : currentScore >= 70 ? '良好' : currentScore >= 55 ? '中等' : '需加强'
  const circ = 414.7

  return (
    <>
      {/* Time Filter + Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
        <div className="time-filter">
          {(['day', 'week', 'month', 'all'] as const).map((t) => (
            <button
              key={t}
              className={`tf-btn${timePeriod === t ? ' active' : ''}`}
              onClick={() => setTimePeriod(t)}
            >
              {t === 'day' ? '今日' : t === 'week' ? '本周' : t === 'month' ? '本月' : '全部'}
            </button>
          ))}
        </div>
        <button className="btn btn-sm" style={{ marginLeft: 'auto' }} onClick={() => alert('评估报告 PDF 导出中...')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          导出报告
        </button>
      </div>

      {/* AI 智能评估问答 */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '12px 0', padding: 12, background: 'var(--brand-soft)', borderRadius: 8 }}>
        <span style={{ fontSize: 14, fontWeight: 600 }}>🤖 AI 评估：</span>
        <input
          value={askInput}
          onChange={e => setAskInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && askAi()}
          placeholder="描述学习情况，AI 生成评估建议"
          disabled={askLoading}
          style={{ flex: 1, padding: '6px 12px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)' }}
        />
        <button onClick={askAi} disabled={askLoading || !askInput.trim()} style={{ padding: '6px 16px', background: 'var(--brand)', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', whiteSpace: 'nowrap' }}>
          {askLoading ? '分析中...' : '提交'}
        </button>
      </div>
      {askResult && (
        <div style={{ padding: 16, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 6 }}>Q: {askResult.question}</div>
          <div style={{ fontSize: 13, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{askResult.answer}</div>
          {askResult.suggestion && (
            <div style={{ marginTop: 10, padding: 10, background: 'var(--success-soft)', borderRadius: 6, fontSize: 12 }}>
              💡 <strong>建议：</strong>{askResult.suggestion}
            </div>
          )}
        </div>
      )}

      {/* Score Hero */}
      <div className="score-hero">
        <div className="sh-score">
          <div className="sh-ring">
            <svg width="160" height="160" viewBox="0 0 160 160">
              <circle cx="80" cy="80" r="66" fill="none" stroke="var(--bg-subtle)" strokeWidth="10" />
              <circle cx="80" cy="80" r="66" fill="none" stroke={scoreColor(currentScore)} strokeWidth="10"
                strokeDasharray={circ} strokeDashoffset={circ - (circ * currentScore / 100)} strokeLinecap="round" />
            </svg>
            {/* 派生真数据：使用 evalReport 时显示 */}
            <div className="sh-val">
              <div className="sh-num">{currentScore}</div>
              <div className="sh-label">综合评分</div>
            </div>
          </div>
          <div className="sh-desc">
            等级：<strong>{level}</strong><br />超越 <strong>{Math.round(currentScore * 0.82)}%</strong> 的同课程学习者
          </div>
        </div>
        <div className="sh-dims">
          {displayDimensions.map((d, i) => (
            <div key={`${d.name}-${i}`} className="dim-bar-card" style={{ opacity: 0, animation: `fadeUp .4s var(--ease) ${i * 0.06}s forwards` }}>
              <div className="db-top">
                <div className="db-icon" style={{ background: d.bg, color: d.color }}>{d.icon}</div>
                <div className="db-name">{d.name}</div>
                <div className="db-score" style={{ color: scoreColor(d.score) }}>{d.score}</div>
              </div>
              <div className="db-bar">
                <div className="db-bar-fill" style={{ width: animatedBars ? `${d.score}%` : '0%', background: scoreColor(d.score) }} />
              </div>
              <div className="db-detail"><span>{d.detail}</span></div>
            </div>
          ))}
        </div>
      </div>

      {/* Stats Row */}
      <div className="stats-row">
        <div className="st-card">
          <div className="st-label">本周学习</div>
          <div className="st-val" style={{ color: 'var(--info)' }}>17.2h</div>
          <div className="st-trend trend-up">↑ 4.2h 较上周</div>
        </div>
        <div className="st-card">
          <div className="st-label">练习正确率</div>
          <div className="st-val" style={{ color: 'var(--warm)' }}>72%</div>
          <div className="st-trend trend-up">↑ 5% 较上周</div>
        </div>
        <div className="st-card">
          <div className="st-label">完成知识点</div>
          <div className="st-val" style={{ color: 'var(--success)' }}>5 / 12</div>
          <div className="st-trend trend-up">↑ +1 本周</div>
        </div>
        <div className="st-card">
          <div className="st-label">生成资源</div>
          <div className="st-val">18</div>
          <div className="st-trend trend-up">↑ +6 本周</div>
        </div>
      </div>

      {/* Trend Charts */}
      <div className="trend-section">
        <div className="card chart-card">
          <div className="card-hd">
            <h3>学习时长趋势</h3>
            <span className="tag tag-info">本周</span>
          </div>
          <div className="card-bd">
            <TrendChart data={displayWeeklyHours} />
          </div>
        </div>
        <div className="card chart-card">
          <div className="card-hd">
            <h3>练习正确率</h3>
            <span className="tag tag-green">按知识点</span>
          </div>
          <div className="card-bd">
            <BarChart data={displayTopicAccuracy} />
          </div>
        </div>
      </div>

      {/* Report + Knowledge */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
        {/* Report */}
        <div className="card">
          <div className="card-hd">
            <h3>评估报告</h3>
            <span className="tag tag-dark">AI 生成</span>
          </div>
          <div className="card-bd">
            <div className="eval-report">
              <h4>总体评价</h4>
              <p>张明远同学在本阶段的学习中表现<span className="er-highlight">良好</span>，综合评分为 <strong>78 分</strong>。学习态度积极，日均学习时长稳定在 2.4 小时，能够主动使用 AI 辅导工具深化理解。</p>

              <h4>优势领域</h4>
              <ul>
                <li><strong>搜索算法</strong>：掌握度 85%，A* 和 Dijkstra 算法理解扎实，能正确区分两者的适用场景</li>
                <li><strong>知识表示</strong>：掌握度 72%，对语义网络和谓词逻辑有较好理解</li>
                <li><strong>学习目标</strong>：目标明确（考研 + 课程高分），执行力评分 90</li>
              </ul>

              <h4>薄弱环节</h4>
              <ul>
                <li><strong>强化学习</strong>（掌握度 22%）：仅了解基础概念，Q-Learning 和策略梯度需系统学习</li>
                <li><strong>RNN 与 LSTM</strong>（掌握度 35%）：序列建模和门控机制理解不够深入</li>
                <li><strong>易错点</strong>：梯度计算、损失函数选择、正则化方法常出错，正确率低于 50%</li>
              </ul>

              <h4>学习建议</h4>
              <ul>
                <li>本周重点攻克 <span className="er-tag tag-warm">Transformer</span> <span className="er-tag tag-danger">RNN</span>，为后续 NLP 学习打基础</li>
                <li>增加反向传播的练习量，建议每天做 2-3 道相关计算题</li>
                <li>利用晚间高效时段（20:00-22:00）学习难度较高的强化学习内容</li>
                <li>建议结合代码实践加深理解，尤其是 CNN 和 Transformer 的 PyTorch 实现</li>
              </ul>

              <h4>进步趋势</h4>
              <p>较上周相比，练习正确率提升了 <span className="er-highlight">+5%</span>，学习时长增加了 <span className="er-highlight">+4.2h</span>。继续保持当前节奏，预计 18 天内可完成全部课程学习路径。</p>
            </div>
          </div>
        </div>

        {/* Knowledge mastery */}
        <div className="card">
          <div className="card-hd">
            <h3>知识点掌握度</h3>
            <button className="btn btn-sm" onClick={() => alert('跳转到练习题库')}>去练习</button>
          </div>
          <div className="card-bd" style={{ padding: '0 0 4px' }}>
            <table className="km-table">
              <thead><tr><th>知识点</th><th>掌握度</th><th>进度</th><th>练习</th><th>正确率</th></tr></thead>
              <tbody>
                {displayKnowledgeTable.map((k, i) => {
                  const col = scoreColor(k.accuracy)
                  return (
                    <tr key={i}>
                      <td className="km-name">{k.name}</td>
                      <td className="km-pct" style={{ color: col }}>{k.mastery}%</td>
                      <td className="km-bar-cell"><div className="km-mini-bar"><div className="km-mini-fill" style={{ width: `${k.mastery}%`, background: col }} /></div></td>
                      <td className="km-attempts">{k.attempts} 次</td>
                      <td className="km-pct" style={{ color: col }}>{k.accuracy}%</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Records */}
      <div className="card">
        <div className="card-hd">
          <h3>学习记录明细</h3>
          <span className="tag tag-dark">{records.length} 条记录</span>
        </div>
        <div className="card-bd">
          {pageRecords.map((r, i) => (
            <div key={i} className="record-item">
              <span className="ri-time">{r.time}</span>
              <div className="ri-icon" style={{ background: r.bg, color: r.color }}>{r.icon}</div>
              <span className="ri-text" dangerouslySetInnerHTML={{ __html: r.text }} />
              {r.score ? (
                <span className="ri-score" style={{ color: scoreColor(+r.score) }}>{r.score}</span>
              ) : (
                <span className="ri-score" style={{ color: 'var(--ink-4)' }}>—</span>
              )}
            </div>
          ))}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="records-pagination">
              <button className="pg-btn" disabled={recordPage === 1} onClick={() => setRecordPage((p) => p - 1)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
              </button>
              {Array.from({ length: totalPages }, (_, i) => (
                <button key={i} className={`pg-btn${recordPage === i + 1 ? ' active' : ''}`} onClick={() => setRecordPage(i + 1)}>
                  {i + 1}
                </button>
              ))}
              <button className="pg-btn" disabled={recordPage === totalPages} onClick={() => setRecordPage((p) => p + 1)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
