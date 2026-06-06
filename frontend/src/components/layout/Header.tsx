'use client'

import { usePathname } from 'next/navigation'
import { Bell, Settings, Search } from 'lucide-react'

// 模板风格的页面标题映射（来自 code.html script titles）
const pageTitles: Record<string, [string, string]> = {
  '/': ['仪表盘', '欢迎回来'],
  '/tutor': ['智能对话', 'AI 导论 · 智能辅导'],
  '/profile': ['学习画像', '六维个性化分析'],
  '/resources': ['资源中心', 'AI 导论 · 学习资源'],
  '/mindmap': ['思维导图', '知识结构可视化'],
  '/path': ['学习路径', '个性化路径规划'],
}

function getPageInfo(pathname: string): [string, string] {
  return pageTitles[pathname] || ['智枢', '多智能体学习平台']
}

export function Header() {
  const pathname = usePathname()
  const [title, sub] = getPageInfo(pathname)

  return (
    <header
      style={{
        height: 60,
        background: 'var(--surface-glass)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderBottom: '1px solid var(--line)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 32px',
        gap: 14,
        flexShrink: 0,
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}
    >
      <h2
        style={{
          fontSize: 19,
          color: 'var(--ink)',
          fontWeight: 400,
          fontFamily: 'Newsreader, Georgia, serif',
          letterSpacing: '-0.02em',
        }}
      >
        {title}
      </h2>
      <div
        style={{ width: 1, height: 18, background: 'var(--line)', margin: '0 2px' }}
      />
      <span style={{ fontSize: 12.5, color: 'var(--ink-3)', fontWeight: 400 }}>
        {sub}
      </span>

      {/* 右侧操作 */}
      <div
        style={{
          marginLeft: 'auto',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        {/* 搜索（模板中是图标按钮） */}
        <button
          className="hdr-btn"
          aria-label="搜索"
          style={{
            width: 34,
            height: 34,
            borderRadius: 'var(--r-xs)',
            border: '1px solid var(--line)',
            background: 'transparent',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.2s var(--ease)',
            color: 'var(--ink-3)',
          }}
        >
          <Search size={16} />
        </button>

        {/* 通知 */}
        <button
          className="hdr-btn"
          aria-label="通知"
          style={{
            width: 34,
            height: 34,
            borderRadius: 'var(--r-xs)',
            border: '1px solid var(--line)',
            background: 'transparent',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.2s var(--ease)',
            color: 'var(--ink-3)',
          }}
        >
          <Bell size={16} />
        </button>

        {/* 设置 */}
        <button
          className="hdr-btn"
          aria-label="设置"
          style={{
            width: 34,
            height: 34,
            borderRadius: 'var(--r-xs)',
            border: '1px solid var(--line)',
            background: 'transparent',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.2s var(--ease)',
            color: 'var(--ink-3)',
          }}
        >
          <Settings size={16} />
        </button>
      </div>
    </header>
  )
}
