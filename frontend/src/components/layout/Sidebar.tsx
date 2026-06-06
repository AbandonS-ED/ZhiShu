'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/stores/appStore'
import {
  LayoutDashboard,
  User,
  Map,
  BookOpen,
  Network,
  MessageCircle,
  Settings,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
} from 'lucide-react'

const navItems = [
  { href: '/', label: '仪表盘', icon: LayoutDashboard },
  { href: '/profile', label: '学习画像', icon: User },
  { href: '/path', label: '学习路径', icon: Map },
  { href: '/resources', label: '学习资源', icon: BookOpen },
  { href: '/mindmap', label: '思维导图', icon: Network },
  { href: '/tutor', label: '智能问答', icon: MessageCircle },
]

export function Sidebar() {
  const pathname = usePathname()
  const { sidebarOpen, toggleSidebar } = useAppStore()

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-40 h-screen bg-white border-r border-gray-200 transition-all duration-300',
        sidebarOpen ? 'w-64' : 'w-20'
      )}
    >
      {/* Logo */}
      <div className="flex items-center h-16 px-4 border-b border-gray-200">
        <GraduationCap className="w-8 h-8 text-primary-600 flex-shrink-0" />
        {sidebarOpen && (
          <span className="ml-3 text-xl font-bold text-gray-900">智学</span>
        )}
        <button
          onClick={toggleSidebar}
          className="ml-auto p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
        >
          {sidebarOpen ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
        </button>
      </div>

      {/* 导航菜单 */}
      <nav className="p-4 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary-50 text-primary-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              )}
            >
              <item.icon
                className={cn(
                  'w-5 h-5 flex-shrink-0',
                  isActive ? 'text-primary-600' : 'text-gray-400'
                )}
              />
              {sidebarOpen && <span className="ml-3">{item.label}</span>}
            </Link>
          )
        })}
      </nav>

      {/* 底部设置 */}
      <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200">
        <Link
          href="/settings"
          className="flex items-center px-3 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900"
        >
          <Settings className="w-5 h-5 text-gray-400" />
          {sidebarOpen && <span className="ml-3">设置</span>}
        </Link>
      </div>
    </aside>
  )
}
