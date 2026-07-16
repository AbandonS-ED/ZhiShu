'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { studyPlanApi, type LearningPath, type LearningPathNode } from '@/lib/api'
import { usePageTimer } from '@/hooks/usePageTimer'
import Icon from '@/components/Icon'

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
          if (found) {
            setPath(found)
          }
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
    
    if (node.status === 'completed') {
      // 已完成的节点可以查看或重学
      router.push(`/plan/${pathId}/learn/${node.id}`)
    } else {
      // 当前节点 - 开始学习
      router.push(`/plan/${pathId}/learn/${node.id}`)
    }
  }, [pathId, router])

  const handleFinalTest = useCallback(() => {
    router.push(`/plan/${pathId}/final-test`)
  }, [pathId, router])

  if (loading) {
    return (
      <div className="plan-page">
        <div className="plan-container">
          <div className="loading-state">
            <div className="loading-spinner" />
            <p>加载学习路径...</p>
          </div>
        </div>
      </div>
    )
  }

  if (!path) {
    return (
      <div className="plan-page">
        <div className="plan-container">
          <div className="error-state">
            <p>学习路径不存在</p>
            <button className="btn-secondary" onClick={() => router.push('/plan')}>
              返回
            </button>
          </div>
        </div>
      </div>
    )
  }

  const completedCount = path.nodes.filter(n => n.status === 'completed').length
  const allCompleted = completedCount === path.nodes.length

  return (
    <div className="plan-page">
      <div className="plan-container">
        {/* 返回按钮 */}
        <button className="back-btn" onClick={() => router.push('/plan')}>
          <Icon name="arrowLeft" size={16} />
          返回
        </button>

        {/* 路径信息 */}
        <div className="path-header">
          <h1>{path.name}</h1>
          <p>{path.description}</p>
          <div className="path-stats">
            <span>{completedCount}/{path.nodes.length} 知识点已完成</span>
          </div>
        </div>

        {/* 学习路径图 */}
        <div className="path-graph">
          {path.nodes.map((node, index) => {
            const isLast = index === path.nodes.length - 1
            
            return (
              <div key={node.id} className="path-node-container">
                {/* 节点 */}
                <div
                  className={`path-node ${node.status}`}
                  onClick={() => handleNodeClick(node)}
                  style={{ cursor: node.status === 'pending' ? 'not-allowed' : 'pointer' }}
                >
                  <div className="node-icon">
                    {node.status === 'completed' ? (
                      <Icon name="check" size={24} />
                    ) : node.status === 'current' ? (
                      <span className="node-number">{index + 1}</span>
                    ) : (
                      <Icon name="lock" size={20} />
                    )}
                  </div>
                  <div className="node-label">{node.knowledge_point}</div>
                  {node.status === 'current' && (
                    <div className="node-badge">当前</div>
                  )}
                </div>
                
                {/* 连接线 */}
                {!isLast && (
                  <div className={`path-connector ${node.status === 'completed' ? 'completed' : ''}`}>
                    <svg viewBox="0 0 60 20" fill="none">
                      <path d="M0 10 L60 10" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4" />
                      <path d="M50 5 L60 10 L50 15" stroke="currentColor" strokeWidth="2" />
                    </svg>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* 综合测试按钮 */}
        {allCompleted && (
          <div className="final-test-section">
            <div className="final-test-card">
              <Icon name="trophy" size={48} />
              <h2>所有知识点已完成！</h2>
              <p>点击下方按钮进行综合测试，验证你是否完全掌握</p>
              <button className="btn-primary" onClick={handleFinalTest}>
                <Icon name="target" size={18} />
                开始综合测试
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
