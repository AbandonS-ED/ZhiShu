'use client'

import { useState, useEffect } from 'react'

export default function Home() {
  const [stats, setStats] = useState<any>(null)
  const [courses, setCourses] = useState<any[]>([])

  useEffect(() => {
    import('@/lib/api').then(({ dashboardApi }) => {
      dashboardApi.getStats().then(setStats).catch(console.error)
      dashboardApi.getCourses().then((data) => setCourses(data.courses)).catch(console.error)
    })
  }, [])

  // 默认值
  const s = stats || {
    knowledge_points: 12,
    knowledge_points_trend: '+3 本周',
    learning_hours: '28.5h',
    learning_hours_trend: '+4.2h 本周',
    accuracy: '78%',
    accuracy_trend: '+5% 较上周',
    path_progress: '42%',
    path_progress_trend: '5 / 12 节点',
  }

  const c = courses.length > 0 ? courses : [
    { name: '人工智能概述', progress: 100 },
    { name: '搜索算法', progress: 85 },
    { name: '机器学习基础', progress: 60 },
    { name: '深度学习与神经网络', progress: 30 },
    { name: '自然语言处理', progress: 10 },
  ]

  return (
    <>
      {/* ═══ DASHBOARD ═══ */}
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
              <div className="act-item">
                <div className="act-dot" style={{ background: 'var(--success)' }}></div>
                <div className="act-body">
                  <p>
                    完成了 <strong>A* 算法</strong> 的学习
                  </p>
                  <div className="time">2 小时前</div>
                </div>
              </div>
              <div className="act-item">
                <div className="act-dot" style={{ background: 'var(--accent)' }}></div>
                <div className="act-body">
                  <p>
                    生成了 <strong>Transformer</strong> 思维导图
                  </p>
                  <div className="time">3 小时前</div>
                </div>
              </div>
              <div className="act-item">
                <div className="act-dot" style={{ background: 'var(--info)' }}></div>
                <div className="act-body">
                  <p>
                    完成 <strong>机器学习</strong> 练习 8/10
                  </p>
                  <div className="time">昨天</div>
                </div>
              </div>
              <div className="act-item">
                <div className="act-dot" style={{ background: 'var(--ink-3)' }}></div>
                <div className="act-body">
                  <p>
                    更新学习画像，新增 <strong>深度学习</strong> 标签
                  </p>
                  <div className="time">昨天</div>
                </div>
              </div>
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
              {c.map((course: any, i: number) => (
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
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
