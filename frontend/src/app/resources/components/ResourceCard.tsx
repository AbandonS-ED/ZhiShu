'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Icon from '@/components/Icon'
import { resourceApi } from '@/lib/api'
import type { ResourceItem } from '@/app/resources/types'

const TYPE_CONFIG: Record<string, { label: string; icon: string; color: string; bg: string }> = {
  knowledge: { label: '知识', icon: 'book', color: 'var(--warm)', bg: 'var(--warm-soft)' },
  code: { label: '代码', icon: 'code', color: 'var(--success)', bg: 'var(--success-soft)' },
  mindmap: { label: '导图', icon: 'map', color: 'var(--info)', bg: 'var(--info-soft)' },
  exercise: { label: '题目', icon: 'clipboard', color: 'var(--accent)', bg: 'var(--accent-soft)' },
}

function difficultyLabel(d: number) {
  if (d <= 2) return { text: '简单', color: 'var(--success)' }
  if (d <= 3) return { text: '中等', color: 'var(--warm)' }
  return { text: '困难', color: 'var(--danger)' }
}

export default function ResourceCard({
  resource,
  onDeleted,
}: {
  resource: ResourceItem
  onDeleted: (id: string) => void
}) {
  const router = useRouter()
  const [favorited, setFavorited] = useState(resource.is_favorited)
  const [deleting, setDeleting] = useState(false)

  const cfg = TYPE_CONFIG[resource.resource_type] || TYPE_CONFIG.knowledge
  const diff = difficultyLabel(resource.difficulty)

  const handleClick = () => {
    router.push(`/resources/${resource.resource_id}`)
  }

  const toggleFav = async (e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      const res = await resourceApi.toggleFavorite(resource.resource_id)
      setFavorited(res.is_favorited)
    } catch {}
  }

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('确认删除该资源？')) return
    setDeleting(true)
    try {
      await resourceApi.delete(resource.resource_id)
      onDeleted(resource.resource_id)
    } catch {
      setDeleting(false)
    }
  }

  return (
    <div
      className="card"
      style={{ cursor: 'pointer', transition: 'all .25s var(--ease)' }}
      onClick={handleClick}
    >
      <div style={{ padding: '18px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: cfg.bg, color: cfg.color,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Icon name={cfg.icon} size={18} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--ink)', marginBottom: 4, lineHeight: 1.4 }}>
              {resource.title}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span className="tag" style={{ background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
              {resource.knowledge_point && (
                <span className="tag tag-dark">{resource.knowledge_point}</span>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            <button
              onClick={toggleFav}
              title={favorited ? '取消收藏' : '收藏'}
              style={{
                background: 'none', border: 'none', cursor: 'pointer', padding: 4,
                color: favorited ? 'var(--warm)' : 'var(--ink-4)', transition: 'color .2s',
              }}
            >
              <Icon name="star" size={18} style={favorited ? { fill: 'var(--warm)' } : {}} />
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              title="删除"
              style={{
                background: 'none', border: 'none', cursor: 'pointer', padding: 4,
                color: 'var(--ink-4)', transition: 'color .2s',
              }}
            >
              <Icon name="trash" size={16} />
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12, fontSize: 11, color: 'var(--ink-3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span>难度</span>
            <div style={{ display: 'flex', gap: 2 }}>
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} style={{
                  width: 16, height: 4, borderRadius: 2,
                  background: i <= resource.difficulty ? diff.color : 'var(--line)',
                }} />
              ))}
            </div>
            <span style={{ color: diff.color, fontWeight: 500 }}>{diff.text}</span>
          </div>
          <span>{new Date(resource.created_at).toLocaleDateString('zh-CN')}</span>
        </div>
      </div>
    </div>
  )
}
