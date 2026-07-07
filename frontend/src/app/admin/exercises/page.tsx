'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { useAdmin } from '@/lib/admin/context'
import { AdminCheckbox, BatchDeleteBar, useSelection } from '@/lib/admin/components'

const BASE = 'http://localhost:8001/api/v1'

interface BankExercise {
  id: string
  question: string
  exercise_type: string
  options: string[] | null
  answer: string
  explanation: string | null
  difficulty: number
  knowledge_point: string | null
  source: string
  is_active: boolean
  created_by: string | null
  created_at: string | null
  updated_at: string | null
}

const TYPE_LABELS: Record<string, string> = {
  choice: '选择题', judge: '判断题', short_answer: '简答题', coding: '编程题',
}
const TYPE_KEYS = ['choice', 'judge', 'short_answer', 'coding']

function adminFetch(path: string, opts: RequestInit = {}) {
  const token = localStorage.getItem('zhishu_admin_token')
  return fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...opts.headers,
    },
  }).then(async (r) => {
    if (!r.ok) {
      const b = await r.json().catch(() => ({}))
      throw new Error(b.detail || r.statusText)
    }
    return r.json()
  })
}

const EMPTY_FORM = {
  question: '',
  exercise_type: 'choice',
  options: ['', '', '', ''],
  answer: '',
  explanation: '',
  difficulty: 50,
  knowledge_point: '',
}

export default function AdminExercisesPage() {
  const { showToast } = useAdmin()
  const [items, setItems] = useState<BankExercise[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)

  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [kpFilter, setKpFilter] = useState('')
  const [kpList, setKpList] = useState<{ name: string; count: number }[]>([])

  const [modal, setModal] = useState<'add' | 'edit' | 'batch' | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [editId, setEditId] = useState<string | null>(null)
  const [batchText, setBatchText] = useState('')
  const [saving, setSaving] = useState(false)

  const PAGE_SIZE = 15

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), page_size: String(PAGE_SIZE) })
      if (search) params.set('search', search)
      if (typeFilter) params.set('exercise_type', typeFilter)
      if (kpFilter) params.set('knowledge_point', kpFilter)
      const data = await adminFetch(`/admin/exercises?${params}`)
      setItems(data.items || [])
      setTotal(data.total || 0)
    } catch (e: any) {
      showToast('加载失败: ' + e.message)
    } finally {
      setLoading(false)
    }
  }, [page, search, typeFilter, kpFilter, showToast])

  const loadKpList = useCallback(async () => {
    try {
      const data = await adminFetch('/admin/exercises/knowledge-points')
      setKpList(data || [])
    } catch {}
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => { loadKpList() }, [loadKpList])

  const sel = useSelection(items)

  async function handleSave() {
    if (!form.question.trim()) { showToast('请输入题目'); return }
    if (!form.answer.trim()) { showToast('请输入答案'); return }
    if (form.exercise_type === 'choice') {
      const opts = form.options.filter((o) => o.trim())
      if (opts.length < 2) { showToast('选择题至少需要 2 个选项'); return }
    }
    setSaving(true)
    try {
      const payload = {
        ...form,
        options: form.exercise_type === 'choice' ? form.options.filter((o) => o.trim()) : null,
        knowledge_point: form.knowledge_point || null,
        explanation: form.explanation || null,
      }
      if (modal === 'add') {
        await adminFetch('/admin/exercises', { method: 'POST', body: JSON.stringify(payload) })
        showToast('题目已添加')
      } else if (modal === 'edit' && editId) {
        await adminFetch(`/admin/exercises/${editId}`, { method: 'PUT', body: JSON.stringify(payload) })
        showToast('题目已更新')
      }
      setModal(null)
      load()
      loadKpList()
    } catch (e: any) {
      showToast('保存失败: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm('确认删除此题目？')) return
    try {
      await adminFetch(`/admin/exercises/${id}`, { method: 'DELETE' })
      showToast('已删除')
      load()
      loadKpList()
    } catch (e: any) {
      showToast('删除失败: ' + e.message)
    }
  }

  async function handleBatchDelete() {
    if (sel.selectedCount === 0) return
    if (!window.confirm(`确认删除选中的 ${sel.selectedCount} 道题目？`)) return
    const ids = Array.from(sel.selected)
    let ok = 0
    for (const id of ids) {
      try {
        await adminFetch(`/admin/exercises/${id}`, { method: 'DELETE' })
        ok++
      } catch {}
    }
    sel.clear()
    showToast(`已删除 ${ok} 道题目`)
    load()
    loadKpList()
  }

  async function handleBatchImport() {
    if (!batchText.trim()) { showToast('请输入题目 JSON'); return }
    let parsed: any[]
    try {
      parsed = JSON.parse(batchText)
      if (!Array.isArray(parsed)) throw new Error('需要 JSON 数组')
    } catch (e: any) {
      showToast('JSON 格式错误: ' + e.message); return
    }
    setSaving(true)
    try {
      const exercises = parsed.map((item: any) => ({
        question: item.question || '',
        exercise_type: item.exercise_type || item.type || 'choice',
        options: item.options || null,
        answer: item.answer || '',
        explanation: item.explanation || null,
        difficulty: item.difficulty ?? 50,
        knowledge_point: item.knowledge_point || item.kp || null,
      }))
      await adminFetch('/admin/exercises/batch', {
        method: 'POST',
        body: JSON.stringify({ exercises }),
      })
      showToast(`成功导入 ${exercises.length} 道题目`)
      setModal(null)
      setBatchText('')
      load()
      loadKpList()
    } catch (e: any) {
      showToast('导入失败: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  function openAdd() {
    setForm(EMPTY_FORM)
    setEditId(null)
    setModal('add')
  }

  function openEdit(item: BankExercise) {
    setForm({
      question: item.question,
      exercise_type: item.exercise_type,
      options: item.options && item.options.length > 0 ? [...item.options, '', '', ''].slice(0, 4) : ['', '', '', ''],
      answer: item.answer,
      explanation: item.explanation || '',
      difficulty: item.difficulty,
      knowledge_point: item.knowledge_point || '',
    })
    setEditId(item.id)
    setModal('edit')
  }

  function setOpt(i: number, v: string) {
    setForm((f) => {
      const opts = [...f.options]
      opts[i] = v
      return { ...f, options: opts }
    })
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="admin-pg">
      {/* 操作栏 */}
      <div className="admin-op" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 14 }}>
        <input
          className="admin-si"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          placeholder="搜索题目..."
          style={{ flex: 1, minWidth: 160 }}
        />
        <select className="admin-sel" value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1) }}>
          <option value="">全部题型</option>
          {TYPE_KEYS.map((k) => <option key={k} value={k}>{TYPE_LABELS[k]}</option>)}
        </select>
        <select className="admin-sel" value={kpFilter} onChange={(e) => { setKpFilter(e.target.value); setPage(1) }}>
          <option value="">全部知识点</option>
          {kpList.map((kp) => <option key={kp.name} value={kp.name}>{kp.name} ({kp.count})</option>)}
        </select>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button className="admin-btn admin-btn-primary" onClick={openAdd}>+ 新增题目</button>
          <button className="admin-btn" onClick={() => { setBatchText(''); setModal('batch') }}>批量导入</button>
        </div>
      </div>

      <BatchDeleteBar
        selectedCount={sel.selectedCount}
        totalCount={items.length}
        onClear={sel.clear}
        onDelete={handleBatchDelete}
        itemLabel="道题"
      />

      {/* 统计 */}
      <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 10 }}>
        共 {total} 道题目
        {kpList.length > 0 && ` · ${kpList.length} 个知识点`}
      </div>

      {/* 表格 */}
      <div className="admin-tw">
        <table>
          <thead>
            <tr>
              <th className="admin-cb-th" style={{ width: 36 }}>
                <AdminCheckbox
                  checked={sel.allSelected}
                  indeterminate={sel.indeterminate}
                  onChange={sel.toggleAll}
                />
              </th>
              <th style={{ width: 40 }}>#</th>
              <th>题目</th>
              <th style={{ width: 80 }}>题型</th>
              <th style={{ width: 60 }}>难度</th>
              <th style={{ width: 100 }}>知识点</th>
              <th style={{ width: 60 }}>状态</th>
              <th style={{ width: 100 }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: 24, color: 'var(--ink-3)' }}>加载中...</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: 24, color: 'var(--ink-3)' }}>暂无题目</td></tr>
            ) : items.map((item, i) => (
              <tr key={item.id} className={sel.selected.has(item.id) ? 'is-selected' : ''}>
                <td className="admin-cb-td">
                  <AdminCheckbox
                    checked={sel.selected.has(item.id)}
                    onChange={() => sel.toggleOne(item.id)}
                  />
                </td>
                <td style={{ color: 'var(--ink-3)' }}>{(page - 1) * PAGE_SIZE + i + 1}</td>
                <td style={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.question}
                </td>
                <td>
                  <span className={`admin-tag admin-tag-${item.exercise_type === 'choice' ? 'blue' : item.exercise_type === 'judge' ? 'green' : item.exercise_type === 'coding' ? 'purple' : 'orange'}`}>
                    {TYPE_LABELS[item.exercise_type] || item.exercise_type}
                  </span>
                </td>
                <td>
                  <span style={{ color: item.difficulty >= 70 ? 'var(--danger)' : item.difficulty >= 40 ? 'var(--warm)' : 'var(--success)' }}>
                    {item.difficulty}
                  </span>
                </td>
                <td style={{ fontSize: 12, color: 'var(--ink-2)' }}>{item.knowledge_point || '—'}</td>
                <td>
                  <span style={{ color: item.is_active ? 'var(--success)' : 'var(--ink-3)', fontSize: 12 }}>
                    {item.is_active ? '启用' : '下架'}
                  </span>
                </td>
                <td>
                  <button className="admin-btn admin-btn-sm" onClick={() => openEdit(item)}>编辑</button>
                  {' '}
                  <button className="admin-btn admin-btn-sm admin-btn-danger" onClick={() => handleDelete(item.id)}>删除</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 分页 */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 14 }}>
          <button className="admin-btn admin-btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>上一页</button>
          <span style={{ lineHeight: '28px', fontSize: 12, color: 'var(--ink-3)' }}>{page} / {totalPages}</span>
          <button className="admin-btn admin-btn-sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>下一页</button>
        </div>
      )}

      {/* 新增/编辑弹窗 */}
      {modal && modal !== 'batch' && (
        <div className="admin-mo vis" onClick={() => setModal(null)}>
          <div className="admin-md" style={{ maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
            <div className="admin-md-h">
              <h3>{modal === 'add' ? '新增题目' : '编辑题目'}</h3>
              <button className="admin-md-x" onClick={() => setModal(null)}>×</button>
            </div>
            <div className="admin-md-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, color: 'var(--ink-2)', marginBottom: 4, display: 'block' }}>题型</label>
                <select
                  className="admin-sel"
                  value={form.exercise_type}
                  onChange={(e) => setForm((f) => ({ ...f, exercise_type: e.target.value }))}
                >
                  {TYPE_KEYS.map((k) => <option key={k} value={k}>{TYPE_LABELS[k]}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--ink-2)', marginBottom: 4, display: 'block' }}>题目</label>
                <textarea
                  className="admin-si"
                  rows={3}
                  value={form.question}
                  onChange={(e) => setForm((f) => ({ ...f, question: e.target.value }))}
                  placeholder="请输入题目内容"
                />
              </div>
              {form.exercise_type === 'choice' && (
                <div>
                  <label style={{ fontSize: 12, color: 'var(--ink-2)', marginBottom: 4, display: 'block' }}>选项（至少 2 个）</label>
                  {form.options.map((opt, i) => (
                    <input
                      key={i}
                      className="admin-si"
                      value={opt}
                      onChange={(e) => setOpt(i, e.target.value)}
                      placeholder={`选项 ${String.fromCharCode(65 + i)}`}
                      style={{ marginBottom: 4 }}
                    />
                  ))}
                </div>
              )}
              <div>
                <label style={{ fontSize: 12, color: 'var(--ink-2)', marginBottom: 4, display: 'block' }}>
                  答案 {form.exercise_type === 'choice' ? '(选项字母，如 A)' : form.exercise_type === 'judge' ? '(true/false)' : ''}
                </label>
                <input
                  className="admin-si"
                  value={form.answer}
                  onChange={(e) => setForm((f) => ({ ...f, answer: e.target.value }))}
                  placeholder="正确答案"
                />
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--ink-2)', marginBottom: 4, display: 'block' }}>解析</label>
                <textarea
                  className="admin-si"
                  rows={2}
                  value={form.explanation}
                  onChange={(e) => setForm((f) => ({ ...f, explanation: e.target.value }))}
                  placeholder="答案解析（可选）"
                />
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 12, color: 'var(--ink-2)', marginBottom: 4, display: 'block' }}>难度 (0-100)</label>
                  <input
                    className="admin-si"
                    type="number"
                    min={0}
                    max={100}
                    value={form.difficulty}
                    onChange={(e) => setForm((f) => ({ ...f, difficulty: Number(e.target.value) }))}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 12, color: 'var(--ink-2)', marginBottom: 4, display: 'block' }}>知识点</label>
                  <input
                    className="admin-si"
                    value={form.knowledge_point}
                    onChange={(e) => setForm((f) => ({ ...f, knowledge_point: e.target.value }))}
                    placeholder="如：机器学习"
                  />
                </div>
              </div>
            </div>
            <div className="admin-md-ft">
              <button className="admin-btn" onClick={() => setModal(null)}>取消</button>
              <button className="admin-btn admin-btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 批量导入弹窗 */}
      {modal === 'batch' && (
        <div className="admin-mo vis" onClick={() => setModal(null)}>
          <div className="admin-md" style={{ maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
            <div className="admin-md-h">
              <h3>批量导入题目</h3>
              <button className="admin-md-x" onClick={() => setModal(null)}>×</button>
            </div>
            <div className="admin-md-body">
              <p style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 8 }}>
                粘贴 JSON 数组，每项包含：question, exercise_type, options(选择题), answer, explanation, difficulty, knowledge_point
              </p>
              <textarea
                className="admin-si"
                rows={10}
                value={batchText}
                onChange={(e) => setBatchText(e.target.value)}
                placeholder={`[
  {
    "question": "以下哪种算法属于无监督学习？",
    "exercise_type": "choice",
    "options": ["线性回归", "K-Means", "SVM", "决策树"],
    "answer": "B",
    "explanation": "K-Means 是无监督聚类算法",
    "difficulty": 40,
    "knowledge_point": "机器学习"
  }
]`}
                style={{ fontFamily: 'monospace', fontSize: 12 }}
              />
            </div>
            <div className="admin-md-ft">
              <button className="admin-btn" onClick={() => setModal(null)}>取消</button>
              <button className="admin-btn admin-btn-primary" onClick={handleBatchImport} disabled={saving}>
                {saving ? '导入中...' : '导入'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
