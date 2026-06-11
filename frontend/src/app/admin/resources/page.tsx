'use client'

import { useState, useMemo } from 'react'
import { useAdmin } from '@/lib/admin/context'
import { AdminCheckbox, BatchDeleteBar, useSelection } from '@/lib/admin/components'

interface Resource {
  id: string
  u: string
  t: string
  kp: string
  tp: string
  tm: string
  ct: string
}

const INIT_RS: Resource[] = [
  {
    id: 'r1',
    u: '张三',
    t: 'Transformer 架构详解',
    kp: 'Transformer',
    tp: '知识讲解',
    tm: '06-11',
    ct: 'Transformer 是一种基于自注意力机制的深度学习模型，由 Vaswani 等人在 2017 年提出。\n\n核心组件：\n1. 多头自注意力 (Multi-Head Self-Attention)\n2. 前馈神经网络 (FFN)\n3. 位置编码 (Positional Encoding)\n\n代码示例：\nclass MultiHeadAttention(nn.Module):\n    def __init__(self, d_model, n_heads):\n        super().__init__()\n        self.n_heads = n_heads\n        self.d_k = d_model // n_heads',
  },
  {
    id: 'r2',
    u: '李四',
    t: 'A* 搜索算法',
    kp: 'A*算法',
    tp: '代码示例',
    tm: '06-10',
    ct: 'A* 是一种启发式搜索算法。\n\ndef a_star(graph, start, goal):\n    open_set = {start}\n    g_score = {start: 0}\n    f_score = {start: heuristic(start, goal)}',
  },
  {
    id: 'r3',
    u: '赵六',
    t: '卷积神经网络入门',
    kp: 'CNN',
    tp: '知识讲解',
    tm: '06-10',
    ct: '卷积神经网络 (CNN) 是深度学习中最重要的架构之一。',
  },
  {
    id: 'r4',
    u: '张三',
    t: '注意力机制详解',
    kp: 'Attention',
    tp: '综合资源',
    tm: '06-09',
    ct: '注意力机制允许模型在处理序列时关注不同位置的信息。',
  },
  {
    id: 'r5',
    u: '孙七',
    t: 'Python 基础数据结构',
    kp: 'Python',
    tp: '知识讲解',
    tm: '06-09',
    ct: 'Python 提供了多种内置数据结构。',
  },
]

const TYPE_MAP: Record<string, string> = {
  知识讲解: 'admin-tag-info',
  代码示例: 'admin-tag-warm',
  综合资源: 'admin-tag-purple',
}

export default function ResourcesPage() {
  const { showToast } = useAdmin()
  const [list, setList] = useState<Resource[]>(INIT_RS)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [modal, setModal] = useState<{ open: boolean; item: Resource | null }>({
    open: false,
    item: null,
  })

  const filtered = useMemo(() => {
    let r = list
    if (search) {
      const q = search.toLowerCase()
      r = r.filter((x) => x.t.toLowerCase().includes(q) || x.kp.toLowerCase().includes(q))
    }
    if (typeFilter) r = r.filter((x) => x.tp === typeFilter)
    return r
  }, [list, search, typeFilter])

  const sel = useSelection(filtered)

  function delR(r: Resource) {
    if (typeof window !== 'undefined' && !window.confirm('确认删除？')) return
    setList((prev) => prev.filter((x) => x.id !== r.id))
    sel.removeMany([r.id])
    showToast('已删除')
  }

  function batchDelete() {
    if (sel.selectedCount === 0) return
    if (typeof window !== 'undefined' && !window.confirm(`确认删除选中的 ${sel.selectedCount} 个资源？`)) return
    const ids = Array.from(sel.selected)
    setList((prev) => prev.filter((x) => !ids.includes(x.id)))
    sel.clear()
    showToast(`已批量删除 ${ids.length} 个资源`)
  }

  return (
    <div className="admin-pnl vis">
      <div className="admin-tb">
        <input
          className="admin-si"
          placeholder="搜索资源标题..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="admin-sf"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
        >
          <option value="">全部类型</option>
          <option>知识讲解</option>
          <option>代码示例</option>
          <option>综合资源</option>
        </select>
        <div style={{ marginLeft: 'auto', fontSize: 11.5, color: 'var(--ink-3)' }}>
          共 <b style={{ color: 'var(--ink)' }}>{filtered.length}</b> 条
        </div>
      </div>
      <BatchDeleteBar
        selectedCount={sel.selectedCount}
        totalCount={filtered.length}
        onClear={sel.clear}
        onDelete={batchDelete}
        itemLabel="个资源"
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
                  <th>知识点</th>
                  <th>类型</th>
                  <th>时间</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const isSel = sel.selected.has(r.id)
                  return (
                    <tr key={r.id} className={isSel ? 'is-selected' : ''}>
                      <td className="admin-cb-td">
                        <AdminCheckbox
                          checked={isSel}
                          onChange={() => sel.toggleOne(r.id)}
                          ariaLabel={`选择 ${r.t}`}
                        />
                      </td>
                      <td style={{ fontWeight: 500 }}>{r.u}</td>
                    <td
                      style={{
                        maxWidth: 200,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {r.t}
                    </td>
                    <td>
                      <span className="admin-tag admin-tag-dark">{r.kp}</span>
                    </td>
                    <td>
                      <span className={`admin-tag ${TYPE_MAP[r.tp] || 'admin-tag-dark'}`}>
                        {r.tp}
                      </span>
                    </td>
                    <td style={{ fontSize: 11, color: 'var(--ink-3)' }}>{r.tm}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button
                          className="admin-btn admin-btn-sm"
                          onClick={() => setModal({ open: true, item: r })}
                        >
                          查看
                        </button>
                        <button
                          className="admin-btn admin-btn-sm admin-btn-danger"
                          onClick={() => delR(r)}
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
          <div className="admin-pg">
            <span>共 {filtered.length} 条，第 1/1 页</span>
            <div className="admin-pg-b">
              <button className="admin-pg-btn">&lt;</button>
              <button className="admin-pg-btn ac">1</button>
              <button className="admin-pg-btn">&gt;</button>
            </div>
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
              <h3>资源详情</h3>
              <button
                className="admin-md-x"
                onClick={() => setModal({ open: false, item: null })}
              >
                &times;
              </button>
            </div>
            <div className="admin-md-body">
              <div className="admin-md-r">
                <span className="ml">标题</span>
                <span className="mv">{modal.item.t}</span>
              </div>
              <div className="admin-md-r">
                <span className="ml">知识点</span>
                <span className="mv">{modal.item.kp}</span>
              </div>
              <div className="admin-md-r">
                <span className="ml">类型</span>
                <span className="mv">{modal.item.tp}</span>
              </div>
              <div className="admin-md-r">
                <span className="ml">生成者</span>
                <span className="mv">{modal.item.u}</span>
              </div>
              <div className="admin-md-r">
                <span className="ml">时间</span>
                <span className="mv">{modal.item.tm}</span>
              </div>
              <div className="admin-md-sec">
                <h4>完整内容</h4>
                <div className="admin-md-code">{modal.item.ct}</div>
              </div>
            </div>
            <div className="admin-md-ft">
              <button
                className="admin-btn admin-btn-danger"
                onClick={() => {
                  delR(modal.item!)
                  setModal({ open: false, item: null })
                }}
              >
                删除资源
              </button>
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
