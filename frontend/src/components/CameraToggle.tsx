'use client'

/**
 * 摄像头开关组件 — 复用于 idle 配置页
 * 受控组件：父组件管 enabled，受 onChange 回调
 * 开启时由 onRequestPermission 触发 getUserMedia（外层拿到 stream）
 */
import { useState } from 'react'

export function CameraToggle({
  enabled,
  onChange,
  onRequestPermission,
}: {
  enabled: boolean
  onChange: (v: boolean) => void
  onRequestPermission: () => Promise<boolean>
}) {
  const [granting, setGranting] = useState(false)

  async function handleClick() {
    if (granting) return
    if (!enabled) {
      setGranting(true)
      try {
        const ok = await onRequestPermission()
        // 权限通过才置为 on；权限被拒保持关闭
        if (ok) onChange(true)
      } catch {
        // 权限拒绝保持关闭
      } finally {
        setGranting(false)
      }
    } else {
      onChange(false)
    }
  }

  const label = enabled
    ? '摄像头监控已开启'
    : granting
      ? '授权中…'
      : '摄像头监控未开启'

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={granting}
      className={`cam-toggle-btn${enabled ? ' on' : ''}${granting ? ' granting' : ''}`}
    >
      <span className="cam-dot" />
      <span className="cam-label">{label}</span>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="16" height="16">
        <path d="M23 7l-7 5 7 5V7z" />
        <rect x="1" y="5" width="15" height="14" rx="2" />
      </svg>
    </button>
  )
}