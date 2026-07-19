'use client'

import { ReactNode, useState } from 'react'

export interface AdminCheckboxProps {
  checked: boolean
  indeterminate?: boolean
  onChange: (checked: boolean) => void
  ariaLabel?: string
}

export function AdminCheckbox({ checked, indeterminate, onChange, ariaLabel }: AdminCheckboxProps) {
  return (
    <label
      className={`admin-cb${checked ? ' is-checked' : ''}${indeterminate ? ' is-indeterminate' : ''}`}
      onClick={(e) => e.stopPropagation()}
    >
      <input
        type="checkbox"
        checked={checked}
        ref={(el) => {
          if (el) el.indeterminate = !!indeterminate
        }}
        onChange={(e) => onChange(e.target.checked)}
        aria-label={ariaLabel}
      />
      <span className="admin-cb-box" aria-hidden="true">
        {indeterminate ? (
          <span className="admin-cb-indet" />
        ) : checked ? (
          <svg viewBox="0 0 16 16" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 8 7 12 13 4" />
          </svg>
        ) : null}
      </span>
    </label>
  )
}

export interface BatchDeleteBarProps {
  selectedCount: number
  totalCount: number
  onClear: () => void
  onDelete: () => void
  itemLabel?: string
}

export function BatchDeleteBar({
  selectedCount,
  totalCount,
  onClear,
  onDelete,
  itemLabel = '条',
}: BatchDeleteBarProps) {
  if (totalCount === 0) return null
  return (
    <div className="admin-batch-bar">
      {selectedCount > 0 ? (
        <>
          <span className="admin-batch-count">
            已选 <b>{selectedCount}</b> {itemLabel}
          </span>
          <button className="admin-btn admin-btn-sm" onClick={onClear}>
            取消选择
          </button>
          <button
            className="admin-btn admin-btn-sm admin-btn-danger"
            onClick={onDelete}
          >
            批量删除
          </button>
        </>
      ) : (
        <span className="admin-batch-hint">
          勾选表格行可进行批量操作
        </span>
      )}
    </div>
  )
}

export function useSelection<T extends { id: string }>(items: T[]) {
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const allSelected = items.length > 0 && items.every((x) => selected.has(x.id))
  const someSelected = items.some((x) => selected.has(x.id))
  const indeterminate = someSelected && !allSelected

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll(checked: boolean) {
    setSelected((checked ? new Set(items.map((x) => x.id)) : new Set()))
  }

  function clear() {
    setSelected(new Set())
  }

  function removeMany(ids: string[]) {
    setSelected((prev) => {
      const next = new Set(prev)
      ids.forEach((id) => next.delete(id))
      return next
    })
  }

  return {
    selected,
    selectedCount: selected.size,
    allSelected,
    indeterminate,
    toggleOne,
    toggleAll,
    clear,
    removeMany,
  }
}
