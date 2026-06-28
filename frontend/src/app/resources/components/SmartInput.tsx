'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { resourceApi } from '@/lib/api'
import { getStudentId } from '@/lib/student'

interface SmartInputProps {
  onBatchStart?: () => void  // 开始批量生成时回调
}

export default function SmartInput({ onBatchStart }: SmartInputProps) {
  const [value, setValue] = useState('')
  const [batchLoading, setBatchLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const handleSubmit = async () => {
    const trimmed = value.trim()
    if (!trimmed) return

    // 按中英文逗号/顿号/空格分割
    const kps = trimmed.split(/[,，、\s]+/).filter(Boolean)
    if (kps.length === 0) return

    if (kps.length === 1) {
      // 单个 → 跳学习页
      router.push(`/resources/learn/${encodeURIComponent(kps[0])}?phase=learn`)
      return
    }

    // 多个 → 批量生成
    const studentId = getStudentId()
    if (!studentId) return

    setBatchLoading(true)
    setError('')
    try {
      await resourceApi.batchGenerate(studentId, kps, 'all')
      onBatchStart?.()
      setValue('')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBatchLoading(false)
    }
  }

  return (
    <div className="smart-input-wrap">
      <div className="smart-input-row">
        <input
          type="text"
          className="smart-input"
          placeholder="输入知识点，如：线性回归、神经网络（逗号分隔批量生成）"
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
        />
        <button
          className="smart-submit"
          onClick={handleSubmit}
          disabled={batchLoading || !value.trim()}
        >
          {batchLoading ? '生成中...' : '▶ 生成'}
        </button>
      </div>
      {error && <p className="smart-error">{error}</p>}
      <p className="smart-hint">输入单个知识点直接进入学习页；多个知识点批量生成资源</p>
    </div>
  )
}
