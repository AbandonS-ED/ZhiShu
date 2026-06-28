'use client'
import type { RecItem } from '../types'
import RecCard from './RecCard'
import Icon from '@/components/Icon'

interface RecFeedProps {
  items: RecItem[]
  loading: boolean
  error: string | null
  onRefresh: () => void
}

export default function RecFeed({ items, loading, error, onRefresh }: RecFeedProps) {
  if (loading) {
    return (
      <div className="rec-feed-loading">
        {[1, 2, 3].map(i => (
          <div key={i} className="rec-card-skeleton">
            <div className="skeleton-line wide" />
            <div className="skeleton-line medium" />
            <div className="skeleton-line short" />
          </div>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="rec-feed-error">
        <p><Icon name="close" size={16} className="inline-icon" /> 加载推荐失败：{error}</p>
        <button onClick={onRefresh}>重试</button>
      </div>
    )
  }

  if (!items.length) {
    return (
      <div className="rec-feed-empty">
        <p><Icon name="robot" size={24} /> 暂无推荐内容</p>
        <p className="rec-feed-empty-hint">完成初始评估后将获得个性化推荐</p>
      </div>
    )
  }

  return (
    <div className="rec-feed">
      {items.map((item, i) => (
        <div key={item.knowledge_point} className="rec-card-wrapper" style={{ animationDelay: `${i * 0.05}s` }}>
          <RecCard item={item} onRefresh={onRefresh} />
        </div>
      ))}
    </div>
  )
}
