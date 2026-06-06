'use client'

import Link from 'next/link'
import { Play, Map, MessageCircle, BookOpen } from 'lucide-react'

const actions = [
  {
    label: '继续学习',
    href: '/path',
    icon: Play,
    color: 'bg-primary-500 hover:bg-primary-600',
  },
  {
    label: '查看路径',
    href: '/path',
    icon: Map,
    color: 'bg-emerald-500 hover:bg-emerald-600',
  },
  {
    label: '智能问答',
    href: '/tutor',
    icon: MessageCircle,
    color: 'bg-amber-500 hover:bg-amber-600',
  },
  {
    label: '学习资源',
    href: '/resources',
    icon: BookOpen,
    color: 'bg-purple-500 hover:bg-purple-600',
  },
]

export function QuickActions() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {actions.map((action) => (
        <Link
          key={action.label}
          href={action.href}
          className={`flex items-center justify-center space-x-2 px-4 py-3 rounded-xl text-white font-medium text-sm transition-colors ${action.color}`}
        >
          <action.icon size={18} />
          <span>{action.label}</span>
        </Link>
      ))}
    </div>
  )
}
