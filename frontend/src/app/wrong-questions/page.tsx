'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { wrongQuestionsApi } from '@/lib/api'
import { getStudentId } from '@/lib/student'
import { showToast } from '@/lib/utils'
import { usePageTimer } from '@/hooks/usePageTimer'
import Icon from '@/components/Icon'
import type { WrongQuestion, WrongQuestionStats } from '@/types'

const ERROR_TYPE_LABEL: Record<string, { label: string; color: string }> = {
  calculation: { label: '计算失误', color: '#f59e0b' },
  concept: { label: '概念不清', color: '#ef4444' },
  reading: { label: '审题错误', color: '#8b5cf6' },
  carelessness: { label: '粗心大意', color: '#3b82f6' },
  unknown: { label: '未分析', color: '#6b7280' },
}

type FilterType = 'all' | 'unmastered' | 'mastered'

export default function WrongQuestionsPage() {
  usePageTimer('wrong_questions')

  const [items, setItems] = useState<WrongQuestion[]>([])
  const [stats, setStats] = useState<WrongQuestionStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterType>('all')
  const [keyword, setKeyword] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const pageSize = 10

  const load = useCallback(async () => {
    const sid = getStudentId()
    if (!sid) {
      showToast('请先登录')
      setLoading(false)
      return
    }
    try {
      const data = await wrongQuestionsApi.list({
        student_id: sid,
        filter_type: filter,
        keyword: keyword || undefined,
        page,
        page_size: pageSize,
      })
      setItems(data.items)
      setStats(data.stats)
      setTotal(data.total)
    } catch (err: any) {
      showToast(err.message || '加载失败')
    } finally {
      setLoading(false)
    }
  }, [filter, keyword, page])

  useEffect(() => {
    setLoading(true)
    load()
  }, [load])

  const handleDelete = async (id: string) => {
    if (!confirm('确定删除这道错题？')) return
    try {
      await wrongQuestionsApi.delete(id)
      showToast('已删除')
      load()
    } catch (err: any) {
      showToast(err.message || '删除失败')
    }
  }

  const totalPages = Math.ceil(total / pageSize)

  if (loading && items.length === 0) {
    return (
      <div className="wq-page">
        <div className="wq-skeleton">
          <div className="skeleton skeleton-line" style={{ width: '40%', height: 24 }} />
          <div className="wq-stat-grid">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="skeleton skeleton-card" style={{ height: 80 }} />
            ))}
          </div>
          <div className="skeleton skeleton-card" style={{ height: 120 }} />
          <div className="skeleton skeleton-card" style={{ height: 120 }} />
        </div>
      </div>
    )
  }

  return (
    <div className="wq-page">
      <header className="wq-header">
        <h1>
          <Icon name="book" size={20} />
          错题本
          <span className="wq-subtitle">AI 自动归因 · 同类题推荐 · 复习巩固</span>
        </h1>
      </header>

      {stats && <StatsBar stats={stats} />}

      <div className="wq-toolbar">
        <div className="wq-tabs">
          {[
            { key: 'all', label: `全部 ${stats?.total ?? 0}` },
            { key: 'unmastered', label: `未掌握 ${stats?.unmastered ?? 0}` },
            { key: 'mastered', label: `已掌握 ${stats?.mastered ?? 0}` },
          ].map(t => (
            <button
              key={t.key}
              className={`wq-tab ${filter === t.key ? 'active' : ''}`}
              onClick={() => { setFilter(t.key as FilterType); setPage(1) }}
            >
              {t.label}
            </button>
          ))}
        </div>
        <input
          className="wq-search"
          placeholder="搜索题干关键词..."
          value={keyword}
          onChange={e => { setKeyword(e.target.value); setPage(1) }}
        />
      </div>

      {items.length === 0 ? (
        <div className="wq-empty">
          <Icon name="inbox" size={48} />
          <p>暂无错题</p>
          <span className="wq-empty-tip">在题库做错的题会自动收录到这里</span>
          <Link href="/tiku" className="wq-empty-btn">前往题库练习</Link>
        </div>
      ) : (
        <div className="wq-list">
          {items.map(wq => (
            <WrongQuestionCard key={wq.id} wq={wq} onDelete={handleDelete} />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="wq-pager">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}>上一页</button>
          <span>第 {page} / {totalPages} 页 · 共 {total} 条</span>
          <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>下一页</button>
        </div>
      )}
    </div>
  )
}

function StatsBar({ stats }: { stats: WrongQuestionStats }) {
  const masteredRatio = stats.total > 0 ? Math.round((stats.mastered / stats.total) * 100) : 0
  return (
    <div className="wq-stat-grid">
      <div className="wq-stat-card">
        <div className="wq-stat-label">错题总数</div>
        <div className="wq-stat-value">{stats.total}</div>
      </div>
      <div className="wq-stat-card">
        <div className="wq-stat-label">已掌握</div>
        <div className="wq-stat-value" style={{ color: '#10b981' }}>{stats.mastered}</div>
      </div>
      <div className="wq-stat-card">
        <div className="wq-stat-label">掌握率</div>
        <div className="wq-stat-value">{masteredRatio}%</div>
      </div>
      <div className="wq-stat-card">
        <div className="wq-stat-label">平均掌握度</div>
        <div className="wq-stat-value">{stats.avg_mastery_level}</div>
      </div>
    </div>
  )
}

function WrongQuestionCard({ wq, onDelete }: { wq: WrongQuestion; onDelete: (id: string) => void }) {
  const meta = ERROR_TYPE_LABEL[wq.error_type] || ERROR_TYPE_LABEL.unknown
  const ex = wq.exercise

  return (
    <Link href={`/wrong-questions/${wq.id}`} className="wq-card">
      <div className="wq-card-head">
        <span className="wq-error-tag" style={{ background: meta.color }}>{meta.label}</span>
        {wq.is_mastered ? (
          <span className="wq-mastered-tag">已掌握</span>
        ) : (
          <span className="wq-mastery-tag">掌握度 {wq.mastery_level}%</span>
        )}
        <div className="wq-card-actions" onClick={e => e.preventDefault()}>
          <button onClick={() => onDelete(wq.id)} title="删除">×</button>
        </div>
      </div>
      <div className="wq-card-question">{ex?.question || '(题目已删除)'}</div>
      <div className="wq-card-meta">
        <span className="wq-meta-item">错答：<b>{wq.wrong_answer}</b></span>
        {ex?.answer && <span className="wq-meta-item">正解：<b style={{ color: '#10b981' }}>{ex.answer}</b></span>}
        {ex?.knowledge_point && <span className="wq-meta-item">{ex.knowledge_point}</span>}
        <span className="wq-meta-item">复习 {wq.review_count} 次</span>
      </div>
      {wq.error_analysis && (
        <div className="wq-card-analysis">{wq.error_analysis}</div>
      )}
      <div className="wq-card-progress">
        <div className="wq-progress-bar">
          <div className="wq-progress-fill" style={{ width: `${wq.mastery_level}%` }} />
        </div>
      </div>
    </Link>
  )
}