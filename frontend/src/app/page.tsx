'use client'

import { useState, useEffect } from 'react'
import { getStudentId } from '@/lib/student'
import dynamic from 'next/dynamic'

const Line = dynamic(() =>
  import('chart.js').then(chartjs => {
    chartjs.Chart.register(
      chartjs.CategoryScale, chartjs.LinearScale, chartjs.PointElement,
      chartjs.LineElement, chartjs.Filler, chartjs.Tooltip,
    )
    return import('react-chartjs-2').then(m => m.Line)
  }),
  { ssr: false },
)

interface Activity {
  type: string
  title?: string
  content?: string
  time: string
  color?: string
}

interface Course {
  name: string
  progress: number
  status: string
}

interface DailyMinute {
  date: string
  minutes: number
}

interface Stats {
  knowledge_points: number
  knowledge_points_trend: string
  learning_hours: string
  learning_hours_trend: string
  accuracy: string
  accuracy_trend: string
  path_progress: string
  path_progress_trend: string
  today_minutes: number
  daily_study_minutes: DailyMinute[]
  streak_days: number
  recent_activities: Activity[]
  recent_chats: Activity[]
}

  const DEFAULT_DAILY_GOAL = 60 // 默认目标每日 60 分钟

export default function Home() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [courses, setCourses] = useState<Course[]>([])
  const [hasProfile, setHasProfile] = useState(false)
  const [resourceCount, setResourceCount] = useState(0)
  const [loadingUser, setLoadingUser] = useState(true)
  const [dailyGoal, setDailyGoal] = useState(DEFAULT_DAILY_GOAL)

  useEffect(() => {
    const saved = localStorage.getItem('zhishu_daily_goal')
    if (saved) {
      const v = parseInt(saved, 10)
      if (!isNaN(v) && v >= 10 && v <= 480) setDailyGoal(v)
    }
  }, [])

  useEffect(() => {
    function onStorage() {
      const saved = localStorage.getItem('zhishu_daily_goal')
      if (saved) {
        const v = parseInt(saved, 10)
        if (!isNaN(v) && v >= 10 && v <= 480) setDailyGoal(v)
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  useEffect(() => {
    const sid = getStudentId()
    if (!sid) return
    import('@/lib/api').then(({ dashboardApi, profileApi, resourceApi }) => {
      dashboardApi.getStats(sid).then(setStats).catch(console.error)
      dashboardApi.getCourses(sid).then((data) => setCourses(data.courses)).catch(console.error)
      Promise.all([
        profileApi.getMe().then((p) => setHasProfile(!!p)).catch(err => console.error('[dashboard] profileApi.getMe 失败:', err)),
        resourceApi.list(sid).then((r) => setResourceCount(Array.isArray(r) ? r.length : 0)).catch(err => console.error('[dashboard] resourceApi.list 失败:', err)),
      ]).finally(() => setLoadingUser(false))
    })
  }, [])

  const s = stats || {
    knowledge_points: 0,
    knowledge_points_trend: '',
    learning_hours: '0h',
    learning_hours_trend: '',
    accuracy: '0%',
    accuracy_trend: '',
    path_progress: '0%',
    path_progress_trend: '',
    today_minutes: 0,
    daily_study_minutes: [],
    streak_days: 0,
    recent_activities: [],
    recent_chats: [],
  }

  // 合并活动和聊天记录，按时间排序
  const allActivities: Activity[] = s.recent_activities || []

  function formatTime(iso: string): string {
    if (!iso) return ''
    const d = new Date(iso)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffMin = Math.floor(diffMs / 60000)
    if (diffMin < 1) return '刚刚'
    if (diffMin < 60) return `${diffMin} 分钟前`
    const diffH = Math.floor(diffMin / 60)
    if (diffH < 24) return `${diffH} 小时前`
    const diffD = Math.floor(diffH / 24)
    if (diffD === 1) return '昨天'
    if (diffD < 7) return `${diffD} 天前`
    return d.toLocaleDateString('zh-CN')
  }

  // 进度环参数
  const todayPct = Math.min(s.today_minutes / dailyGoal * 100, 100)
  const circ = 2 * Math.PI * 42 // 周长
  const offset = circ - (circ * todayPct / 100)

  // 7 天折线图数据
  const chartLabels = s.daily_study_minutes.map(d => {
    const dt = new Date(d.date)
    return `${dt.getMonth() + 1}/${dt.getDate()}`
  })
  const chartData = s.daily_study_minutes.map(d => d.minutes)

  return (
    <>
      <div className="page active" id="pg-dashboard">
        {/* 顶部 Hero：今日 + Streak */}
        <div className="dash-hero">
          <div className="dash-hero-ring">
            <svg width="100" height="100" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="42" fill="none" stroke="var(--bg-subtle)" strokeWidth="8" />
              <circle cx="50" cy="50" r="42" fill="none"
                stroke={todayPct >= 100 ? 'var(--success)' : 'var(--warm)'}
                strokeWidth="8" strokeLinecap="round"
                strokeDasharray={circ} strokeDashoffset={offset}
                style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%', transition: 'stroke-dashoffset 1s ease' }} />
            </svg>
            <div className="dash-hero-ring-val">
              <div className="dash-hero-ring-num">{s.today_minutes}</div>
              <div className="dash-hero-ring-unit">分钟</div>
            </div>
          </div>
          <div className="dash-hero-info">
            <div className="dash-hero-title">
              {s.today_minutes >= dailyGoal ? '今日目标已达成 !' : `今日已学 ${s.today_minutes} 分钟`}
            </div>
            <div className="dash-hero-sub">
              目标 {dailyGoal} 分钟 · {todayPct >= 100 ? '超额完成' : `还差 ${dailyGoal - s.today_minutes} 分钟`}
            </div>
            <div className="dash-hero-streak">
              <span className="streak-fire">🔥</span>
              <span className="streak-num">{s.streak_days}</span>
              <span className="streak-label">天连续学习</span>
            </div>
          </div>
        </div>

        {/* 4 个核心指标 */}
        <div className="stats">
          <div className="stat">
            <div className="num">{s.knowledge_points}</div>
            <div className="label">已学知识点</div>
            <div className="trend">{s.knowledge_points_trend}</div>
          </div>
          <div className="stat">
            <div className="num">{s.learning_hours}</div>
            <div className="label">累计学习时长</div>
            <div className="trend">{s.learning_hours_trend}</div>
          </div>
          <div className="stat">
            <div className="num">{s.accuracy}</div>
            <div className="label">练习正确率</div>
            <div className="trend">{s.accuracy_trend}</div>
          </div>
          <div className="stat">
            <div className="num">{s.path_progress}</div>
            <div className="label">路径总进度</div>
            <div className="trend">{s.path_progress_trend}</div>
          </div>
        </div>

        <div className="dash-grid">
          {/* 7 天学习趋势折线图 */}
          <div className="card" style={{ gridColumn: 'span 2' }}>
            <div className="card-hd">
              <h3>7 天学习趋势</h3>
              <span className="tag tag-dark">本周</span>
            </div>
            <div className="card-bd" style={{ height: 180, padding: '8px 12px' }}>
              {chartData.some(v => v > 0) ? (
                <Line
                  data={{
                    labels: chartLabels,
                    datasets: [{
                      data: chartData,
                      borderColor: 'var(--warm)',
                      backgroundColor: 'rgba(196,122,58,0.08)',
                      borderWidth: 2,
                      pointRadius: 4,
                      pointBackgroundColor: 'var(--warm)',
                      pointBorderColor: '#fff',
                      pointBorderWidth: 2,
                      fill: true,
                      tension: 0.3,
                    }],
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                      x: { grid: { display: false }, ticks: { font: { size: 11 }, color: '#a8a29e' } },
                      y: { beginAtZero: true, grid: { color: '#e7e5e4' }, ticks: { font: { size: 11 }, color: '#a8a29e', callback: (v: any) => `${v}m` } },
                    },
                    plugins: {
                      legend: { display: false },
                      tooltip: { backgroundColor: 'rgba(28,25,23,0.92)', titleFont: { size: 12 }, bodyFont: { size: 13 }, padding: 10, cornerRadius: 8, callbacks: { label: (ctx: any) => ` ${ctx.raw} 分钟` } },
                    },
                  }}
                />
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--ink-3)', fontSize: 13 }}>
                  暂无学习数据，开始学习后将显示趋势图
                </div>
              )}
            </div>
          </div>

          {/* 最近活动 */}
          <div className="card">
            <div className="card-hd">
              <h3>最近活动</h3>
              <span className="tag tag-dark">7 天</span>
            </div>
            <div className="card-bd">
              {allActivities.length === 0 ? (
                <div className="act-item">
                  <div className="act-dot" style={{ background: 'var(--ink-4)' }}></div>
                  <div className="act-body">
                    <p>暂无活动记录</p>
                    <div className="time">开始学习后将在此显示</div>
                  </div>
                </div>
              ) : (
                allActivities.map((act, i) => (
                  <div className="act-item" key={i}>
                    <div className="act-dot" style={{ background: act.color || 'var(--ink-3)' }}></div>
                    <div className="act-body">
                      <p>
                        {act.type === 'chat' ? (
                          <>对话：{act.content ? `"${act.content.slice(0, 25)}${act.content.length > 25 ? '...' : ''}"` : '新消息'}</>
                        ) : act.type === 'exercise' ? (
                          <>做了题：<strong>{act.title || '练习题'}</strong></>
                        ) : act.type === 'study' ? (
                          <>自习了 <strong>{act.title || '番茄钟'}</strong></>
                        ) : act.type === 'path' ? (
                          <>生成路径：<strong>{act.title || '学习路径'}</strong></>
                        ) : act.type === 'profile' ? (
                          <>更新画像：<strong>{act.title || '学习画像'}</strong></>
                        ) : (
                          <>学习了 <strong>{act.title || '新资源'}</strong></>
                        )}
                      </p>
                      <div className="time">{formatTime(act.time)}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* 快速开始 */}
          <div className="card">
            <div className="card-hd">
              <h3>快速开始</h3>
              <span className="tag tag-warm">Quick</span>
            </div>
            <div className="card-bd">
              {/* 根据用户状态推荐最合适的入口 */}
              {loadingUser ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', background: 'var(--bg)', borderRadius: 8, marginBottom: 12, fontSize: 13, color: 'var(--ink-4)' }}>
                  <div className="skeleton" style={{ width: 20, height: 20, borderRadius: 4 }} />
                  <div style={{ flex: 1 }}>
                    <div className="skeleton" style={{ width: '60%', height: 14, borderRadius: 4, marginBottom: 4 }} />
                    <div className="skeleton" style={{ width: '40%', height: 10, borderRadius: 4 }} />
                  </div>
                </div>
              ) : !hasProfile ? (
                <a className="rec-cta" href="/duihua">
                  <svg viewBox="0 0 24 24" fill="none" stroke="var(--brand)" strokeWidth="1.8"><circle cx="12" cy="8" r="4" /><path d="M20 21a8 8 0 1 0-16 0" /></svg>
                  <div>
                    <div className="rec-title">完成首次对话，生成你的学习画像</div>
                    <div className="rec-sub">系统会根据你的回答推荐学习内容</div>
                  </div>
                </a>
              ) : resourceCount === 0 ? (
                <a className="rec-cta" href="/resources">
                  <svg viewBox="0 0 24 24" fill="none" stroke="var(--brand)" strokeWidth="1.8"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
                  <div>
                    <div className="rec-title">你的资源中心还是空的，去看看</div>
                    <div className="rec-sub">系统会根据你的画像推荐学习资源</div>
                  </div>
                </a>
              ) : (
                <a className="rec-cta" href="/zixi">
                  <svg viewBox="0 0 24 24" fill="none" stroke="var(--brand)" strokeWidth="1.8"><path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" /></svg>
                  <div>
                    <div className="rec-title">继续自习，专注学习 {resourceCount} 个资源</div>
                    <div className="rec-sub">摄像头监控你的专注状态，番茄钟式学习</div>
                  </div>
                </a>
              )}
              {/* 其他快捷入口 */}
              <div className="qa-grid">
                <a className="qa" href="/duihua">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                  开始对话
                </a>
                <a className="qa" href="/profile">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <circle cx="12" cy="8" r="4" />
                    <path d="M20 21a8 8 0 1 0-16 0" />
                  </svg>
                  更新画像
                </a>
                <a className="qa" href="/duihua">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                  开始对话
                </a>
                <a className="qa" href="/tiku">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M9 11l3 3L22 4" />
                    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                  </svg>
                  开始练习
                </a>
              </div>
            </div>
          </div>

          {/* 课程进度 */}
          <div className="card" style={{ gridColumn: 'span 2' }}>
            <div className="card-hd">
              <h3>课程进度</h3>
              <span className="tag tag-green">进行中</span>
            </div>
            <div className="card-bd">
              {courses.length === 0 ? (
                <div className="prog-item">
                  <div className="prog-top">
                    <span>暂无课程</span>
                    <span>--</span>
                  </div>
                  <div className="prog-track">
                    <div className="prog-fill" style={{ width: '0%' }}></div>
                  </div>
                </div>
              ) : (
                courses.map((course, i) => (
                  <div className="prog-item" key={i}>
                    <div className="prog-top">
                      <span>{course.name}</span>
                      <span>{course.progress}%</span>
                    </div>
                    <div className="prog-track">
                      <div
                        className="prog-fill"
                        style={{
                          width: `${course.progress}%`,
                          background: course.progress >= 100 ? 'var(--success)' : course.progress >= 50 ? 'var(--ink)' : 'var(--warm)',
                        }}
                      ></div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
