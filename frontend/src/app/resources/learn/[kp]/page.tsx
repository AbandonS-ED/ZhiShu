'use client'
import { Suspense } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import LearningPage from '../../components/LearningPage'
import Icon from '@/components/Icon'

function Loading() {
  return <div className="lp-loading"><div className="skeleton-line wide" /><div className="skeleton-line medium" /></div>
}

export default function LearnPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const kp = decodeURIComponent(String(params.kp ?? ''))
  const phase = searchParams.get('phase') ?? 'learn'

  return (
    <div className="learn-page">
      <div className="learn-page-header">
        <h2><Icon name="book" size={24} /> {kp}</h2>
        <a href="/resources" className="back-link">← 返回资源中心</a>
      </div>
      <Suspense fallback={<Loading />}>
        <LearningPage knowledge_point={kp} />
      </Suspense>
    </div>
  )
}
