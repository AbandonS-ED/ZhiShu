'use client'

import { useState, useMemo } from 'react'
import { useAdmin } from '@/lib/admin/context'
import { AdminCheckbox, BatchDeleteBar, useSelection } from '@/lib/admin/components'

interface Doc {
  id: string
  nm: string
  au: string
  tp: string
  ck: number
  sz: string
}

const INIT_DC: Doc[] = [
  { id: 'd1', nm: '人工智能导论（第4版）', au: '系统', tp: '教材', ck: 420, sz: '18.5MB' },
  { id: 'd2', nm: 'AI 导论课件 Ch1-Ch8', au: '系统', tp: '课件', ck: 380, sz: '24.2MB' },
  { id: 'd3', nm: '实验指导手册', au: '系统', tp: '实验', ck: 156, sz: '3.8MB' },
  { id: 'd4', nm: '历年习题及解析', au: '系统', tp: '习题', ck: 290, sz: '5.1MB' },
  { id: 'd5', nm: '经典论文集', au: '系统', tp: '论文', ck: 180, sz: '12.7MB' },
  { id: 'd6', nm: '补充阅读材料', au: '系统', tp: '参考', ck: 85, sz: '1.2MB' },
]

const TP_TAG: Record<string, string> = {
  教材: 'admin-tag-info',
  课件: 'admin-tag-warm',
  实验: 'admin-tag-green',
  习题: 'admin-tag-purple',
  论文: 'admin-tag-danger',
  参考: 'admin-tag-dark',
}

export default function DocumentsPage() {
  const { showToast } = useAdmin()
  const [list, setList] = useState<Doc[]>(INIT_DC)
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    if (!search) return list
    const q = search.toLowerCase()
    return list.filter((x) => x.nm.toLowerCase().includes(q))
  }, [list, search])

  const sel = useSelection(filtered)

  function delD(d: Doc) {
    if (typeof window !== 'undefined' && !window.confirm('确认删除？')) return
    setList((prev) => prev.filter((x) => x.id !== d.id))
    sel.removeMany([d.id])
    showToast('已删除')
  }

  function batchDelete() {
    if (sel.selectedCount === 0) return
    if (typeof window !== 'undefined' && !window.confirm(`确认删除选中的 ${sel.selectedCount} 份文档？`)) return
    const ids = Array.from(sel.selected)
    setList((prev) => prev.filter((x) => !ids.includes(x.id)))
    sel.clear()
    showToast(`已批量删除 ${ids.length} 份文档`)
  }

  const totalChunks = list.reduce((s, x) => s + x.ck, 0)

  return (
    <div className="admin-pnl vis">
      <div className="admin-tb">
        <input
          className="admin-si"
          placeholder="搜索文档..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div style={{ marginLeft: 'auto', fontSize: 11.5, color: 'var(--ink-3)' }}>
          共 <b style={{ color: 'var(--ink)' }}>{list.length}</b> 份 ·{' '}
          <b style={{ color: 'var(--ink)' }}>{totalChunks.toLocaleString()}</b> 分块
        </div>
      </div>
      <BatchDeleteBar
        selectedCount={sel.selectedCount}
        totalCount={filtered.length}
        onClear={sel.clear}
        onDelete={batchDelete}
        itemLabel="份文档"
      />
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
                      ariaLabel="全选"
                    />
                  </th>
                  <th>文档来源</th>
                  <th>作者</th>
                  <th>类型</th>
                  <th>分块数</th>
                  <th>大小</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((d) => {
                  const isSel = sel.selected.has(d.id)
                  return (
                    <tr key={d.id} className={isSel ? 'is-selected' : ''}>
                      <td className="admin-cb-td">
                        <AdminCheckbox
                          checked={isSel}
                          onChange={() => sel.toggleOne(d.id)}
                          ariaLabel={`选择 ${d.nm}`}
                        />
                      </td>
                      <td style={{ fontWeight: 500 }}>{d.nm}</td>
                    <td>{d.au}</td>
                    <td>
                      <span className={`admin-tag ${TP_TAG[d.tp] || 'admin-tag-dark'}`}>
                        {d.tp}
                      </span>
                    </td>
                    <td style={{ fontWeight: 500 }}>{d.ck}</td>
                    <td style={{ fontSize: 11, color: 'var(--ink-3)' }}>{d.sz}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="admin-btn admin-btn-sm">查看</button>
                        <button
                          className="admin-btn admin-btn-sm admin-btn-danger"
                          onClick={() => delD(d)}
                        >
                          删除
                        </button>
                      </div>
                    </td>
                  </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
