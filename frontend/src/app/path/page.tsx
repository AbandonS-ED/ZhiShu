'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { pathApi, evaluationApi, type PathNode as ApiPathNode, type PathEdge as ApiPathEdge } from '@/lib/api'
import { getStudentId } from '@/lib/student'
import { usePageTimer } from '@/hooks/usePageTimer'
import Icon from '@/components/Icon'

// ═══ TYPES ═══
interface PathNode extends ApiPathNode {}
interface PathEdge extends ApiPathEdge {}

interface DailyPlanItem {
  day: number
  topics: string[]
  duration_hours: number
  activities: string[]
}

interface PathData {
  path_id: string
  title: string
  description: string
  total_days: number
  nodes: PathNode[]
  edges: PathEdge[]
  daily_plan: DailyPlanItem[]
  created_at?: string
}

interface LayoutNode extends PathNode {
  x: number
  y: number
}

// ═══ HELPERS ═══
function getDiffLabel(d: number) {
  if (d < 40) return '初级'
  if (d < 70) return '中级'
  return '高级'
}

function getDiffClass(d: number) {
  if (d < 40) return 'easy'
  if (d < 70) return 'med'
  return 'hard'
}

function getNodeStatus(d: number): 'done' | 'active' | 'weak' | 'todo' {
  if (d < 30) return 'done'
  if (d < 60) return 'active'
  if (d < 80) return 'weak'
  return 'todo'
}

function getStatusLabel(status: string) {
  return status === 'done' ? '已完成' : status === 'active' ? '进行中' : status === 'weak' ? '薄弱' : '待学习'
}

function getStatusColor(status: string) {
  return status === 'done' ? 'var(--success)' : status === 'active' ? 'var(--warm)' : status === 'weak' ? 'var(--danger)' : 'var(--ink-4)'
}

// ═══ MAIN PAGE ═══
export default function PathPage() {
  const [paths, setPaths] = useState<PathData[]>([])
  const [currentPath, setCurrentPath] = useState<PathData | null>(null)
  const [selectedNode, setSelectedNode] = useState<string | null>(null)
  const graphRef = useRef<HTMLDivElement>(null)
  const [genInput, setGenInput] = useState('')
  const [genDays, setGenDays] = useState(14)
  const [genDailyTopics, setGenDailyTopics] = useState(3)
  const [generating, setGenerating] = useState(false)
  const [genResult, setGenResult] = useState('')
  const [genResultType, setGenResultType] = useState<'success' | 'error' | ''>('')
  const [loading, setLoading] = useState(true)

  // 记录页面停留时间
  usePageTimer('path')

  // 消息队列
  const msgQueueRef = useRef<string[]>([])
  const msgTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 加载计划列表
  const loadPaths = useCallback(async () => {
    try {
      setLoading(true)
      const data = await pathApi.list(getStudentId())
      setPaths(data as PathData[])
      if (data.length > 0 && !currentPath) {
        await loadPathDetail(data[0].path_id)
      }
    } catch {
      // 静默失败
    } finally {
      setLoading(false)
    }
  }, [])

  // 加载计划详情
  const loadPathDetail = async (pathId: string) => {
    try {
      const data = await pathApi.get(getStudentId(), pathId)
      setCurrentPath(data as PathData)
      setSelectedNode(null)
    } catch {
      // 静默失败
    }
  }

  // 删除计划
  const deletePath = async (pathId: string) => {
    if (!confirm('确定要删除这个学习计划吗？')) return
    try {
      await pathApi.delete(getStudentId(), pathId)
      if (currentPath?.path_id === pathId) {
        setCurrentPath(null)
      }
      await loadPaths()
    } catch {
      // 静默失败
    }
  }

  useEffect(() => {
    loadPaths()
  }, [loadPaths])

  // 处理消息队列
  const processMsgQueue = useCallback(() => {
    if (msgTimerRef.current) return
    const queue = msgQueueRef.current
    if (queue.length === 0) return
    const msg = queue.shift()!
    setGenResult(msg)
    if (queue.length > 0) {
      msgTimerRef.current = setTimeout(() => {
        msgTimerRef.current = null
        processMsgQueue()
      }, 2500)
    }
  }, [])

  const clearMsgQueue = useCallback(() => {
    msgQueueRef.current = []
    if (msgTimerRef.current) {
      clearTimeout(msgTimerRef.current)
      msgTimerRef.current = null
    }
  }, [])

  // 生成计划
  const generatePath = () => {
    if (!genInput.trim() || generating) return
    setGenerating(true)
    setGenResult('正在生成学习计划...'); setGenResultType('')
    clearMsgQueue()

    const topics = genInput.split(/[,，、\s]+/).filter(Boolean)
    pathApi.generateStream(
      getStudentId(),
      topics,
      (e) => {
        if (e.type === 'progress' && e.message) {
          msgQueueRef.current.push(e.message)
          processMsgQueue()
        }
        if (e.type === 'result' && e.data) {
          clearMsgQueue()
          const data = e.data as PathData
          setGenResult(`已生成「${data.title || ''}」\n共 ${data.total_days || 0} 天，${data.nodes?.length || 0} 个知识点`)
          setGenResultType('success')
          loadPaths()
          evaluationApi.recordAction({
            student_id: getStudentId(),
            action: 'generate',
            detail: { total_days: data.total_days, topics },
          }).catch(() => {})
        }
        if (e.type === 'error') {
          clearMsgQueue()
          setGenResult(e.message || '调用失败')
          setGenResultType('error')
        }
        if (e.type === 'done') {
          setTimeout(() => clearMsgQueue(), 3000)
        }
        if (e.type === 'done' || e.type === 'error') {
          setGenerating(false)
        }
      },
      genDays,
      genDailyTopics
    )
  }

  // 根据知识点数量自动估算天数
  const estimateDays = (input: string) => {
    const count = input.split(/[,，、\s]+/).filter(s => s.trim()).length
    const days = Math.ceil(count / genDailyTopics)
    if (days <= 7) return 7
    if (days <= 14) return 14
    if (days <= 21) return 21
    return 30
  }

  // 计算布局
  const calculateLayout = (nodes: PathNode[], edges: PathEdge[]): LayoutNode[] => {
    if (nodes.length === 0) return []

    const adj: Record<string, string[]> = {}
    const inDegree: Record<string, number> = {}
    nodes.forEach(n => { adj[n.id] = []; inDegree[n.id] = 0 })
    edges.forEach(e => { adj[e.source]?.push(e.target); inDegree[e.target] = (inDegree[e.target] || 0) + 1 })

    const levels: string[][] = []
    const queue = Object.keys(inDegree).filter(k => inDegree[k] === 0)
    while (queue.length > 0) {
      levels.push([...queue])
      const next: string[] = []
      queue.forEach(id => { adj[id]?.forEach(t => { inDegree[t]--; if (inDegree[t] === 0) next.push(t) }) })
      queue.length = 0; queue.push(...next)
    }

    const nodeMap: Record<string, LayoutNode> = {}
    levels.forEach((level, li) => {
      level.forEach((id, ni) => {
        const node = nodes.find(n => n.id === id)
        if (node) nodeMap[id] = { ...node, x: 40 + li * 240, y: 30 + ni * 120 }
      })
    })
    return Object.values(nodeMap)
  }

  const layoutNodes = calculateLayout(currentPath?.nodes || [], currentPath?.edges || [])
  const layoutEdges = (currentPath?.edges || []).map(e => ({ from: e.source, to: e.target }))
  const dailyPlan = currentPath?.daily_plan || []

  const done = layoutNodes.filter(n => getNodeStatus(n.difficulty) === 'done').length
  const active = layoutNodes.filter(n => getNodeStatus(n.difficulty) === 'active').length
  const weak = layoutNodes.filter(n => getNodeStatus(n.difficulty) === 'weak').length
  const total = layoutNodes.length
  const pct = total > 0 ? Math.round((done / total) * 100) : 0
  const totalHrs = layoutNodes.reduce((s, n) => s + (n.estimated_hours || 2), 0)

  const selectedData = selectedNode ? layoutNodes.find(n => n.id === selectedNode) : null

  useEffect(() => {
    if (!graphRef.current || layoutNodes.length === 0) return
    const maxX = Math.max(...layoutNodes.map(n => n.x)) + 220
    const maxY = Math.max(...layoutNodes.map(n => n.y)) + 80
    graphRef.current.style.width = `${maxX}px`
    graphRef.current.style.height = `${maxY}px`
  }, [layoutNodes])

  if (loading) {
    return (
      <div style={{ padding: '12px 0' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16 }}>
          <div className="skeleton" style={{ width: 120, height: 36, borderRadius: 8 }} />
          <div className="skeleton" style={{ width: 80, height: 36, borderRadius: 8 }} />
        </div>
        <div className="skeleton-card">
          <div className="skeleton skeleton-line w60" style={{ height: 18 }} />
          <div className="skeleton skeleton-line w100" />
          <div className="skeleton skeleton-line w80" />
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="skeleton" style={{ width: 100, height: 80, borderRadius: 8 }} />
            ))}
          </div>
        </div>
        <div className="skeleton-card" style={{ marginTop: 12 }}>
          <div className="skeleton skeleton-line w40" style={{ height: 18 }} />
          <div className="skeleton skeleton-line w100" />
          <div className="skeleton skeleton-line w60" />
        </div>
      </div>
    )
  }

  return (
    <>
      {/* 计划选择 + AI 生成面板 */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '12px 0', padding: 12, background: 'var(--brand-soft)', borderRadius: 8 }}>
        {paths.length > 0 && (
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <select
              value={currentPath?.path_id || ''}
              onChange={(e) => loadPathDetail(e.target.value)}
              style={{ padding: '6px 12px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)', fontSize: 13 }}
            >
              {paths.map(p => (
                <option key={p.path_id} value={p.path_id}>{p.title.replace(/\s*\d+天.*$/, '').replace(/学习路径|学习计划/g, '').trim() || p.title}</option>
              ))}
            </select>
            {currentPath && (
              <button onClick={() => deletePath(currentPath.path_id)} style={{ padding: '6px 10px', background: 'transparent', border: '1px solid var(--danger)', color: 'var(--danger)', borderRadius: 6, cursor: 'pointer', fontSize: 12 }} title="删除计划">
                <Icon name="trash" size={16} />
              </button>
            )}
          </div>
        )}
        <input
          value={genInput}
          onChange={e => {
            setGenInput(e.target.value)
            // 自动估算天数
            if (e.target.value.trim()) {
              setGenDays(estimateDays(e.target.value))
            }
          }}
          onKeyDown={e => e.key === 'Enter' && generatePath()}
          placeholder="输入知识点（逗号分隔）"
          disabled={generating}
          style={{ flex: 1, padding: '6px 12px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)', fontSize: 13 }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '0 8px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6 }}>
          <span style={{ fontSize: 12, color: 'var(--ink-4)' }}>天数:</span>
          <select
            value={genDays}
            onChange={e => setGenDays(Number(e.target.value))}
            disabled={generating}
            style={{ border: 'none', background: 'transparent', fontSize: 13, cursor: 'pointer', outline: 'none' }}
          >
            <option value={7}>7天</option>
            <option value={14}>14天</option>
            <option value={21}>21天</option>
            <option value={30}>30天</option>
          </select>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '0 8px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6 }}>
          <span style={{ fontSize: 12, color: 'var(--ink-4)' }}>每天:</span>
          <select
            value={genDailyTopics}
            onChange={e => setGenDailyTopics(Number(e.target.value))}
            disabled={generating}
            style={{ border: 'none', background: 'transparent', fontSize: 13, cursor: 'pointer', outline: 'none' }}
          >
            <option value={2}>2个</option>
            <option value={3}>3个</option>
            <option value={5}>5个</option>
            <option value={8}>8个</option>
          </select>
          <span style={{ fontSize: 12, color: 'var(--ink-4)' }}>知识点</span>
        </div>
        <button onClick={generatePath} disabled={generating || !genInput.trim()} style={{ padding: '6px 16px', background: 'var(--brand)', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', whiteSpace: 'nowrap', fontSize: 13 }}>
          {generating ? '生成中...' : '生成计划'}
        </button>
        {currentPath && (
          <button onClick={() => { setCurrentPath(null); setSelectedNode(null) }} style={{ padding: '6px 12px', background: 'transparent', border: '1px solid var(--border)', color: 'var(--ink-3)', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>
            重置
          </button>
        )}
      </div>
      {genResult && (
        generating ? (
          <div className="gen-loading">
            <div className="gen-spinner" />
            <span>{genResult}</span>
          </div>
        ) : (
          <div style={{ padding: '12px 16px', background: genResultType === 'success' ? 'var(--success-soft)' : genResultType === 'error' ? 'var(--danger-soft)' : 'var(--surface)', border: `1px solid ${genResultType === 'success' ? 'var(--success)' : genResultType === 'error' ? 'var(--danger)' : 'var(--border)'}`, borderRadius: 8, marginBottom: 12, fontSize: 13, whiteSpace: 'pre-wrap', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <span style={{ fontSize: 16, flexShrink: 0 }}>
              {genResultType === 'success' ? <Icon name="check" size={16} className="inline-icon" /> : genResultType === 'error' ? <Icon name="close" size={16} className="inline-icon" /> : <Icon name="clock" size={16} className="inline-icon" />}
            </span>
            <span>{genResult}</span>
          </div>
        )
      )}

      {/* 计划描述 */}
      {currentPath?.description && (
        <div style={{ padding: '10px 14px', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, marginBottom: 12, fontSize: 13, color: 'var(--ink-2)' }}>
          <span style={{ fontWeight: 500, color: 'var(--ink)' }}><Icon name="clipboard" size={16} /> {currentPath.title}</span>
          <span style={{ margin: '0 8px', color: 'var(--ink-4)' }}>·</span>
          <span>{currentPath.description}</span>
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
          <div className="ov-label">进行中</div>
          <div className="ov-val" style={{ color: 'var(--warm)' }}>{active}</div>
          <div className="ov-sub">薄弱 {weak} 项</div>
        </div>
        <div className="ov-item">
          <div className="ov-label">预计时长</div>
          <div className="ov-val">{totalHrs}h</div>
          <div className="ov-sub">共 {currentPath?.total_days || 0} 天</div>
        </div>
      </div>

      {/* Main layout */}
      <div className="path-layout" style={{ marginTop: '14px' }}>
        {/* Left: Graph */}
        <div className="path-left">
          <div className="card graph-card">
            <div className="card-hd">
              <h3>学习计划图</h3>
              <div className="legend">
                <div className="legend-item"><div className="legend-dot" style={{ background: 'var(--success)' }} />已完成</div>
                <div className="legend-item"><div className="legend-dot" style={{ background: 'var(--warm)' }} />进行中</div>
                <div className="legend-item"><div className="legend-dot" style={{ background: 'var(--danger)' }} />薄弱</div>
                <div className="legend-item"><div className="legend-dot" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--line)' }} />待学习</div>
              </div>
            </div>
            <div className="card-bd" id="graphArea">
              {layoutNodes.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--ink-4)' }}>
                  <div style={{ marginBottom: '12px' }}><Icon name="book" size={32} /></div>
                  <div style={{ fontSize: '14px', fontWeight: 500 }}>暂无学习计划</div>
                  <div style={{ fontSize: '12px', marginTop: '4px', marginBottom: '16px' }}>输入知识点生成计划，或在对话页说&quot;生成XX学习路径&quot;</div>
                  <button onClick={() => {
                    setGenInput('机器学习,深度学习,CNN,RNN,Transformer')
                    setTimeout(() => generatePath(), 100)
                  }} style={{ padding: '8px 16px', background: 'var(--brand)', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>
                    一键生成示例计划
                  </button>
                </div>
              ) : (
                <div className="graph-container" ref={graphRef}>
                  <svg className="graph-edges" width={Math.max(...layoutNodes.map(n => n.x)) + 220} height={Math.max(...layoutNodes.map(n => n.y)) + 80}>
                    {layoutEdges.map((e, i) => {
                      const from = layoutNodes.find(n => n.id === e.from)
                      const to = layoutNodes.find(n => n.id === e.to)
                      if (!from || !to) return null
                      const x1 = from.x + 90, y1 = from.y + 30
                      const x2 = to.x + 90, y2 = to.y + 30
                      const status = getNodeStatus(from.difficulty)
                      const cls = status === 'done' ? 'done' : status === 'active' ? 'active' : 'todo'
                      const dx = x2 - x1
                      const cx1 = x1 + dx * 0.4, cy1 = y1
                      const cx2 = x2 - dx * 0.4, cy2 = y2
                      return (
                        <path key={i} d={`M${x1},${y1} C${cx1},${cy1} ${cx2},${cy2} ${x2},${y2}`} fill="none" className={cls} strokeWidth={cls === 'todo' ? 1 : 1.5} stroke={getStatusColor(cls)} opacity={cls === 'todo' ? 0.15 : 0.35} strokeDasharray={cls === 'todo' ? '4 4' : undefined} />
                      )
                    })}
                  </svg>
                  {layoutNodes.map((n, i) => {
                    const st = getNodeStatus(n.difficulty)
                    return (
                      <div key={n.id} className={`g-node${selectedNode === n.id ? ' selected' : ''}`} style={{ left: `${n.x}px`, top: `${n.y}px`, animation: `cardIn .4s var(--ease) ${i * 0.04}s forwards`, opacity: 0 }} onClick={() => setSelectedNode(n.id)}>
                        <div className={`gn-dot ${st}`}>{st === 'done' ? '✓' : st === 'active' ? '►' : st === 'weak' ? '!' : i + 1}</div>
                        <div className="gn-body">
                          <h4>{n.label}</h4>
                          <div className="gn-meta">
                            <span className={`diff-${getDiffClass(n.difficulty)}`}>{getDiffLabel(n.difficulty)}</span>
                            <span>{n.estimated_hours || 2}h</span>
                          </div>
                          <div className={`gn-status st-${st}`}>{getStatusLabel(st)}</div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: Detail + Plan */}
        <div className="path-right">
          {selectedData ? (
            <div className="detail-panel" style={{ animation: 'emerge .3s var(--ease)' }}>
              <div className="dp-hd">
                <div className={`dp-icon ${getNodeStatus(selectedData.difficulty)}`} style={{ cursor: 'pointer' }} onClick={() => setSelectedNode(null)}>
                  {getNodeStatus(selectedData.difficulty) === 'done' ? '✓' : getNodeStatus(selectedData.difficulty) === 'active' ? '►' : '○'}
                </div>
                <div className="dp-text" style={{ flex: 1 }}>
                  <h3>{selectedData.label}</h3>
                  <p>{selectedData.type} · {getStatusLabel(getNodeStatus(selectedData.difficulty))}</p>
                </div>
                <span style={{ fontSize: 11, color: 'var(--ink-4)', cursor: 'pointer' }} onClick={() => setSelectedNode(null)}>✕</span>
              </div>
              <div className="dp-bd">
                <div className="dp-row"><span className="dp-label">难度</span><span className="dp-value"><strong className={`diff-${getDiffClass(selectedData.difficulty)}`}>{getDiffLabel(selectedData.difficulty)}</strong></span></div>
                <div className="dp-row"><span className="dp-label">预计时长</span><span className="dp-value">{selectedData.estimated_hours || 2} 小时</span></div>
                {(currentPath?.edges || []).filter(e => e.target === selectedData.id).length > 0 && (
                  <div className="dp-row">
                    <span className="dp-label">前置知识</span>
                    <div className="dp-prereq">
                      {(currentPath?.edges || [])
                        .filter(e => e.target === selectedData.id)
                        .map(e => {
                          const prereq = currentPath?.nodes?.find(n => n.id === e.source)
                          return <span key={e.source}>{prereq?.label || e.source}</span>
                        })}
                    </div>
                  </div>
                )}
                <div className="dp-row">
                  <span className="dp-label">关联资源</span>
                  <div className="dp-resources">
                    <button className="dp-res-btn" onClick={() => window.location.href = `/duihua?msg=讲解${selectedData.label}`}><Icon name="doc" size={16} /> 讲解</button>
                    <button className="dp-res-btn" onClick={() => window.location.href = `/duihua?msg=画${selectedData.label}思维导图`}><Icon name="map" size={16} /> 导图</button>
                    <button className="dp-res-btn" onClick={() => window.location.href = `/duihua?msg=出5道${selectedData.label}练习题`}><Icon name="edit" size={16} /> 练习</button>
                  </div>
                </div>
              </div>
              <div className="dp-actions">
                <button className="btn btn-solid" onClick={() => window.location.href = `/duihua?msg=讲解${selectedData.label}`}>开始学习</button>
              </div>
            </div>
          ) : (
            <div className="detail-panel">
              <div className="detail-placeholder">
                <div className="dp-icon"><Icon name="point" size={24} /></div>
                <p>点击计划图中的节点<br />查看知识点详情</p>
              </div>
            </div>
          )}

          {/* Daily plan */}
          <div className="card" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div className="card-hd">
              <h3>每日计划</h3>
              {dailyPlan.length > 5 && <span className="tag tag-warm">{dailyPlan.length} 天</span>}
            </div>
            <div className="card-bd" style={{ flex: 1, overflowY: 'auto' }}>
              {dailyPlan.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--ink-4)', fontSize: 12 }}>暂无每日计划</div>
              ) : (
                dailyPlan.map((d, i) => (
                  <div key={i} className="daily-item" style={{ opacity: i >= 5 ? 0.6 : 1 }}>
                    <div className="di-day">
                      <span>第 {d.day} 天</span>
                      <span className="di-hrs">{d.duration_hours}h</span>
                    </div>
                    {d.topics.slice(0, 3).map((t, j) => (
                      <div key={j} className="di-task">
                        <div className="di-dot" style={{ background: i === 0 ? 'var(--warm)' : 'var(--ink-4)' }} />
                        <span className="di-name">{t}</span>
                      </div>
                    ))}
                    {d.topics.length > 3 && (
                      <div style={{ fontSize: 11, color: 'var(--ink-4)', paddingLeft: 16 }}>+{d.topics.length - 3} 项</div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
