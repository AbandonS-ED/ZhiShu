'use client'

import { useState, useMemo } from 'react'
import { useAdmin } from '@/lib/admin/context'
import { AdminCheckbox, BatchDeleteBar, useSelection } from '@/lib/admin/components'

interface ChatMsg {
  r: 'u' | 'a'
  x: string
}

interface Chat {
  id: string
  u: string
  t: string
  ct: number
  tm: string
  msg: ChatMsg[]
}

const INIT_CH: Chat[] = [
  {
    id: 'c1',
    u: '张三',
    t: 'ML 学习对话',
    ct: 12,
    tm: '06-11',
    msg: [
      { r: 'u', x: '什么是 Transformer？' },
      { r: 'a', x: 'Transformer 是一种基于自注意力机制的深度学习架构，由 Vaswani 等人在 2017 年提出。' },
      { r: 'u', x: '它和 RNN 有什么区别？' },
      { r: 'a', x: '主要区别：1) Transformer 可以并行计算；2) 直接建模任意位置间的关系。' },
    ],
  },
  {
    id: 'c2',
    u: '李四',
    t: '路径规划讨论',
    ct: 5,
    tm: '06-10',
    msg: [
      { r: 'u', x: '帮我规划一个深度学习的学习路径' },
      { r: 'a', x: '好的，基于你的学习画像，我为你规划了 21 天的学习路径...' },
    ],
  },
  {
    id: 'c3',
    u: '赵六',
    t: 'CNN 问题咨询',
    ct: 8,
    tm: '06-10',
    msg: [
      { r: 'u', x: 'CNN 的卷积操作是什么？' },
      { r: 'a', x: '卷积操作通过卷积核在输入特征图上滑动来提取局部特征。' },
    ],
  },
]

export default function ChatsPage() {
  const { showToast } = useAdmin()
  const [list, setList] = useState<Chat[]>(INIT_CH)
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState<{ open: boolean; item: Chat | null }>({
    open: false,
    item: null,
  })

  const filtered = useMemo(() => {
    let r = list
    if (search) {
      const q = search.toLowerCase()
      r = r.filter((x) => x.u.toLowerCase().includes(q) || x.t.toLowerCase().includes(q))
    }
    return r
  }, [list, search])

  const sel = useSelection(filtered)

  function batchDelete() {
    if (sel.selectedCount === 0) return
    if (typeof window !== 'undefined' && !window.confirm(`确认删除选中的 ${sel.selectedCount} 个会话？`)) return
    const ids = Array.from(sel.selected)
    setList((prev) => prev.filter((x) => !ids.includes(x.id)))
    sel.clear()
    showToast(`已批量删除 ${ids.length} 个会话`)
  }

  return (
    <div className="admin-pnl vis">
      <div className="admin-tb">
        <input
          className="admin-si"
          placeholder="搜索用户..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div style={{ marginLeft: 'auto', fontSize: 11.5, color: 'var(--ink-3)' }}>
          共 <b style={{ color: 'var(--ink)' }}>{filtered.length}</b> 条会话
        </div>
      </div>
      <BatchDeleteBar
        selectedCount={sel.selectedCount}
        totalCount={filtered.length}
        onClear={sel.clear}
        onDelete={batchDelete}
        itemLabel="个会话"
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
                  <th>消息数</th>
                  <th>时间</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => {
                  const isSel = sel.selected.has(c.id)
                  return (
                    <tr key={c.id} className={isSel ? 'is-selected' : ''}>
                      <td className="admin-cb-td">
                        <AdminCheckbox
                          checked={isSel}
                          onChange={() => sel.toggleOne(c.id)}
                          ariaLabel={`选择 ${c.t}`}
                        />
                      </td>
                      <td style={{ fontWeight: 500 }}>{c.u}</td>
                    <td>{c.t}</td>
                    <td>{c.ct}</td>
                    <td style={{ fontSize: 11, color: 'var(--ink-3)' }}>{c.tm}</td>
                    <td>
                      <button
                        className="admin-btn admin-btn-sm"
                        onClick={() => setModal({ open: true, item: c })}
                      >
                        查看对话
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
              <h3>对话: {modal.item.t}</h3>
              <button
                className="admin-md-x"
                onClick={() => setModal({ open: false, item: null })}
              >
                &times;
              </button>
            </div>
            <div className="admin-md-body">
              <div className="admin-md-r" style={{ marginBottom: 16 }}>
                <span className="ml">用户</span>
                <span className="mv">{modal.item.u}</span>
              </div>
              <div className="admin-cht-m">
                {modal.item.msg.map((m, i) => {
                  const cls = m.r === 'u' ? 'u' : 'a'
                  const av = { background: m.r === 'u' ? 'var(--warm-soft)' : 'var(--info-soft)', color: m.r === 'u' ? 'var(--warm)' : 'var(--info)' }
                  const ico = m.r === 'u' ? 'U' : 'A'
                  return (
                    <div key={i} className={`admin-cht-msg ${cls}`}>
                      <div className="admin-cht-av" style={av}>
                        {ico}
                      </div>
                      <div className="admin-cht-bl">{m.x}</div>
                    </div>
                  )
                })}
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
