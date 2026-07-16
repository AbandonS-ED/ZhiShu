'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { useAppStore } from '@/stores/appStore'
import { logout } from '@/lib/student'

type NavItem = {
  href: string
  label: string
  tag?: string
  active?: boolean
  svg: React.ReactNode
}

const gridSvg = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="14" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
  </svg>
)
const chatSvg = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
)
const userSvg = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="8" r="4" />
    <path d="M20 21a8 8 0 1 0-16 0" />
  </svg>
)
const bookSvg = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
  </svg>
)
const pathSvg = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="6" cy="6" r="2.5" />
    <circle cx="18" cy="18" r="2.5" />
    <path d="M8.5 8.5a6 6 0 0 1 7 7" />
  </svg>
)
const checkSvg = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 11l3 3L22 4" />
    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
  </svg>
)
const evalSvg = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="20" x2="18" y2="10" />
    <line x1="12" y1="20" x2="12" y2="4" />
    <line x1="6" y1="20" x2="6" y2="14" />
  </svg>
)
const zixiSvg = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="13" r="8" />
    <path d="M12 9v4l2.5 2.5" />
    <path d="M9 2h6" />
  </svg>
)

const bookmarkSvg = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
  </svg>
)

const wrongBookSvg = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 4h12a2 2 0 0 1 2 2v14" />
    <path d="M4 4v14a2 2 0 0 0 2 2h12" />
    <path d="M16 8l-4 4-2-2" />
    <path d="M8 14l4 4 6-6" />
  </svg>
)

const navGroups: { label: string; items: NavItem[] }[] = [
  {
    label: '主控台',
    items: [
      { href: '/', label: '仪表盘', svg: gridSvg },
    ],
  },
  {
    label: 'AI 学习',
    items: [
      { href: '/duihua', label: '智能对话', tag: 'AI', svg: chatSvg },
      { href: '/zixi', label: '自习模式', tag: 'NEW', svg: zixiSvg },
      { href: '/resources', label: '资源中心', svg: bookSvg },
      { href: '/tiku', label: '练习题库', svg: checkSvg },
      { href: '/wrong-questions', label: '错题本', tag: 'NEW', svg: wrongBookSvg },
    ],
  },
  {
    label: '学习管理',
    items: [
      { href: '/profile', label: '学习画像', svg: userSvg },
      { href: '/pinggu', label: '学习评估', svg: evalSvg },
      { href: '/plan', label: '学习计划', svg: calendarSvg },
      { href: '/resources/my-resources', label: '我的资源', svg: bookmarkSvg },
    ],
  },
]

export default function Sidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const student = useAppStore((s) => s.student)
  const setStudent = useAppStore((s) => s.setStudent)

  useEffect(() => {
    if (student) return
    try {
      const raw = localStorage.getItem('zhishu_student')
      if (raw) setStudent(JSON.parse(raw))
    } catch {}
  }, [student, setStudent])

  const userName = student?.name || student?.student_no || '未登录'
  const userAvatar = (userName).charAt(0) || '未'
  const userRole = [student?.major, student?.grade].filter(Boolean).join(' · ') || '智枢用户'

  function handleLogout() {
    logout()
  }

  const isActive = (href: string) => {
    return pathname === href || pathname.startsWith(href + '/')
  }

  return (
    <aside className={`sidebar${collapsed ? ' collapsed' : ''}`}>
      <div className="sb-brand">
        <div className="mark">S</div>
        <div className="sb-text">
          <div className="wordmark">智枢</div>
          <span className="sub">SmartHub · v1.0</span>
        </div>
        <button
          className="sb-toggle"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? '展开侧边栏' : '收起侧边栏'}
          title={collapsed ? '展开' : '收起'}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {collapsed ? (
              <path d="M9 6l6 6-6 6" />
            ) : (
              <path d="M15 6l-6 6 6 6" />
            )}
          </svg>
        </button>
      </div>

      <nav className="sb-nav">
        {navGroups.map((group) => (
          <div key={group.label}>
            <div className="sb-label">{group.label}</div>
            {group.items.map((item) => {
              const active = isActive(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`sb-item${active ? ' active' : ''}`}
                  title={collapsed ? item.label : undefined}
                >
                  <div className="dot"></div>
                  {item.svg}
                  <span className="sb-text">{item.label}</span>
                  {item.tag && <div className="sb-tag sb-text">{item.tag}</div>}
                </Link>
              )
            })}
          </div>
        ))}
      </nav>

      <div className="sb-foot">
        <div className="av">{userAvatar}</div>
        <div className="info sb-text">
          <div className="name">{userName}</div>
          <div className="role">{userRole}</div>
        </div>
        <button
          className="sb-logout"
          onClick={handleLogout}
          title="退出登录"
          style={{
            marginLeft: 'auto',
            background: 'none',
            border: 'none',
            color: 'var(--muted)',
            cursor: 'pointer',
            padding: '4px',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
        </button>
      </div>
    </aside>
  )
}
