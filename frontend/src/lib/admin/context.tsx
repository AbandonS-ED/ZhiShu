'use client'

import { createContext, useContext, useState, useCallback, ReactNode } from 'react'

export type PanelId = 'pDash' | 'pUsers' | 'pEx' | 'pChat' | 'pDoc' | 'pAg'

export interface PanelMeta {
  id: PanelId
  title: string
  sub: string
}

export const PANELS: Record<PanelId, PanelMeta> = {
  pDash:  { id: 'pDash',  title: '管理仪表盘',     sub: '系统概览 · 数据统计' },
  pUsers: { id: 'pUsers', title: '用户管理',       sub: '用户列表 · 搜索 · 详情' },
  pEx:    { id: 'pEx',    title: '题库管理',       sub: '公共题库 · 新增 · 编辑 · 批量导入' },
  pChat:  { id: 'pChat',  title: '对话记录',       sub: '会话列表 · 消息详情' },
  pDoc:   { id: 'pDoc',   title: '知识库管理',     sub: '文档分块列表' },
  pAg:    { id: 'pAg',    title: 'Agent 监控',     sub: '集群状态 · 调用统计' },
}

export interface AdminUser {
  id: string
  student_no: string
  name: string
  role: string
}

interface AdminContextValue {
  isAuth: boolean
  user: AdminUser | null
  login: (user: AdminUser, token: string) => void
  logout: () => void
  activePanel: PanelId
  setActivePanel: (id: PanelId) => void
  showToast: (msg: string) => void
}

const AdminContext = createContext<AdminContextValue | null>(null)

export function AdminProvider({ children }: { children: ReactNode }) {
  const [isAuth, setIsAuth] = useState(false)
  const [user, setUser] = useState<AdminUser | null>(null)
  const [activePanel, setActivePanel] = useState<PanelId>('pDash')

  const login = useCallback((u: AdminUser, token: string) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('zhishu_admin_token', token)
      localStorage.setItem('zhishu_admin_user', JSON.stringify(u))
    }
    setUser(u)
    setIsAuth(true)
  }, [])

  const logout = useCallback(() => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('zhishu_admin_token')
      localStorage.removeItem('zhishu_admin_user')
    }
    setUser(null)
    setIsAuth(false)
  }, [])

  const showToast = useCallback((msg: string) => {
    if (typeof window === 'undefined') return
    const t = document.getElementById('adminToast')
    if (!t) return
    t.textContent = msg
    t.style.display = 'block'
    t.style.opacity = '1'
    setTimeout(() => {
      t.style.opacity = '0'
      setTimeout(() => { t.style.display = 'none' }, 300)
    }, 2000)
  }, [])

  return (
    <AdminContext.Provider value={{ isAuth, user, login, logout, activePanel, setActivePanel, showToast }}>
      {children}
    </AdminContext.Provider>
  )
}

export function useAdmin() {
  const ctx = useContext(AdminContext)
  if (!ctx) throw new Error('useAdmin must be used within AdminProvider')
  return ctx
}
