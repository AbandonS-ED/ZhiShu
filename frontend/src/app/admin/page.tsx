'use client'

import { useEffect, useState } from 'react'
import { adminApi, type AdminStats, type AdminTrends, type AdminUser } from '@/lib/api'

const CHART_COLORS = ['var(--info)', 'var(--success)', 'var(--warm)', 'var(--danger)', 'var(--purple)']

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<AdminStats>({
    total_users: 0, admin_count: 0, total_resources: 0, total_exercises: 0,
    total_paths: 0, total_chats: 0, total_documents: 0, today_active: 0,
    today_new_resources: 0,
  })
  const [trends, setTrends] = useState<AdminTrends>({ labels: [], registrations: [], resources: [] })
  const [users, setUsers] = useState<AdminUser[]>([])
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const token = localStorage.getItem('zhishu_admin_token')
    if (!token) return

    adminApi.getStats().then(setStats).catch(() => {})
    adminApi.getTrends(7).then(setTrends).catch(() => {})
    adminApi.getUsers(1, 5).then((d) => setUsers(d.items)).catch(() => {})
  }, [])

  function renderChart(id: string, data: number[], color: string) {
    if (!data.length) return
    const mx = Math.max(...data, 1)
    const bars = data.map((v) =>
      `<div class="admin-ch-bar" style="height:${Math.round((v / mx) * 100)}%;background:${color}"></div>`
    ).join('')
    const labels = trends.labels.map((l) => `<span>${l}</span>`).join('')
    const el = document.getElementById(id)
    if (el) el.innerHTML = `<div class="admin-ch-b">${bars}</div><div class="admin-ch-l">${labels}</div>`
  }

  useEffect(() => {
    if (!mounted) return
    renderChart('cR', trends.registrations, CHART_COLORS[0])
    renderChart('cG', trends.resources, CHART_COLORS[1])
  }, [mounted, trends])

  const studentCount = stats.total_users - stats.admin_count

  return (
    <div className="admin-pnl vis">
      <div className="admin-sg">
        <div className="admin-st">
          <div className="admin-st-t">
            <div className="admin-st-l">用户总数</div>
            <div className="admin-st-i" style={{ background: 'var(--info-soft)', color: 'var(--info)' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
              </svg>
            </div>
          </div>
          <div className="admin-st-v" style={{ color: 'var(--info)' }}>{stats.total_users}</div>
          <div className="admin-st-s">学生 {studentCount} · 管理员 {stats.admin_count}</div>
        </div>

        <div className="admin-st">
          <div className="admin-st-t">
            <div className="admin-st-l">资源总数</div>
            <div className="admin-st-i" style={{ background: 'var(--warm-soft)', color: 'var(--warm)' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
            </div>
          </div>
          <div className="admin-st-v" style={{ color: 'var(--warm)' }}>{stats.total_resources}</div>
          <div className="admin-st-s">今日新增 <span style={{ color: 'var(--success)', fontWeight: 600 }}>+{stats.today_new_resources}</span></div>
        </div>

        <div className="admin-st">
          <div className="admin-st-t">
            <div className="admin-st-l">练习题</div>
            <div className="admin-st-i" style={{ background: 'var(--success-soft)', color: 'var(--success)' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 11l3 3L22 4" />
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
              </svg>
            </div>
          </div>
          <div className="admin-st-v" style={{ color: 'var(--success)' }}>{stats.total_exercises.toLocaleString()}</div>
          <div className="admin-st-s">路径 {stats.total_paths} · 知识库 {stats.total_documents}</div>
        </div>

        <div className="admin-st">
          <div className="admin-st-t">
            <div className="admin-st-l">今日活跃</div>
            <div className="admin-st-i" style={{ background: 'var(--purple-soft)', color: 'var(--purple)' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
            </div>
          </div>
          <div className="admin-st-v" style={{ color: 'var(--purple)' }}>{stats.today_active}</div>
          <div className="admin-st-s">对话 {stats.total_chats}</div>
        </div>
      </div>

      <div className="admin-g2">
        <div className="admin-cd">
          <div className="admin-cd-h"><h3>7天注册趋势</h3></div>
          <div className="admin-cd-b">
            <div className="admin-ch" id="cR"></div>
          </div>
        </div>
        <div className="admin-cd">
          <div className="admin-cd-h"><h3>7天资源生成趋势</h3></div>
          <div className="admin-cd-b">
            <div className="admin-ch" id="cG"></div>
          </div>
        </div>
      </div>

      <div className="admin-cd" style={{ marginTop: 12 }}>
        <div className="admin-cd-h"><h3>最近活跃用户</h3></div>
        <div className="admin-cd-b" style={{ padding: 0 }}>
          <div className="admin-tw">
            <table>
              <thead>
                <tr>
                  <th>学号</th>
                  <th>姓名</th>
                  <th>角色</th>
                  <th>资源数</th>
                  <th>最近登录</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td><code style={{ fontSize: 11 }}>{u.student_no}</code></td>
                    <td style={{ fontWeight: 500 }}>{u.name}</td>
                    <td style={{ fontSize: 11.5, color: u.role === 'admin' ? 'var(--warm)' : 'var(--ink-2)' }}>{u.role}</td>
                    <td style={{ fontWeight: 500 }}>{u.resource_count}</td>
                    <td style={{ fontSize: 11.5 }}>{u.last_login ? new Date(u.last_login).toLocaleDateString() : '-'}</td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr><td colSpan={5} style={{ textAlign: 'center', padding: 20, color: 'var(--ink-2)' }}>暂无数据</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
