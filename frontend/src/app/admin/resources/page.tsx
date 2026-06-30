'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { useAdmin } from '@/lib/admin/context'
import { AdminCheckbox, BatchDeleteBar, useSelection } from '@/lib/admin/components'
import { adminApi, type AdminResource } from '@/lib/api'

const TYPE_MAP: Record<string, string> = {
  knowledge: '知识讲解',
  code: '代码示例',
  mindmap: '思维导图',
  exercise: '练习题',
  audio: '音频脚本',
}

const TYPE_TAG: Record<string, string> = {
  knowledge: 'admin-tag-info',
  code: 'admin-tag-warm',
  mindmap: 'admin-tag-purple',
  exercise: 'admin-tag-success',
  audio: 'admin-tag-info',
}

export default function ResourcesPage() {
  const { showToast } = useAdmin()
  const [list, setList] = useState<AdminResource[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<{ open: boolean; item: AdminResource | null }>({ open: false, item: null })

  const loadResources = useCallback(async () => {
    setLoading(true)
    try {
      const data = await adminApi.getResources(page, 20)
      setList(data.items)
      setTotal(data.total)
    } catch { showToast('加载资源失败') }
    setLoading(false)
  }, [page])

  useEffect(() => { loadResources() }, [loadResources])

  const filtered = useMemo(() => {
    if (!search) return list
    const q = search.toLowerCase()
    return list.filter((r) => r.title.toLowerCase().includes(q) || r.knowledge_point.toLowerCase().includes(q))
  }, [list, search])

  const sel = useSelection(filtered)

  const totalPages = Math.ceil(total / 20)

  return (
    <div className="admin-pnl vis">
      <div className="admin-tb">
        <input
          className="admin-si"
          placeholder="搜索资源标题..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div style={{ marginLeft: 'auto', fontSize: 11.5, color: 'var(--ink-3)' }}>
          共 <b style={{ color: 'var(--ink)' }}>{total}</b> 条
        </div>
      </div>
      <div className="admin-cd">
        <div className="admin-cd-b" style={{ padding: 0 }}>
          <div className="admin-tw">
            <table>
              <thead>
                <tr>
                  <th className="admin-cb-th">
                    <AdminCheckbox
                      checked={sel.allSelected}
                      indeterminate={sel.indeterminate}
                      onChange={sel.toggleAll}
                    />
                  </th>
                  <th>用户</th>
                  <th>标题</th>
                  <th>知识点</th>
                  <th>类型</th>
                  <th>收藏</th>
                  <th>时间</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const isSel = sel.selected.has(r.id)
                  return (
                    <tr key={r.id} className={isSel ? 'is-selected' : ''}>
                      <td className="admin-cb-td">
                        <AdminCheckbox checked={isSel} onChange={() => sel.toggleOne(r.id)} />
                      </td>
                      <td style={{ fontWeight: 500 }}>{r.student_name}</td>
                      <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.title || '(无标题)'}
                      </td>
                      <td><span className="admin-tag admin-tag-dark">{r.knowledge_point || '-'}</span></td>
                      <td>
                        <span className={`admin-tag ${TYPE_TAG[r.resource_type] || 'admin-tag-dark'}`}>
                          {TYPE_MAP[r.resource_type] || r.resource_type}
                        </span>
                      </td>
                      <td style={{ fontWeight: 500, color: r.is_favorited ? 'var(--warm)' : 'var(--ink-3)' }}>
                        {r.is_favorited ? '★' : '-'}
                      </td>
                      <td style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                        {r.created_at ? new Date(r.created_at).toLocaleDateString() : '-'}
                      </td>
                    </tr>
                  )
                })}
                {filtered.length === 0 && !loading && (
                  <tr><td colSpan={7} style={{ textAlign: 'center', padding: 20, color: 'var(--ink-2)' }}>暂无资源</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="admin-pg">
            <span>共 {total} 条，第 {page}/{totalPages || 1} 页</span>
            <div className="admin-pg-b">
              <button className="admin-pg-btn" disabled={page <= 1} onClick={() => setPage(page - 1)}>&lt;</button>
              <button className="admin-pg-btn ac">{page}</button>
              <button className="admin-pg-btn" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>&gt;</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
