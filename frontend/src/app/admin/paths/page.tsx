'use client'

import { useState, useMemo } from 'react'
import { useAdmin } from '@/lib/admin/context'
import { AdminCheckbox, BatchDeleteBar, useSelection } from '@/lib/admin/components'

interface Path {
  id: string
  u: string
  t: string
  d: number
  n: number
  p: number
}

const INIT_PA: Path[] = [
  { id: 'pa1', u: '张三', t: '机器学习工程师路径', d: 14, n: 12, p: 42 },
  { id: 'pa2', u: '李四', t: '深度学习基础到进阶', d: 21, n: 18, p: 67 },
  { id: 'pa3', u: '赵六', t: 'NLP 方向学习路径', d: 10, n: 8, p: 25 },
]

const DAG_NODES = [
  '数学基础', 'Python 基础', 'NumPy/Pandas', '线性回归', '逻辑回归',
  '决策树', '神经网络', 'CNN', 'RNN/LSTM', 'Transformer',
  '实战项目', '模型部署',
]

export default function PathsPage() {
  const { showToast } = useAdmin()
  const [list, setList] = useState<Path[]>(INIT_PA)
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState<{ open: boolean; item: Path | null }>({
    open: false,
    item: null,
  })

  const filtered = useMemo(() => {
    let r = list
    if (search) {
      const q = search.toLowerCase()
      r = r.filter((x) => x.t.toLowerCase().includes(q) || x.u.toLowerCase().includes(q))
    }
    return r
  }, [list, search])

  const sel = useSelection(filtered)

  function batchDelete() {
    if (sel.selectedCount === 0) return
    if (typeof window !== 'undefined' && !window.confirm(`确认删除选中的 ${sel.selectedCount} 条路径？`)) return
    const ids = Array.from(sel.selected)
    setList((prev) => prev.filter((x) => !ids.includes(x.id)))
    sel.clear()
    showToast(`已批量删除 ${ids.length} 条路径`)
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
          共 <b style={{ color: 'var(--ink)' }}>{filtered.length}</b> 条
        </div>
      </div>
      <BatchDeleteBar
        selectedCount={sel.selectedCount}
        totalCount={filtered.length}
        onClear={sel.clear}
        onDelete={batchDelete}
        itemLabel="条路径"
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
                  <th>用户</th>
                  <th>标题</th>
                  <th>天数</th>
                  <th>节点数</th>
                  <th>进度</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const pc = p.p >= 50 ? 'var(--success)' : 'var(--warm)'
                  const isSel = sel.selected.has(p.id)
                  return (
                    <tr key={p.id} className={isSel ? 'is-selected' : ''}>
                      <td className="admin-cb-td">
                        <AdminCheckbox
                          checked={isSel}
                          onChange={() => sel.toggleOne(p.id)}
                          ariaLabel={`选择 ${p.t}`}
                        />
                      </td>
                      <td style={{ fontWeight: 500 }}>{p.u}</td>
                      <td>{p.t}</td>
                      <td>{p.d}天</td>
                      <td>{p.n}</td>
                      <td>
                        <div className="admin-prg">
                          <div className="admin-prg-t">
                            <div
                              className="admin-prg-f"
                              style={{ width: `${p.p}%`, background: pc }}
                            ></div>
                          </div>
                          <span className="admin-prg-l">{p.p}%</span>
                        </div>
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
              <h3>路径: {modal.item.t}</h3>
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
                <span className="mv">{modal.item.u}</span>
              </div>
              <div className="admin-md-r">
                <span className="ml">总天数</span>
                <span className="mv">{modal.item.d} 天</span>
              </div>
              <div className="admin-md-r">
                <span className="ml">进度</span>
                <span className="mv">
                  <div className="admin-prg">
                    <div className="admin-prg-t" style={{ width: 120 }}>
                      <div
                        className="admin-prg-f"
                        style={{
                          width: `${modal.item.p}%`,
                          background: 'var(--success)',
                        }}
                      ></div>
                    </div>
                    <span className="admin-prg-l">{modal.item.p}%</span>
                  </div>
                </span>
              </div>
              <div className="admin-md-sec">
                <h4>DAG 可视化</h4>
                <div className="admin-dag">
                  <div className="admin-dag-ns">
                    {(() => {
                      const done = Math.floor((modal.item.n * modal.item.p) / 100)
                      const nodes: React.ReactNode[] = []
                      for (let j = 0; j < modal.item.n && j < DAG_NODES.length; j++) {
                        const cls = j < done ? 'done' : j === done ? 'cur' : 'pend'
                        nodes.push(
                          <div key={j} className={`admin-dag-n ${cls}`}>
                            {DAG_NODES[j]}
                          </div>
                        )
                        if ((j + 1) % 4 === 0 && j < modal.item.n - 1) {
                          nodes.push(
                            <div
                              key={`arr-${j}`}
                              style={{ width: '100%', textAlign: 'center', color: 'var(--ink-4)', fontSize: 16 }}
                            >
                              &darr;
                            </div>
                          )
                        }
                      }
                      return nodes
                    })()}
                  </div>
                  <div style={{ marginTop: 12, fontSize: 10.5, color: 'var(--ink-3)' }}>
                    <span style={{ color: 'var(--success)' }}>&#9632;</span> 已完成 &nbsp;
                    <span style={{ color: 'var(--warm)' }}>&#9632;</span> 进行中 &nbsp;
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
