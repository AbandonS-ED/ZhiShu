'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { studyPlanApi, type LearningPath, type LearningPathNode } from '@/lib/api'
import { usePageTimer } from '@/hooks/usePageTimer'

export default function PathDetailPage() {
  const router = useRouter()
  const params = useParams()
  const pathId = params.pathId as string
  usePageTimer('plan-path')

  const [path, setPath] = useState<LearningPath | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadPath = async () => {
      try {
        const result = await studyPlanApi.getPaths()
        if (result.success) {
          const found = result.data.find(p => p.id === pathId)
          if (found) setPath(found)
        }
      } catch (err) {
        console.error('加载路径失败:', err)
      } finally {
        setLoading(false)
      }
    }
    loadPath()
  }, [pathId])

  const handleNodeClick = useCallback((node: LearningPathNode) => {
    if (node.status === 'pending') return
    router.push(`/plan/${pathId}/learn/${node.id}`)
  }, [pathId, router])

  const handleFinalTest = useCallback(() => {
    router.push(`/plan/${pathId}/final-test`)
  }, [pathId, router])

  if (loading) {
    return (
      <div className="plan-page">
        <div className="plan-container">
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <div className="loading-spinner" style={{ margin: '0 auto 16px' }} />
            <p style={{ color: 'var(--ink-3)', fontSize: 13 }}>加载学习路径...</p>
          </div>
        </div>
      </div>
    )
  }

  if (!path) {
    return (
      <div className="plan-page">
        <div className="plan-container">
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <p style={{ color: 'var(--ink-3)', marginBottom: 16 }}>学习路径不存在</p>
            <button className="back-btn" onClick={() => router.push('/plan')}>返回</button>
          </div>
        </div>
      </div>
    )
  }

  const completedCount = path.nodes.filter(n => n.status === 'completed').length
  const totalCount = path.nodes.length
  const allCompleted = completedCount === totalCount
  const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0
  const currentIdx = path.nodes.findIndex(n => n.status !== 'completed')
  const estimatedHours = Math.max(1, (totalCount - completedCount) * 1)

  return (
    <div className="plan-page">
      <div className="plan-container">
        {/* ═══ BACK NAV ═══ */}
        <div className="back-nav">
          <a className="back-link" onClick={() => router.push('/plan')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><polyline points="15 18 9 12 15 6"/></svg>
            返回学习计划
          </a>
        </div>

        {/* ═══ PATH HEADER ═══ */}
        <div className="path-header">
          <div className="ph-top">
            <div className="ph-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="22" height="22"><circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M8.5 8.5a6 6 0 0 1 7 7"/></svg>
            </div>
            <div className="ph-title-group">
              <div className="ph-title">{path.name}</div>
            </div>
            <span className={`ph-status ${allCompleted ? 'complete' : 'active'}`}>
              {allCompleted ? '已完成' : '进行中'}
            </span>
          </div>

          <div className="ph-desc">{path.description || 'AI 为你量身定制的学习路径，涵盖核心知识点与实践练习。'}</div>

          <div className="path-stats">
            <div className="ps-item">
              <div className="ps-icon green">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              </div>
              <div className="ps-body">
                <span className="ps-val">{completedCount}/{totalCount}</span>
                <span className="ps-label">已完成</span>
              </div>
            </div>
            <div className="ps-item">
              <div className="ps-icon warm">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5"/></svg>
              </div>
              <div className="ps-body">
                <span className="ps-val">~{estimatedHours}h</span>
                <span className="ps-label">预计剩余</span>
              </div>
            </div>
            <div className="ps-item">
              <div className="ps-icon info">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
              </div>
              <div className="ps-body">
                <span className="ps-val">AI</span>
                <span className="ps-label">画像驱动</span>
              </div>
            </div>
          </div>

          <div className="path-progress">
            <div className="pp-track">
              <div className={`pp-fill ${progress >= 50 ? '' : 'partial'}`} style={{ width: `${progress}%` }} />
            </div>
            <div className="pp-info">
              <span>{path.nodes[0]?.knowledge_point || '开始'} → {path.nodes[path.nodes.length - 1]?.knowledge_point || '完成'}</span>
              <span className="pp-pct">{progress}%</span>
            </div>
          </div>
        </div>

        {/* ═══ PATH TIMELINE ═══ */}
        <div className="path-timeline">
          <div className="pt-title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M8.5 8.5a6 6 0 0 1 7 7"/></svg>
            学习路径
          </div>

          {path.nodes.map((node, idx) => {
            const isLast = idx === path.nodes.length - 1
            const circleStatus = node.status === 'completed' ? 'completed' : node.status === 'current' ? 'current' : 'pending'
            const cardStatus = node.status === 'current' ? 'current-card' : node.status === 'pending' ? 'pending-card' : ''
            const stepStatus = node.status === 'completed' ? 'completed' : node.status === 'current' ? 'current' : 'pending'

            return (
              <div key={node.id} className="pt-node">
                <div className="pt-node-track">
                  <div className={`pt-node-circle ${circleStatus}`}>
                    {node.status === 'completed' ? (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="16" height="16"><polyline points="20 6 9 17 4 12"/></svg>
                    ) : node.status === 'current' ? (
                      <span style={{ fontSize: 14, fontWeight: 600 }}>{idx + 1}</span>
                    ) : (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                    )}
                  </div>
                  {!isLast && (
                    <div className={`pt-node-line ${node.status === 'completed' ? 'done' : 'todo'}`} />
                  )}
                </div>

                <div
                  className={`pt-node-card ${cardStatus}`}
                  onClick={() => handleNodeClick(node)}
                >
                  <div className="nc-top">
                    <span className={`nc-step ${stepStatus}`}>
                      第 {idx + 1} 步{node.status === 'current' ? ' · 当前' : ''}
                    </span>
                    <span className="nc-title">{node.knowledge_point}</span>
                  </div>
                  <div className="nc-desc">
                    {node.status === 'completed'
                      ? '已完成本节学习，点击可回顾复习。'
                      : node.status === 'current'
                        ? '当前学习节点，点击开始学习。'
                        : '完成上一步后解锁本节内容。'}
                  </div>
                  <div className="nc-meta">
                    {node.status === 'pending' ? (
                      <span className="nc-chip" style={{ opacity: .5 }}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="11" height="11"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                        完成上一步后解锁
                      </span>
                    ) : (
                      <>
                        <span className="nc-chip">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="11" height="11"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                          视频讲解
                        </span>
                        <span className="nc-chip">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="11" height="11"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
                          教材阅读
                        </span>
                        <span className="nc-chip">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="11" height="11"><path d="M9 11l3 3L22 4"/></svg>
                          练习题
                        </span>
                      </>
                    )}
                  </div>
                  {node.status !== 'pending' && (
                    <div className="nc-arrow">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12"><polyline points="9 18 15 12 9 6"/></svg>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* ═══ FINAL TEST ═══ */}
        {allCompleted && (
          <div className="final-section">
            <div className="final-card">
              <div className="fc-trophy">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="28" height="28"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>
              </div>
              <h2>所有知识点已完成！</h2>
              <p>点击下方按钮进行综合测试，验证你是否完全掌握了全部内容。</p>
              <button className="final-btn" onClick={handleFinalTest}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
                开始综合测试
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
