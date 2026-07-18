'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { profileApi, studyPlanApi, type LearningPath } from '@/lib/api'
import { usePageTimer } from '@/hooks/usePageTimer'

const RECOMMENDATIONS = [
  { name: '搜索算法强化', reason: '最薄弱知识点', icon: 'target', iconClass: 'target' },
  { name: '神经网络原理', reason: '进阶推荐', icon: 'brain', iconClass: 'brain' },
  { name: '深度学习框架', reason: '实践应用', icon: 'code', iconClass: 'code' },
  { name: '自然语言处理', reason: '前沿方向', icon: 'book', iconClass: 'book' },
]

const QUICK_TAGS = ['机器学习基础', 'Transformer', 'CNN 卷积网络', 'A* 算法', 'Python 数据结构', 'PyTorch']

const ICONS: Record<string, JSX.Element> = {
  link: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M8.5 8.5a6 6 0 0 1 7 7"/></svg>,
  search: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  layers: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>,
  target: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>,
  brain: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2z"/><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2z"/></svg>,
  code: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>,
  book: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>,
  chevron: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>,
  clock: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5"/></svg>,
  check: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>,
  bookOpen: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>,
}

function getNodeStatus(node: { status: string }, pathNodes: { status: string }[], idx: number): 'completed' | 'current' | 'locked' {
  if (node.status === 'completed') return 'completed'
  if (node.status === 'in_progress' || node.status === 'current') return 'current'
  const firstCurrent = pathNodes.findIndex(n => n.status !== 'completed')
  if (firstCurrent === -1) return 'completed'
  return idx < firstCurrent ? 'completed' : idx === firstCurrent ? 'current' : 'locked'
}

export default function PlanPage() {
  const router = useRouter()
  usePageTimer('plan')

  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [recentPaths, setRecentPaths] = useState<LearningPath[]>([])
  const [recommendations, setRecommendations] = useState(RECOMMENDATIONS)
  const [showGenerating, setShowGenerating] = useState(false)
  const [genTopic, setGenTopic] = useState('')
  const [genStep, setGenStep] = useState(0)

  useEffect(() => {
    const loadData = async () => {
      try {
        const profile = await profileApi.getMe()
        if (profile.dimensions) {
          const weakPoints = Object.entries(profile.dimensions)
            .filter(([_, v]) => v < 60)
            .map(([k]) => k)
          if (weakPoints.length > 0) {
            setRecommendations(prev => [
              { name: weakPoints[0] + '强化', reason: '最薄弱知识点', icon: 'target', iconClass: 'target' },
              ...prev.slice(1)
            ])
          }
        }
      } catch {}

      try {
        const paths = await studyPlanApi.getPaths()
        if (paths.success) {
          setRecentPaths(paths.data)
        }
      } catch {}
    }
    loadData()
  }, [])

  const handleGeneratePath = useCallback(async (knowledge: string) => {
    if (!knowledge.trim() || loading) return

    setLoading(true)
    setGenTopic(knowledge)
    setShowGenerating(true)
    setGenStep(0)

    const stepTimer = setInterval(() => {
      setGenStep(prev => {
        if (prev >= 3) { clearInterval(stepTimer); return prev }
        return prev + 1
      })
    }, 800)

    try {
      const result = await studyPlanApi.generatePath({
        target_knowledge: knowledge,
        current_level: 'beginner'
      })

      if (result.success && result.data) {
        router.push(`/plan/${result.data.id}`)
      }
    } catch (err) {
      console.error('生成学习路径失败:', err)
    } finally {
      clearInterval(stepTimer)
      setShowGenerating(false)
      setLoading(false)
    }
  }, [router, loading])

  return (
    <div className="plan-page">
      {/* ═══ HERO ═══ */}
      <div className="plan-hero">
        <div className="hero-icon">
          {ICONS.link}
        </div>
        <h1>学习计划</h1>
        <p>输入你想学习的内容，AI 将为你生成个性化学习路径</p>

        <div className="plan-search-box">
          <div className="sb-icon">{ICONS.search}</div>
          <input
            type="text"
            placeholder="输入知识点，如：机器学习、Python 编程、数据结构..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && searchQuery.trim()) {
                handleGeneratePath(searchQuery.trim())
              }
            }}
          />
          <button
            className="search-btn"
            onClick={() => searchQuery.trim() && handleGeneratePath(searchQuery.trim())}
            disabled={loading || !searchQuery.trim()}
          >
            {loading ? (
              <div className="loading-spinner" />
            ) : (
              <>
                {ICONS.layers}
                生成学习路径
              </>
            )}
          </button>
        </div>

        <div className="quick-tags">
          {QUICK_TAGS.map(tag => (
            <button
              key={tag}
              className="quick-tag"
              onClick={() => { setSearchQuery(tag); handleGeneratePath(tag) }}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      {/* ═══ RECOMMENDED ═══ */}
      <div className="plan-section">
        <div className="section-header">
          <h2>推荐学习</h2>
          <span className="section-subtitle">基于你的学习画像</span>
        </div>
        <div className="recommend-grid">
          {recommendations.map((item) => (
            <div
              key={item.name}
              className="recommend-card"
              onClick={() => handleGeneratePath(item.name)}
            >
              <div className={`rc-icon ${item.iconClass}`}>
                {ICONS[item.icon]}
              </div>
              <div className="rc-body">
                <div className="rc-name">{item.name}</div>
                <div className="rc-reason">{item.reason}</div>
              </div>
              <div className="rc-arrow">
                {ICONS.chevron}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ═══ PATHS ═══ */}
      {recentPaths.length > 0 && (
        <div className="plan-section">
          <div className="section-header">
            <h2>学习路径</h2>
            <span className="section-subtitle">{recentPaths.length} 条进行中</span>
          </div>
          <div className="path-list">
            {recentPaths.map((path) => {
              const completedCount = path.nodes.filter(n => n.status === 'completed').length
              const totalCount = path.nodes.length
              const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

              return (
                <div
                  key={path.id}
                  className="path-card"
                  onClick={() => router.push(`/plan/${path.id}`)}
                >
                  <div className="path-card-top">
                    <div className="pc-icon active-icon">
                      {ICONS.link}
                    </div>
                    <div className="pc-info">
                      <div className="pc-title-row">
                        <span className="pc-title">{path.name}</span>
                        <span className={`pc-status ${path.status === 'completed' ? 'complete' : 'active'}`}>
                          {path.status === 'completed' ? '已完成' : '进行中'}
                        </span>
                      </div>
                      <div className="pc-desc">{path.description}</div>
                    </div>
                  </div>
                  <div className="path-card-mid">
                    <div className="pc-progress-track">
                      <div
                        className={`pc-progress-fill ${progress >= 50 ? 'high' : 'low'}`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <span className="pc-progress-text">{completedCount}/{totalCount}</span>
                  </div>
                  <div className="path-card-nodes">
                    {path.nodes.slice(0, 6).map((node, idx) => {
                      const status = getNodeStatus(node, path.nodes, idx)
                      return (
                        <span key={node.id} className={`pc-node ${status}`}>
                          <span className="node-dot" />
                          {node.knowledge_point}
                        </span>
                      )
                    })}
                    {path.nodes.length > 6 && (
                      <span className="pc-node locked">
                        <span className="node-dot" />
                        +{path.nodes.length - 6}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ═══ GENERATING OVERLAY ═══ */}
      <div className={`generating-overlay ${showGenerating ? 'show' : ''}`}>
        <div className="generating-card">
          <div className="gen-spinner" />
          <h3>AI 正在规划学习路径</h3>
          <p>目标：{genTopic}</p>
          <div className="gen-steps">
            {['分析主题结构', '拆分知识模块', '规划学习顺序', '生成路径详情'].map((label, i) => (
              <div key={i} className={`gen-step ${i < genStep ? 'done' : i === genStep ? 'active' : 'waiting'}`}>
                <div className="gs-dot" />
                {label}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
