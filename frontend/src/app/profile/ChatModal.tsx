'use client'

import { useState } from 'react'
import { profileApi, StudentProfile } from '@/lib/api'
import { getStudentId } from '@/lib/student'

export default function ProfileChatModal({ onClose, onProfile }: {
  onClose: () => void
  onProfile: (p: StudentProfile) => void
}) {
  const [messages, setMessages] = useState<Array<{ role: string; content: string }>>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [hint, setHint] = useState('你好！我是智枢学习助手。请简单介绍一下你的专业、年级、学习情况？')

  const send = async () => {
    if (!input.trim() || loading) return
    const newMsgs = [...messages, { role: 'user', content: input }]
    setMessages(newMsgs)
    setInput('')
    setHint('')
    setLoading(true)
    try {
      const profile = await profileApi.build(getStudentId(), newMsgs)
      onProfile(profile)
      setHint(`✅ 画像已更新！版本 v${profile.version}，完整度 ${profile.completeness_score.toFixed(0)}%`)
    } catch (e: any) {
      setHint(`❌ 调用失败: ${e.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'var(--surface)', borderRadius: 12, padding: 24, width: 520, maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <h3 style={{ margin: 0 }}>🤖 AI 对话式画像提取</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer' }}>×</button>
        </div>

        {hint && <div style={{ padding: 12, background: 'var(--info-soft)', borderRadius: 8, marginBottom: 12, fontSize: 13 }}>{hint}</div>}

        <div style={{ flex: 1, overflow: 'auto', minHeight: 240, maxHeight: 400, marginBottom: 12, padding: 8, background: 'var(--bg)', borderRadius: 8 }}>
          {messages.length === 0 ? (
            <div style={{ color: 'var(--text-3)', textAlign: 'center', padding: 40, fontSize: 13 }}>
              回答 3-5 个问题，AI 会自动构建你的 6 维学习画像<br/>
              <br/>
              例如：<br/>
              • 我是计算机专业大三学生<br/>
              • 对机器学习感兴趣<br/>
              • 深度学习不太好<br/>
              • 每天能学 2 小时，喜欢看视频
            </div>
          ) : messages.map((m, i) => (
            <div key={i} style={{ marginBottom: 8, padding: 8, background: m.role === 'user' ? 'var(--brand-soft)' : 'var(--surface)', borderRadius: 6, fontSize: 13 }}>
              <strong>{m.role === 'user' ? '我' : 'AI'}：</strong>{m.content}
            </div>
          ))}
          {loading && <div style={{ padding: 8, color: 'var(--text-3)', fontSize: 13 }}>AI 分析中...</div>}
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && send()}
            placeholder="输入你的回答..."
            disabled={loading}
            style={{ flex: 1, padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)' }}
          />
          <button onClick={send} disabled={loading || !input.trim()} style={{ padding: '8px 16px', background: 'var(--brand)', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}>发送</button>
        </div>
      </div>
    </div>
  )
}
