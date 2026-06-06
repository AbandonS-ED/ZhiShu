'use client'

import { ProfileRadarChart } from '@/components/dashboard/RadarChart'
import { useAppStore } from '@/stores/appStore'
import { useEffect } from 'react'
import { User, BookOpen, Brain, Heart, AlertCircle, Clock } from 'lucide-react'

const dimensionInfo = [
  { key: 'knowledge_mastery', label: '知识掌握度', icon: BookOpen, color: 'text-blue-600 bg-blue-50', description: '对各知识点的理解和掌握程度' },
  { key: 'learning_style', label: '学习风格', icon: User, color: 'text-emerald-600 bg-emerald-50', description: '视觉/文本/听觉/动手学习偏好' },
  { key: 'cognitive_level', label: '认知水平', icon: Brain, color: 'text-purple-600 bg-purple-50', description: '记忆/理解/应用/分析能力' },
  { key: 'interest', label: '兴趣偏好', icon: Heart, color: 'text-pink-600 bg-pink-50', description: '对AI各方向的兴趣程度' },
  { key: 'weak_points', label: '薄弱环节', icon: AlertCircle, color: 'text-amber-600 bg-amber-50', description: '需要加强学习的知识点' },
  { key: 'learning_pace', label: '学习节奏', icon: Clock, color: 'text-cyan-600 bg-cyan-50', description: '每日学习时长和专注度' },
]

export default function ProfilePage() {
  const { profile, setProfile } = useAppStore()

  useEffect(() => {
    if (!profile) {
      setProfile({
        knowledge_mastery: { '搜索算法': 0.8, '机器学习': 0.3, '深度学习': 0.2, 'NLP': 0.15, 'CV': 0.1 },
        learning_style: { visual: 0.7, textual: 0.3, auditory: 0.5, kinesthetic: 0.4 },
        cognitive_level: { memory: 0.9, understand: 0.7, apply: 0.5, analyze: 0.3 },
        interest: { cv: 0.9, nlp: 0.4, rl: 0.6, ml: 0.7 },
        weak_topics: ['深度学习', '强化学习', 'NLP'],
        learning_pace: { daily_hours: 2.5, preferred_time: 'evening', focus_duration: 45 },
      })
    }
  }, [profile, setProfile])

  const radarData = profile ? {
    knowledge_mastery: Object.values(profile.knowledge_mastery).reduce((a, b) => a + b, 0) / Object.keys(profile.knowledge_mastery).length,
    learning_style: Object.values(profile.learning_style).reduce((a, b) => a + b, 0) / Object.keys(profile.learning_style).length,
    cognitive_level: Object.values(profile.cognitive_level).reduce((a, b) => a + b, 0) / Object.keys(profile.cognitive_level).length,
    interest: Object.values(profile.interest).reduce((a, b) => a + b, 0) / Object.keys(profile.interest).length,
    weak_points: 1 - (profile.weak_topics.length / 10),
    learning_pace: profile.learning_pace.daily_hours / 8,
  } : {
    knowledge_mastery: 0.65,
    learning_style: 0.72,
    cognitive_level: 0.58,
    interest: 0.81,
    weak_points: 0.45,
    learning_pace: 0.68,
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">📊 学习者画像</h1>

      {/* 雷达图 */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">六维画像总览</h2>
        <ProfileRadarChart data={radarData} />
      </div>

      {/* 各维度详情 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {dimensionInfo.map((dim) => {
          const Icon = dim.icon
          const value = radarData[dim.key as keyof typeof radarData]
          return (
            <div key={dim.key} className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start space-x-3">
                <div className={`p-2 rounded-lg ${dim.color}`}>
                  <Icon size={20} />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-gray-900">{dim.label}</h3>
                  <p className="text-xs text-gray-500 mt-1">{dim.description}</p>
                  <div className="mt-3 flex items-center space-x-2">
                    <div className="flex-1 bg-gray-100 rounded-full h-2">
                      <div
                        className="bg-primary-500 h-2 rounded-full transition-all"
                        style={{ width: `${Math.round(value * 100)}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium text-gray-700">
                      {Math.round(value * 100)}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* 薄弱环节列表 */}
      {profile && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">⚠️ 薄弱环节</h2>
          <div className="flex flex-wrap gap-2">
            {profile.weak_topics.map((topic) => (
              <span
                key={topic}
                className="px-3 py-1.5 bg-amber-50 text-amber-700 rounded-full text-sm font-medium"
              >
                {topic}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
