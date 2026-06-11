'use client'

import { useState, useMemo } from 'react'
import { useAdmin } from '@/lib/admin/context'
import { AdminCheckbox, BatchDeleteBar, useSelection } from '@/lib/admin/components'

interface Exercise {
  id: string
  u: string
  t: string
  tp: string
  df: '简单' | '中等' | '困难'
  kp: string
}

const INIT_EX: Exercise[] = [
  { id: 'e1', u: '张三', t: 'Transformer 中自注意力机制的计算过程是什么？', tp: '简答题', df: '中等', kp: 'Transformer' },
  { id: 'e2', u: '李四', t: '实现 A* 算法的 open list 数据结构应选择...', tp: '选择题', df: '简单', kp: 'A*算法' },
  { id: 'e3', u: '赵六', t: 'CNN 中池化层的作用及常见类型', tp: '简答题', df: '简单', kp: 'CNN' },
  { id: 'e4', u: '张三', t: '编写一个 Transformer Encoder Block', tp: '编程题', df: '困难', kp: 'Transformer' },
  { id: 'e5', u: '孙七', t: 'Python 列表与元组的区别', tp: '选择题', df: '简单', kp: 'Python' },
]

const DF_TAG: Record<string, string> = {
  简单: 'admin-tag-green',
  中等: 'admin-tag-warm',
  困难: 'admin-tag-danger',
}

export default function ExercisesPage() {
  const { showToast } = useAdmin()
  const [list, setList] = useState<Exercise[]>(INIT_EX)
  const [search, setSearch] = useState('')
  const [dfFilter, setDfFilter] = useState('')

  const filtered = useMemo(() => {
    let r = list
    if (search) {
      const q = search.toLowerCase()
      r = r.filter((x) => x.t.toLowerCase().includes(q))
    }
    if (dfFilter) r = r.filter((x) => x.df === dfFilter)
    return r
  }, [list, search, dfFilter])

  const sel = useSelection(filtered)

  function delE(e: Exercise) {
    if (typeof window !== 'undefined' && !window.confirm('确认删除？')) return
    setList((prev) => prev.filter((x) => x.id !== e.id))
    sel.removeMany([e.id])
    showToast('已删除')
  }

  function batchDelete() {
    if (sel.selectedCount === 0) return
    if (typeof window !== 'undefined' && !window.confirm(`确认删除选中的 ${sel.selectedCount} 道题？`)) return
    const ids = Array.from(sel.selected)
    setList((prev) => prev.filter((x) => !ids.includes(x.id)))
    sel.clear()
    showToast(`已批量删除 ${ids.length} 道题`)
  }

  return (
    <div className="admin-pnl vis">
      <div className="admin-tb">
        <input
          className="admin-si"
          placeholder="搜索题目..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="admin-sf"
          value={dfFilter}
          onChange={(e) => setDfFilter(e.target.value)}
        >
          <option value="">全部难度</option>
          <option>简单</option>
          <option>中等</option>
          <option>困难</option>
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
        itemLabel="道题"
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
                  <th>题目</th>
                  <th>类型</th>
                  <th>难度</th>
                  <th>知识点</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => {
                  const isSel = sel.selected.has(e.id)
                  return (
                    <tr key={e.id} className={isSel ? 'is-selected' : ''}>
                      <td className="admin-cb-td">
                        <AdminCheckbox
                          checked={isSel}
                          onChange={() => sel.toggleOne(e.id)}
                          ariaLabel={`选择题目`}
                        />
                      </td>
                      <td style={{ fontWeight: 500 }}>{e.u}</td>
                    <td
                      style={{
                        maxWidth: 220,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {e.t}
                    </td>
                    <td>
                      <span className="admin-tag admin-tag-info">{e.tp}</span>
                    </td>
                    <td>
                      <span className={`admin-tag ${DF_TAG[e.df] || 'admin-tag-dark'}`}>
                        {e.df}
                      </span>
                    </td>
                    <td>
                      <span className="admin-tag admin-tag-dark">{e.kp}</span>
                    </td>
                    <td>
                      <button
                        className="admin-btn admin-btn-sm admin-btn-danger"
                        onClick={() => delE(e)}
                      >
                        删除
                      </button>
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
    </div>
  )
}
