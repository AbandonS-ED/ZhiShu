'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAdmin } from '@/lib/admin/context'
import { AdminCheckbox, BatchDeleteBar, useSelection } from '@/lib/admin/components'
import { adminApi, type AdminUser } from '@/lib/api'

export default function UsersPage() {
  const { showToast } = useAdmin()
  const [users, setUsers] = useState<AdminUser[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<{ open: boolean; user: AdminUser | null }>({ open: false, user: null })
  const { selected, toggleAll, toggleOne, clear } = useSelection(users)

  const loadUsers = useCallback(async () => {
    setLoading(true)
    try {
      const data = await adminApi.getUsers(page, 20, search || undefined, roleFilter || undefined)
      setUsers(data.items)
      setTotal(data.total)
    } catch { showToast('加载用户失败') }
    setLoading(false)
  }, [page, search, roleFilter])

  useEffect(() => { loadUsers() }, [loadUsers])

  async function toggleActive(user: AdminUser) {
    try {
      await adminApi.updateUser(user.id, { is_active: !user.is_active })
      showToast(`已${user.is_active ? '禁用' : '启用'} ${user.name}`)
      loadUsers()
    } catch { showToast('操作失败') }
  }

  async function batchDelete() {
    if (!selected.size) return
    if (!confirm(`确认禁用选中的 ${selected.size} 个用户？`)) return
    try {
      for (const id of Array.from(selected)) {
        await adminApi.updateUser(id, { is_active: false })
      }
      showToast(`已禁用 ${selected.size} 个用户`)
      clear()
      loadUsers()
    } catch { showToast('批量操作失败') }
  }

  const totalPages = Math.ceil(total / 20)

  return (
    <div className="admin-pnl vis">
      <div className="admin-cd">
        <div className="admin-cd-h">
          <h3>用户管理</h3>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              className="admin-input"
              placeholder="搜索学号/姓名..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              style={{ width: 180 }}
            />
            <select
              className="admin-input"
              value={roleFilter}
              onChange={(e) => { setRoleFilter(e.target.value); setPage(1) }}
              style={{ width: 100 }}
            >
              <option value="">全部角色</option>
              <option value="student">学生</option>
              <option value="admin">管理员</option>
            </select>
          </div>
        </div>
        <div className="admin-cd-b" style={{ padding: 0 }}>
          <div className="admin-tw">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 40 }}>
                    <AdminCheckbox
                      checked={selected.size === users.length && users.length > 0}
                      indeterminate={selected.size > 0 && selected.size < users.length}
                      onChange={() => toggleAll(selected.size < users.length)}
                    />
                  </th>
                  <th>学号</th>
                  <th>姓名</th>
                  <th>角色</th>
                  <th>资源数</th>
                  <th>题数</th>
                  <th>状态</th>
                  <th>最近登录</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td><AdminCheckbox checked={selected.has(u.id)} onChange={() => toggleOne(u.id)} /></td>
                    <td><code style={{ fontSize: 11 }}>{u.student_no}</code></td>
                    <td style={{ fontWeight: 500 }}>{u.name}</td>
                    <td style={{ fontSize: 11.5, color: u.role === 'admin' ? 'var(--warm)' : 'var(--ink-2)' }}>{u.role}</td>
                    <td style={{ fontWeight: 500 }}>{u.resource_count}</td>
                    <td style={{ fontWeight: 500 }}>{u.exercise_count}</td>
                    <td>
                      <span className={`admin-tag ${u.is_active ? 'admin-tag-green' : 'admin-tag-red'}`}>
                        {u.is_active ? '活跃' : '禁用'}
                      </span>
                    </td>
                    <td style={{ fontSize: 11.5 }}>{u.last_login ? new Date(u.last_login).toLocaleDateString() : '-'}</td>
                    <td>
                      <button className="admin-btn-s" onClick={() => setModal({ open: true, user: u })}>详情</button>
                      <button className="admin-btn-s" onClick={() => toggleActive(u)} style={{ marginLeft: 4 }}>
                        {u.is_active ? '禁用' : '启用'}
                      </button>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && !loading && (
                  <tr><td colSpan={9} style={{ textAlign: 'center', padding: 20, color: 'var(--ink-2)' }}>暂无用户</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {selected.size > 0 && (
        <BatchDeleteBar selectedCount={selected.size} totalCount={users.length} onClear={clear} onDelete={batchDelete} itemLabel="个用户" />
      )}

      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 12 }}>
          <button className="admin-btn-s" disabled={page <= 1} onClick={() => setPage(page - 1)}>上一页</button>
          <span style={{ fontSize: 12, color: 'var(--ink-2)', lineHeight: '28px' }}>第 {page}/{totalPages} 页</span>
          <button className="admin-btn-s" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>下一页</button>
        </div>
      )}

      {modal.open && modal.user && (
        <div className="admin-modal-mask" onClick={() => setModal({ open: false, user: null })}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-h">
              <h3>用户详情</h3>
              <button onClick={() => setModal({ open: false, user: null })}>×</button>
            </div>
            <div className="admin-modal-b">
              <p>学号: {modal.user.student_no}</p>
              <p>姓名: {modal.user.name}</p>
              <p>邮箱: {modal.user.email || '-'}</p>
              <p>角色: {modal.user.role}</p>
              <p>状态: {modal.user.is_active ? '活跃' : '禁用'}</p>
              <p>资源数: {modal.user.resource_count}</p>
              <p>题数: {modal.user.exercise_count}</p>
              <p>最近登录: {modal.user.last_login ? new Date(modal.user.last_login).toLocaleString() : '-'}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
