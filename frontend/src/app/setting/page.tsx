'use client'

import { useState, useEffect } from 'react'
import { authApi, AuthStudent } from '@/lib/api'
import { useAppStore } from '@/stores/appStore'

export default function SettingPage() {
  const setStudent = useAppStore((s) => s.setStudent)

  const [me, setMe] = useState<AuthStudent | null>(null)

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [savingMe, setSavingMe] = useState(false)
  const [meMsg, setMeMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const [oldPwd, setOldPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [cfmPwd, setCfmPwd] = useState('')
  const [savingPwd, setSavingPwd] = useState(false)
  const [pwdMsg, setPwdMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  useEffect(() => {
    authApi.getMe()
      .then((data) => {
        setMe(data)
        setName(data.name || '')
        setEmail(data.email || '')
      })
      .catch((err) => {
        setMeMsg({ type: 'err', text: '加载失败：' + err.message })
      })
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
      setMeMsg({ type: 'err', text: '邮箱格式不正确' })
      return
    }
    setSavingMe(true)
    setMeMsg(null)
    try {
      const updated = await authApi.updateMe({ name, email })
      setMe(updated)
      syncLocal(updated)
      setMeMsg({ type: 'ok', text: '保存成功' })
    } catch (err: any) {
      setMeMsg({ type: 'err', text: err.message || '保存失败' })
    } finally {
      setSavingMe(false)
    }
  }

  function handleResetMe() {
    if (!me) return
    setName(me.name || '')
    setEmail(me.email || '')
    setMeMsg(null)
  }

  async function handleChangePwd() {
    if (!oldPwd) {
      setPwdMsg({ type: 'err', text: '请输入当前密码' })
      return
    }
    if (!newPwd || newPwd.length < 6) {
      setPwdMsg({ type: 'err', text: '新密码至少 6 位' })
      return
    }
    if (newPwd !== cfmPwd) {
      setPwdMsg({ type: 'err', text: '两次输入的新密码不一致' })
      return
    }
    setSavingPwd(true)
    setPwdMsg(null)
    try {
      const res = await authApi.changePassword({ old_password: oldPwd, new_password: newPwd })
      setPwdMsg({ type: 'ok', text: res.message || '密码修改成功' })
      setOldPwd('')
      setNewPwd('')
      setCfmPwd('')
    } catch (err: any) {
      setPwdMsg({ type: 'err', text: err.message || '修改失败' })
    } finally {
      setSavingPwd(false)
    }
  }

  if (!me) {
    return <div className="set-loading">{meMsg ? meMsg.text : '加载中...'}</div>
  }

  return (
    <div className="set-page">
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

        {meMsg && <div className={`set-msg ${meMsg.type}`}>{meMsg.text}</div>}

        <div className="set-actions">
          <button className="set-btn ghost" onClick={handleResetMe} disabled={savingMe}>
            重置
          </button>
          <button className="set-btn primary" onClick={handleSaveMe} disabled={savingMe}>
            {savingMe ? '保存中...' : '保存修改'}
          </button>
        </div>
      </section>

      <section className="set-card">
        <header className="set-card-hd">
          <h2>修改密码</h2>
          <p>修改后保持当前登录，JWT 不变</p>
        </header>

        <div className="set-field">
          <label>当前密码</label>
          <input
            type="password"
            value={oldPwd}
            onChange={(e) => setOldPwd(e.target.value)}
            placeholder="请输入当前密码"
          />
        </div>
        <div className="set-field">
          <label>新密码</label>
          <input
            type="password"
            value={newPwd}
            onChange={(e) => setNewPwd(e.target.value)}
            placeholder="至少 6 位"
          />
        </div>
        <div className="set-field">
          <label>确认新密码</label>
          <input
            type="password"
            value={cfmPwd}
            onChange={(e) => setCfmPwd(e.target.value)}
            placeholder="再次输入新密码"
          />
        </div>

        {pwdMsg && <div className={`set-msg ${pwdMsg.type}`}>{pwdMsg.text}</div>}

        <div className="set-actions">
          <button className="set-btn primary" onClick={handleChangePwd} disabled={savingPwd}>
            {savingPwd ? '修改中...' : '确认修改'}
          </button>
        </div>
      </section>

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
    </div>
  )
}
