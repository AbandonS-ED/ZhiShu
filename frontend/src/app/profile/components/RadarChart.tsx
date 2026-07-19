'use client'

import { Chart as ChartJS, RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend } from 'chart.js'
import { Radar } from 'react-chartjs-2'

ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend)

const DIMS = [
  { key: 'comprehension', label: '理解力', color: '#6366F1' },
  { key: 'memory', label: '记忆力', color: '#06B6D4' },
  { key: 'application', label: '应用转化', color: '#10B981' },
  { key: 'imagination', label: '想象力', color: '#F59E0B' },
  { key: 'focus', label: '专注力', color: '#EF4444' },
  { key: 'knowledge_base', label: '知识基础', color: '#8B5CF6' },
  { key: 'learning_goal', label: '学习目标', color: '#EC4899' },
]

export default function RadarChart({ scores, size = 340 }: { scores: Record<string, number>; size?: number }) {
  const labels = DIMS.map(d => d.label)
  const dataValues = DIMS.map(d => scores[d.key] || 0)
  const allZero = dataValues.every(v => v === 0)

  const data = {
    labels,
    datasets: [{
      data: allZero ? [10, 10, 10, 10, 10, 10, 10] : dataValues,
      backgroundColor: 'rgba(99,102,241,0.10)',
      borderColor: 'rgba(99,102,241,0.75)',
      borderWidth: 2,
      pointBackgroundColor: DIMS.map(d => d.color),
      pointBorderColor: '#fff',
      pointBorderWidth: 2,
      pointRadius: 5,
      pointHoverRadius: 8,
    }],
  }

  const options = {
    responsive: true,
    maintainAspectRatio: true,
    scales: {
      r: {
        min: 0,
        max: 100,
        ticks: {
          stepSize: 20,
          font: { size: 10, family: "'Inter', sans-serif" },
          color: '#A8A29E',
          backdropColor: 'transparent',
        },
        grid: { color: '#E7E5E4' },
        angleLines: { color: '#E7E5E4' },
        pointLabels: {
          font: { size: 13, weight: 500, family: "'Inter', sans-serif" },
          color: '#57534E',
        },
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(28,25,23,0.92)',
        titleFont: { size: 12, family: "'Inter', sans-serif" },
        bodyFont: { size: 13, family: "'Inter', sans-serif" },
        padding: 10,
        cornerRadius: 8,
        callbacks: {
          label: (ctx: any) => ` ${ctx.raw} 分`,
        },
      },
    },
  }

  return (
    <div style={{ width: size, height: size, margin: '0 auto', position: 'relative' }}>
      <Radar data={data} options={options} />
    </div>
  )
}
