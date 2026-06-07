'use client'

import { useState, useRef, useEffect } from 'react'
import { pathApi } from '@/lib/api'
import { getStudentId } from '@/lib/student'

// ═══ TYPES ═══
interface Node {
  id: string
  name: string
  status: 'done' | 'active' | 'weak' | 'todo'
  diff: string
  hours: number
  category: string
  prereqs: string[]
  mastery: number
  x: number
  y: number
}

interface Edge {
  from: string
  to: string
}

interface Task {
  name: string
  time: string
  status: 'done' | 'active' | 'pending'
}

interface DayPlan {
  day: string
  total: string
  tasks: Task[]
}

// ═══ DATA ═══
const nodes: Node[] = [
  { id: 'ai_intro', name: '人工智能概述', status: 'done', diff: '初级', hours: 1.5, category: '基础', prereqs: [], mastery: 95, x: 40, y: 30 },
  { id: 'search', name: '搜索算法', status: 'done', diff: '中级', hours: 3.0, category: '核心', prereqs: ['ai_intro'], mastery: 85, x: 40, y: 140 },
  { id: 'kr', name: '知识表示', status: 'done', diff: '初级', hours: 2.0, category: '核心', prereqs: ['ai_intro'], mastery: 72, x: 280, y: 30 },
  { id: 'uncertain', name: '不确定性推理', status: 'done', diff: '中级', hours: 2.5, category: '核心', prereqs: ['kr'], mastery: 68, x: 280, y: 140 },
  { id: 'ml_basic', name: '机器学习基础', status: 'done', diff: '中级', hours: 3.5, category: '核心', prereqs: ['search'], mastery: 62, x: 40, y: 250 },
  { id: 'cnn', name: 'CNN 卷积网络', status: 'active', diff: '中级', hours: 3.0, category: '深度学习', prereqs: ['ml_basic'], mastery: 55, x: 40, y: 360 },
  { id: 'rnn', name: 'RNN 与 LSTM', status: 'weak', diff: '中级', hours: 2.5, category: '深度学习', prereqs: ['ml_basic'], mastery: 35, x: 280, y: 250 },
  { id: 'transformer', name: 'Transformer', status: 'active', diff: '高级', hours: 3.0, category: 'NLP', prereqs: ['rnn', 'ml_basic'], mastery: 48, x: 280, y: 360 },
  { id: 'rl', name: '强化学习', status: 'weak', diff: '高级', hours: 2.5, category: '强化学习', prereqs: ['ml_basic'], mastery: 22, x: 520, y: 30 },
  { id: 'nlp', name: '自然语言处理', status: 'todo', diff: '高级', hours: 3.0, category: 'NLP', prereqs: ['transformer', 'uncertain'], mastery: 0, x: 520, y: 140 },
  { id: 'cv', name: '计算机视觉', status: 'todo', diff: '高级', hours: 2.5, category: 'CV', prereqs: ['cnn'], mastery: 0, x: 520, y: 250 },
  { id: 'multi_agent', name: '多智能体系统', status: 'todo', diff: '高级', hours: 2.0, category: '高级', prereqs: ['rl', 'nlp'], mastery: 0, x: 520, y: 360 },
]

const edges: Edge[] = [
  { from: 'ai_intro', to: 'search' },
  { from: 'ai_intro', to: 'kr' },
  { from: 'kr', to: 'uncertain' },
  { from: 'search', to: 'ml_basic' },
  { from: 'ml_basic', to: 'cnn' },
  { from: 'ml_basic', to: 'rnn' },
  { from: 'ml_basic', to: 'rl' },
  { from: 'rnn', to: 'transformer' },
  { from: 'transformer', to: 'nlp' },
  { from: 'uncertain', to: 'nlp' },
  { from: 'cnn', to: 'cv' },
  { from: 'rl', to: 'multi_agent' },
  { from: 'nlp', to: 'multi_agent' },
]

const dailyPlan: DayPlan[] = [
  {
    day: '今天 · 6月6日 (周五)', total: '2.5h', tasks: [
      { name: 'Transformer 注意力机制', time: '1.5h', status: 'active' },
      { name: 'RNN 梯度问题复习', time: '1.0h', status: 'pending' },
    ],
  },
  {
    day: '明天 · 6月7日 (周六)', total: '3.0h', tasks: [
      { name: 'CNN 实战练习', time: '1.5h', status: 'pending' },
      { name: 'Transformer 代码实现', time: '1.5h', status: 'pending' },
    ],
  },
  {
    day: '后天 · 6月8日 (周日)', total: '2.5h', tasks: [
      { name: '强化学习 Q-Learning', time: '1.5h', status: 'pending' },
      { name: '机器学习复习测试', time: '1.0h', status: 'pending' },
    ],
  },
  {
    day: '周一 · 6月9日', total: '2.0h', tasks: [
      { name: 'NLP 基础概念', time: '1.0h', status: 'pending' },
      { name: '反向传播推导', time: '1.0h', status: 'pending' },
    ],
  },
  {
    day: '周二 · 6月10日', total: '2.5h', tasks: [
      { name: '计算机视觉概述', time: '1.0h', status: 'pending' },
      { name: 'RNN 与 LSTM 对比', time: '1.5h', status: 'pending' },
    ],
  },
]

// ═══ HELPERS ═══
function getDiffClass(diff: string) {
  return diff === '初级' ? 'easy' : diff === '中级' ? 'med' : 'hard'
}

function getStatusLabel(status: string) {
  return status === 'done' ? '已完成' : status === 'active' ? '进行中' : status === 'weak' ? '薄弱' : '待学习'
}

function getStatusColor(status: string) {
  return status === 'done' ? 'var(--success)' : status === 'active' ? 'var(--warm)' : status === 'weak' ? 'var(--danger)' : 'var(--ink-4)'
}

// ═══ MAIN PAGE ═══
export default function PathPage() {
  const [selectedNode, setSelectedNode] = useState<string | null>(null)
  const graphRef = useRef<HTMLDivElement>(null)
  const [genInput, setGenInput] = useState('线性回归,逻辑回归,神经网络,决策树,CNN,RNN')
  const [generating, setGenerating] = useState(false)
  const [genResult, setGenResult] = useState('')

  const generatePath = async () => {
    if (!genInput.trim() || generating) return
    setGenerating(true)
    setGenResult('正在生成学习路径...')
    try {
      const topics = genInput.split(/[,，、\s]+/).filter(Boolean)
      const r = await pathApi.generate(getStudentId(), topics, 14)
      setGenResult(`✅ 已生成「${r.title}」\n共 ${r.total_days} 天，${r.nodes.length} 个知识点，${r.edges.length} 条依赖关系\nID: ${r.path_id.slice(0, 8)}...`)
    } catch (e: any) {
      setGenResult(`❌ 生成失败: ${e.message}`)
    } finally {
      setGenerating(false)
    }
  }

  // Stats
  const done = nodes.filter((n) => n.status === 'done').length
  const active = nodes.filter((n) => n.status === 'active').length
  const weak = nodes.filter((n) => n.status === 'weak').length
  const total = nodes.length
  const pct = Math.round((done / total) * 100)
  const totalHrs = nodes.reduce((s, n) => s + n.hours, 0)
  const doneHrs = nodes.filter((n) => n.status === 'done').reduce((s, n) => s + n.hours, 0)

  // Selected node data
  const selectedData = selectedNode ? nodes.find((n) => n.id === selectedNode) : null

  // Render graph
  useEffect(() => {
    if (!graphRef.current) return
    const container = graphRef.current
    const maxX = Math.max(...nodes.map((n) => n.x)) + 220
    const maxY = Math.max(...nodes.map((n) => n.y)) + 80
    container.style.width = `${maxX}px`
    container.style.height = `${maxY}px`
  }, [selectedNode])

  return (
    <>
      {/* AI 生成面板 */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '12px 0', padding: 12, background: 'var(--brand-soft)', borderRadius: 8 }}>
        <span style={{ fontSize: 14, fontWeight: 600 }}>🤖 AI 生成路径：</span>
        <input
          value={genInput}
          onChange={e => setGenInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && generatePath()}
          placeholder="输入知识点（逗号分隔）"
          disabled={generating}
          style={{ flex: 1, padding: '6px 12px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)' }}
        />
        <button onClick={generatePath} disabled={generating || !genInput.trim()} style={{ padding: '6px 16px', background: 'var(--brand)', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', whiteSpace: 'nowrap' }}>
          {generating ? '生成中...' : '生成 14 天路径'}
        </button>
      </div>
      {genResult && (
        <div style={{ padding: 12, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, marginBottom: 12, fontSize: 13, whiteSpace: 'pre-wrap' }}>
          {genResult}
        </div>
      )}

      {/* Overview strip */}
      <div className="overview-strip">
        <div className="ov-item">
          <div className="ov-label">总体进度</div>
          <div className="ov-val">{pct}%</div>
          <div className="ov-sub">{done}/{total} 知识点</div>
          <div className="ov-bar"><div className="ov-bar-fill" style={{ width: `${pct}%`, background: 'var(--success)' }} /></div>
        </div>
        <div className="ov-item">
          <div className="ov-label">已投入</div>
          <div className="ov-val">{doneHrs}h</div>
          <div className="ov-sub">预计共 {totalHrs}h</div>
          <div className="ov-bar"><div className="ov-bar-fill" style={{ width: `${Math.round((doneHrs / totalHrs) * 100)}%`, background: 'var(--info)' }} /></div>
        </div>
        <div className="ov-item">
          <div className="ov-label">进行中</div>
          <div className="ov-val" style={{ color: 'var(--warm)' }}>{active}</div>
          <div className="ov-sub">薄弱 {weak} 项</div>
        </div>
        <div className="ov-item">
          <div className="ov-label">预计完成</div>
          <div className="ov-val">18天</div>
          <div className="ov-sub">按日均 2.4h 计算</div>
        </div>
      </div>

      {/* Main layout */}
      <div className="path-layout" style={{ marginTop: '14px' }}>
        {/* Left: Graph */}
        <div className="path-left">
          <div className="card graph-card">
            <div className="card-hd">
              <h3>路径图谱</h3>
              <div className="legend">
                <div className="legend-item"><div className="legend-dot" style={{ background: 'var(--success)' }} />已完成</div>
                <div className="legend-item"><div className="legend-dot" style={{ background: 'var(--warm)' }} />进行中</div>
                <div className="legend-item"><div className="legend-dot" style={{ background: 'var(--danger)' }} />薄弱</div>
                <div className="legend-item"><div className="legend-dot" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--line)' }} />待学习</div>
              </div>
            </div>
            <div className="card-bd" id="graphArea">
              <div className="graph-container" ref={graphRef}>
                {/* SVG edges */}
                <svg className="graph-edges" width={Math.max(...nodes.map((n) => n.x)) + 220} height={Math.max(...nodes.map((n) => n.y)) + 80}>
                  {edges.map((e, i) => {
                    const from = nodes.find((n) => n.id === e.from)!
                    const to = nodes.find((n) => n.id === e.to)!
                    const x1 = from.x + 90, y1 = from.y + 30
                    const x2 = to.x + 90, y2 = to.y + 30
                    const status = from.status === 'done' && to.status !== 'todo' ? to.status :
                      from.status === 'done' && to.status === 'todo' ? 'done' : 'todo'
                    const cls = status === 'done' ? 'done' : status === 'active' ? 'active' : 'todo'
                    const dx = x2 - x1, dy = y2 - y1
                    const cx1 = x1 + dx * 0.4, cy1 = y1
                    const cx2 = x2 - dx * 0.4, cy2 = y2

                    return (
                      <path
                        key={i}
                        d={`M${x1},${y1} C${cx1},${cy1} ${cx2},${cy2} ${x2},${y2}`}
                        fill="none"
                        className={cls}
                        strokeWidth={cls === 'todo' ? 1 : 1.5}
                        stroke={getStatusColor(status)}
                        opacity={cls === 'todo' ? 0.15 : 0.35}
                        strokeDasharray={cls === 'todo' ? '4 4' : undefined}
                      />
                    )
                  })}
                </svg>

                {/* Nodes */}
                {nodes.map((n, i) => {
                  const dc = getDiffClass(n.diff)
                  const statusLabel = getStatusLabel(n.status)
                  const stClass = n.status

                  return (
                    <div
                      key={n.id}
                      className={`g-node${selectedNode === n.id ? ' selected' : ''}`}
                      style={{
                        left: `${n.x}px`,
                        top: `${n.y}px`,
                        animation: `cardIn .4s var(--ease) ${i * 0.04}s forwards`,
                        opacity: 0,
                      }}
                      onClick={() => setSelectedNode(n.id)}
                    >
                      <div className={`gn-dot ${n.status}`}>
                        {n.status === 'done' ? '✓' : n.status === 'active' ? '►' : n.status === 'weak' ? '!' : i + 1}
                      </div>
                      <div className="gn-body">
                        <h4>{n.name}</h4>
                        <div className="gn-meta">
                          <span className={`diff-${dc}`}>{n.diff}</span>
                          <span>{n.hours}h</span>
                        </div>
                        <div className={`gn-status st-${stClass}`}>
                          {statusLabel}{n.mastery > 0 ? ` · ${n.mastery}%` : ''}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Right: Detail + Plan */}
        <div className="path-right">
          {/* Node detail */}
          {selectedData ? (
            <div className="detail-panel" style={{ animation: 'emerge .3s var(--ease)' }}>
              <div className="dp-hd">
                <div className={`dp-icon ${selectedData.status}`}>
                  {selectedData.status === 'done' ? '✓' : selectedData.status === 'active' ? '►' : selectedData.status === 'weak' ? '!' : '○'}
                </div>
                <div className="dp-text">
                  <h3>{selectedData.name}</h3>
                  <p>{selectedData.category} · {getStatusLabel(selectedData.status)}</p>
                </div>
                <span className={`tag tag-${selectedData.status === 'done' ? 'green' : selectedData.status === 'active' ? 'warm' : selectedData.status === 'weak' ? 'danger' : 'dark'}`}>
                  {getStatusLabel(selectedData.status)}
                </span>
              </div>
              <div className="dp-bd">
                <div className="dp-row">
                  <span className="dp-label">难度</span>
                  <span className="dp-value"><strong className={`diff-${getDiffClass(selectedData.diff)}`}>{selectedData.diff}</strong></span>
                </div>
                <div className="dp-row">
                  <span className="dp-label">预计时长</span>
                  <span className="dp-value">{selectedData.hours} 小时</span>
                </div>
                <div className="dp-row">
                  <span className="dp-label">掌握度</span>
                  <span className="dp-value">{selectedData.mastery > 0 ? `${selectedData.mastery}%` : '尚未学习'}</span>
                </div>
                {selectedData.mastery > 0 && (
                  <div className="dp-row">
                    <span className="dp-label">进度</span>
                    <span className="dp-value">
                      <div style={{ flex: 1, height: '4px', background: 'var(--bg-subtle)', borderRadius: '2px', overflow: 'hidden', margin: '0 8px' }}>
                        <div style={{
                          width: `${selectedData.mastery}%`,
                          height: '100%',
                          borderRadius: '2px',
                          background: selectedData.mastery >= 70 ? 'var(--success)' : selectedData.mastery >= 30 ? 'var(--warm)' : 'var(--danger)',
                        }} />
                      </div>
                      {selectedData.mastery}%
                    </span>
                  </div>
                )}
                {selectedData.prereqs.length > 0 && (
                  <div className="dp-row">
                    <span className="dp-label">前置知识</span>
                    <div className="dp-prereq">
                      {selectedData.prereqs.map((pid) => {
                        const prereq = nodes.find((n) => n.id === pid)
                        return <span key={pid}>{prereq?.name || pid}</span>
                      })}
                    </div>
                  </div>
                )}
                <div className="dp-row">
                  <span className="dp-label">关联资源</span>
                  <div className="dp-resources">
                    {[
                      { icon: '📄', label: '知识点讲解' },
                      { icon: '🗺️', label: '思维导图' },
                      { icon: '📝', label: '练习题' },
                      { icon: '💻', label: '代码示例' },
                    ].map((r) => (
                      <button key={r.label} className="dp-res-btn" onClick={() => alert(`查看 ${selectedData.name} 的${r.label}`)}>
                        {r.icon} {r.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="dp-actions">
                <button className="btn btn-solid" onClick={() => alert(`跳转到智能对话页，开始学习: ${selectedData.name}`)}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                  开始学习
                </button>
                <button className="btn" onClick={() => alert('已标记为稍后学习')}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                  稍后学习
                </button>
              </div>
            </div>
          ) : (
            <div className="detail-panel">
              <div className="detail-placeholder">
                <div className="dp-icon">👆</div>
                <p>点击路径图中的节点<br />查看知识点详情</p>
              </div>
            </div>
          )}

          {/* Daily plan */}
          <div className="card">
            <div className="card-hd">
              <h3>每日计划</h3>
              <span className="tag tag-warm">本周</span>
            </div>
            <div className="card-bd">
              {dailyPlan.map((d, i) => (
                <div key={i} className="daily-item">
                  <div className="di-day">
                    {d.day}
                    <span className="di-hrs">{d.total}</span>
                  </div>
                  {d.tasks.map((t, j) => (
                    <div key={j} className={`di-task${t.status === 'done' ? ' done-task' : ''}`}>
                      <div className="di-dot" style={{ background: getStatusColor(t.status) }} />
                      <span className="di-name">{t.name}</span>
                      <span className="di-time">{t.time}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
