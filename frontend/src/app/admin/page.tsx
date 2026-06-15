'use client'

import { useEffect, useState } from 'react'

const US = [
  { n: '张三', no: '2024001', m: '计算机科学', r: 12, e: 48, s: 1, la: '2小时前' },
  { n: '李四', no: '2024002', m: '人工智能', r: 8, e: 32, s: 1, la: '5小时前' },
  { n: '王五', no: '2024003', m: '软件工程', r: 0, e: 0, s: 0, la: '2天前' },
  { n: '赵六', no: '2024004', m: '数据科学', r: 15, e: 56, s: 1, la: '1小时前' },
  { n: '孙七', no: '2024005', m: '计算机科学', r: 3, e: 12, s: 1, la: '30分钟前' },
]

const chartR = [8, 12, 15, 10, 18, 23, 14]
const chartG = [28, 35, 42, 38, 55, 47, 62]
const dayLabels = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']

export default function AdminDashboardPage() {
  const [stats, setStats] = useState({
    total_users: 128,
    total_resources: 256,
    total_exercises: 1024,
    today_active: 12,
    today_new_resources: 8,
    total_chats: 512,
    storage_mb: 45.2,
    ai_ratio: 93,
  })
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const token = typeof window !== 'undefined' ? localStorage.getItem('zhishu_admin_token') : null
    if (token) {
      fetch('http://localhost:8001/api/v1/admin/stats', {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data) setStats((s) => ({ ...s, ...data }))
        })
        .catch(() => {})
    }
  }, [])

  function renderChart(id: string, data: number[], cls: string) {
    const mx = Math.max(...data)
    const bars = data
      .map((v) => `<div class="admin-ch-bar ${cls}" style="height:${Math.round((v / mx) * 100)}%"></div>`)
      .join('')
    const labels = dayLabels.map((d) => `<span>${d}</span>`).join('')
    const el = document.getElementById(id)
    if (el) el.innerHTML = `<div class="admin-ch-b">${bars}</div><div class="admin-ch-l">${labels}</div>`
  }

  useEffect(() => {
    if (!mounted) return
    renderChart('cR', chartR, '')
    renderChart('cG', chartG, 'ac')
  }, [mounted])

  return (
    <div className="admin-pnl vis">
      <div className="admin-sg">
        <div className="admin-st">
          <div className="admin-st-t">
            <div className="admin-st-l">用户总数</div>
            <div
              className="admin-st-i"
              style={{ background: 'var(--info-soft)', color: 'var(--info)' }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
              </svg>
            </div>
          </div>
          <div className="admin-st-v" style={{ color: 'var(--info)' }}>
            {stats.total_users}
          </div>
          <div className="admin-st-s">学生 {stats.total_users - 5} · 管理员 5</div>
        </div>

        <div className="admin-st">
          <div className="admin-st-t">
            <div className="admin-st-l">资源总数</div>
            <div
              className="admin-st-i"
              style={{ background: 'var(--warm-soft)', color: 'var(--warm)' }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
            </div>
          </div>
          <div className="admin-st-v" style={{ color: 'var(--warm)' }}>
            {stats.total_resources}
          </div>
          <div className="admin-st-s">
            今日新增{' '}
            <span style={{ color: 'var(--success)', fontWeight: 600 }}>
              +{stats.today_new_resources}
            </span>
          </div>
        </div>

        <div className="admin-st">
          <div className="admin-st-t">
            <div className="admin-st-l">练习题</div>
            <div
              className="admin-st-i"
              style={{ background: 'var(--success-soft)', color: 'var(--success)' }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 11l3 3L22 4" />
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
              </svg>
            </div>
          </div>
          <div className="admin-st-v" style={{ color: 'var(--success)' }}>
            {stats.total_exercises.toLocaleString()}
          </div>
          <div className="admin-st-s">
            AI 生成 <span style={{ fontWeight: 600 }}>{stats.ai_ratio}%</span>
          </div>
        </div>

        <div className="admin-st">
          <div className="admin-st-t">
            <div className="admin-st-l">今日活跃</div>
            <div
              className="admin-st-i"
              style={{ background: 'var(--purple-soft)', color: 'var(--purple)' }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
            </div>
          </div>
          <div className="admin-st-v" style={{ color: 'var(--purple)' }}>
            {stats.today_active}
          </div>
          <div className="admin-st-s">
            对话 {stats.total_chats} · 存储 {stats.storage_mb}MB
          </div>
        </div>
      </div>

      <div className="admin-g2">
        <div className="admin-cd">
          <div className="admin-cd-h">
            <h3>7天注册趋势</h3>
          </div>
          <div className="admin-cd-b">
            <div className="admin-ch" id="cR"></div>
          </div>
        </div>
        <div className="admin-cd">
          <div className="admin-cd-h">
            <h3>7天资源生成趋势</h3>
          </div>
          <div className="admin-cd-b">
            <div className="admin-ch" id="cG"></div>
          </div>
        </div>
      </div>

      <div className="admin-cd" style={{ marginTop: 12 }}>
        <div className="admin-cd-h">
          <h3>最近活跃用户</h3>
        </div>
        <div className="admin-cd-b" style={{ padding: 0 }}>
          <div className="admin-tw">
            <table>
              <thead>
                <tr>
                  <th>学号</th>
                  <th>姓名</th>
                  <th>最近活动</th>
                  <th>资源数</th>
                </tr>
              </thead>
              <tbody>
                {US.filter((u) => u.s === 1).map((u, i) => (
                  <tr key={i}>
                    <td>
                      <code style={{ fontSize: 11 }}>{u.no}</code>
                    </td>
                    <td style={{ fontWeight: 500 }}>{u.n}</td>
                    <td style={{ fontSize: 11.5 }}>{u.la}</td>
                    <td style={{ fontWeight: 500 }}>{u.r}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
