'use client'

import * as Progress from '@radix-ui/react-progress'
import { cn } from '@/lib/utils'

interface ProgressCardProps {
  title: string
  value: number
  maxValue?: number
  description?: string
  color?: string
  icon?: React.ReactNode
}

export function ProgressCard({
  title,
  value,
  maxValue = 100,
  description,
  color = 'bg-primary-500',
  icon,
}: ProgressCardProps) {
  const percentage = Math.round((value / maxValue) * 100)

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center space-x-3">
          {icon && (
            <div className="p-2 bg-primary-50 rounded-lg text-primary-600">
              {icon}
            </div>
          )}
          <div>
            <h3 className="text-sm font-medium text-gray-900">{title}</h3>
            {description && (
              <p className="text-xs text-gray-500 mt-0.5">{description}</p>
            )}
          </div>
        </div>
        <span className="text-2xl font-bold text-gray-900">{percentage}%</span>
      </div>
      <Progress.Root
        className="relative overflow-hidden bg-gray-100 rounded-full h-2"
        value={percentage}
      >
        <Progress.Indicator
          className={cn('h-full rounded-full transition-all duration-500', color)}
          style={{ width: `${percentage}%` }}
        />
      </Progress.Root>
    </div>
  )
}
