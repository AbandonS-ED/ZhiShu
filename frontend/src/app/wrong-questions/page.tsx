'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { wrongQuestionsApi } from '@/lib/api'
import { getStudentId } from '@/lib/student'
import { showToast } from '@/lib/utils'
import { usePageTimer } from '@/hooks/usePageTimer'
import Icon from '@/components/Icon'
import type { WrongQuestion, WrongQuestionStats } from '@/types'

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

const ERROR_TYPE_LABEL: Record<string, { label: string; bg: string; fg: string }> = {
  calculation: { label: '计算失误', bg: '#fef3c7', fg: '#92400e' },
  concept: { label: '概念不清', bg: '#fee2e2', fg: '#991b1b' },
  reading: { label: '审题错误', bg: '#ede9fe', fg: '#5b21b6' },
  carelessness: { label: '粗心大意', bg: '#dbeafe', fg: '#1e40af' },
  unknown: { label: '未分析', bg: 'var(--bg-subtle)', fg: 'var(--ink-3)' },
}

type FilterType = 'all' | 'unmastered' | 'mastered'

function ConfirmDialog({ message, onConfirm, onCancel }: { message: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="modal-overlay show" onClick={onCancel}>
      <div className="modal" style={{ maxWidth: 400 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-hd"><h3>确认操作</h3></div>
        <div className="modal-bd" style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--ink)' }}>{message}</div>
        <div className="modal-ft" style={{ justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn btn-sm" onClick={onCancel}>取消</button>
          <button className="btn btn-sm btn-solid" style={{ background: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={onConfirm}>确认</button>
        </div>
      </div>
    </div>
  )
}

export default function WrongQuestionsPage() {
  usePageTimer('wrong_questions')

  const [items, setItems] = useState<WrongQuestion[]>([])
  const [stats, setStats] = useState<WrongQuestionStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterType>('all')
  const [keyword, setKeyword] = useState('')
  const debouncedKeyword = useDebounce(keyword, 300)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [confirmDlg, setConfirmDlg] = useState<{ message: string; onConfirm: () => void } | null>(null)
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
        keyword: debouncedKeyword || undefined,
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
  }, [filter, debouncedKeyword, page])

  useEffect(() => {
    setLoading(true)
    load()
  }, [load])

  const handleDelete = async (id: string) => {
    setConfirmDlg({
      message: '确定删除这道错题？删除后不可恢复。',
      onConfirm: async () => {
        try {
          await wrongQuestionsApi.delete(id)
          showToast('已删除')
          load()
        } catch (err: any) {
          showToast(err.message || '删除失败')
        }
        setConfirmDlg(null)
      },
    })
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
        <div className="tab-switch">
          {[
            { key: 'all', label: `全部 ${stats?.total ?? 0}` },
            { key: 'unmastered', label: `未掌握 ${stats?.unmastered ?? 0}` },
            { key: 'mastered', label: `已掌握 ${stats?.mastered ?? 0}` },
          ].map(t => (
            <button
              key={t.key}
              className={`tab-btn ${filter === t.key ? 'active' : ''}`}
              onClick={() => { setFilter(t.key as FilterType); setPage(1) }}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="wq-search-wrap">
          <Icon name="search" size={15} />
          <input
            className="wq-search"
            placeholder="搜索题干关键词..."
            value={keyword}
            onChange={e => { setKeyword(e.target.value); setPage(1) }}
          />
        </div>
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
          <button disabled={page <= 1} onClick={() => setPage(1)}>首页</button>
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}>上一页</button>
          <span className="wq-pager-current">第 {page} / {totalPages} 页 · 共 {total} 条</span>
          <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>下一页</button>
          <button disabled={page >= totalPages} onClick={() => setPage(totalPages)}>末页</button>
        </div>
      )}

      {confirmDlg && (
        <ConfirmDialog
          message={confirmDlg.message}
          onConfirm={confirmDlg.onConfirm}
          onCancel={() => setConfirmDlg(null)}
        />
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
    <Link href={`/wrong-questions/${wq.id}`} className="wq-card card">
      <div className="wq-card-head card-hd">
        <div className="wq-card-head-left">
          <span className="wq-error-tag" style={{ background: meta.bg, color: meta.fg }}>{meta.label}</span>
          {wq.is_mastered ? (
            <span className="wq-mastered-tag">已掌握</span>
          ) : (
            <span className="wq-mastery-tag">掌握度 {wq.mastery_level}%</span>
          )}
        </div>
        <div className="wq-card-actions" onClick={e => e.preventDefault()}>
          <button onClick={() => onDelete(wq.id)} title="删除" className="wq-delete-btn">
            <Icon name="trash" size={14} />
          </button>
        </div>
      </div>
      <div className="wq-card-body card-bd">
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
      </div>
    </Link>
  )
}