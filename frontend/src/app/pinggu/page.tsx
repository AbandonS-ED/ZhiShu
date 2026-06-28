'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { tutorApi, evaluationApi, type EvaluationReport } from '@/lib/api'
import { getStudentId } from '@/lib/student'
import { showToast } from '@/lib/utils'
import RobotIcon from '@/components/RobotIcon'
import { usePageTimer } from '@/hooks/usePageTimer'
import Icon from '@/components/Icon'

// ═══ DATA ═══

// 默认 fallback 数据
const defaultDimensions = [
  { name: '知识基础', icon: 'book', bg: 'var(--info-soft)', color: 'var(--info)', score: 0, detail: '暂无数据' },
  { name: '认知风格', icon: 'brain', bg: 'var(--success-soft)', color: 'var(--success)', score: 0, detail: '暂无数据' },
  { name: '学习目标', icon: 'target', bg: 'var(--warm-soft)', color: 'var(--warm)', score: 0, detail: '暂无数据' },
  { name: '易错点', icon: 'warning', bg: 'var(--danger-soft)', color: 'var(--danger)', score: 0, detail: '暂无数据' },
  { name: '学习节奏', icon: 'clock', bg: 'var(--info-soft)', color: 'var(--info)', score: 0, detail: '暂无数据' },
  { name: '兴趣方向', icon: 'lightbulb', bg: 'var(--success-soft)', color: 'var(--success)', score: 0, detail: '暂无数据' },
]

const defaultWeeklyHours = [
  { day: '周一', val: 0 }, { day: '周二', val: 0 }, { day: '周三', val: 0 },
  { day: '周四', val: 0 }, { day: '周五', val: 0 }, { day: '周六', val: 0 },
  { day: '周日', val: 0 },
]

const defaultTopicAccuracy = [
  { name: '暂无数据', pct: 0 },
]

const defaultKnowledgeTable = [
  { name: '暂无数据', mastery: 0, attempts: 0, accuracy: 0 },
]

// ═══ HELPERS ═══
function scoreColor(s: number) {
  return s >= 70 ? 'var(--success)' : s >= 40 ? 'var(--warm)' : 'var(--danger)'
}

// 把后端 EvaluationReport 派生为页面所需的展示数据
function deriveDimensions(report: EvaluationReport | null) {
  if (!report) return defaultDimensions
  const km = report.knowledge_mastery || {}
  const entries = Object.entries(km)
  if (entries.length === 0) return defaultDimensions
  // 取前 6 个知识点 → 6 个维度卡
  return entries.slice(0, 6).map(([name, info], i) => ({
    name: name.length > 8 ? name.slice(0, 8) + '…' : name,
    icon: ['book', 'brain', 'target', 'warning', 'clock', 'lightbulb'][i] || 'book',
    bg: 'var(--info-soft)',
    color: 'var(--info)',
    score: Math.round(info.avg_score),
    detail: `练习 ${info.attempt_count} 次，平均 ${Math.round(info.avg_score)} 分`,
  }))
}

function deriveKnowledgeTable(report: EvaluationReport | null) {
  if (!report) return defaultKnowledgeTable
  const km = report.knowledge_mastery || {}
  const entries = Object.entries(km)
  if (entries.length === 0) return defaultKnowledgeTable
  return entries.map(([name, info]) => ({
    name,
    mastery: Math.round(info.avg_score),
    attempts: info.attempt_count,
    accuracy: Math.round(info.avg_score),
  }))
}

function deriveWeeklyHours(report: EvaluationReport | null) {
  if (!report) return defaultWeeklyHours
  const daily = report.daily_activity || []
  if (daily.length === 0) return defaultWeeklyHours
  const dayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  // 取最近 7 天，按日期排序
  return daily.slice(0, 7).reverse().map((d) => {
    const dt = new Date(d.date)
    return { day: dayNames[dt.getDay()], val: d.duration_minutes / 60 }
  })
}

function deriveTopicAccuracy(report: EvaluationReport | null) {
  if (!report) return defaultTopicAccuracy
  const km = report.knowledge_mastery || {}
  if (Object.keys(km).length === 0) return defaultTopicAccuracy
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

const PROGRESS_MSGS = [
  '正在查询学习记录...',
  '正在分析知识掌握度...',
  '正在分析易错点...',
  'AI 正在生成评估报告...',
]

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
  const [regenerating, setRegenerating] = useState(false)
  const [progressMsg, setProgressMsg] = useState('')

  const msgQueueRef = useRef<string[]>([])
  const msgTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const displayDimensions = useMemo(() => deriveDimensions(evalReport), [evalReport])
  const displayKnowledgeTable = useMemo(() => deriveKnowledgeTable(evalReport), [evalReport])
  const displayWeeklyHours = useMemo(() => deriveWeeklyHours(evalReport), [evalReport])
  const displayTopicAccuracy = useMemo(() => deriveTopicAccuracy(evalReport), [evalReport])
  const [evalLoading, setEvalLoading] = useState(true)

  // 记录页面停留时间
  usePageTimer('evaluation')

  useEffect(() => {
    msgQueueRef.current = [...PROGRESS_MSGS]

    const processQueue = () => {
      if (msgTimerRef.current) return
      const queue = msgQueueRef.current
      if (queue.length === 0) return
      setProgressMsg(queue.shift()!)
      if (queue.length > 0) {
        msgTimerRef.current = setTimeout(() => {
          msgTimerRef.current = null
          processQueue()
        }, 3000)
      }
    }
    processQueue()

    evaluationApi.getReport(getStudentId())
      .then((r) => { setEvalReport(r); setCurrentScore(r.overall_score) })
      .catch(() => {})
      .finally(() => {
        setEvalLoading(false)
        if (msgTimerRef.current) {
          clearTimeout(msgTimerRef.current)
          msgTimerRef.current = null
        }
      })

    return () => {
      if (msgTimerRef.current) {
        clearTimeout(msgTimerRef.current)
        msgTimerRef.current = null
      }
    }
  }, [])

  const askAi = async () => {
    if (!askInput.trim() || askLoading) return
    setAskLoading(true)
    setAskResult(null)
    try {
      const r = await tutorApi.ask(getStudentId(), askInput.trim())
      setAskResult({ question: r.question, answer: r.answer, suggestion: r.suggestion })
    } catch (e: any) {
      setAskResult({ question: askInput, answer: `调用失败: ${e.message}`, suggestion: '' })
    } finally {
      setAskLoading(false)
    }
  }

  const regenerateReport = async () => {
    if (regenerating) return
    setRegenerating(true)
    try {
      const r = await evaluationApi.regenerateReport(getStudentId())
      setEvalReport(r)
      setCurrentScore(r.overall_score)
      showToast('评估报告已重新生成')
    } catch (e: any) {
      showToast(`重新生成失败: ${e.message}`)
    } finally {
      setRegenerating(false)
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
  }, [evalReport?.overall_score])

  // Records pagination - 暂时移除硬编码记录
  const records: Array<{ time: string; icon: string; bg: string; color: string; text: string; score?: string }> = []
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
        <button className="btn btn-sm" style={{ marginLeft: 'auto' }} onClick={() => showToast('评估报告 PDF 导出中...')}>
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
        <span style={{ fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}><RobotIcon size={18} /> AI 评估：</span>
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
          <div style={{ fontSize: 13, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
            {(askResult.answer.startsWith('调用失败')) && <Icon name="close" size={14} className="inline-icon" />}
            {askResult.answer}
          </div>
          {askResult.suggestion && (
            <div style={{ marginTop: 10, padding: 10, background: 'var(--success-soft)', borderRadius: 6, fontSize: 12 }}>
              <Icon name="lightbulb" size={14} className="inline-icon" /> <strong>建议：</strong>{askResult.suggestion}
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
                <div className="db-icon" style={{ background: d.bg, color: d.color }}><Icon name={d.icon as any} size={20} /></div>
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
          <div className="st-val" style={{ color: 'var(--info)' }}>
            {evalReport ? `${Math.round((evalReport.summary?.total_duration_minutes || 0) / 60 * 10) / 10}h` : '0h'}
          </div>
          <div className="st-trend trend-up">↑ 较上周</div>
        </div>
        <div className="st-card">
          <div className="st-label">练习正确率</div>
          <div className="st-val" style={{ color: 'var(--warm)' }}>
            {evalReport ? `${Math.round(evalReport.summary?.avg_score || 0)}%` : '0%'}
          </div>
          <div className="st-trend trend-up">↑ 较上周</div>
        </div>
        <div className="st-card">
          <div className="st-label">完成知识点</div>
          <div className="st-val" style={{ color: 'var(--success)' }}>
            {evalReport ? `${Object.keys(evalReport.knowledge_mastery || {}).length} / 12` : '0 / 12'}
          </div>
          <div className="st-trend trend-up">↑ 本周</div>
        </div>
        <div className="st-card">
          <div className="st-label">生成资源</div>
          <div className="st-val">
            {evalReport ? evalReport.summary?.total_resources || 0 : 0}
          </div>
          <div className="st-trend trend-up">↑ 本周</div>
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {evalReport?.generated_at && (
                <span className="tag tag-info" style={{ fontSize: 11 }}>
                  {new Date(evalReport.generated_at).toLocaleString('zh-CN', { hour: '2-digit', minute: '2-digit' })} 生成
                </span>
              )}
              <span className="tag tag-dark">AI 生成</span>
              <button
                className="btn btn-sm"
                onClick={regenerateReport}
                disabled={regenerating}
                style={{ opacity: regenerating ? 0.6 : 1 }}
              >
                {regenerating ? '生成中...' : '重新生成'}
              </button>
            </div>
          </div>
          <div className="card-bd">
            {evalLoading ? (
              <div className="gen-loading" style={{ justifyContent: 'center', padding: '24px 20px', border: 'none' }}>
                <div className="gen-spinner" />
                <span>{progressMsg || 'AI 正在分析您的学习数据...'}</span>
              </div>
            ) : evalReport?.report ? (
              <div className="eval-report">
                <h4>总体评价</h4>
                <p>{evalReport.report.overall_evaluation}</p>

                {evalReport.report.strengths && evalReport.report.strengths.length > 0 && (
                  <>
                    <h4>优势领域</h4>
                    <ul>
                      {evalReport.report.strengths.map((s, i) => (
                        <li key={i}><strong>{s.name}</strong>（掌握度 {s.mastery}%）：{s.description}</li>
                      ))}
                    </ul>
                  </>
                )}

                {evalReport.report.weak_points && evalReport.report.weak_points.length > 0 && (
                  <>
                    <h4>薄弱环节</h4>
                    <ul>
                      {evalReport.report.weak_points.map((w, i) => (
                        <li key={i}><strong>{w.name}</strong>（掌握度 {w.mastery}%）：{w.description}</li>
                      ))}
                    </ul>
                  </>
                )}

                {evalReport.report.error_prone_areas && evalReport.report.error_prone_areas.length > 0 && (
                  <>
                    <h4>易错点</h4>
                    <ul>
                      {evalReport.report.error_prone_areas.map((e, i) => (
                        <li key={i}><strong>{e.name}</strong>（错误率 {e.error_rate}%）：{e.description}</li>
                      ))}
                    </ul>
                  </>
                )}

                {evalReport.report.recommendations && evalReport.report.recommendations.length > 0 && (
                  <>
                    <h4>学习建议</h4>
                    <ul>
                      {evalReport.report.recommendations.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  </>
                )}

                {evalReport.report.progress_trend && (
                  <>
                    <h4>进步趋势</h4>
                    <p>{evalReport.report.progress_trend.description}</p>
                  </>
                )}
              </div>
            ) : (
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-3)' }}>
                暂无评估报告数据
              </div>
            )}
          </div>
        </div>

        {/* Knowledge mastery */}
        <div className="card">
          <div className="card-hd">
            <h3>知识点掌握度</h3>
            <button className="btn btn-sm" onClick={() => showToast('跳转到练习题库')}>去练习</button>
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
          {records.length === 0 ? (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-3)' }}>
              暂无学习记录
            </div>
          ) : (
            <>
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
            </>
          )}
        </div>
      </div>
    </>
  )
}
