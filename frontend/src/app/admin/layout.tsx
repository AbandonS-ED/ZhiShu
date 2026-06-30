'use client'

import { useEffect, useState, ReactNode } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { AdminProvider, useAdmin, PANELS, PanelId } from '@/lib/admin/context'

function AdminShell({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { user, isAuth, logout, activePanel, setActivePanel, showToast } = useAdmin()
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    if (pathname === '/admin/login') {
      setHydrated(true)
      return
    }
    const token = localStorage.getItem('zhishu_admin_token')
    const userStr = localStorage.getItem('zhishu_admin_user')
    if (!token || !userStr) {
      router.replace('/admin/login')
      return
    }
    try {
      const u = JSON.parse(userStr)
      if (u.role !== 'admin') {
        router.replace('/admin/login')
        return
      }
    } catch {
      router.replace('/admin/login')
      return
    }
    setHydrated(true)
  }, [pathname, router])

  useEffect(() => {
    if (pathname === '/admin') {
      setActivePanel('pDash')
    } else {
      const seg = pathname.replace('/admin/', '').split('/')[0]
      const map: Record<string, PanelId> = {
        users: 'pUsers',
        resources: 'pRes',
        exercises: 'pEx',
        paths: 'pPath',
        chats: 'pChat',
        documents: 'pDoc',
        agents: 'pAg',
      }
      if (map[seg]) setActivePanel(map[seg])
    }
  }, [pathname, setActivePanel])

  if (pathname === '/admin/login') {
    return <>{children}</>
  }

  if (!hydrated) return null

  function navTo(panel: PanelId, path: string) {
    setActivePanel(panel)
    router.push(path)
  }

  function handleLogout() {
    logout()
    router.push('/admin/login')
  }

  function refresh() {
    showToast('已刷新')
    if (typeof window !== 'undefined') window.location.reload()
  }

  const cur = PANELS[activePanel]

  return (
    <div className="admin-app" style={{ display: 'flex', height: '100vh' }}>
      <aside className="admin-sb">
        <div className="sb-brand">
          <div className="mk2">S</div>
          <div>
            <div className="wm">智枢管理后台</div>
            <span className="su">SmartHub Admin v1.0</span>
          </div>
        </div>
        <nav className="sb-nav">
          <div className="sb-lb">概览</div>
          <div
            className={`sb-it${activePanel === 'pDash' ? ' on' : ''}`}
            onClick={() => navTo('pDash', '/admin')}
          >
            <div className="ld"></div>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <rect x="3" y="3" width="7" height="7" rx="1.5" />
              <rect x="14" y="3" width="7" height="7" rx="1.5" />
              <rect x="14" y="14" width="7" height="7" rx="1.5" />
              <rect x="3" y="14" width="7" height="7" rx="1.5" />
            </svg>
            <span className="sb-text">仪表盘</span>
          </div>
          <div className="sb-lb">管理</div>
          <div
            className={`sb-it${activePanel === 'pUsers' ? ' on' : ''}`}
            onClick={() => navTo('pUsers', '/admin/users')}
          >
            <div className="ld"></div>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
            </svg>
            <span className="sb-text">用户管理</span>
          </div>
          <div
            className={`sb-it${activePanel === 'pRes' ? ' on' : ''}`}
            onClick={() => navTo('pRes', '/admin/resources')}
          >
            <div className="ld"></div>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            <span className="sb-text">资源管理</span>
          </div>
          <div
            className={`sb-it${activePanel === 'pEx' ? ' on' : ''}`}
            onClick={() => navTo('pEx', '/admin/exercises')}
          >
            <div className="ld"></div>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M9 11l3 3L22 4" />
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
            </svg>
            <span className="sb-text">练习题</span>
          </div>
          <div
            className={`sb-it${activePanel === 'pPath' ? ' on' : ''}`}
            onClick={() => navTo('pPath', '/admin/paths')}
          >
            <div className="ld"></div>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="6" cy="6" r="2.5" />
              <circle cx="18" cy="18" r="2.5" />
              <path d="M8.5 8.5a6 6 0 0 1 7 7" />
            </svg>
            <span className="sb-text">学习路径</span>
          </div>
          <div
            className={`sb-it${activePanel === 'pChat' ? ' on' : ''}`}
            onClick={() => navTo('pChat', '/admin/chats')}
          >
            <div className="ld"></div>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <span className="sb-text">对话记录</span>
          </div>
          <div
            className={`sb-it${activePanel === 'pDoc' ? ' on' : ''}`}
            onClick={() => navTo('pDoc', '/admin/documents')}
          >
            <div className="ld"></div>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
            <span className="sb-text">知识库</span>
          </div>
          <div className="sb-lb">监控</div>
          <div
            className={`sb-it${activePanel === 'pAg' ? ' on' : ''}`}
            onClick={() => navTo('pAg', '/admin/agents')}
          >
            <div className="ld"></div>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <polyline points="16 18 22 12 16 6" />
              <polyline points="8 6 2 12 8 18" />
            </svg>
            <span className="sb-text">Agent 监控</span>
          </div>
        </nav>
        <div className="sb-ft">
          <div
            className="sb-av"
            style={{ background: 'var(--warm-soft)', color: 'var(--warm)' }}
          >
            {user?.name?.[0] || '管'}
          </div>
          <div>
            <div className="sb-nm">{user?.name || '系统管理员'}</div>
            <div className="sb-rl">{user?.student_no || 'admin'}</div>
          </div>
          <button
            className="admin-sb-logout"
            onClick={handleLogout}
            title="退出登录"
            aria-label="退出登录"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              width="16"
              height="16"
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </div>
      </aside>

      <div className="admin-mn">
        <header className="admin-hd">
          <h2>{cur.title}</h2>
          <div className="sp"></div>
          <span className="hs">{cur.sub}</span>
          <div className="hd-r">
            <button className="hd-b" title="刷新" onClick={refresh}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <polyline points="23 4 23 10 17 10" />
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
            </button>
          </div>
        </header>
        <div className="admin-cnt">{children}</div>
      </div>

      <div id="adminToast"></div>
    </div>
  )
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <AdminProvider>
      <AdminShell>{children}</AdminShell>
    </AdminProvider>
  )
}
