'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { profileApi, studyPlanApi, type LearningPath, type LearningPathNode } from '@/lib/api'
import { getStudentId } from '@/lib/student'
import { usePageTimer } from '@/hooks/usePageTimer'
import Icon from '@/components/Icon'

export default function PlanPage() {
  const router = useRouter()
  usePageTimer('plan')

  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [recentPaths, setRecentPaths] = useState<LearningPath[]>([])
  const [recommendedKP, setRecommendedKP] = useState([
    { name: '机器学习基础', reason: '薄弱知识点', icon: 'target' },
    { name: '神经网络原理', reason: '进阶推荐', icon: 'brain' },
    { name: '深度学习框架', reason: '实践应用', icon: 'code' },
    { name: '自然语言处理', reason: '前沿方向', icon: 'book' },
  ])

  useEffect(() => {
    const loadData = async () => {
      try {
        const profile = await profileApi.getMe()
        if (profile.dimensions) {
          const weakPoints = Object.entries(profile.dimensions)
            .filter(([_, v]) => v < 60)
            .map(([k]) => k)
          if (weakPoints.length > 0) {
            setRecommendedKP(prev => [
              { name: weakPoints[0] + '强化', reason: '最薄弱', icon: 'target' },
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
    if (!knowledge.trim()) return
    
    setLoading(true)
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
      setLoading(false)
    }
  }, [router])

  return (
    <div className="plan-page">
      <div className="plan-container">
        {/* 顶部输入区 */}
        <div className="plan-hero">
          <h1>学习计划</h1>
          <p>输入你想学习的内容，AI将为你生成个性化学习路径</p>
          
          <div className="plan-search-box">
            <Icon name="search" size={20} />
            <input
              type="text"
              placeholder="输入知识点，如：机器学习、Python编程、数据结构..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && searchQuery.trim()) {
                  handleGeneratePath(searchQuery.trim())
                }
              }}
            />
            <button 
              className="btn-primary"
              onClick={() => searchQuery.trim() && handleGeneratePath(searchQuery.trim())}
              disabled={loading || !searchQuery.trim()}
            >
              {loading ? (
                <div className="loading-spinner" />
              ) : (
                <>
                  <Icon name="sparkles" size={16} />
                  生成学习路径
                </>
              )}
            </button>
          </div>
        </div>

        {/* 推荐学习 */}
        <div className="plan-section">
          <div className="section-header">
            <h2>推荐学习</h2>
            <span className="section-subtitle">基于你的学习画像</span>
          </div>
          <div className="recommend-grid">
            {recommendedKP.map((item) => (
              <div
                key={item.name}
                className="recommend-card"
                onClick={() => handleGeneratePath(item.name)}
              >
                <div className="recommend-icon">
                  <Icon name={item.icon as any} size={24} />
                </div>
                <div className="recommend-info">
                  <div className="recommend-name">{item.name}</div>
                  <div className="recommend-reason">{item.reason}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 最近学习路径 */}
        {recentPaths.length > 0 && (
          <div className="plan-section">
            <div className="section-header">
              <h2>学习路径</h2>
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
                    <div className="path-card-header">
                      <h3>{path.name}</h3>
                      <span className="path-status">{path.status === 'active' ? '进行中' : '已完成'}</span>
                    </div>
                    <div className="path-card-desc">{path.description}</div>
                    <div className="path-card-progress">
                      <div className="progress-bar">
                        <div className="progress-fill" style={{ width: `${progress}%` }} />
                      </div>
                      <span>{completedCount}/{totalCount} 知识点</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
