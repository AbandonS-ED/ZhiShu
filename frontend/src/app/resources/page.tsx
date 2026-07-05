'use client'

import { useState, useEffect } from 'react'
import Icon from '@/components/Icon'
import { resourceApi } from '@/lib/api'
import { getStudentId } from '@/lib/student'
import ResourceCard from './components/ResourceCard'
import CreateModal from './components/CreateModal'
import type { ResourceItem } from '@/app/resources/types'

const TYPE_FILTERS = [
  { key: 'all', label: '全部' },
  { key: 'knowledge', label: '知识' },
  { key: 'code', label: '代码' },
  { key: 'mindmap', label: '导图' },
  { key: 'exercise', label: '题目' },
]

export default function ResourcesPage() {
  const [resources, setResources] = useState<ResourceItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [favOnly, setFavOnly] = useState(false)
  const [showCreate, setShowCreate] = useState(false)

  const studentId = getStudentId()

  useEffect(() => {
    loadResources()
  }, [])

  const loadResources = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await resourceApi.list(studentId)
      setResources(data)
    } catch (err: any) {
      setError(err.message || '加载失败')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleted = (id: string) => {
    setResources(prev => prev.filter(r => r.resource_id !== id))
  }

  const handleCreated = (r: ResourceItem) => {
    setResources(prev => [r, ...prev])
  }

  const filtered = resources.filter(r => {
    if (typeFilter !== 'all' && r.resource_type !== typeFilter) return false
    if (favOnly && !r.is_favorited) return false
    if (search) {
      const q = search.toLowerCase()
      if (!r.title.toLowerCase().includes(q) && !r.knowledge_point.toLowerCase().includes(q)) return false
    }
    return true
  })

  return (
    <div style={{ padding: '24px 32px 40px', height: 'calc(100vh - var(--header-h))', overflow: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, fontFamily: "'Newsreader', serif" }}>资源中心</h2>
        <button className="btn btn-warm" onClick={() => setShowCreate(true)}>
          <Icon name="sparkles" size={14} />
          创建资源
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'var(--surface)', border: '1px solid var(--line)',
          borderRadius: 'var(--r-xs)', padding: '0 12px', flex: '1 1 240px', maxWidth: 360,
        }}>
          <Icon name="search" size={16} style={{ color: 'var(--ink-3)', flexShrink: 0 }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="搜索资源..."
            style={{
              border: 'none', background: 'transparent', outline: 'none',
              padding: '9px 0', fontSize: 13, color: 'var(--ink)', width: '100%',
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: 6 }}>
          {TYPE_FILTERS.map(f => (
            <button
              key={f.key}
              className={`tag ${typeFilter === f.key ? 'tag-warm' : 'tag-dark'}`}
              style={{ cursor: 'pointer', border: 'none', padding: '6px 12px' }}
              onClick={() => setTypeFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>

        <button
          className={`tag ${favOnly ? 'tag-warm' : 'tag-dark'}`}
          style={{ cursor: 'pointer', border: 'none', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 4 }}
          onClick={() => setFavOnly(!favOnly)}
        >
          <Icon name="star" size={12} style={favOnly ? { fill: 'var(--warm)' } : {}} />
          收藏
        </button>
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--ink-3)' }}>
          <div className="loading-spinner" style={{ width: 24, height: 24, margin: '0 auto 12px' }} />
          加载中...
        </div>
      )}

      {error && (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--danger)' }}>
          <Icon name="alertTriangle" size={24} />
          <p style={{ marginTop: 8, fontSize: 13 }}>{error}</p>
          <button className="btn btn-sm" onClick={loadResources} style={{ marginTop: 12 }}>重试</button>
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--ink-3)' }}>
          <Icon name="inbox" size={40} style={{ opacity: 0.3 }} />
          <p style={{ fontSize: 14, marginTop: 12, color: 'var(--ink-2)' }}>
            {search || typeFilter !== 'all' || favOnly ? '没有匹配的资源' : '暂无资源'}
          </p>
          <p style={{ fontSize: 12, marginTop: 4 }}>
            {search || typeFilter !== 'all' || favOnly ? '尝试调整筛选条件' : '点击「创建资源」开始'}
          </p>
        </div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
          gap: 14,
        }}>
          {filtered.map(r => (
            <ResourceCard key={r.resource_id} resource={r} onDeleted={handleDeleted} />
          ))}
        </div>
      )}

      {showCreate && (
        <CreateModal
          onClose={() => setShowCreate(false)}
          onCreated={handleCreated}
        />
      )}
    </div>
  )
}
