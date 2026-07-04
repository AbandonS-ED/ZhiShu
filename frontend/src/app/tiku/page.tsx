'use client'

import Icon from '@/components/Icon'

export default function TikuPage() {
  return (
    <div style={{ textAlign: 'center', padding: '120px 0', color: 'var(--ink-3)' }}>
      <div style={{ marginBottom: 16 }}><Icon name="book" size={48} /></div>
      <h2 style={{ fontSize: 20, fontWeight: 600, color: 'var(--ink)', marginBottom: 8 }}>题库功能重建中</h2>
      <p style={{ fontSize: 14, maxWidth: 360, margin: '0 auto', lineHeight: 1.7 }}>
        题库正在升级重构，敬请期待。
      </p>
    </div>
  )
}
