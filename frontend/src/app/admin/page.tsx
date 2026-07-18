'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { adminApi, type AdminStats, type AdminTrends, type AdminUser } from '@/lib/api'

const CHART_COLORS = ['var(--info)', 'var(--success)', 'var(--warm)', 'var(--danger)', 'var(--purple)']

function BarChart({ data, labels, color }: { data: number[]; labels: string[]; color: string }) {
  if (!data.length) return null
  const mx = Math.max(...data, 1)
  return (
    <div className="admin-ch">
      <div className="admin-ch-b">
        {data.map((v, i) => (
          <div key={i} className="admin-ch-bar" style={{ height: `${Math.round((v / mx) * 100)}%`, background: color }} />
        ))}
      </div>
      <div className="admin-ch-l">
        {labels.map((l, i) => <span key={i}>{l}</span>)}
      </div>
    </div>
  )
}

function SkeletonCard() {
  return (
    <div className="admin-st" style={{ opacity: 0.5 }}>
      <div className="admin-st-t">
        <div className="admin-st-l" style={{ width: 80, height: 14, background: 'var(--bg-subtle)', borderRadius: 4 }} />
      </div>
      <div style={{ width: 60, height: 28, background: 'var(--bg-subtle)', borderRadius: 4, marginTop: 8 }} />
      <div style={{ width: 120, height: 12, background: 'var(--bg-subtle)', borderRadius: 4, marginTop: 8 }} />
    </div>
  )
}

export default function AdminDashboardPage() {
  const router = useRouter()
  const [stats, setStats] = useState<AdminStats>({
    total_users: 0, admin_count: 0, total_exercises: 0,
    total_chats: 0, total_documents: 0, today_active: 0,
  })
  const [trends, setTrends] = useState<AdminTrends>({ labels: [], registrations: [], resources: [] })
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('zhishu_admin_token')
    if (!token) {
      router.replace('/admin/login')
      return
    }
    Promise.all([
      adminApi.getStats().then(setStats).catch(err => console.error('[admin] getStats 失败:', err)),
      adminApi.getTrends(7).then(setTrends).catch(err => console.error('[admin] getTrends 失败:', err)),
      adminApi.getUsers(1, 5).then((d) => setUsers(d.items)).catch(err => console.error('[admin] getUsers 失败:', err)),
    ]).finally(() => setLoading(false))
  }, [router])

  const studentCount = stats.total_users - stats.admin_count

  return (
    <div className="admin-pg">
      {loading ? (
        <div className="admin-sg">
          <SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard />
        </div>
      ) : (
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
              <div className="admin-st-l">练习题</div>
              <div className="admin-st-i" style={{ background: 'var(--success-soft)', color: 'var(--success)' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 11l3 3L22 4" />
                  <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                </svg>
              </div>
            </div>
            <div className="admin-st-v" style={{ color: 'var(--success)' }}>{stats.total_exercises.toLocaleString()}</div>
            <div className="admin-st-s">知识库 {stats.total_documents}</div>
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
      )}

      <div className="admin-g2">
        <div className="admin-cd">
          <div className="admin-cd-h"><h3>7天注册趋势</h3></div>
          <div className="admin-cd-b">
            {loading ? <div style={{ height: 120, opacity: 0.3 }} /> : <BarChart data={trends.registrations} labels={trends.labels} color={CHART_COLORS[0]} />}
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
                  <th>最近登录</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td><code style={{ fontSize: 11 }}>{u.student_no}</code></td>
                    <td style={{ fontWeight: 500 }}>{u.name}</td>
                    <td style={{ fontSize: 11.5, color: u.role === 'admin' ? 'var(--warm)' : 'var(--ink-2)' }}>{u.role}</td>
                    <td style={{ fontSize: 11.5 }}>{u.last_login ? new Date(u.last_login).toLocaleDateString() : '-'}</td>
                  </tr>
                ))}
                {users.length === 0 && !loading && (
                  <tr><td colSpan={4} style={{ textAlign: 'center', padding: 20, color: 'var(--ink-2)' }}>暂无数据</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
