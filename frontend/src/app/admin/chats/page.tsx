'use client'

import { useState, useEffect } from 'react'
import { useAdmin } from '@/lib/admin/context'
import { AdminCheckbox, BatchDeleteBar, useSelection } from '@/lib/admin/components'
import { adminApi, type AdminChat, type AdminChatMessage } from '@/lib/api'

export default function ChatsPage() {
  const { showToast } = useAdmin()
  const [list, setList] = useState<AdminChat[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<{ open: boolean; item: AdminChat | null }>({
    open: false,
    item: null,
  })
  const [messages, setMessages] = useState<AdminChatMessage[]>([])
  const [msgLoading, setMsgLoading] = useState(false)

  async function load(p = 1) {
    setLoading(true)
    try {
      const res = await adminApi.getChats(p, 20)
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

  async function openChat(chat: AdminChat) {
    setModal({ open: true, item: chat })
    setMsgLoading(true)
    try {
      const res = await adminApi.getChatMessages(chat.id)
      setMessages(res.items)
    } catch {
      setMessages([])
    } finally {
      setMsgLoading(false)
    }
  }

  async function batchDelete() {
    if (sel.selectedCount === 0) return
    if (!window.confirm(`确认删除选中的 ${sel.selectedCount} 个会话？`)) return
    showToast('后端暂不支持删除会话')
    sel.clear()
  }

  return (
    <div className="admin-pg">
      <div className="admin-tb">
        <div style={{ marginLeft: 'auto', fontSize: 11.5, color: 'var(--ink-3)' }}>
          共 <b style={{ color: 'var(--ink)' }}>{total}</b> 条会话
        </div>
      </div>
      <BatchDeleteBar
        selectedCount={sel.selectedCount}
        totalCount={list.length}
        onClear={sel.clear}
        onDelete={batchDelete}
        itemLabel="个会话"
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
                    <th>消息数</th>
                    <th>时间</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((c) => {
                    const isSel = sel.selected.has(c.id)
                    return (
                      <tr key={c.id} className={isSel ? 'is-selected' : ''}>
                        <td className="admin-cb-td">
                          <AdminCheckbox
                            checked={isSel}
                            onChange={() => sel.toggleOne(c.id)}
                            ariaLabel={`选择 ${c.title}`}
                          />
                        </td>
                        <td style={{ fontWeight: 500 }}>{c.student_name}</td>
                        <td>{c.title || '(无标题)'}</td>
                        <td>{c.message_count}</td>
                        <td style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                          {c.created_at ? new Date(c.created_at).toLocaleDateString() : '-'}
                        </td>
                        <td>
                          <button
                            className="admin-btn admin-btn-sm"
                            onClick={() => openChat(c)}
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
              <h3>对话: {modal.item.title || '(无标题)'}</h3>
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
                <span className="mv">{modal.item.student_name}</span>
              </div>
              <div className="admin-cht-m">
                {msgLoading ? (
                  <div style={{ padding: 20, textAlign: 'center', color: 'var(--ink-3)' }}>加载中...</div>
                ) : messages.length === 0 ? (
                  <div style={{ padding: 20, textAlign: 'center', color: 'var(--ink-3)' }}>暂无消息</div>
                ) : (
                  messages.map((m) => {
                    const cls = m.role === 'user' ? 'u' : 'a'
                    const av = { background: m.role === 'user' ? 'var(--warm-soft)' : 'var(--info-soft)', color: m.role === 'user' ? 'var(--warm)' : 'var(--info)' }
                    const ico = m.role === 'user' ? 'U' : 'A'
                    return (
                      <div key={m.id} className={`admin-cht-msg ${cls}`}>
                        <div className="admin-cht-av" style={av}>
                          {ico}
                        </div>
                        <div className="admin-cht-bl">{m.content}</div>
                      </div>
                    )
                  })
                )}
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
