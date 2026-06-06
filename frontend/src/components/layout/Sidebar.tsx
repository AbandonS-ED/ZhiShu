'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  MessageSquare,
  User,
  BookOpen,
  Network,
  ClipboardCheck,
} from 'lucide-react'

type NavItem = {
  href: string
  label: string
  icon: typeof LayoutDashboard
  exact?: boolean
  tag?: string
}

const navGroups: { label: string; items: NavItem[] }[] = [
  {
    label: 'Overview',
    items: [
      { href: '/', label: '仪表盘', icon: LayoutDashboard, exact: true },
    ],
  },
  {
    label: 'Learning',
    items: [
      { href: '/tutor', label: '智能对话', icon: MessageSquare, tag: 'AI' },
      { href: '/profile', label: '学习画像', icon: User },
      { href: '/resources', label: '资源中心', icon: BookOpen },
      { href: '/mindmap', label: '思维导图', icon: Network },
      { href: '/path', label: '学习路径', icon: ClipboardCheck },
    ],
  },
]

export default function Sidebar() {
  const pathname = usePathname()

  const isActive = (href: string, exact?: boolean) => {
    if (exact) return pathname === href
    return pathname === href || pathname.startsWith(href + '/')
  }

  return (
    <aside
      style={{
        width: 240,
        background: 'var(--surface)',
        borderRight: '1px solid var(--line)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        position: 'relative',
        zIndex: 20,
        height: '100vh',
      }}
    >
      {/* 品牌区 */}
      <div
        style={{
          padding: '24px 22px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: 11,
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            background: 'var(--ink)',
            borderRadius: 9,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--bg)',
            fontFamily: 'Newsreader, Georgia, serif',
            fontSize: 16,
            fontStyle: 'italic',
            transition: 'transform 0.3s var(--ease)',
          }}
        >
          Z
        </div>
        <div>
          <div
            style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: 15,
              fontWeight: 600,
              letterSpacing: '-0.03em',
              color: 'var(--ink)',
            }}
          >
            智枢
          </div>
          <span
            style={{
              fontSize: 10.5,
              color: 'var(--ink-3)',
              fontWeight: 400,
              display: 'block',
              letterSpacing: 0,
            }}
          >
            SmartHub · v1.0
          </span>
        </div>
      </div>

      {/* 导航 */}
      <nav style={{ flex: 1, padding: '8px 10px', overflowY: 'auto' }}>
        {navGroups.map((group) => (
          <div key={group.label}>
            <div
              style={{
                fontSize: 10,
                textTransform: 'uppercase',
                letterSpacing: '1.4px',
                color: 'var(--ink-4)',
                padding: '16px 14px 6px',
                fontWeight: 600,
              }}
            >
              {group.label}
            </div>
            {group.items.map((item) => {
              const Icon = item.icon
              const active = isActive(item.href, item.exact)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 11,
                    padding: '9px 14px',
                    borderRadius: 'var(--r-xs)',
                    cursor: 'pointer',
                    transition: 'all 0.2s var(--ease)',
                    fontSize: 13,
                    fontWeight: 500,
                    color: active ? 'var(--ink)' : 'var(--ink-3)',
                    background: active ? 'var(--accent-soft)' : 'transparent',
                    marginBottom: 1,
                    userSelect: 'none',
                    position: 'relative',
                    textDecoration: 'none',
                  }}
                >
                  <span
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      width: 3,
                      height: active ? 16 : 0,
                      borderRadius: 2,
                      background: 'var(--ink)',
                      transition: 'height 0.25s var(--ease)',
                    }}
                  />
                  <Icon
                    size={17}
                    style={{ opacity: active ? 0.9 : 0.55, flexShrink: 0 }}
                  />
                  <span style={{ flex: 1 }}>{item.label}</span>
                  {item.tag && (
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 600,
                        padding: '1.5px 7px',
                        borderRadius: 6,
                        background: 'var(--warm-soft)',
                        color: 'var(--warm)',
                        letterSpacing: 0,
                      }}
                    >
                      {item.tag}
                    </span>
                  )}
                </Link>
              )
            })}
          </div>
        ))}
      </nav>

      {/* 底部用户区 */}
      <div
        style={{
          padding: '16px 20px',
          borderTop: '1px solid var(--line)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: '50%',
            background: 'var(--bg-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--ink-2)',
            border: '1.5px solid var(--line)',
          }}
        >
          张
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{ fontSize: 12.5, color: 'var(--ink)', fontWeight: 500 }}
          >
            张明远
          </div>
          <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>
            计算机科学 · 大三
          </div>
        </div>
      </div>
    </aside>
  )
}
