'use client'

import { useState, useEffect, useMemo } from 'react'
import { useAdmin } from '@/lib/admin/context'
import { AdminCheckbox, BatchDeleteBar, useSelection } from '@/lib/admin/components'
import { adminApi, type AdminPath } from '@/lib/api'

export default function PathsPage() {
  const { showToast } = useAdmin()
  const [list, setList] = useState<AdminPath[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState<{ open: boolean; item: AdminPath | null }>({
    open: false,
    item: null,
  })

  async function load(p = 1) {
    setLoading(true)
    try {
      const res = await adminApi.getPaths(p, 20)
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

  const sel = useSelection(list)

  async function batchDelete() {
    if (sel.selectedCount === 0) return
    if (!window.confirm(`确认删除选中的 ${sel.selectedCount} 条路径？`)) return
    showToast('后端暂不支持删除路径')
    sel.clear()
  }

  return (
    <div className="admin-pnl vis">
      <div className="admin-tb">
        <input
          className="admin-si"
          placeholder="搜索路径..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div style={{ marginLeft: 'auto', fontSize: 11.5, color: 'var(--ink-3)' }}>
          共 <b style={{ color: 'var(--ink)' }}>{total}</b> 条
        </div>
      </div>
      <BatchDeleteBar
        selectedCount={sel.selectedCount}
        totalCount={list.length}
        onClear={sel.clear}
        onDelete={batchDelete}
        itemLabel="条路径"
      />
      <div className="admin-cd">
        <div className="admin-cd-b" style={{ padding: 0 }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-3)' }}>加载中...</div>
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
                    <th>用户</th>
                    <th>标题</th>
                    <th>天数</th>
                    <th>节点数</th>
                    <th>创建时间</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((p) => {
                    const isSel = sel.selected.has(p.id)
                    return (
                      <tr key={p.id} className={isSel ? 'is-selected' : ''}>
                        <td className="admin-cb-td">
                          <AdminCheckbox
                            checked={isSel}
                            onChange={() => sel.toggleOne(p.id)}
                            ariaLabel={`选择 ${p.title}`}
                          />
                        </td>
                        <td style={{ fontWeight: 500 }}>{p.student_name}</td>
                        <td>{p.title}</td>
                        <td>{p.total_days}天</td>
                        <td>{p.node_count}</td>
                        <td style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                          {p.created_at ? new Date(p.created_at).toLocaleDateString() : '-'}
                        </td>
                        <td>
                          <button
                            className="admin-btn admin-btn-sm"
                            onClick={() => setModal({ open: true, item: p })}
                          >
                            查看 DAG
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
          {total > 20 && (
            <div style={{ padding: '12px 16px', display: 'flex', justifyContent: 'center', gap: 8 }}>
              <button className="admin-btn admin-btn-sm" disabled={page <= 1} onClick={() => load(page - 1)}>上一页</button>
              <span style={{ fontSize: 12, color: 'var(--ink-3)', lineHeight: '28px' }}>第 {page} 页</span>
              <button className="admin-btn admin-btn-sm" disabled={list.length < 20} onClick={() => load(page + 1)}>下一页</button>
            </div>
          )}
        </div>
      </div>

      {modal.open && modal.item && (
        <div
          className="admin-mo vis"
          onClick={(e) => {
            if (e.target === e.currentTarget) setModal({ open: false, item: null })
          }}
        >
          <div className="admin-md">
            <div className="admin-md-h">
              <h3>路径: {modal.item.title}</h3>
              <button
                className="admin-md-x"
                onClick={() => setModal({ open: false, item: null })}
              >
                &times;
              </button>
            </div>
            <div className="admin-md-body">
              <div className="admin-md-r">
                <span className="ml">用户</span>
                <span className="mv">{modal.item.student_name}</span>
              </div>
              <div className="admin-md-r">
                <span className="ml">总天数</span>
                <span className="mv">{modal.item.total_days} 天</span>
              </div>
              <div className="admin-md-r">
                <span className="ml">节点 / 边</span>
                <span className="mv">{modal.item.node_count} / {modal.item.edge_count}</span>
              </div>
              <div className="admin-md-sec">
                <h4>DAG 可视化</h4>
                <div className="admin-dag">
                  <div className="admin-dag-ns">
                    {modal.item.nodes.map((node, j) => {
                      const cls = j === 0 ? 'cur' : 'pend'
                      return (
                        <div key={node.id} className={`admin-dag-n ${cls}`}>
                          {node.label}
                          <span style={{ fontSize: 9, color: 'var(--ink-4)', marginLeft: 4 }}>
                            {node.estimated_hours}h
                          </span>
                        </div>
                      )
                    })}
                  </div>
                  <div style={{ marginTop: 12, fontSize: 10.5, color: 'var(--ink-3)' }}>
                    <span style={{ color: 'var(--warm)' }}>&#9632;</span> 当前 &nbsp;
                    <span style={{ color: 'var(--ink-4)' }}>&#9632;</span> 未开始
                  </div>
                </div>
              </div>
            </div>
            <div className="admin-md-ft">
              <button
                className="admin-btn"
                onClick={() => setModal({ open: false, item: null })}
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
