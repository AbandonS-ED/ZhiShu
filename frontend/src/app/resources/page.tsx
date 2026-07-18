'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Icon from '@/components/Icon'
import { resourceApi } from '@/lib/api'
import { getStudentId } from '@/lib/student'
import { showToast } from '@/lib/utils'
import CreateModal from './components/CreateModal'
import type { ResourceItem } from '@/app/resources/types'

const TYPE_FILTERS = [
  { key: 'all', label: '全部' },
  { key: 'knowledge', label: '知识' },
  { key: 'code', label: '代码' },
  { key: 'mindmap', label: '导图' },
  { key: 'exercise', label: '题目' },
]

const TYPE_CONFIG: Record<string, { label: string; icon: string; color: string; bg: string }> = {
  knowledge: { label: '知识', icon: 'book', color: 'var(--info)', bg: 'var(--info-soft)' },
  code: { label: '代码', icon: 'code', color: 'var(--success)', bg: 'var(--success-soft)' },
  mindmap: { label: '导图', icon: 'map', color: '#7c3aed', bg: 'rgba(139,92,246,0.08)' },
  exercise: { label: '题目', icon: 'clipboard', color: 'var(--warm)', bg: 'var(--warm-soft)' },
}

export default function ResourcesPage() {
  const router = useRouter()
  const [resources, setResources] = useState<ResourceItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [favOnly, setFavOnly] = useState(false)
  const [showCreate, setShowCreate] = useState(false)

  const studentId = getStudentId()

  useEffect(() => { loadResources() }, [])

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

  const filtered = resources.filter(r => {
    if (typeFilter !== 'all' && r.resource_type !== typeFilter) return false
    if (favOnly && !r.is_favorited) return false
    if (search) {
      const q = search.toLowerCase()
      if (!r.title.toLowerCase().includes(q) && !r.knowledge_point.toLowerCase().includes(q)) return false
    }
    return true
  })

  const total = resources.length
  const codeCount = resources.filter(r => r.resource_type === 'code').length
  const favCount = resources.filter(r => r.is_favorited).length

  const toggleFav = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      const res = await resourceApi.toggleFavorite(id)
      setResources(prev => prev.map(r => r.resource_id === id ? { ...r, is_favorited: res.is_favorited } : r))
    } catch {}
  }

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('确认删除该资源？')) return
    try {
      await resourceApi.delete(id)
      setResources(prev => prev.filter(r => r.resource_id !== id))
      showToast('已删除')
    } catch {}
  }

  const handleCreated = (r: ResourceItem) => {
    setResources(prev => [r, ...prev])
  }

  return (
    <div style={{ padding: '28px 32px 40px', height: 'calc(100vh - var(--header-h))', overflow: 'auto' }}>
      {/* Stats */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, animation: 'emerge .5s var(--ease)' }}>
        <div className="rs-card">
          <div className="rs-icon warm"><Icon name="book" size={16} /></div>
          <div><div className="rs-val">{total}</div><div className="rs-label">总资源数</div></div>
        </div>
        <div className="rs-card">
          <div className="rs-icon green"><Icon name="code" size={16} /></div>
          <div><div className="rs-val">{codeCount}</div><div className="rs-label">代码资源</div></div>
        </div>
        <div className="rs-card">
          <div className="rs-icon info"><Icon name="star" size={16} /></div>
          <div><div className="rs-val">{favCount}</div><div className="rs-label">已收藏</div></div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="res-toolbar">
        <div className="search-wrap">
          <Icon name="search" size={16} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="搜索资源标题或知识点..."
          />
        </div>
        <div className="filter-group">
          {TYPE_FILTERS.map(f => (
            <button
              key={f.key}
              className={`filter-btn ${typeFilter === f.key ? 'active' : ''}`}
              onClick={() => setTypeFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>
        <button
          className={`fav-btn ${favOnly ? 'active' : ''}`}
          onClick={() => setFavOnly(!favOnly)}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
          收藏
        </button>
        <button className="btn btn-warm" onClick={() => setShowCreate(true)} style={{ marginLeft: 'auto' }}>
          <Icon name="sparkles" size={14} />
          创建资源
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--ink-3)' }}>
          <div className="loading-spinner" style={{ width: 24, height: 24, margin: '0 auto 12px' }} />
          加载中...
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--danger)' }}>
          <Icon name="alertTriangle" size={24} />
          <p style={{ marginTop: 8, fontSize: 13 }}>{error}</p>
          <button className="btn btn-sm" onClick={loadResources} style={{ marginTop: 12 }}>重试</button>
        </div>
      )}

      {/* Empty */}
      {!loading && !error && filtered.length === 0 && (
        <div className="empty-state">
          <div className="es-icon">
            <Icon name="inbox" size={28} />
          </div>
          <h3>{search || typeFilter !== 'all' || favOnly ? '没有匹配的资源' : '暂无资源'}</h3>
          <p className="es-hint">{search || typeFilter !== 'all' || favOnly ? '尝试调整筛选条件' : '点击「创建资源」开始'}</p>
          {!search && typeFilter === 'all' && !favOnly && (
            <button className="es-btn" onClick={() => setShowCreate(true)}>
              <Icon name="sparkles" size={14} />
              创建资源
            </button>
          )}
        </div>
      )}

      {/* Grid */}
      {!loading && !error && filtered.length > 0 && (
        <div className="res-grid">
          {filtered.map((r, i) => {
            const cfg = TYPE_CONFIG[r.resource_type] || TYPE_CONFIG.knowledge
            const preview = r.content?.knowledge || r.content?.code || ''
            return (
              <div
                key={r.resource_id}
                className="res-card"
                style={{ animationDelay: `${Math.min(i * 0.04, 0.2)}s` }}
                onClick={() => router.push(`/resources/${r.resource_id}`)}
              >
                <div className="rc-head">
                  <div className={`rc-icon ${r.resource_type}`}>
                    <Icon name={cfg.icon} size={18} />
                  </div>
                  <div className="rc-title-group">
                    <div className="rc-title">{r.title}</div>
                    <div className="rc-kp">{r.knowledge_point}</div>
                  </div>
                  <div className="rc-actions">
                    <button
                      className={`rc-action ${r.is_favorited ? 'fav-active' : ''}`}
                      onClick={(e) => toggleFav(r.resource_id, e)}
                      title={r.is_favorited ? '取消收藏' : '收藏'}
                    >
                      <svg viewBox="0 0 24 24" fill={r.is_favorited ? 'var(--warm)' : 'none'} stroke="currentColor" strokeWidth="2" width="14" height="14">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                      </svg>
                    </button>
                    <button
                      className="rc-action delete"
                      onClick={(e) => handleDelete(r.resource_id, e)}
                      title="删除"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                        <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6" /><path d="M14 11v6" />
                      </svg>
                    </button>
                  </div>
                </div>
                {preview && (
                  <div className="rc-body">
                    <div className="rc-preview">{preview}</div>
                  </div>
                )}
                <div className="rc-foot">
                  <span className={`rc-type-tag ${r.resource_type}`}>{cfg.label}</span>
                  <span className="rc-meta">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12">
                      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                    </svg>
                    {new Date(r.created_at).toLocaleDateString('zh-CN')}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showCreate && (
        <CreateModal onClose={() => setShowCreate(false)} onCreated={handleCreated} />
      )}
    </div>
  )
}
