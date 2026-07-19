'use client'

import { useState, useEffect, useCallback } from 'react'
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

const ERROR_TYPE_CONFIG: Record<string, { label: string; cls: string }> = {
  calculation: { label: '计算失误', cls: 'calculation' },
  concept: { label: '概念不清', cls: 'concept' },
  reading: { label: '审题错误', cls: 'reading' },
  carelessness: { label: '粗心大意', cls: 'carelessness' },
  unknown: { label: '未分析', cls: 'unknown' },
}

type FilterType = 'all' | 'unmastered' | 'mastered'

function ConfirmDialog({ message, onConfirm, onCancel }: { message: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="wq-modal-overlay show" onClick={onCancel}>
      <div className="wq-modal-box" onClick={e => e.stopPropagation()}>
        <div className="wq-modal-head"><h3>确认操作</h3></div>
        <div className="wq-modal-body">{message}</div>
        <div className="wq-modal-foot">
          <button className="btn btn-sm" onClick={onCancel}>取消</button>
          <button className="btn btn-sm btn-danger" onClick={onConfirm}>确认删除</button>
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
    if (!sid) { setLoading(false); return }
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

  useEffect(() => { setLoading(true); load() }, [load])

  const handleDelete = (id: string) => {
    setConfirmDlg({
      message: '确定删除这道错题？删除后不可恢复。',
      onConfirm: async () => {
        try { await wrongQuestionsApi.delete(id); showToast('已删除'); load() }
        catch (err: any) { showToast(err.message || '删除失败') }
        setConfirmDlg(null)
      },
    })
  }

  const totalPages = Math.ceil(total / pageSize)

  if (loading && items.length === 0) {
    return (
      <div className="wq-page">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="skeleton skeleton-line" style={{ width: '40%', height: 24 }} />
          <div className="stats-grid">
            {[1, 2, 3, 4].map(i => <div key={i} className="skeleton skeleton-card" style={{ height: 80 }} />)}
          </div>
          <div className="skeleton skeleton-card" style={{ height: 120 }} />
          <div className="skeleton skeleton-card" style={{ height: 120 }} />
        </div>
      </div>
    )
  }

  const masteredRatio = stats && stats.total > 0 ? Math.round((stats.mastered / stats.total) * 100) : 0

  return (
    <div className="wq-page">
      <div className="stats-grid">
        <div className="stat-card">
          <div className="sc-label">错题总数</div>
          <div className="sc-value">{stats?.total ?? 0}</div>
          <div className="sc-sub">不同错误类型分布</div>
        </div>
        <div className="stat-card highlight">
          <div className="sc-label">已掌握</div>
          <div className="sc-value">{stats?.mastered ?? 0}</div>
          <div className="sc-sub">连续答对 ≥ 3 次</div>
        </div>
        <div className="stat-card">
          <div className="sc-label">掌握率</div>
          <div className="sc-value">{masteredRatio}%</div>
          <div className="sc-sub">目标 ≥ 80%</div>
        </div>
        <div className="stat-card warm-hl">
          <div className="sc-label">平均掌握度</div>
          <div className="sc-value">{stats?.avg_mastery_level ?? 0}</div>
          <div className="sc-sub">较上次 +0</div>
        </div>
      </div>

      <div className="wq-toolbar">
        <div className="wq-tab-switch">
          {([
            { key: 'all', label: '全部', count: stats?.total ?? 0 },
            { key: 'unmastered', label: '未掌握', count: stats?.unmastered ?? 0 },
            { key: 'mastered', label: '已掌握', count: stats?.mastered ?? 0 },
          ] as const).map(t => (
            <button key={t.key} className={`wq-tab-btn${filter === t.key ? ' active' : ''}`}
              onClick={() => { setFilter(t.key); setPage(1) }}>
              {t.label}<span className="wq-tab-count">{t.count}</span>
            </button>
          ))}
        </div>
        <div className="wq-search-wrap">
          <Icon name="search" size={15} />
          <input placeholder="搜索题干关键词..." value={keyword}
            onChange={e => { setKeyword(e.target.value); setPage(1) }} />
        </div>
      </div>

      {items.length === 0 ? (
        <div className="empty-state">
          <div className="es-icon"><Icon name="inbox" size={28} /></div>
          <h3>暂无错题</h3>
          <p>在题库做错的题会自动收录到这里</p>
          <span className="es-tip">前往题库练习，错题将自动添加</span>
          <Link href="/tiku" className="es-btn">前往题库练习</Link>
        </div>
      ) : (
        <div className="wq-list">
          {items.map(wq => (
            <WQCard key={wq.id} wq={wq} onDelete={handleDelete} />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="wq-pager">
          <button disabled={page <= 1} onClick={() => setPage(1)}>&laquo;</button>
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}>&lsaquo;</button>
          {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
            let p = i + 1
            if (totalPages > 7) {
              if (page <= 4) p = i + 1
              else if (page >= totalPages - 3) p = totalPages - 6 + i
              else p = page - 3 + i
            }
            return (
              <button key={p} className={page === p ? 'pg-active' : ''} onClick={() => setPage(p)}>{p}</button>
            )
          })}
          <span className="pg-info">共 {total} 条</span>
          <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>&rsaquo;</button>
          <button disabled={page >= totalPages} onClick={() => setPage(totalPages)}>&raquo;</button>
        </div>
      )}

      {confirmDlg && (
        <ConfirmDialog message={confirmDlg.message} onConfirm={confirmDlg.onConfirm} onCancel={() => setConfirmDlg(null)} />
      )}
    </div>
  )
}

function WQCard({ wq, onDelete }: { wq: WrongQuestion; onDelete: (id: string) => void }) {
  const cfg = ERROR_TYPE_CONFIG[wq.error_type] || ERROR_TYPE_CONFIG.unknown
  const ex = wq.exercise
  const masteryCls = wq.mastery_level >= 80 ? 'high' : wq.mastery_level >= 40 ? 'mid' : 'low'

  return (
    <Link href={`/wrong-questions/${wq.id}`} className="wq-card">
      <div className="wq-card-head">
        <div className="wq-card-head-left">
          <span className={`error-tag ${cfg.cls}`}><span className="et-dot" />{cfg.label}</span>
          {wq.is_mastered ? (
            <span className="mastery-tag done">已掌握</span>
          ) : (
            <span className={`mastery-tag ${masteryCls}`}>掌握度 {wq.mastery_level}%</span>
          )}
        </div>
        <div className="wq-card-actions" onClick={e => e.preventDefault()}>
          <button className="card-action-btn" title="删除" onClick={() => onDelete(wq.id)}>
            <Icon name="trash" size={14} />
          </button>
        </div>
      </div>
      <div className="wq-card-body">
        <div className="wq-card-question">{ex?.question || '(题目已删除)'}</div>
        <div className="wq-card-meta">
          <span className="meta-chip">错答：<b className="mc-wrong">{wq.wrong_answer}</b></span>
          {ex?.answer && <span className="meta-chip">正解：<b className="mc-correct">{ex.answer}</b></span>}
          {ex?.knowledge_point && <span className="meta-chip kp">{ex.knowledge_point}</span>}
          <span className="meta-chip">复习 {wq.review_count} 次</span>
        </div>
        {wq.error_analysis && <div className="wq-card-analysis">{wq.error_analysis}</div>}
        <div className="wq-progress-track">
          <div className={`wq-progress-fill ${masteryCls}`} style={{ width: `${wq.mastery_level}%` }} />
        </div>
      </div>
    </Link>
  )
}
