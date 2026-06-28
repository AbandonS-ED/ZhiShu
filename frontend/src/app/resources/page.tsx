'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { resourceApi, evaluationApi } from '@/lib/api'
import { getStudentId } from '@/lib/student'
import { showToast } from '@/lib/utils'
import RobotIcon from '@/components/RobotIcon'
import { usePageTimer } from '@/hooks/usePageTimer'
import SmartInput from './components/SmartInput'
import RecFeed from './components/RecFeed'
import { useRecommendations } from './hooks/useRecommendations'

// ═══ TYPES ═══
// UI 视图模型（区别于 api.ts 的 API 类型，用于前端渲染）
type ResourceType = 'explanation' | 'mindmap' | 'exercise' | 'code' | 'audio'
type FilterType = 'all' | 'favorites' | ResourceType

interface ExerciseVM {
  q: string
  opts: string[]
  ans: number
  expl: string
}

interface ResourceVM {
  id: string
  type: ResourceType
  title: string
  kp: string
  desc: string
  diff: string
  verified: boolean
  time: string
  fav: boolean
  content?: string
  mindmap?: string
  code?: string
  duration?: string
  count?: number
  exTypes?: string[]
  exercises?: ExerciseVM[]
  rawData?: Record<string, unknown>
}

// ═══ ICONS ═══
const typeIcons: Record<ResourceType, { icon: string; bg: string; color: string }> = {
  explanation: { icon: '📄', bg: 'var(--info-soft)', color: 'var(--info)' },
  mindmap: { icon: '🗺️', bg: 'var(--success-soft)', color: 'var(--success)' },
  exercise: { icon: '📝', bg: 'var(--warm-soft)', color: 'var(--warm)' },
  code: { icon: '💻', bg: 'var(--accent-soft)', color: 'var(--ink-2)' },
  audio: { icon: '🎧', bg: 'var(--danger-soft)', color: 'var(--danger)' },
}
const typeLabels: Record<ResourceType, string> = {
  explanation: '知识点讲解', mindmap: '思维导图', exercise: '练习题', code: '代码示例', audio: '音频',
}

// ═══ HELPERS ═══
function esc(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function inferTypeFromContent(content: Record<string, unknown> | null, resourceType: string): ResourceType {
  if (!content) return 'explanation'

  if (resourceType === 'mindmap' || content.mermaid_code || content.mermaid) return 'mindmap'
  if (resourceType === 'exercise' || content.exercises) return 'exercise'
  if (resourceType === 'code' || content.code) return 'code'
  if (resourceType === 'audio' || content.audio_script) return 'audio'

  if (content.knowledge && !content.code) return 'explanation'
  if (content.code) return 'code'

  return 'explanation'
}

function extractContentFromApi(resource: {
  resource_id: string
  title: string
  resource_type: string
  knowledge_point: string
  content: Record<string, unknown>
  difficulty: number
  is_favorited: boolean
  created_at: string
}): ResourceVM {
  const content = resource.content || {}
  const type = inferTypeFromContent(content, resource.resource_type)

  let desc = ''
  if (content.knowledge) {
    desc = String(content.knowledge).slice(0, 150) + (String(content.knowledge).length > 150 ? '...' : '')
  } else if (content.mermaid_code || content.mermaid) {
    desc = `思维导图：${resource.knowledge_point}`
  } else if (content.exercises) {
    const exs = content.exercises as ExerciseVM[]
    desc = `${exs.length} 道练习题`
  } else if (content.code) {
    desc = String(content.code).slice(0, 100) + '...'
  } else if (content.audio_script) {
    desc = String(content.audio_script).slice(0, 100) + '...'
  } else {
    desc = resource.title
  }

  const result: ResourceVM = {
    id: resource.resource_id,
    type,
    title: resource.title || resource.knowledge_point,
    kp: resource.knowledge_point,
    desc,
    diff: getDifficultyLabel(resource.difficulty),
    verified: true,
    time: resource.created_at ? new Date(resource.created_at).toLocaleDateString('zh-CN') : '刚刚',
    fav: resource.is_favorited,
    rawData: content,
  }

  if (type === 'explanation') {
    const knowledge = String(content.knowledge || '')
    result.content = knowledge.replace(/\n/g, '<br>')
  } else if (type === 'mindmap') {
    result.mindmap = String(content.mermaid_code || content.mermaid || '')
  } else if (type === 'exercise') {
    const exercises = content.exercises as Array<Record<string, unknown>> || []
    result.exercises = exercises.map((ex) => ({
      q: String(ex.question || ''),
      opts: (ex.options as string[]) || [],
      ans: getAnswerIndex(ex),
      expl: String(ex.explanation || ''),
    }))
    result.count = exercises.length
    result.exTypes = Array.from(new Set(exercises.map((ex) => getExerciseTypeLabel(String(ex.type || '')))))
  } else if (type === 'code') {
    result.code = String(content.code || '')
  } else if (type === 'audio') {
    result.content = String(content.audio_script || '')
    result.duration = content.duration_minutes ? `${content.duration_minutes} 分钟` : '未知时长'
  }

  return result
}

function getDifficultyLabel(difficulty: number): string {
  if (difficulty < 40) return '初级'
  if (difficulty < 70) return '中级'
  return '高级'
}

function getExerciseTypeLabel(type: string): string {
  const map: Record<string, string> = {
    choice: '选择',
    judge: '判断',
    short_answer: '简答',
    coding: '编程',
  }
  return map[type] || type
}

function getAnswerIndex(ex: Record<string, unknown>): number {
  const answer = String(ex.answer || '')
  // 如果是 A/B/C/D 格式
  if (/^[A-D]$/.test(answer)) {
    return answer.charCodeAt(0) - 65
  }
  // 如果是数字
  const idx = parseInt(answer)
  if (!isNaN(idx) && idx >= 0 && idx <= 3) {
    return idx
  }
  return -1
}

// ═══ MAIN PAGE ═══
export default function ResourcesPage() {
  const [mainTab, setMainTab] = useState<'feed' | 'all'>('feed')
  const [filter, setFilter] = useState<FilterType>('all')
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [search, setSearch] = useState('')
  const [selectedRes, setSelectedRes] = useState<ResourceVM | null>(null)
  const [revealedAns, setRevealedAns] = useState<Set<string>>(new Set())
  const [audioBars, setAudioBars] = useState<number[]>([])
  const [detailAudioBars, setDetailAudioBars] = useState<number[]>([])
  const [generating, setGenerating] = useState(false)
  const [genResult, setGenResult] = useState<string>('')
  const [genInput, setGenInput] = useState('')
  const [apiResources, setApiResources] = useState<ResourceVM[]>([])
  const [loading, setLoading] = useState(true)

  // 记录页面停留时间
  usePageTimer('resource')

  // 推荐 Feed 数据
  const { data: recItems, loading: recLoading, error: recError, mutate: recMutate } = useRecommendations()

  // 消息队列
  const msgQueueRef = useRef<string[]>([])
  const msgTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setAudioBars(Array.from({ length: 24 }, () => Math.random() * 16 + 4))
    setDetailAudioBars(Array.from({ length: 40 }, () => Math.random() * 20 + 4))
  }, [])

  // 加载资源列表
  const loadResources = useCallback(async () => {
    try {
      setLoading(true)
      const data = await resourceApi.list(getStudentId())
      const resources = data.map(extractContentFromApi)
      setApiResources(resources)
    } catch {
      // 静默失败
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadResources()
  }, [loadResources])

  // 处理消息队列：每条消息至少显示 2.5 秒
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

  // 生成资源（支持单个或批量）
  const generate = async () => {
    if (!genInput.trim() || generating) return
    setGenerating(true)
    setGenResult('正在分析知识点...')
    clearMsgQueue()

    // 检查是否是批量生成（用逗号分隔）
    const knowledgePoints = genInput.split(/[,，、]/).map(s => s.trim()).filter(s => s.length > 0)

    if (knowledgePoints.length > 1) {
      // 批量生成
      try {
        msgQueueRef.current.push(`正在批量生成 ${knowledgePoints.length} 个知识点的资源...`)
        processMsgQueue()
        const result = await resourceApi.batchGenerate(getStudentId(), knowledgePoints)

        const successCount = result.success
        const failCount = result.total - successCount

        let resultMsg = `✅ 批量生成完成\n\n`
        resultMsg += `成功：${successCount} 个\n`
        if (failCount > 0) {
          resultMsg += `失败：${failCount} 个\n`
        }
        resultMsg += `\n知识点：${knowledgePoints.join('、')}`

        setGenResult(resultMsg)
        clearMsgQueue()
        loadResources()
      } catch (err) {
        clearMsgQueue()
        setGenResult(`❌ 批量生成失败: ${err instanceof Error ? err.message : '未知错误'}`)
      } finally {
        setGenerating(false)
      }
    } else {
      // 单个生成（流式）
      let streamContent = ''
      resourceApi.generateStream(
        getStudentId(),
        genInput.trim(),
        (e) => {
          if (e.type === 'progress' && e.message) {
            msgQueueRef.current.push(e.message)
            processMsgQueue()
          }
          if (e.type === 'token' && e.content) {
            clearMsgQueue()
            streamContent += e.content
            setGenResult(streamContent.slice(0, 500) + (streamContent.length > 500 ? '...' : ''))
          }
          if (e.type === 'result' && e.data) {
            clearMsgQueue()
            const data = e.data as Record<string, unknown>
            const content = data.content as Record<string, unknown> || {}
            const knowledge = String(content.knowledge || '')
            setGenResult(`✅ 已生成「${data.knowledge_point || genInput.trim()}」资源\n\n${knowledge.slice(0, 500)}${knowledge.length > 500 ? '...' : ''}`)
            // 刷新资源列表
            loadResources()
            evaluationApi.recordAction({
              student_id: getStudentId(),
              action: 'generate',
              resource_type: 'resource',
              resource_id: String(data.resource_id || ''),
              knowledge_point: String(data.knowledge_point || genInput.trim()),
            }).catch(() => {})
          }
          if (e.type === 'error') {
            clearMsgQueue()
            setGenResult(`❌ ${e.message || '调用失败'}`)
          }
          if (e.type === 'done') {
            setTimeout(() => clearMsgQueue(), 3000)
          }
          if (e.type === 'done' || e.type === 'error') {
            setGenerating(false)
          }
        }
      )
    }
  }

  // 切换收藏
  const toggleFav = useCallback(async (id: string) => {
    // 乐观更新
    setApiResources((prev) =>
      prev.map((r) => (r.id === id ? { ...r, fav: !r.fav } : r))
    )
    if (selectedRes && selectedRes.id === id) {
      setSelectedRes((prev) => (prev ? { ...prev, fav: !prev.fav } : null))
    }

    try {
      await resourceApi.favorite(id)
    } catch {
      // 失败时回滚
      setApiResources((prev) =>
        prev.map((r) => (r.id === id ? { ...r, fav: !r.fav } : r))
      )
      if (selectedRes && selectedRes.id === id) {
        setSelectedRes((prev) => (prev ? { ...prev, fav: !prev.fav } : null))
      }
      showToast('收藏失败，请重试')
    }
  }, [selectedRes])

  // 筛选资源
  const filtered: ResourceVM[] = apiResources.filter((r) => {
    if (filter === 'favorites') return r.fav
    if (filter !== 'all') return r.type === (filter as ResourceType)
    return true
  }).filter((r) => {
    if (!search) return true
    const q = search.toLowerCase()
    return r.title.toLowerCase().includes(q) || r.kp.toLowerCase().includes(q) || r.desc.toLowerCase().includes(q)
  })

  const favoritesCount = apiResources.filter((r) => r.fav).length
  const getDiffClass = (diff: string) => diff === '初级' ? 'easy' : diff === '中级' ? 'med' : 'hard'

  return (
    <>
      {/* 主 Tab 切换 */}
      <div className="resources-tabs">
        <button
          className={`tab-btn${mainTab === 'feed' ? ' active' : ''}`}
          onClick={() => setMainTab('feed')}
        >
          🤖 推荐 Feed
        </button>
        <button
          className={`tab-btn${mainTab === 'all' ? ' active' : ''}`}
          onClick={() => setMainTab('all')}
        >
          📚 全部资源
        </button>
      </div>

      {/* 推荐 Feed Tab */}
      {mainTab === 'feed' && (
        <div className="feed-tab">
          <SmartInput onBatchStart={recMutate} />
          <RecFeed
            items={recItems ?? []}
            loading={recLoading}
            error={recError}
            onRefresh={recMutate}
          />
        </div>
      )}

      {/* 全部资源 Tab — 原有内容完全不动 */}
      {mainTab === 'all' && (
      <>
      {/* Toolbar */}
      <div className="res-toolbar">
        <div className="search-wrap">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            className="search-input"
            placeholder="按知识点或标题搜索..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="filter-group">
          {(['all', 'explanation', 'mindmap', 'exercise', 'code', 'audio', 'favorites'] as const).map((f) => (
            <button
              key={f}
              className={`filter-btn${filter === f ? ' active' : ''}`}
              onClick={() => setFilter(f)}
            >
              {f === 'all' ? '全部' : f === 'favorites' ? '收藏夹' : typeLabels[f as ResourceType]}
            </button>
          ))}
        </div>
        <div className="view-btns">
          <button className={`view-btn${view === 'grid' ? ' active' : ''}`} onClick={() => setView('grid')} title="网格视图">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
            </svg>
          </button>
          <button className={`view-btn${view === 'list' ? ' active' : ''}`} onClick={() => setView('list')} title="列表视图">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="8" y1="6" x2="21" y2="6" />
              <line x1="8" y1="12" x2="21" y2="12" />
              <line x1="8" y1="18" x2="21" y2="18" />
              <line x1="3" y1="6" x2="3.01" y2="6" />
              <line x1="3" y1="12" x2="3.01" y2="12" />
              <line x1="3" y1="18" x2="3.01" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      {/* AI 生成面板 */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '12px 0', padding: 12, background: 'var(--brand-soft)', borderRadius: 8 }}>
        <span style={{ fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}><RobotIcon size={18} /> AI 生成：</span>
        <input
          value={genInput}
          onChange={e => setGenInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && generate()}
          placeholder="输入知识点，多个用逗号分隔（如：线性回归、神经网络、决策树）"
          disabled={generating}
          style={{ flex: 1, padding: '6px 12px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)' }}
        />
        <button onClick={generate} disabled={generating || !genInput.trim()} style={{ padding: '6px 16px', background: 'var(--brand)', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', whiteSpace: 'nowrap' }}>
          {generating ? '生成中...' : '生成'}
        </button>
      </div>
      {genResult && (
        generating ? (
          <div className="gen-loading">
            <div className="gen-spinner" />
            <span>{genResult}</span>
          </div>
        ) : (
          <div style={{ padding: 12, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, marginBottom: 12, fontSize: 13, whiteSpace: 'pre-wrap', maxHeight: 200, overflow: 'auto' }}>
            {genResult}
          </div>
        )
      )}

      {/* Stats */}
      <div className="stats-bar">
        共 <span className="sb-count">{filtered.length}</span> 项资源
        <span className="sb-sep">·</span>
        已收藏 <span className="sb-count">{favoritesCount}</span> 项
      </div>

      {/* Grid */}
      <div className={`res-grid${view === 'list' ? ' list-view' : ''}`}>
        {loading ? (
          <div style={{ gridColumn: '1/-1', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="skeleton-card">
                <div className="skeleton skeleton-line w60" />
                <div className="skeleton skeleton-line w100" />
                <div className="skeleton skeleton-line w40" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '60px 0', color: 'var(--ink-3)' }}>
            <div style={{ fontSize: '36px', marginBottom: '12px' }}>📭</div>
            <div style={{ fontSize: '14px', fontWeight: 500 }}>没有找到匹配的资源</div>
            <div style={{ fontSize: '12.5px', marginTop: '4px' }}>尝试更换筛选条件或搜索关键词</div>
          </div>
        ) : (
          filtered.map((r, i) => {
            const ti = typeIcons[r.type as keyof typeof typeIcons]
            const isFav = r.fav
            const dc = getDiffClass(r.diff)

            return (
              <div key={r.id} className="res-card" style={{ animationDelay: `${i * 0.03}s` }} onClick={() => setSelectedRes(r)}>
                <button
                  className={`rc-fav${isFav ? ' liked' : ''}`}
                  onClick={(e) => { e.stopPropagation(); toggleFav(r.id) }}
                  title={isFav ? '取消收藏' : '收藏'}
                >
                  <svg viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                  </svg>
                </button>
                <div className="rc-header">
                  <div className="rc-type-icon" style={{ background: ti.bg, color: ti.color }}>{ti.icon}</div>
                  <div className="rc-header-text">
                    <h4>{r.title}</h4>
                    <div className="rc-kp"><span className="kp-dot" />{r.kp} · {typeLabels[r.type]}</div>
                  </div>
                </div>
                <div className="rc-body">
                  <div className="rc-desc">{r.desc}</div>
                  {r.type === 'mindmap' && r.mindmap && (
                    <div className="rc-mindmap-preview">{esc(r.mindmap)}</div>
                  )}
                  {r.type === 'code' && r.code && (
                    <div className="rc-code-preview">{esc(r.code)}</div>
                  )}
                  {r.type === 'exercise' && r.count && (
                    <div className="rc-exercise-count">
                      <div>
                        <div className="ec-num">{r.count}</div>
                        <div className="ec-label">道题目</div>
                      </div>
                      <div className="rc-exercise-types">
                        {r.exTypes?.map((t) => <span key={t}>{t}</span>)}
                      </div>
                    </div>
                  )}
                  {r.type === 'audio' && r.duration && (
                    <div className="rc-audio-preview">
                      <button className="rc-audio-btn" onClick={(e) => e.stopPropagation()}>
                        <svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                      </button>
                      <div className="rc-audio-wave">
                        {audioBars.map((h, j) => <div key={j} className="wave-bar" style={{ height: `${h}px` }} />)}
                      </div>
                      <div className="rc-audio-dur">{r.duration}</div>
                    </div>
                  )}
                </div>
                <div className="rc-foot">
                  <span className={`rc-diff diff-${dc}`}>{r.diff}</span>
                  {r.verified && (
                    <span className="rc-verified">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                      已验证
                    </span>
                  )}
                  <span className="rc-time">{r.time}</span>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Detail Modal */}
      {selectedRes && (
        <div className="modal-overlay show" onClick={(e) => e.target === e.currentTarget && setSelectedRes(null)}>
          <div className="modal">
            <div className="modal-hd">
              <div className="mh-icon" style={{ background: typeIcons[selectedRes.type].bg, color: typeIcons[selectedRes.type].color }}>
                {typeIcons[selectedRes.type].icon}
              </div>
              <div className="mh-text">
                <h3>{selectedRes.title}</h3>
                <div className="mh-meta">
                  <span>{typeLabels[selectedRes.type]}</span>
                  <span>{selectedRes.kp}</span>
                  <span className={`rc-diff diff-${getDiffClass(selectedRes.diff)}`} style={{ padding: '2px 7px' }}>{selectedRes.diff}</span>
                </div>
              </div>
              <button
                className={`rc-fav${selectedRes.fav ? ' liked' : ''}`}
                style={{ position: 'static', boxShadow: 'none' }}
                onClick={() => toggleFav(selectedRes.id)}
              >
                <svg viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                </svg>
              </button>
              <button className="modal-close" onClick={() => setSelectedRes(null)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className="modal-bd">
              {/* 知识点讲解 */}
              {selectedRes.type === 'explanation' && selectedRes.content && (
                <div className="md-content" dangerouslySetInnerHTML={{ __html: selectedRes.content }} />
              )}
              {/* 思维导图 */}
              {selectedRes.type === 'mindmap' && selectedRes.mindmap && (
                <div className="md-mindmap">{esc(selectedRes.mindmap)}</div>
              )}
              {/* 练习题 */}
              {selectedRes.type === 'exercise' && selectedRes.exercises && (
                selectedRes.exercises.map((ex, i) => (
                  <div key={i} className="md-exercise">
                    <div className="ex-q"><span className="ex-num">{i + 1}.</span>{ex.q}</div>
                    {ex.opts.length > 0 ? (
                      <div className="ex-opts">
                        {ex.opts.map((o, j) => (
                          <div
                            key={j}
                            className={`ex-opt${revealedAns.has(`${selectedRes.id}-${i}`) && j === ex.ans ? ' reveal-correct' : ''}`}
                            style={revealedAns.has(`${selectedRes.id}-${i}`) && j !== ex.ans ? { pointerEvents: 'none' } : {}}
                            onClick={() => {
                              setRevealedAns((prev) => new Set(prev).add(`${selectedRes.id}-${i}`))
                            }}
                          >
                            {String.fromCharCode(65 + j)}. {o}
                          </div>
                        ))}
                      </div>
                    ) : null}
                    <div className={`ex-ans${revealedAns.has(`${selectedRes.id}-${i}`) || ex.opts.length === 0 ? ' show' : ''}`}>
                      <strong>{ex.opts.length > 0 ? '解析' : '参考答案'}：</strong>{ex.expl}
                    </div>
                  </div>
                ))
              )}
              {/* 代码示例 */}
              {selectedRes.type === 'code' && selectedRes.code && (
                <div className="md-content"><div className="md-codeblk">{esc(selectedRes.code)}</div></div>
              )}
              {/* 音频 */}
              {selectedRes.type === 'audio' && (
                <div style={{ padding: '20px 0', textAlign: 'center' }}>
                  <div style={{ fontSize: '13px', color: 'var(--ink-2)', marginBottom: '16px' }}>{selectedRes.desc}</div>
                  <div className="rc-audio-preview" style={{ maxWidth: '400px', margin: '0 auto', justifyContent: 'center' }}>
                    <button className="rc-audio-btn">
                      <svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                    </button>
                    <div className="rc-audio-wave">
                      {detailAudioBars.map((h, j) => <div key={j} className="wave-bar" style={{ height: `${h}px` }} />)}
                    </div>
                    <div className="rc-audio-dur">{selectedRes.duration || '--:--'}</div>
                  </div>
                </div>
              )}
            </div>
            <div className="modal-ft">
              <span style={{ fontSize: '11.5px', color: 'var(--ink-4)' }}>
                {selectedRes.time}{selectedRes.verified ? ' · 已验证 AI 生成内容' : ''}
              </span>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px' }}>
                <button className="btn" onClick={() => {
                  // 复制内容到剪贴板
                  const content = selectedRes.content || selectedRes.mindmap || selectedRes.code || ''
                  navigator.clipboard.writeText(content).then(() => showToast('已复制到剪贴板'))
                }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13">
                    <rect x="9" y="9" width="13" height="13" rx="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                  复制
                </button>
                <button className="btn btn-solid" onClick={() => showToast('跳转到智能对话页，基于该资源继续学习')}>继续学习</button>
              </div>
            </div>
          </div>
        </div>
      )}
      </>
      )}
    </>
  )
}
