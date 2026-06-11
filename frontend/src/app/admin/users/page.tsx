'use client'

import { useState, useMemo, useEffect } from 'react'
import { useAdmin } from '@/lib/admin/context'
import { AdminCheckbox, BatchDeleteBar, useSelection } from '@/lib/admin/components'

interface User {
  id: string
  no: string
  n: string
  m: string
  r: number
  e: number
  s: 0 | 1
  la: string
}

const AVATAR_COLORS = [
  { b: 'var(--warm-soft)', c: 'var(--warm)' },
  { b: 'var(--info-soft)', c: 'var(--info)' },
  { b: 'var(--accent-soft)', c: 'var(--ink-2)' },
  { b: 'var(--purple-soft)', c: 'var(--purple)' },
  { b: 'var(--success-soft)', c: 'var(--success)' },
  { b: 'var(--danger-soft)', c: 'var(--danger)' },
]

const INIT_USERS: User[] = [
  { id: 'u1', no: '2024001', n: '张三', m: '计算机科学', r: 12, e: 48, s: 1, la: '2小时前' },
  { id: 'u2', no: '2024002', n: '李四', m: '人工智能', r: 8, e: 32, s: 1, la: '5小时前' },
  { id: 'u3', no: '2024003', n: '王五', m: '软件工程', r: 0, e: 0, s: 0, la: '2天前' },
  { id: 'u4', no: '2024004', n: '赵六', m: '数据科学', r: 15, e: 56, s: 1, la: '1小时前' },
  { id: 'u5', no: '2024005', n: '孙七', m: '计算机科学', r: 3, e: 12, s: 1, la: '30分钟前' },
  { id: 'u6', no: '2024006', n: '周八', m: '人工智能', r: 0, e: 0, s: 0, la: '5天前' },
]

export default function UsersPage() {
  const { showToast } = useAdmin()
  const [users, setUsers] = useState<User[]>(INIT_USERS)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [modal, setModal] = useState<{ open: boolean; user: User | null }>({ open: false, user: null })

  const filtered = useMemo(() => {
    let r = users
    if (search) {
      const q = search.toLowerCase()
      r = r.filter((u) => u.n.toLowerCase().includes(q) || u.no.toLowerCase().includes(q))
    }
    if (statusFilter === 'active') r = r.filter((u) => u.s === 1)
    if (statusFilter === 'disabled') r = r.filter((u) => u.s === 0)
    return r
  }, [users, search, statusFilter])

  const sel = useSelection(filtered)

  function togU(u: User) {
    setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, s: x.s === 1 ? 0 : 1 } : x)))
    showToast(u.s === 1 ? `已禁用: ${u.n}` : `已启用: ${u.n}`)
  }

  function delU(u: User) {
    if (typeof window !== 'undefined' && !window.confirm(`确认删除 ${u.n}？`)) return
    setUsers((prev) => prev.filter((x) => x.id !== u.id))
    sel.removeMany([u.id])
    showToast(`已删除: ${u.n}`)
  }

  function batchDelete() {
    if (sel.selectedCount === 0) return
    if (typeof window !== 'undefined' && !window.confirm(`确认删除选中的 ${sel.selectedCount} 个用户？`)) return
    const ids = Array.from(sel.selected)
    setUsers((prev) => prev.filter((x) => !ids.includes(x.id)))
    sel.clear()
    showToast(`已批量删除 ${ids.length} 个用户`)
  }

  function openDetail(u: User) {
    setModal({ open: true, user: u })
  }

  function closeModal() {
    setModal({ open: false, user: null })
  }

  return (
    <div className="admin-pnl vis">
      <div className="admin-tb">
        <input
          className="admin-si"
          placeholder="搜索姓名 / 学号..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="admin-sf"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">全部状态</option>
          <option value="active">活跃</option>
          <option value="disabled">已禁用</option>
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
        itemLabel="个用户"
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
                  <th>学号</th>
                  <th>用户</th>
                  <th>专业</th>
                  <th>资源数</th>
                  <th>题数</th>
                  <th>状态</th>
                  <th>最后登录</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => {
                  const a = AVATAR_COLORS[u.n.charCodeAt(0) % AVATAR_COLORS.length]
                  const isSel = sel.selected.has(u.id)
                  return (
                    <tr key={u.id} className={isSel ? 'is-selected' : ''}>
                      <td className="admin-cb-td">
                        <AdminCheckbox
                          checked={isSel}
                          onChange={() => sel.toggleOne(u.id)}
                          ariaLabel={`选择 ${u.n}`}
                        />
                      </td>
                      <td>
                        <code style={{ fontSize: 11 }}>{u.no}</code>
                      </td>
                      <td>
                        <div className="admin-td-u">
                          <div
                            className="admin-td-a"
                            style={{ background: a.b, color: a.c }}
                          >
                            {u.n[0]}
                          </div>
                          <div>
                            <div className="admin-td-n">{u.n}</div>
                            <div className="admin-td-d">{u.m}</div>
                          </div>
                        </div>
                      </td>
                      <td>{u.m}</td>
                      <td style={{ fontWeight: 500 }}>{u.r}</td>
                      <td style={{ fontWeight: 500 }}>{u.e}</td>
                      <td>
                        <span className={`admin-sd ${u.s ? 'on' : 'off'}`}></span>
                        {u.s ? '活跃' : '已禁用'}
                      </td>
                      <td style={{ fontSize: 11, color: 'var(--ink-3)' }}>{u.la}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button
                            className="admin-btn admin-btn-sm"
                            onClick={() => openDetail(u)}
                          >
                            详情
                          </button>
                          <button
                            className={`admin-btn admin-btn-sm ${u.s ? 'admin-btn-danger' : ''}`}
                            onClick={() => togU(u)}
                          >
                            {u.s ? '禁用' : '启用'}
                          </button>
                          <button
                            className="admin-btn admin-btn-sm"
                            onClick={() => delU(u)}
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

      {modal.open && modal.user && (
        <div className="admin-mo vis" onClick={(e) => { if (e.target === e.currentTarget) closeModal() }}>
          <div className="admin-md">
            <div className="admin-md-h">
              <h3>用户详情</h3>
              <button className="admin-md-x" onClick={closeModal}>
                &times;
              </button>
            </div>
            <div className="admin-md-body">
              <h4 style={{ fontSize: 13, marginBottom: 10, fontFamily: 'Newsreader, serif' }}>
                基本信息
              </h4>
              <div className="admin-md-r">
                <span className="ml">姓名</span>
                <span className="mv">{modal.user.n}</span>
              </div>
              <div className="admin-md-r">
                <span className="ml">学号</span>
                <span className="mv">{modal.user.no}</span>
              </div>
              <div className="admin-md-r">
                <span className="ml">专业</span>
                <span className="mv">{modal.user.m}</span>
              </div>
              <div className="admin-md-r">
                <span className="ml">状态</span>
                <span className="mv">{modal.user.s ? '活跃' : '已禁用'}</span>
              </div>
              <div className="admin-md-r">
                <span className="ml">最后登录</span>
                <span className="mv">{modal.user.la}</span>
              </div>
              <div className="admin-md-sec">
                <h4>学习画像</h4>
                <div className="admin-md-r">
                  <span className="ml">知识掌握</span>
                  <span className="mv">Python: 0.8 · ML: 0.6 · DL: 0.3</span>
                </div>
                <div className="admin-md-r">
                  <span className="ml">学习风格</span>
                  <span className="mv">视觉型 70% / 文本型 30%</span>
                </div>
                <div className="admin-md-r">
                  <span className="ml">认知水平</span>
                  <span className="mv">记忆 80 · 理解 70 · 应用 60</span>
                </div>
                <div className="admin-md-r">
                  <span className="ml">薄弱环节</span>
                  <span className="mv">深度学习 · 自然语言处理</span>
                </div>
              </div>
              <div className="admin-md-sec">
                <h4>学习统计</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
                  <div
                    style={{
                      textAlign: 'center',
                      padding: 12,
                      background: 'var(--bg)',
                      borderRadius: 7,
                    }}
                  >
                    <div style={{ fontFamily: 'Newsreader,serif', fontSize: 22, color: 'var(--warm)' }}>
                      {modal.user.r}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--ink-3)' }}>资源数</div>
                  </div>
                  <div
                    style={{
                      textAlign: 'center',
                      padding: 12,
                      background: 'var(--bg)',
                      borderRadius: 7,
                    }}
                  >
                    <div style={{ fontFamily: 'Newsreader,serif', fontSize: 22, color: 'var(--info)' }}>
                      {modal.user.e}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--ink-3)' }}>练习题</div>
                  </div>
                  <div
                    style={{
                      textAlign: 'center',
                      padding: 12,
                      background: 'var(--bg)',
                      borderRadius: 7,
                    }}
                  >
                    <div style={{ fontFamily: 'Newsreader,serif', fontSize: 22, color: 'var(--success)' }}>
                      3
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--ink-3)' }}>学习路径</div>
                  </div>
                </div>
              </div>
            </div>
            <div className="admin-md-ft">
              <button
                className="admin-btn admin-btn-danger"
                onClick={() => {
                  togU(modal.user!)
                  closeModal()
                }}
              >
                {modal.user.s ? '禁用账号' : '启用账号'}
              </button>
              <button className="admin-btn" onClick={closeModal}>
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
