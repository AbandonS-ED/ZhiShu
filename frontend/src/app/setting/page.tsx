'use client'

import { useState, useEffect } from 'react'
import { authApi, AuthStudent, dashboardApi } from '@/lib/api'
import { useAppStore } from '@/stores/appStore'
import { getStudentId, logout } from '@/lib/student'
import { showToast } from '@/lib/utils'

interface DashboardStats {
  today_minutes: number
  streak_days: number
  knowledge_points: number
}

export default function SettingPage() {
  const setStudent = useAppStore((s) => s.setStudent)

  const [loading, setLoading] = useState(true)
  const [me, setMe] = useState<AuthStudent | null>(null)

  // 个人信息
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [major, setMajor] = useState('')
  const [grade, setGrade] = useState('')
  const [savingMe, setSavingMe] = useState(false)

  // 修改密码
  const [oldPwd, setOldPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [cfmPwd, setCfmPwd] = useState('')
  const [savingPwd, setSavingPwd] = useState(false)
  const [showOldPwd, setShowOldPwd] = useState(false)
  const [showNewPwd, setShowNewPwd] = useState(false)

  // 学习概览
  const [stats, setStats] = useState<DashboardStats | null>(null)

  // 每日目标
  const [dailyGoal, setDailyGoal] = useState('60')

  useEffect(() => {
    const saved = localStorage.getItem('zhishu_daily_goal')
    if (saved) setDailyGoal(saved)
  }, [])

  useEffect(() => {
    authApi.getMe()
      .then((data) => {
        setMe(data)
        setName(data.name || '')
        setEmail(data.email || '')
        setMajor(data.major || '')
        setGrade(data.grade || '')
      })
      .catch(() => showToast('加载用户信息失败'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    const sid = getStudentId()
    if (!sid) return
    dashboardApi.getStats(sid).then(setStats).catch(() => {})
  }, [])

  function syncLocal(student: AuthStudent) {
    localStorage.setItem('zhishu_student', JSON.stringify(student))
    setStudent(student as any)
  }

  function fmtTime(iso: string) {
    if (!iso) return '—'
    try {
      return new Date(iso).toLocaleString('zh-CN', { hour12: false })
    } catch {
      return iso
    }
  }

  async function handleSaveMe() {
    if (!me) return
    if (email && !/^[\w.+-]+@[\w-]+\.[\w.-]+$/.test(email)) {
      showToast('邮箱格式不正确')
      return
    }
    setSavingMe(true)
    try {
      const updated = await authApi.updateMe({ name, email, major, grade })
      setMe(updated)
      syncLocal(updated)
      showToast('保存成功')
    } catch (err: any) {
      showToast(err.message || '保存失败')
    } finally {
      setSavingMe(false)
    }
  }

  function handleResetMe() {
    if (!me) return
    setName(me.name || '')
    setEmail(me.email || '')
    setMajor(me.major || '')
    setGrade(me.grade || '')
  }

  async function handleChangePwd() {
    if (!oldPwd) { showToast('请输入当前密码'); return }
    if (!newPwd || newPwd.length < 6) { showToast('新密码至少 6 位'); return }
    if (newPwd !== cfmPwd) { showToast('两次输入的新密码不一致'); return }
    setSavingPwd(true)
    try {
      const res = await authApi.changePassword({ old_password: oldPwd, new_password: newPwd })
      showToast(res.message || '密码修改成功')
      setOldPwd('')
      setNewPwd('')
      setCfmPwd('')
    } catch (err: any) {
      showToast(err.message || '修改失败')
    } finally {
      setSavingPwd(false)
    }
  }

  function handleSaveGoal() {
    const v = parseInt(dailyGoal, 10)
    if (isNaN(v) || v < 10 || v > 480) {
      showToast('每日目标需在 10-480 分钟之间')
      return
    }
    localStorage.setItem('zhishu_daily_goal', String(v))
    showToast('每日目标已保存')
  }

  if (loading) {
    return (
      <div className="set-page">
        <div className="set-skeleton">
          <div className="skeleton skeleton-line" style={{ width: '40%', height: 20 }} />
          <div className="skeleton skeleton-line" style={{ width: '100%', height: 44 }} />
          <div className="skeleton skeleton-line" style={{ width: '100%', height: 44 }} />
          <div className="skeleton skeleton-line" style={{ width: '100%', height: 44 }} />
          <div className="skeleton skeleton-line" style={{ width: '100%', height: 44 }} />
        </div>
        <div className="set-skeleton">
          <div className="skeleton skeleton-line" style={{ width: '35%', height: 20 }} />
          <div className="skeleton skeleton-line" style={{ width: '100%', height: 44 }} />
          <div className="skeleton skeleton-line" style={{ width: '100%', height: 44 }} />
          <div className="skeleton skeleton-line" style={{ width: '100%', height: 44 }} />
        </div>
      </div>
    )
  }

  if (!me) {
    return <div className="set-loading">加载失败，请刷新页面</div>
  }

  return (
    <div className="set-page">
      {/* 学习概览 */}
      {stats && (
        <section className="set-card">
          <header className="set-card-hd">
            <h2>学习概览</h2>
          </header>
          <div className="set-overview">
            <div className="set-overview-item">
              <div className="set-overview-val" style={{ color: 'var(--warm)' }}>{stats.today_minutes}</div>
              <div className="set-overview-label">今日学习（分钟）</div>
            </div>
            <div className="set-overview-item">
              <div className="set-overview-val" style={{ color: '#EF4444' }}>🔥 {stats.streak_days}</div>
              <div className="set-overview-label">连续学习（天）</div>
            </div>
            <div className="set-overview-item">
              <div className="set-overview-val" style={{ color: 'var(--success)' }}>{stats.knowledge_points}</div>
              <div className="set-overview-label">已学知识点</div>
            </div>
          </div>
        </section>
      )}

      {/* 快捷入口 */}
      <section className="set-card">
        <header className="set-card-hd">
          <h2>快捷入口</h2>
        </header>
        <div className="set-quick-grid">
          <a className="set-quick-card" href="/profile">
            <div className="set-quick-icon" style={{ background: 'rgba(99,102,241,0.1)', color: '#6366F1' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
                <circle cx="12" cy="8" r="4" /><path d="M20 21a8 8 0 1 0-16 0" />
              </svg>
            </div>
            <span className="set-quick-label">学习画像</span>
            <span className="set-quick-arrow">›</span>
          </a>
          <a className="set-quick-card" href="/pinggu">
            <div className="set-quick-icon" style={{ background: 'rgba(138,155,168,0.1)', color: '#8a9ba8' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
                <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
              </svg>
            </div>
            <span className="set-quick-label">学习评估</span>
            <span className="set-quick-arrow">›</span>
          </a>
          <a className="set-quick-card" href="/resources/my-resources">
            <div className="set-quick-icon" style={{ background: 'rgba(5,150,105,0.1)', color: '#059669' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <span className="set-quick-label">我的资源</span>
            <span className="set-quick-arrow">›</span>
          </a>
          <a className="set-quick-card" href="/path">
            <div className="set-quick-icon" style={{ background: 'rgba(16,185,129,0.1)', color: '#10B981' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
                <circle cx="6" cy="6" r="2.5" /><circle cx="18" cy="18" r="2.5" /><path d="M8.5 8.5a6 6 0 0 1 7 7" />
              </svg>
            </div>
            <span className="set-quick-label">学习计划</span>
            <span className="set-quick-arrow">›</span>
          </a>
        </div>
      </section>

      {/* 个人信息 */}
      <section className="set-card">
        <header className="set-card-hd">
          <h2>个人信息</h2>
          <p>学号为登录账号不可修改；修改后即时生效</p>
        </header>

        <div className="set-field">
          <label>学号</label>
          <input value={me.student_no} disabled />
        </div>
        <div className="set-field">
          <label>姓名</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={100}
            placeholder="请输入姓名"
          />
        </div>
        <div className="set-field">
          <label>邮箱</label>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="留空表示不填"
          />
        </div>
        <div className="set-field">
          <label>专业</label>
          <input
            value={major}
            onChange={(e) => setMajor(e.target.value)}
            maxLength={100}
            placeholder="请输入专业"
          />
        </div>
        <div className="set-field">
          <label>年级</label>
          <input
            value={grade}
            onChange={(e) => setGrade(e.target.value)}
            maxLength={50}
            placeholder="如：大二"
          />
        </div>

        <div className="set-actions">
          <button className="set-btn ghost" onClick={handleResetMe} disabled={savingMe}>
            重置
          </button>
          <button className="set-btn primary" onClick={handleSaveMe} disabled={savingMe}>
            {savingMe ? '保存中...' : '保存修改'}
          </button>
        </div>
      </section>

      {/* 修改密码 */}
      <section className="set-card">
        <header className="set-card-hd">
          <h2>修改密码</h2>
          <p>修改后保持当前登录，JWT 不变</p>
        </header>

        <div className="set-field">
          <label>当前密码</label>
          <div className="form-input-wrap">
            <input
              type={showOldPwd ? 'text' : 'password'}
              value={oldPwd}
              onChange={(e) => setOldPwd(e.target.value)}
              placeholder="请输入当前密码"
              autoComplete="current-password"
            />
            <span className="input-icon" onClick={() => setShowOldPwd((s) => !s)}>
              {showOldPwd ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </span>
          </div>
        </div>
        <div className="set-field">
          <label>新密码</label>
          <div className="form-input-wrap">
            <input
              type={showNewPwd ? 'text' : 'password'}
              value={newPwd}
              onChange={(e) => setNewPwd(e.target.value)}
              placeholder="至少 6 位"
              autoComplete="new-password"
            />
            <span className="input-icon" onClick={() => setShowNewPwd((s) => !s)}>
              {showNewPwd ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </span>
          </div>
        </div>
        <div className="set-field">
          <label>确认新密码</label>
          <input
            type="password"
            value={cfmPwd}
            onChange={(e) => setCfmPwd(e.target.value)}
            placeholder="再次输入新密码"
            autoComplete="new-password"
          />
        </div>

        <div className="set-actions">
          <button className="set-btn primary" onClick={handleChangePwd} disabled={savingPwd}>
            {savingPwd ? '修改中...' : '确认修改'}
          </button>
        </div>
      </section>

      {/* 每日学习目标 */}
      <section className="set-card">
        <header className="set-card-hd">
          <h2>每日学习目标</h2>
          <p>设置后仪表盘进度环将同步更新</p>
        </header>
        <div className="set-field">
          <label>每日目标（分钟）</label>
          <div className="set-goal-row">
            <input
              type="number"
              min={10}
              max={480}
              value={dailyGoal}
              onChange={(e) => setDailyGoal(e.target.value)}
              placeholder="60"
              style={{ width: 120 }}
            />
            <span className="set-goal-unit">分钟 / 天</span>
            <button className="set-btn primary" onClick={handleSaveGoal}>保存</button>
          </div>
        </div>
      </section>

      {/* 账号信息 */}
      <section className="set-card readonly">
        <header className="set-card-hd">
          <h2>账号信息</h2>
          <p>以下信息不可修改</p>
        </header>
        <div className="set-info-grid">
          <div className="set-info-item">
            <span className="set-info-label">学号</span>
            <span className="set-info-val">{me.student_no}</span>
          </div>
          <div className="set-info-item">
            <span className="set-info-label">角色</span>
            <span className="set-info-val">{me.role === 'admin' ? '管理员' : '学生'}</span>
          </div>
          <div className="set-info-item">
            <span className="set-info-label">注册时间</span>
            <span className="set-info-val">{fmtTime(me.created_at || '')}</span>
          </div>
          <div className="set-info-item">
            <span className="set-info-label">最后登录</span>
            <span className="set-info-val">{fmtTime(me.last_login || '')}</span>
          </div>
        </div>
      </section>

      {/* 退出登录 */}
      <section className="set-card">
        <button className="set-logout-btn" onClick={logout}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          退出登录
        </button>
      </section>
    </div>
  )
}
