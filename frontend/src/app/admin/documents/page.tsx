'use client'

import { useState, useEffect, useMemo } from 'react'
import { useAdmin } from '@/lib/admin/context'
import { AdminCheckbox, BatchDeleteBar, useSelection } from '@/lib/admin/components'
import { adminApi, type AdminDocument } from '@/lib/api'

export default function DocumentsPage() {
  const { showToast } = useAdmin()
  const [list, setList] = useState<AdminDocument[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  async function load(p = 1, q = '') {
    setLoading(true)
    try {
      const res = await adminApi.getDocuments(p, 20, q || undefined)
      setList(res.items)
      setTotal(res.total)
      setPage(res.page)
    } catch {
      showToast('加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const totalChunks = useMemo(() => list.reduce((s, x) => s + x.chunk_count, 0), [list])

  const sel = useSelection(list)

  function batchDelete() {
    if (sel.selectedCount === 0) return
    if (!window.confirm(`确认删除选中的 ${sel.selectedCount} 份文档？`)) return
    showToast('后端暂不支持删除文档')
    sel.clear()
  }

  return (
    <div className="admin-pnl vis">
      <div className="admin-tb">
        <input
          className="admin-si"
          placeholder="搜索文档..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') load(1, search) }}
        />
        <button className="admin-btn admin-btn-sm" onClick={() => load(1, search)} style={{ marginLeft: 8 }}>
          搜索
        </button>
        <div style={{ marginLeft: 'auto', fontSize: 11.5, color: 'var(--ink-3)' }}>
          共 <b style={{ color: 'var(--ink)' }}>{total}</b> 份 ·{' '}
          <b style={{ color: 'var(--ink)' }}>{totalChunks.toLocaleString()}</b> 分块
        </div>
      </div>
      <BatchDeleteBar
        selectedCount={sel.selectedCount}
        totalCount={list.length}
        onClear={sel.clear}
        onDelete={batchDelete}
        itemLabel="份文档"
      />
      <div className="admin-cd">
        <div className="admin-cd-b" style={{ padding: 0 }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-3)' }}>加载中...</div>
          ) : list.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-3)' }}>暂无文档</div>
          ) : (
            <div className="admin-tw">
              <table>
                <thead>
                  <tr>
                    <th className="admin-cb-th">
                      <AdminCheckbox
                        checked={sel.allSelected}
                        indeterminate={sel.indeterminate}
                        onChange={sel.toggleAll}
                        ariaLabel="全选"
                      />
                    </th>
                    <th>文档来源</th>
                    <th>分块数</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((d) => {
                    const isSel = sel.selected.has(d.id)
                    return (
                      <tr key={d.id} className={isSel ? 'is-selected' : ''}>
                        <td className="admin-cb-td">
                          <AdminCheckbox
                            checked={isSel}
                            onChange={() => sel.toggleOne(d.id)}
                            ariaLabel={`选择 ${d.source_file}`}
                          />
                        </td>
                        <td style={{ fontWeight: 500 }}>{d.source_file}</td>
                        <td style={{ fontWeight: 500 }}>{d.chunk_count}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
          {total > 20 && (
            <div style={{ padding: '12px 16px', display: 'flex', justifyContent: 'center', gap: 8 }}>
              <button className="admin-btn admin-btn-sm" disabled={page <= 1} onClick={() => load(page - 1, search)}>上一页</button>
              <span style={{ fontSize: 12, color: 'var(--ink-3)', lineHeight: '28px' }}>第 {page} 页</span>
              <button className="admin-btn admin-btn-sm" disabled={list.length < 20} onClick={() => load(page + 1, search)}>下一页</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
