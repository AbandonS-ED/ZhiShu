'use client'

import { useState, useEffect } from 'react'
import { getStudentId } from '@/lib/student'

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

interface Stats {
  knowledge_points: number
  knowledge_points_trend: string
  learning_hours: string
  learning_hours_trend: string
  accuracy: string
  accuracy_trend: string
  path_progress: string
  path_progress_trend: string
  recent_activities: Activity[]
  recent_chats: Activity[]
}

export default function Home() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [courses, setCourses] = useState<Course[]>([])

  useEffect(() => {
    const sid = getStudentId()
    if (!sid) return
    import('@/lib/api').then(({ dashboardApi }) => {
      dashboardApi.getStats(sid).then(setStats).catch(console.error)
      dashboardApi.getCourses(sid).then((data) => setCourses(data.courses)).catch(console.error)
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
    recent_activities: [],
    recent_chats: [],
  }

  // 合并活动和聊天记录，按时间排序
  const allActivities: Activity[] = [...s.recent_activities, ...s.recent_chats]
    .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
    .slice(0, 5)

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

  return (
    <>
      <div className="page active" id="pg-dashboard">
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
          <div className="card">
            <div className="card-hd">
              <h3>最近活动</h3>
              <span className="tag tag-dark">Today</span>
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
                          <>对话：{act.content ? `"${act.content.slice(0, 30)}${act.content.length > 30 ? '...' : ''}"` : '新消息'}</>
                        ) : act.type === 'exercise' ? (
                          <>做了题：<strong>{act.title || '练习题'}</strong></>
                        ) : act.type === 'study' ? (
                          <>自习了 <strong>{act.title || '番茄钟'}</strong></>
                        ) : act.type === 'path' ? (
                          <>生成了路径：<strong>{act.title || '学习路径'}</strong></>
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

          <div className="card">
            <div className="card-hd">
              <h3>快速开始</h3>
              <span className="tag tag-warm">Quick</span>
            </div>
            <div className="card-bd">
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
                <a className="qa" href="/resources">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                  查看资源
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
