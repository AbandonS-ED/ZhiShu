'use client'

import { useEffect } from 'react'
import { ProfileRadarChart } from '@/components/dashboard/RadarChart'
import { ProgressCard } from '@/components/dashboard/ProgressCard'
import { QuickActions } from '@/components/dashboard/QuickActions'
import { useAppStore } from '@/stores/appStore'
import { BookOpen, Clock, Target, TrendingUp } from 'lucide-react'

// 模拟数据
const mockProfile = {
  knowledge_mastery: 0.65,
  learning_style: 0.72,
  cognitive_level: 0.58,
  interest: 0.81,
  weak_points: 0.45,
  learning_pace: 0.68,
}

const mockStats = [
  { title: '已学习知识点', value: 8, maxValue: 12, icon: <BookOpen size={20} />, color: 'bg-primary-500' },
  { title: '学习时长', value: 24, maxValue: 40, icon: <Clock size={20} />, color: 'bg-emerald-500' },
  { title: '练习完成率', value: 65, maxValue: 100, icon: <Target size={20} />, color: 'bg-amber-500' },
  { title: '整体进度', value: 45, maxValue: 100, icon: <TrendingUp size={20} />, color: 'bg-purple-500' },
]

export default function DashboardPage() {
  const { setStudent, setProfile } = useAppStore()

  useEffect(() => {
    // 模拟加载用户数据
    setStudent({
      id: '1',
      student_no: '2024001',
      name: '张三',
      grade: '大二',
      major: '计算机科学',
    })
    setProfile({
      knowledge_mastery: { '搜索算法': 0.8, '机器学习': 0.3, '深度学习': 0.2 },
      learning_style: { visual: 0.7, textual: 0.3, auditory: 0.5, kinesthetic: 0.4 },
      cognitive_level: { memory: 0.9, understand: 0.7, apply: 0.5, analyze: 0.3 },
      interest: { cv: 0.9, nlp: 0.4, rl: 0.6 },
      weak_topics: ['深度学习', '强化学习'],
      learning_pace: { daily_hours: 2.5, preferred_time: 'evening', focus_duration: 45 },
    })
  }, [setStudent, setProfile])

  return (
    <div className="space-y-6">
      {/* 欢迎横幅 */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-500 rounded-2xl p-6 text-white">
        <h1 className="text-2xl font-bold">👋 欢迎回来，张三！</h1>
        <p className="mt-2 text-primary-100">
          你已经连续学习 7 天了，继续保持！今天想学点什么？
        </p>
      </div>

      {/* 快捷操作 */}
      <QuickActions />

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {mockStats.map((stat) => (
          <ProgressCard
            key={stat.title}
            title={stat.title}
            value={stat.value}
            maxValue={stat.maxValue}
            icon={stat.icon}
            color={stat.color}
          />
        ))}
      </div>

      {/* 画像雷达图 */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">📊 学习者画像</h2>
        <ProfileRadarChart data={mockProfile} />
      </div>

      {/* 最近学习活动 */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">📚 最近学习</h2>
        <div className="space-y-3">
          {[
            { title: '搜索算法 - BFS/DFS', time: '2小时前', status: '已完成', color: 'text-emerald-600 bg-emerald-50' },
            { title: 'A* 算法练习', time: '昨天', status: '进行中', color: 'text-amber-600 bg-amber-50' },
            { title: '知识表示与推理', time: '3天前', status: '待学习', color: 'text-gray-600 bg-gray-50' },
          ].map((activity, i) => (
            <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <p className="text-sm font-medium text-gray-900">{activity.title}</p>
                <p className="text-xs text-gray-500">{activity.time}</p>
              </div>
              <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${activity.color}`}>
                {activity.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
