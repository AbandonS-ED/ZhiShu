'use client'

import { useAppStore } from '@/stores/appStore'
import { Bell, Search, ChevronDown } from 'lucide-react'
import * as Avatar from '@radix-ui/react-avatar'

export function Header() {
  const { student, sidebarOpen } = useAppStore()

  return (
    <header
      className={`fixed top-0 right-0 z-30 h-16 bg-white border-b border-gray-200 transition-all duration-300 ${
        sidebarOpen ? 'left-64' : 'left-20'
      }`}
    >
      <div className="flex items-center justify-between h-full px-6">
        {/* 左侧：课程选择器 */}
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2 px-3 py-1.5 bg-gray-50 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-100">
            <span className="text-sm font-medium text-gray-700">人工智能导论</span>
            <ChevronDown size={14} className="text-gray-400" />
          </div>
        </div>

        {/* 右侧：搜索、通知、用户头像 */}
        <div className="flex items-center space-x-4">
          {/* 搜索框 */}
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="搜索知识点..."
              className="pl-9 pr-4 py-2 w-64 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          {/* 通知铃铛 */}
          <button className="relative p-2 text-gray-500 hover:bg-gray-50 rounded-lg">
            <Bell size={20} />
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
          </button>

          {/* 用户头像 */}
          <div className="flex items-center space-x-3 cursor-pointer">
            <Avatar.Root className="w-9 h-9 rounded-full overflow-hidden bg-primary-100">
              <Avatar.Image
                src={student?.avatar_url}
                alt={student?.name}
                className="w-full h-full object-cover"
              />
              <Avatar.Fallback className="flex items-center justify-center w-full h-full text-sm font-medium text-primary-700">
                {student?.name?.charAt(0) || '张'}
              </Avatar.Fallback>
            </Avatar.Root>
            <div className="hidden md:block">
              <p className="text-sm font-medium text-gray-900">{student?.name || '张三'}</p>
              <p className="text-xs text-gray-500">{student?.student_no || '2024001'}</p>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
