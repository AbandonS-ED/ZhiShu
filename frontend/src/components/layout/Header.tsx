'use client'

import { usePathname } from 'next/navigation'

// 模板页面标题映射（来自 7 个模板的 script titles + 标题）
const pageTitles: Record<string, { title: string; sub: string; actions?: React.ReactNode }> = {
  '/': { title: '仪表盘', sub: '欢迎回来' },
  '/duihua': {
    title: '智能对话',
    sub: 'AI 导论 · 智能辅导',
  },
  '/profile': {
    title: '学习画像',
    sub: '六维个性化分析',
  },
  '/resources': {
    title: '资源中心',
    sub: 'AI 导论 · 学习资源',
  },
  '/path': {
    title: '学习路径',
    sub: '个性化路径规划',
  },
  '/tiku': {
    title: '练习题库',
    sub: '智能练习与评估',
  },
  '/pinggu': {
    title: '学习评估',
    sub: '效果分析报告',
  },
}

function getPageInfo(pathname: string) {
  if (pageTitles[pathname]) return pageTitles[pathname]
  return { title: '智枢', sub: '多智能体学习平台' }
}

export function Header() {
  const pathname = usePathname()
  const { title, sub } = getPageInfo(pathname)

  return (
    <header className="hdr">
      <h2>{title}</h2>
      <div className="sep"></div>
      <span className="sub">{sub}</span>
      <div className="hdr-actions">
        <button className="hdr-btn" aria-label="通知">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
        </button>
        <button className="hdr-btn" aria-label="设置">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
      </div>
    </header>
  )
}
