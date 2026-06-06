'use client'

import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Legend, Tooltip } from 'recharts'

interface RadarChartProps {
  data: {
    knowledge_mastery: number
    learning_style: number
    cognitive_level: number
    interest: number
    weak_points: number
    learning_pace: number
  }
}

const dimensionLabels: Record<string, string> = {
  knowledge_mastery: '知识掌握',
  learning_style: '学习风格',
  cognitive_level: '认知水平',
  interest: '兴趣偏好',
  weak_points: '薄弱环节',
  learning_pace: '学习节奏',
}

export function ProfileRadarChart({ data }: RadarChartProps) {
  const chartData = Object.entries(data).map(([key, value]) => ({
    dimension: dimensionLabels[key] || key,
    value: Math.round(value * 100),
    fullMark: 100,
  }))

  return (
    <div className="w-full h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart cx="50%" cy="50%" outerRadius="70%" data={chartData}>
          <PolarGrid stroke="#e2e8f0" />
          <PolarAngleAxis
            dataKey="dimension"
            tick={{ fill: '#64748b', fontSize: 12 }}
          />
          <PolarRadiusAxis
            angle={30}
            domain={[0, 100]}
            tick={{ fill: '#94a3b8', fontSize: 10 }}
          />
          <Radar
            name="掌握度"
            dataKey="value"
            stroke="#3b82f6"
            fill="#3b82f6"
            fillOpacity={0.3}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'white',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            }}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  )
}
