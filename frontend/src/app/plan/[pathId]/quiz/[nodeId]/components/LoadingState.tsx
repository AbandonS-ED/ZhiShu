'use client'

interface LoadingStateProps {
  loading: boolean
  generating: boolean
}

export default function LoadingState({ loading, generating }: LoadingStateProps) {
  return (
    <div className="plan-page">
      <div className="plan-container">
        <div className="loading-state">
          <div className="loading-spinner" />
          <p>{loading ? '加载中...' : 'AI 正在生成测验题...'}</p>
          {generating && (
            <p className="loading-hint">正在调用 AI 生成题目，请稍候...</p>
          )}
        </div>
      </div>
    </div>
  )
}