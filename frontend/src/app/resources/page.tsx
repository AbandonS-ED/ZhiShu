'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import {
  FileText,
  Code,
  HelpCircle,
  Headphones,
  Network,
  Play,
  Clock,
  CheckCircle,
  Lock,
} from 'lucide-react'

const resourceTypes = [
  { id: 'all', label: '全部' },
  { id: 'explanation', label: '讲解' },
  { id: 'exercise', label: '练习' },
  { id: 'code', label: '代码' },
  { id: 'audio', label: '音频' },
  { id: 'mindmap', label: '导图' },
]

const typeIcons: Record<string, any> = {
  explanation: FileText,
  exercise: HelpCircle,
  code: Code,
  audio: Headphones,
  mindmap: Network,
}

const difficultyColors: Record<string, string> = {
  beginner: 'bg-emerald-100 text-emerald-700',
  intermediate: 'bg-amber-100 text-amber-700',
  advanced: 'bg-red-100 text-red-700',
}

// 模拟资源数据
const mockResources = [
  {
    id: '1',
    type: 'explanation',
    title: '搜索算法详解',
    description: '全面介绍 BFS、DFS、A* 等搜索算法的原理和实现',
    difficulty: 'intermediate',
    duration: '15分钟',
    status: 'completed',
    kp: '搜索算法',
  },
  {
    id: '2',
    type: 'explanation',
    title: 'BFS vs DFS 对比分析',
    description: '深度对比广度优先和深度优先搜索的优缺点',
    difficulty: 'intermediate',
    duration: '10分钟',
    status: 'completed',
    kp: '搜索算法',
  },
  {
    id: '3',
    type: 'code',
    title: 'A* 算法 Python 实现',
    description: '完整的 A* 搜索算法代码示例与注释',
    difficulty: 'advanced',
    duration: '20分钟',
    status: 'available',
    kp: '搜索算法',
  },
  {
    id: '4',
    type: 'exercise',
    title: '搜索算法练习题',
    description: '5 道选择题 + 2 道编程题',
    difficulty: 'medium',
    duration: '30分钟',
    status: 'available',
    kp: '搜索算法',
    count: '7题',
  },
  {
    id: '5',
    type: 'audio',
    title: '搜索算法音频讲解',
    description: '听老师讲解搜索算法核心概念',
    difficulty: 'beginner',
    duration: '8:30',
    status: 'available',
    kp: '搜索算法',
  },
  {
    id: '6',
    type: 'mindmap',
    title: '搜索算法知识图谱',
    description: '可视化展示搜索算法知识结构',
    difficulty: 'intermediate',
    duration: '5分钟',
    status: 'available',
    kp: '搜索算法',
  },
  {
    id: '7',
    type: 'explanation',
    title: '监督学习入门',
    description: '线性回归、逻辑回归基础讲解',
    difficulty: 'intermediate',
    duration: '20分钟',
    status: 'locked',
    kp: '监督学习',
  },
  {
    id: '8',
    type: 'code',
    title: 'SVM 分类器实现',
    description: '使用 scikit-learn 实现 SVM 分类',
    difficulty: 'advanced',
    duration: '25分钟',
    status: 'locked',
    kp: '监督学习',
  },
]

export default function ResourcesPage() {
  const [activeType, setActiveType] = useState('all')

  const filteredResources = activeType === 'all'
    ? mockResources
    : mockResources.filter(r => r.type === activeType)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">📚 学习资源</h1>
        <span className="text-sm text-gray-500">共 {filteredResources.length} 个资源</span>
      </div>

      {/* 筛选栏 */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-2">
        {resourceTypes.map((type) => (
          <button
            key={type.id}
            onClick={() => setActiveType(type.id)}
            className={cn(
              'px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors',
              activeType === type.id
                ? 'bg-primary-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            )}
          >
            {type.label}
          </button>
        ))}
      </div>

      {/* 搜索框 */}
      <div className="relative">
        <input
          type="text"
          placeholder="搜索资源..."
          className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>

      {/* 资源卡片网格 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredResources.map((resource) => {
          const Icon = typeIcons[resource.type] || FileText
          const isLocked = resource.status === 'locked'
          const isCompleted = resource.status === 'completed'

          return (
            <div
              key={resource.id}
              className={cn(
                'bg-white rounded-xl border border-gray-200 p-5 transition-all cursor-pointer',
                isLocked ? 'opacity-60 cursor-not-allowed' : 'hover:shadow-md hover:border-primary-200'
              )}
            >
              {/* 头部：图标和状态 */}
              <div className="flex items-start justify-between mb-3">
                <div className="p-2 bg-primary-50 rounded-lg text-primary-600">
                  <Icon size={20} />
                </div>
                {isCompleted && <CheckCircle size={18} className="text-emerald-500" />}
                {isLocked && <Lock size={18} className="text-gray-400" />}
              </div>

              {/* 标题和描述 */}
              <h3 className="text-sm font-semibold text-gray-900 mb-1">{resource.title}</h3>
              <p className="text-xs text-gray-500 mb-3 line-clamp-2">{resource.description}</p>

              {/* 标签 */}
              <div className="flex items-center space-x-2 mb-3">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${difficultyColors[resource.difficulty] || difficultyColors.intermediate}`}>
                  {resource.difficulty === 'beginner' ? '入门' : resource.difficulty === 'intermediate' ? '中级' : '高级'}
                </span>
                <span className="text-xs text-gray-400">·</span>
                <span className="text-xs text-gray-500 flex items-center">
                  <Clock size={12} className="mr-1" />
                  {resource.duration}
                </span>
              </div>

              {/* 操作按钮 */}
              <button
                className={cn(
                  'w-full py-2 rounded-lg text-sm font-medium transition-colors',
                  isLocked
                    ? 'bg-gray-100 text-gray-400'
                    : isCompleted
                    ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                    : 'bg-primary-50 text-primary-600 hover:bg-primary-100'
                )}
                disabled={isLocked}
              >
                {isLocked ? '🔒 未解锁' : isCompleted ? '✅ 复习' : '📖 开始学习'}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
