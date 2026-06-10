'use client'

import { useState, useEffect, useRef } from 'react'
import { profileApi, StudentProfile } from '@/lib/api'
import { getStudentId } from '@/lib/student'
import ChatModal from './ChatModal'

// ═══ DATA ═══
const knowledgeData = [
  { name: 'A* 搜索算法', score: 85, topic: '搜索算法', sessions: 8 },
  { name: 'Dijkstra 算法', score: 78, topic: '搜索算法', sessions: 6 },
  { name: '机器学习基础', score: 62, topic: '机器学习', sessions: 12 },
  { name: 'CNN 卷积神经网络', score: 55, topic: '深度学习', sessions: 7 },
  { name: 'Transformer 架构', score: 48, topic: 'NLP', sessions: 5 },
  { name: 'RNN 与 LSTM', score: 35, topic: '深度学习', sessions: 4 },
  { name: '强化学习', score: 22, topic: '强化学习', sessions: 2 },
  { name: '知识表示', score: 72, topic: '知识工程', sessions: 5 },
  { name: '决策树与随机森林', score: 58, topic: '机器学习', sessions: 6 },
  { name: '反向传播算法', score: 40, topic: '深度学习', sessions: 3 },
]

const fallbackWeaknessData = [
  { name: '强化学习', score: 22, detail: '仅有基础概念理解', level: 'danger' },
  { name: 'RNN 与 LSTM', score: 35, detail: '序列建模需加深', level: 'danger' },
  { name: '反向传播算法', score: 40, detail: '梯度计算易出错', level: 'warm' },
  { name: 'Transformer 架构', score: 48, detail: '注意力机制需巩固', level: 'warm' },
]

const fallbackDimensions = [
  {
    name: '知识基础',
    icon: '📚',
    iconBg: 'var(--info-soft)',
    iconColor: 'var(--info)',
    score: 72,
    desc: '已掌握搜索算法、机器学习基础概念；深度学习和强化学习需要加强。',
    tags: ['搜索算法', '机器学习基础', '知识表示', '概率论'],
    details: [
      { label: '搜索算法', val: 85 },
      { label: '机器学习', val: 62 },
      { label: '深度学习', val: 45 },
      { label: 'NLP', val: 48 },
      { label: '强化学习', val: 22 },
    ],
  },
  {
    name: '认知风格',
    icon: '🧠',
    iconBg: 'var(--success-soft)',
    iconColor: 'var(--success)',
    score: 80,
    desc: '偏好视觉化学习，通过图表和代码示例理解效果最佳。倾向于先理解原理再动手实践。',
    tags: ['视觉型', '原理优先', '代码驱动', '归纳推理'],
    details: [
      { label: '视觉偏好', val: 90 },
      { label: '抽象思维', val: 75 },
      { label: '动手实践', val: 82 },
      { label: '记忆风格', val: 70 },
      { label: '归纳推理', val: 78 },
    ],
  },
  {
    name: '学习目标',
    icon: '🎯',
    iconBg: 'var(--warm-soft)',
    iconColor: 'var(--warm)',
    score: 90,
    desc: '目标明确，聚焦 AI 导论课程高分通过 + 深度学习入门。考研方向为人工智能。',
    tags: ['AI 导论高分', '深度学习入门', '考研准备', '论文阅读'],
    details: [
      { label: '课程目标', val: 95 },
      { label: '考研准备', val: 85 },
      { label: '论文能力', val: 60 },
      { label: '工程能力', val: 88 },
      { label: '竞赛参与', val: 70 },
    ],
  },
  {
    name: '易错点',
    icon: '⚠️',
    iconBg: 'var(--danger-soft)',
    iconColor: 'var(--danger)',
    score: 55,
    desc: '梯度计算、损失函数选择、正则化方法理解不深；算法复杂度分析常出错。',
    tags: ['梯度计算', '损失函数', '正则化', '复杂度分析'],
    details: [
      { label: '梯度计算', val: 40 },
      { label: '损失函数', val: 50 },
      { label: '正则化', val: 45 },
      { label: '复杂度分析', val: 55 },
      { label: '超参调优', val: 60 },
    ],
  },
  {
    name: '学习节奏',
    icon: '⏱️',
    iconBg: 'var(--info-soft)',
    iconColor: 'var(--info)',
    score: 70,
    desc: '日均学习 2.4 小时，专注时长约 38 分钟。晚间 20:00-22:00 效率最高。',
    tags: ['晚间高效', '2.4h/天', '38min 专注', '间歇学习'],
    details: [
      { label: '日均时长', val: 75 },
      { label: '专注时长', val: 65 },
      { label: '连续天数', val: 70 },
      { label: '效率指数', val: 72 },
      { label: '休息频率', val: 68 },
    ],
  },
  {
    name: '兴趣方向',
    icon: '💡',
    iconBg: 'var(--success-soft)',
    iconColor: 'var(--success)',
    score: 85,
    desc: '对深度学习和 NLP 领域兴趣浓厚，关注 GPT、BERT 等大模型技术。对 CV 方向兴趣一般。',
    tags: ['NLP', '大模型', 'Transformer', '生成式AI'],
    details: [
      { label: 'NLP', val: 95 },
      { label: 'CV', val: 50 },
      { label: '强化学习', val: 40 },
      { label: '大模型', val: 92 },
      { label: '知识图谱', val: 70 },
    ],
  },
]

const historyData = [
  { time: '2026-06-06 14:30', text: '通过问卷更新画像', changes: ['认知风格 +8', '学习节奏 修正'], dot: 'var(--warm)' },
  { time: '2026-06-05 16:20', text: '完成 A* 算法练习，画像自动更新', changes: ['知识基础 +5', 'A* 掌握度 → 85%'], dot: 'var(--success)' },
  { time: '2026-06-04 21:15', text: '新增 Transformer 标签', changes: ['兴趣方向 +3', 'NLP 关联'], dot: 'var(--info)' },
  { time: '2026-06-03 10:00', text: '初始画像生成（对话式）', changes: ['六维初始化', 'v3.0 发布'], dot: 'var(--ink-3)' },
]

const questions = [
  {
    title: '学习风格偏好',
    type: 'single',
    options: [
      '我偏好通过阅读文字和公式理解概念',
      '我偏好通过图表、动画等视觉方式理解',
      '我偏好通过动手写代码和实验来学习',
      '我偏好通过讨论和讲解来巩固知识',
    ],
  },
  { title: '每日可用学习时间', type: 'slider', min: 0.5, max: 6, step: 0.5, unit: '小时', default: 2.5 },
  { title: '当前最薄弱的知识点', type: 'text', placeholder: '例如：反向传播算法、梯度计算...' },
  {
    title: '你的学习目标是什么？',
    type: 'single',
    options: [
      '通过课程考试即可',
      '深入理解 AI 核心概念',
      '考研准备 / 学术深造',
      '工程项目实践能力',
      '科研论文阅读与写作',
    ],
  },
]

// ═══ HELPER ═══
function getScoreClass(s: number) {
  return s >= 70 ? 'high' : s >= 30 ? 'mid' : 'low'
}

// ═══ DERIVE FROM PROFILE ═══
function deriveWeakness(p: StudentProfile | null) {
  const km = p?.dimensions?.knowledge_mastery
  if (!km || Object.keys(km).length === 0) return fallbackWeaknessData
  const sorted = Object.entries(km).sort((a, b) => a[1] - b[1])
  const levelMap = (s: number) => s < 30 ? 'danger' : s < 50 ? 'warm' : 'info'
  return sorted.slice(0, 4).map(([name, score]) => ({
    name,
    score,
    detail: score < 30 ? '仅有基础概念理解' : score < 50 ? '需加深理解' : '掌握中等',
    level: levelMap(score),
  }))
}

function deriveSixDimensions(p: StudentProfile | null) {
  const d = p?.dimensions
  if (!d) return fallbackDimensions
  const km = d.knowledge_mastery || {}
  const ls = d.learning_style || { visual: 0, textual: 0, auditory: 0, kinesthetic: 0 }
  const cl = d.cognitive_level || { memory: 0, understand: 0, apply: 0, analyze: 0 }
  const interest = d.interest || {}
  const avg = (obj: Record<string, number>) => {
    const vals = Object.values(obj)
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0
  }
  const kmAvg = avg(km)
  const lsAvg = Math.round((ls.visual + ls.textual + ls.auditory + ls.kinesthetic) / 4)
  const clAvg = Math.round((cl.memory + cl.understand + cl.apply + cl.analyze) / 4)
  const intAvg = avg(interest)
  const daily = d.learning_pace?.daily_hours || 0
  const paceScore = Math.min(100, Math.round(daily * 30))
  const weakScore = kmAvg < 50 ? Math.round(kmAvg * 1.2) : Math.max(20, 100 - kmAvg)
  return [
    { name: '知识基础', icon: '📚', iconBg: 'var(--info-soft)', iconColor: 'var(--info)', score: kmAvg, desc: `掌握 ${Object.keys(km).length} 个知识点`, tags: Object.keys(km).slice(0, 4), details: Object.entries(km).slice(0, 5).map(([label, val]) => ({ label, val })) },
    { name: '认知风格', icon: '🧠', iconBg: 'var(--success-soft)', iconColor: 'var(--success)', score: lsAvg, desc: '学习风格综合评估', tags: ['视觉型', '原理优先', '代码驱动', '归纳推理'], details: [{ label: '视觉偏好', val: ls.visual }, { label: '抽象思维', val: ls.textual }, { label: '动手实践', val: ls.auditory }, { label: '记忆风格', val: ls.kinesthetic }] },
    { name: '学习目标', icon: '🎯', iconBg: 'var(--warm-soft)', iconColor: 'var(--warm)', score: clAvg, desc: '认知水平综合评估', tags: ['课程目标', '理解应用', '分析能力', '记忆能力'], details: [{ label: '记忆', val: cl.memory }, { label: '理解', val: cl.understand }, { label: '应用', val: cl.apply }, { label: '分析', val: cl.analyze }] },
    { name: '易错点', icon: '⚠️', iconBg: 'var(--danger-soft)', iconColor: 'var(--danger)', score: weakScore, desc: '薄弱环节识别', tags: d.weak_topics?.slice(0, 4) || [], details: Object.entries(km).sort((a, b) => a[1] - b[1]).slice(0, 5).map(([label, val]) => ({ label, val })) },
    { name: '学习节奏', icon: '⏱️', iconBg: 'var(--info-soft)', iconColor: 'var(--info)', score: paceScore, desc: `日均 ${daily}h，专注 ${d.learning_pace?.focus_duration || 0}min`, tags: ['晚间高效', `${daily}h/天`, `${d.learning_pace?.focus_duration || 0}min 专注`, '间歇学习'], details: [{ label: '日均时长', val: paceScore }, { label: '专注时长', val: d.learning_pace?.focus_duration || 0 }, { label: '连续天数', val: Math.min(60, Math.round((d.learning_pace?.focus_duration || 0) * 1.2)) }, { label: '效率指数', val: paceScore }, { label: '休息频率', val: Math.round(100 - paceScore * 0.4) }] },
    { name: '兴趣方向', icon: '💡', iconBg: 'var(--success-soft)', iconColor: 'var(--success)', score: intAvg, desc: '兴趣方向综合评估', tags: Object.keys(interest).slice(0, 4), details: Object.entries(interest).slice(0, 5).map(([label, val]) => ({ label, val })) },
  ]
}

// ═══ RADAR CHART COMPONENT ═══
function RadarChart({ dims }: { dims: { name: string; score: number }[] }) {
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (!svgRef.current) return
    const svg = svgRef.current
    const cx = 150, cy = 150, R = 120
    const n = dims.length
    const labels = dims.map((d) => d.name)
    const values = dims.map((d) => d.score / 100)
    const angleStep = (Math.PI * 2) / n
    const startAngle = -Math.PI / 2

    let html = ''

    // Grid rings
    for (let r = 1; r <= 4; r++) {
      const rr = R * (r / 4)
      let pts = ''
      for (let i = 0; i < n; i++) {
        const a = startAngle + i * angleStep
        const x = cx + rr * Math.cos(a)
        const y = cy + rr * Math.sin(a)
        pts += `${x},${y} `
      }
      html += `<polygon points="${pts}" fill="none" stroke="var(--line)" stroke-width="1"/>`
    }

    // Axes
    for (let i = 0; i < n; i++) {
      const a = startAngle + i * angleStep
      const x = cx + R * Math.cos(a)
      const y = cy + R * Math.sin(a)
      html += `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="var(--line)" stroke-width="1"/>`
    }

    // Data polygon
    let dataPts = ''
    for (let i = 0; i < n; i++) {
      const a = startAngle + i * angleStep
      const rr = R * values[i]
      const x = cx + rr * Math.cos(a)
      const y = cy + rr * Math.sin(a)
      dataPts += `${x},${y} `
    }
    html += `<polygon points="${dataPts}" fill="rgba(196,122,58,0.12)" stroke="var(--warm)" stroke-width="2" stroke-linejoin="round"/>`

    // Data dots
    for (let i = 0; i < n; i++) {
      const a = startAngle + i * angleStep
      const rr = R * values[i]
      const x = cx + rr * Math.cos(a)
      const y = cy + rr * Math.sin(a)
      html += `<circle cx="${x}" cy="${y}" r="4" fill="var(--warm)" stroke="var(--surface)" stroke-width="2"/>`
    }

    // Labels
    for (let i = 0; i < n; i++) {
      const a = startAngle + i * angleStep
      const lr = R + 24
      let x = cx + lr * Math.cos(a)
      let y = cy + lr * Math.sin(a)
      let anchor = 'middle'
      let dy = '.35em'
      if (Math.cos(a) > 0.3) anchor = 'start'
      else if (Math.cos(a) < -0.3) anchor = 'end'
      if (Math.sin(a) < -0.5) dy = '1em'
      else if (Math.sin(a) > 0.5) dy = '-.2em'
      html += `<text x="${x}" y="${y}" text-anchor="${anchor}" dy="${dy}" font-family="Inter,sans-serif" font-size="11" fill="var(--ink-2)" font-weight="500">${labels[i]}</text>`

      // Score next to label
      const sr = R + 42
      let sx = cx + sr * Math.cos(a)
      let sy = cy + sr * Math.sin(a)
      const sc = getScoreClass(dims[i].score)
      const color = sc === 'high' ? 'var(--success)' : sc === 'mid' ? 'var(--warm)' : 'var(--danger)'
      html += `<text x="${sx}" y="${sy}" text-anchor="${anchor}" dy="${dy}" font-family="Newsreader,serif" font-size="12" fill="${color}" font-weight="600">${dims[i].score}</text>`
    }

    svg.innerHTML = html
  }, [])

  return (
    <div className="radar-wrap">
      <svg ref={svgRef} width="300" height="300" viewBox="0 0 300 300" />
    </div>
  )
}

// ═══ MAIN PAGE ═══
export default function ProfilePage() {
  const [openDims, setOpenDims] = useState<Set<number>>(new Set())
  const [showHistory, setShowHistory] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [qStep, setQStep] = useState(0)
  const [selectedOpt, setSelectedOpt] = useState<number | null>(null)
  const [sliderVal, setSliderVal] = useState(2.5)
  const [textInput, setTextInput] = useState('')
  const [animatedBars, setAnimatedBars] = useState(false)
  const [showAiModal, setShowAiModal] = useState(false)
  const [realProfile, setRealProfile] = useState<StudentProfile | null>(null)
  const [profileLoading, setProfileLoading] = useState(false)
  const [qAnswers, setQAnswers] = useState<(string | number)[]>([])

  // Animate knowledge bars on mount
  useEffect(() => {
    const timer = setTimeout(() => setAnimatedBars(true), 100)
    return () => clearTimeout(timer)
  }, [])

  // 加载真实画像（mount 时）
  useEffect(() => {
    const sid = getStudentId()
    profileApi.get(sid)
      .then((p) => setRealProfile(p))
      .catch(() => {})
  }, [])

  const toggleDim = (i: number) => {
    const next = new Set(openDims)
    if (next.has(i)) next.delete(i)
    else next.add(i)
    setOpenDims(next)
  }

  const expandAll = () => {
    if (openDims.size === derivedDimensions.length) {
      setOpenDims(new Set())
    } else {
      setOpenDims(new Set(derivedDimensions.map((_, i) => i)))
    }
  }

  const qNav = async (dir: number) => {
    if (dir > 0 && qStep === questions.length - 1) {
      setShowModal(false)
      setProfileLoading(true)
      try {
        const msg = qAnswers.filter(Boolean).map((a) => ({ role: 'user' as const, content: String(a) }))
        const result = await profileApi.build(getStudentId(), msg)
        setRealProfile(result)
        alert('✅ 画像问卷已提交！')
      } catch (e: any) {
        alert('❌ 提交失败: ' + e.message)
      } finally {
        setProfileLoading(false)
      }
      return
    }
    setQStep(Math.max(0, Math.min(questions.length - 1, qStep + dir)))
    setSelectedOpt(null)
  }

  const recordAnswer = (val: string | number) => {
    setQAnswers((prev) => { const n = [...prev]; n[qStep] = val; return n })
  }

  const displayKnowledge = realProfile?.dimensions?.knowledge_mastery
    ? Object.entries(realProfile.dimensions.knowledge_mastery).map(([name, score]) => ({ name, score, topic: '—', sessions: 0 }))
    : knowledgeData
  const sortedKnowledge = [...displayKnowledge].sort((a, b) => a.score - b.score)
  const derivedWeakness = deriveWeakness(realProfile)
  const derivedDimensions = deriveSixDimensions(realProfile)

  // 从真实画像计算雷达图维度
  const radarDims = realProfile?.dimensions
    ? [
        { name: '知识基础', score: Math.round(Object.values(realProfile.dimensions.knowledge_mastery || {}).reduce((a, b) => a + b, 0) / Math.max(Object.keys(realProfile.dimensions.knowledge_mastery || {}).length, 1)) },
        { name: '学习风格', score: Math.round(Object.values(realProfile.dimensions.learning_style || {}).reduce((a, b) => a + b, 0) / 4) },
        { name: '认知水平', score: Math.round(Object.values(realProfile.dimensions.cognitive_level || {}).reduce((a, b) => a + b, 0) / 4) },
        { name: '兴趣方向', score: Math.round(Object.values(realProfile.dimensions.interest || {}).reduce((a, b) => a + b, 0) / Math.max(Object.keys(realProfile.dimensions.interest || {}).length, 1)) },
      ]
    : fallbackDimensions.map((d) => ({ name: d.name, score: d.score }))
  const currentQ = questions[qStep]

  return (
    <>
      <div className="prof-layout">
        {/* ═══ LEFT: Radar + Meta ═══ */}
        <div className="radar-section">
          {/* Radar card */}
          <div className="card radar-card">
            <div className="card-hd">
              <h3>画像雷达</h3>
              <span className="tag tag-dark">{realProfile ? `v${realProfile.version}` : '--'}</span>
            </div>
            <div className="card-bd">
              <RadarChart dims={radarDims} />
            </div>
          </div>

          {/* Meta grid */}
          <div className="radar-meta">
            <div className="rm-item">
              <div className="rm-label">置信度</div>
              <div className="rm-val">{realProfile ? realProfile.completeness_score.toFixed(2) : '0.00'}</div>
            </div>
            <div className="rm-item">
              <div className="rm-label">版本</div>
              <div className="rm-val">{realProfile ? `v${realProfile.version}` : '--'}</div>
            </div>
            <div className="rm-item">
              <div className="rm-label">日均学习</div>
              <div className="rm-val">{realProfile?.dimensions?.learning_pace?.daily_hours || '--'}h</div>
            </div>
            <div className="rm-item">
              <div className="rm-label">专注时长</div>
              <div className="rm-val">{realProfile?.dimensions?.learning_pace?.focus_duration || '--'}min</div>
            </div>
          </div>

          {/* Completeness */}
          <div className="card comp-card">
            <div className="card-bd">
              <div className="comp-ring">
                <svg width="72" height="72" viewBox="0 0 72 72">
                  <circle cx="36" cy="36" r="30" fill="none" stroke="var(--bg-subtle)" strokeWidth="5" />
                  <circle
                    cx="36"
                    cy="36"
                    r="30"
                    fill="none"
                    stroke="var(--warm)"
                    strokeWidth="5"
                    strokeDasharray="188.5"
                    strokeDashoffset={188.5 - (188.5 * (realProfile?.completeness_score ?? 75)) / 100}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="comp-pct">
                  {Math.round(realProfile?.completeness_score ?? 75)}%
                  <small>完整</small>
                </div>
              </div>
              <div className="comp-info">
                <h4>画像完整度</h4>
                <p>
                  建议通过对话补充<strong>学习节奏</strong>和<strong>易错点</strong>维度信息，以获得更精准的个性化推荐。
                </p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="card action-card">
            <div className="card-bd">
              <div className="action-row">
                <button className="btn btn-solid" onClick={() => { setShowModal(true); setQStep(0) }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z" />
                  </svg>
                  问卷更新画像
                </button>
                <button className="btn" onClick={() => setShowAiModal(true)}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                  🤖 AI 对话式画像
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ═══ RIGHT: Details ═══ */}
        <div className="prof-right">
          {/* Knowledge mastery */}
          <div className="card">
            <div className="card-hd">
              <h3>知识点掌握度</h3>
              <div style={{ display: 'flex', gap: '8px' }}>
                <span className="tag tag-green">高 &gt;70%</span>
                <span className="tag tag-warm">中 30-70%</span>
                <span className="tag tag-danger">低 &lt;30%</span>
              </div>
            </div>
            <div className="card-bd">
              <div className="kb-scroll">
                {sortedKnowledge.map((k, i) => {
                  const c = getScoreClass(k.score)
                  return (
                    <div key={i} className="kb-item">
                      <div className="kb-top">
                        <span className="kb-name">{k.name}</span>
                        <span className={`kb-score sc-${c}`}>{k.score}%</span>
                      </div>
                      <div className="kb-bar">
                        <div
                          className={`kb-bar-fill bar-${c}`}
                          style={{ width: animatedBars ? `${k.score}%` : '0%' }}
                        />
                      </div>
                      <div className="kb-meta">
                        <span>{k.topic}</span>
                        <span>·</span>
                        <span>{k.sessions} 次学习</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Weakness */}
          <div className="card">
            <div className="card-hd">
              <h3>薄弱环节</h3>
              <span className="tag tag-danger">需要加强</span>
            </div>
            <div className="card-bd">
              <div className="weak-grid">
                {derivedWeakness.map((w, i) => {
                  const c = getScoreClass(w.score)
                  return (
                    <div key={i} className="weak-item">
                      <div className="weak-dot" style={{ background: `var(--${w.level})` }} />
                      <div className="weak-info">
                        <div className="wk-name">{w.name}</div>
                        <div className="wk-detail">{w.detail}</div>
                      </div>
                      <div className={`weak-score sc-${c}`}>{w.score}%</div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* 6 Dimension details */}
          <div className="card dim-card">
            <div className="card-hd">
              <h3>六维详情</h3>
              <button className="btn btn-ghost" onClick={expandAll}>
                全部展开
              </button>
            </div>
            <div className="card-bd">
              {derivedDimensions.map((d, i) => {
                const isOpen = openDims.has(i)
                return (
                  <div key={i} className="dim-section">
                    <div className="dim-header" onClick={() => toggleDim(i)}>
                      <div className="dh-left">
                        <div className="dh-icon" style={{ background: d.iconBg, color: d.iconColor }}>
                          {d.icon}
                        </div>
                        <div>
                          <h4>{d.name}</h4>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span className={`dh-score sc-${getScoreClass(d.score)}`}>{d.score}</span>
                        <div className={`dh-toggle${isOpen ? ' open' : ''}`}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="6 9 12 15 18 9" />
                          </svg>
                        </div>
                      </div>
                    </div>
                    <div className={`dim-body${isOpen ? ' open' : ''}`}>
                      <p>{d.desc}</p>
                      <div className="dim-tags">
                        {d.tags.map((t, j) => (
                          <span key={j}>{t}</span>
                        ))}
                      </div>
                      <div style={{ marginTop: '12px' }}>
                        {d.details.map((dd, j) => {
                          const dc = getScoreClass(dd.val)
                          return (
                            <div key={j} className="dim-bar-row">
                              <span className="dbr-label">{dd.label}</span>
                              <div className="dbr-track">
                                <div className={`dbr-fill bar-${dc}`} style={{ width: `${dd.val}%` }} />
                              </div>
                              <span className={`dbr-val sc-${dc}`}>{dd.val}%</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Update history */}
          {showHistory && (
            <div className="card" style={{ animation: 'emerge .35s var(--ease)' }}>
              <div className="card-hd">
                <h3>更新历史</h3>
                <span className="tag tag-dark">最近 5 条</span>
              </div>
              <div className="card-bd">
                {historyData.map((h, i) => (
                  <div key={i} className="hist-item">
                    <div className="hist-dot-wrap">
                      <div className="hist-dot" style={{ background: h.dot }} />
                      {i < historyData.length - 1 && <div className="hist-line" />}
                    </div>
                    <div className="hist-body">
                      <div className="hb-time">{h.time}</div>
                      <div className="hb-text">{h.text}</div>
                      <div className="hb-changes">
                        {h.changes.map((c, j) => (
                          <span key={j}>{c}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ═══ QUESTIONNAIRE MODAL ═══ */}
      {showModal && (
        <div className="modal-overlay show" onClick={(e) => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <div className="modal-hd">
              <h3>
                画像问卷 · 第 <span>{qStep + 1}</span> 步 / 共 {questions.length} 步
              </h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className="modal-bd">
              <div className="q-block">
                <div className="q-label">
                  <span className="q-num">{qStep + 1}</span>
                  {currentQ.title}
                </div>
                {currentQ.type === 'single' && (
                  <div className="q-options">
                    {currentQ.options!.map((o, i) => (
                      <div
                        key={i}
                        className={`q-opt${selectedOpt === i ? ' selected' : ''}`}
                        onClick={() => { setSelectedOpt(i); recordAnswer(o) }}
                      >
                        <div className="q-radio" />
                        <span>{o}</span>
                      </div>
                    ))}
                  </div>
                )}
                {currentQ.type === 'slider' && (
                  <div className="q-slider-wrap">
                    <div className="q-slider-val">
                      {sliderVal} {currentQ.unit}
                    </div>
                    <input
                      type="range"
                      className="q-slider"
                      min={currentQ.min}
                      max={currentQ.max}
                      step={currentQ.step}
                      value={sliderVal}
                      onChange={(e) => { const v = Number(e.target.value); setSliderVal(v); recordAnswer(v) }}
                    />
                    <div className="q-slider-labels">
                      <span>
                        {currentQ.min} {currentQ.unit}
                      </span>
                      <span>
                        {currentQ.max} {currentQ.unit}
                      </span>
                    </div>
                  </div>
                )}
                {currentQ.type === 'text' && (
                  <input
                    type="text"
                    className="q-input"
                    placeholder={currentQ.placeholder}
                    value={textInput}
                    onChange={(e) => { setTextInput(e.target.value); recordAnswer(e.target.value) }}
                  />
                )}
              </div>
            </div>
            <div className="modal-ft">
              <div className="step-dots">
                {questions.map((_, i) => (
                  <div
                    key={i}
                    className={`step-dot${i === qStep ? ' active' : i < qStep ? ' done' : ''}`}
                  />
                ))}
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                {qStep > 0 && (
                  <button className="btn" onClick={() => qNav(-1)}>
                    上一步
                  </button>
                )}
                <button className="btn btn-solid" onClick={() => qNav(1)} disabled={profileLoading}>
                  {profileLoading ? '提交中...' : qStep === questions.length - 1 ? '提交' : '下一步'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showAiModal && (
        <ChatModal
          onClose={() => setShowAiModal(false)}
          onProfile={(p) => {
            setRealProfile(p)
            setShowAiModal(false)
            alert(`✅ 画像已更新 v${p.version} (完整度 ${p.completeness_score.toFixed(0)}%)\n刷新页面查看最新数据`)
          }}
        />
      )}
    </>
  )
}
