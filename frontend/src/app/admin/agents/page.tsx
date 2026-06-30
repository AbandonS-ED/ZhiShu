'use client'

import { useEffect, useState } from 'react'
import { useAdmin } from '@/lib/admin/context'
import { adminApi, type AdminAgent } from '@/lib/api'

const COLORS = [
  { b: 'var(--accent-soft)', c: 'var(--ink-2)' },
  { b: 'var(--info-soft)', c: 'var(--info)' },
  { b: 'var(--warm-soft)', c: 'var(--warm)' },
  { b: 'var(--purple-soft)', c: 'var(--purple)' },
  { b: 'var(--success-soft)', c: 'var(--success)' },
  { b: 'var(--danger-soft)', c: 'var(--danger)' },
  { b: 'var(--info-soft)', c: 'var(--info)' },
  { b: 'var(--warm-soft)', c: 'var(--warm)' },
]

const FALLBACK_AGENTS: AdminAgent[] = [
  { name: 'MasterAgent', role: '调度中心', calls: 0, errors: 0, error_rate: 0, avg_ms: 0 },
  { name: 'InitialAssessmentAgent', role: '画像构建', calls: 0, errors: 0, error_rate: 0, avg_ms: 0 },
  { name: 'DocumentAgent', role: '知识讲解', calls: 0, errors: 0, error_rate: 0, avg_ms: 0 },
  { name: 'ExerciseAgent', role: '练习生成', calls: 0, errors: 0, error_rate: 0, avg_ms: 0 },
  { name: 'PathAgent', role: '路径规划', calls: 0, errors: 0, error_rate: 0, avg_ms: 0 },
  { name: 'TutorAgent', role: '智能问答', calls: 0, errors: 0, error_rate: 0, avg_ms: 0 },
  { name: 'MindMapAgent', role: '思维导图', calls: 0, errors: 0, error_rate: 0, avg_ms: 0 },
  { name: 'AudioAgent', role: '音频脚本', calls: 0, errors: 0, error_rate: 0, avg_ms: 0 },
]

export default function AgentsPage() {
  const { showToast } = useAdmin()
  const [agents, setAgents] = useState<AdminAgent[]>(FALLBACK_AGENTS)
  const [system, setSystem] = useState({ cpu_percent: 0, memory_mb: 0 })
  const [mounted, setMounted] = useState(false)

  async function loadAgents() {
    try {
      const data = await adminApi.getAgents()
      setAgents(data.agents.length ? data.agents : FALLBACK_AGENTS)
      setSystem(data.system)
    } catch {
      // 静默失败，使用默认数据
    }
  }

  useEffect(() => {
    setMounted(true)
    loadAgents()
    const timer = setInterval(loadAgents, 30000) // 30s 刷新
    return () => clearInterval(timer)
  }, [])

  const online = agents.filter((a) => a.calls > 0 || a.avg_ms === 0).length
  const totalCalls = agents.reduce((s, a) => s + a.calls, 0)
  const totalErrors = agents.reduce((s, a) => s + a.errors, 0)
  const avgErrorRate = totalCalls > 0 ? (totalErrors / totalCalls * 100).toFixed(1) : '0.0'
  const maxCalls = Math.max(...agents.map((a) => a.calls), 1)

  return (
    <div className="admin-pnl vis">
      <div className="admin-cd" style={{ marginBottom: 12 }}>
        <div className="admin-cd-h">
          <h3>Agent 集群状态</h3>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <span className="admin-tag admin-tag-green">在线 {online}/{agents.length}</span>
            <span style={{ fontSize: 11, color: 'var(--ink-2)' }}>
              CPU {system.cpu_percent}% · 内存 {system.memory_mb.toFixed(0)}MB
            </span>
          </div>
        </div>
        <div className="admin-cd-b">
          <div className="admin-ag-g">
            {agents.map((a, i) => {
              const cl = COLORS[i % COLORS.length]
              const bc = a.avg_ms > 0 ? 'var(--success)' : 'var(--warm)'
              return (
                <div key={a.name} className="admin-ag-c">
                  <div className="admin-ag-t">
                    <div className="admin-ag-ic" style={{ background: cl.b, color: cl.c }}>
                      {a.name[0]}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div className="admin-ag-nm" title={a.name}>{a.name}</div>
                      <div className="admin-ag-rl">{a.role}</div>
                    </div>
                    <span className="admin-ag-bg" style={{ background: 'var(--success-soft)', color: 'var(--success)' }}>
                      {a.calls > 0 ? '活跃' : '就绪'}
                    </span>
                  </div>
                  <div className="admin-ag-bar">
                    <div
                      className="admin-ag-fill"
                      style={{
                        width: `${Math.min((a.calls / maxCalls) * 100, 100)}%`,
                        background: bc,
                      }}
                    />
                  </div>
                  <div className="admin-ag-mt">
                    <span>{a.calls} 调用</span>
                    <span>{a.avg_ms.toFixed(0)}ms</span>
                    <span style={{ color: a.error_rate > 1 ? 'var(--danger)' : 'var(--ink-2)' }}>
                      {a.error_rate}%
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className="admin-g2">
        <div className="admin-cd">
          <div className="admin-cd-h"><h3>调用统计</h3></div>
          <div className="admin-cd-b">
            {agents.map((a) => (
              <div key={a.name} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--line-2)' }}>
                <span title={a.name} style={{ width: 130, fontSize: 11.5, color: 'var(--ink-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.name}</span>
                <div style={{ flex: 1, height: 4, background: 'var(--bg-subtle)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${(a.calls / maxCalls) * 100}%`, background: 'var(--info)', borderRadius: 2 }} />
                </div>
                <span style={{ fontSize: 10.5, fontWeight: 600, minWidth: 36, textAlign: 'right' }}>{a.calls}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="admin-cd">
          <div className="admin-cd-h"><h3>错误率</h3></div>
          <div className="admin-cd-b">
            {agents.map((a) => {
              const ec = a.error_rate >= 1 ? 'var(--danger)' : a.error_rate >= 0.5 ? 'var(--warm)' : 'var(--success)'
              return (
                <div key={a.name} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--line-2)' }}>
                  <span title={a.name} style={{ width: 130, fontSize: 11.5, color: 'var(--ink-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.name}</span>
                  <div style={{ flex: 1, height: 4, background: 'var(--bg-subtle)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.min(a.error_rate * 40, 100)}%`, background: ec, borderRadius: 2 }} />
                  </div>
                  <span style={{ fontSize: 10.5, fontWeight: 600, minWidth: 36, textAlign: 'right', color: ec }}>
                    {a.error_rate}%
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
