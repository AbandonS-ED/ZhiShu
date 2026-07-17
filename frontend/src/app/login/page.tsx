'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { authApi } from '@/lib/api'
import { saveAuthStorage } from '@/lib/student'

type Tab = 'login' | 'register'

export default function LoginPage() {
  const router = useRouter()
  const particlesRef = useRef<HTMLDivElement>(null)

  const [tab, setTab] = useState<Tab>('login')
  const [isLoading, setIsLoading] = useState(false)
  const [alertType, setAlertType] = useState<'' | 'error' | 'success' | 'info'>('')
  const [alertText, setAlertText] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [successTitle, setSuccessTitle] = useState('登录成功')
  const [successDesc, setSuccessDesc] = useState('正在跳转到智枢学习平台...')

  // 表单字段
  const [name, setName] = useState('')
  const [major, setMajor] = useState('')
  const [email, setEmail] = useState('')
  const [studentNo, setStudentNo] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [remember, setRemember] = useState(true)
  const [countdown, setCountdown] = useState(0)
  const [isSending, setIsSending] = useState(false)

  // 错误高亮
  const [studentNoErr, setStudentNoErr] = useState('')
  const [passwordErr, setPasswordErr] = useState('')
  const [confirmErr, setConfirmErr] = useState('')
  const [phoneErr, setPhoneErr] = useState('')
  const [codeErr, setCodeErr] = useState('')

  // Particles
  useEffect(() => {
    const container = particlesRef.current
    if (!container) return
    for (let i = 0; i < 20; i++) {
      const p = document.createElement('div')
      p.className = 'particle'
      p.style.left = Math.random() * 100 + '%'
      p.style.animationDuration = 8 + Math.random() * 12 + 's'
      p.style.animationDelay = Math.random() * 10 + 's'
      const size = 1 + Math.random() * 2
      p.style.width = size + 'px'
      p.style.height = size + 'px'
      container.appendChild(p)
    }
    return () => {
      while (container.firstChild) container.removeChild(container.firstChild)
    }
  }, [])

  // 切换 tab 时清空错误和 alert
  useEffect(() => {
    hideAlert()
    clearErrors()
  }, [tab])

  function hideAlert() {
    setAlertType('')
    setAlertText('')
  }

  function clearErrors() {
    setStudentNoErr('')
    setPasswordErr('')
    setConfirmErr('')
    setPhoneErr('')
    setCodeErr('')
  }

  function showAlert(type: 'error' | 'success' | 'info', text: string) {
    setAlertType(type)
    setAlertText(text)
  }

  function switchTab(next: Tab) {
    setTab(next)
  }

  function togglePassword() {
    setShowPassword((s) => !s)
  }

  async function sendCode() {
    setPhoneErr('')
    if (!phone || phone.length !== 11 || !/^\d+$/.test(phone)) {
      setPhoneErr('请输入 11 位手机号')
      return
    }
    setIsSending(true)
    try {
      await authApi.sendCode(phone)
      showAlert('info', '验证码已发送，请查看控制台')
      setCountdown(60)
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer)
            return 0
          }
          return prev - 1
        })
      }, 1000)
    } catch (err: any) {
      showAlert('error', err?.message || '发送失败')
    } finally {
      setIsSending(false)
    }
  }

  function validate(): boolean {
    clearErrors()
    let valid = true

    if (!studentNo || studentNo.length < 4) {
      setStudentNoErr('请输入有效的学号（至少4位）')
      valid = false
    }
    if (!password || password.length < 6) {
      setPasswordErr('密码至少需要6个字符')
      valid = false
    }
    if (tab === 'register') {
      if (!name.trim()) {
        showAlert('error', '请填写姓名')
        valid = false
      }
      if (!phone || phone.length !== 11 || !/^\d+$/.test(phone)) {
        setPhoneErr('请输入 11 位手机号')
        valid = false
      }
      if (!code || code.length !== 6 || !/^\d+$/.test(code)) {
        setCodeErr('验证码为 6 位数字')
        valid = false
      }
      if (password !== confirmPassword) {
        setConfirmErr('两次密码不一致')
        valid = false
      }
    }
    return valid
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (isLoading) return
    hideAlert()
    if (!validate()) return

    setIsLoading(true)
    try {
      if (tab === 'login') {
        const res = await authApi.login({ student_no: studentNo, password })
        saveAuthStorage(res)
        showAlert('success', '登录成功，正在跳转...')
        setTimeout(() => {
          setSuccessTitle('登录成功')
          setSuccessDesc('正在跳转到智枢学习平台...')
          setSuccessShown(true)
        }, 800)
        setTimeout(() => router.push('/'), 1800)
      } else {
        const res = await authApi.register({
          student_no: studentNo,
          password,
          phone,
          code,
          name,
          email,
          major,
        })
        saveAuthStorage(res)
        showAlert('success', '注册成功！正在跳转...')
        setTimeout(() => {
          setSuccessTitle('注册成功')
          setSuccessDesc('欢迎加入智枢，正在为你初始化学习画像...')
          setSuccessShown(true)
        }, 800)
        setTimeout(() => router.push('/'), 1800)
      }
    } catch (err: any) {
      showAlert('error', err?.message || '请求失败，请稍后重试')
      setIsLoading(false)
    }
  }

  const [successShown, setSuccessShown] = useState(false)

  function quickLogin(method: 'wechat' | 'campus') {
    const labels: Record<string, string> = { wechat: '微信', campus: '校园统一认证' }
    showAlert('info', `正在跳转到${labels[method]}登录页面...`)
  }

  function goToApp() {
    showAlert('info', '正在跳转到智枢主页面...')
    setTimeout(() => {
      router.push('/')
    }, 400)
  }

  return (
    <div className="auth-root">
      <div className="login-page">
        {/* ═══ LEFT BRANDING ═══ */}
        <div className="brand-panel">
          <div className="particles" ref={particlesRef}></div>

          <div className="brand-top">
            <div className="brand-logo">
              <div className="mark">枢</div>
              <div className="text">智枢 SmartHub</div>
            </div>

            <h1 className="brand-headline">
              多智能体驱动的<br />
              <em>个性化学习</em>引擎
            </h1>

            <p className="brand-desc">
              7 个专业智能体协同工作，基于你的学习画像动态生成个性化学习资源、路径与评估，让每一次学习都精准高效。
            </p>
          </div>

          <div className="brand-features">
            <div className="brand-feature">
              <div className="feat-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="8" r="4" />
                  <path d="M20 21a8 8 0 0 0-16 0" />
                </svg>
              </div>
              <div className="feat-text">
                <div className="feat-title">六维学习画像</div>
                <div className="feat-desc">知识掌握 · 学习风格 · 认知水平 · 兴趣偏好 · 薄弱环节 · 学习节奏</div>
              </div>
            </div>

            <div className="brand-feature">
              <div className="feat-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <div className="feat-text">
                <div className="feat-title">多智能体协同</div>
                <div className="feat-desc">Master Agent 调度 Teaching、MindMap、Quiz、Coding 等专业 Agent</div>
              </div>
            </div>

            <div className="brand-feature">
              <div className="feat-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                </svg>
              </div>
              <div className="feat-text">
                <div className="feat-title">RAG 知识检索</div>
                <div className="feat-desc">基于课程知识库的精确检索，所有回答均有出处引用</div>
              </div>
            </div>
          </div>

          <div className="brand-bottom">
            <span className="tech-tag">FastAPI</span>
            <span className="tech-tag">Next.js</span>
            <span className="tech-tag">LangGraph</span>
            <span className="tech-tag">PostgreSQL</span>
            <span className="tech-tag">讯飞星火 4.0</span>
          </div>
        </div>

        {/* ═══ RIGHT FORM ═══ */}
        <div className="form-panel">
          <div className="form-container">
            {/* Login / Register forms */}
            <div id="formView" style={{ display: successShown ? 'none' : 'block' }}>
              <div className="form-header">
                <h2 id="formTitle">{tab === 'register' ? '创建账号' : '欢迎回来'}</h2>
                <p id="formSubtitle">
                  {tab === 'register' ? '注册智枢账号，开启个性化学习之旅' : '登录你的智枢账号，继续学习之旅'}
                </p>
              </div>

              <div className="tab-switch">
                <button
                  type="button"
                  className={`tab-btn${tab === 'login' ? ' active' : ''}`}
                  onClick={() => switchTab('login')}
                >
                  登录
                </button>
                <button
                  type="button"
                  className={`tab-btn${tab === 'register' ? ' active' : ''}`}
                  onClick={() => switchTab('register')}
                >
                  注册
                </button>
              </div>

              {/* Alert */}
              <div className={`alert${alertType ? ' show ' + alertType : ''}`} id="alertBox">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <span id="alertText">{alertText}</span>
              </div>

              <form id="authForm" onSubmit={handleSubmit} autoComplete="off">
                {/* Register extras */}
                <div className={`register-extras${tab === 'register' ? ' show' : ''}`}>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label" htmlFor="name">姓名</label>
                      <input
                        className="form-input"
                        id="name"
                        type="text"
                        placeholder="张明远"
                        autoComplete="off"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label" htmlFor="major">专业</label>
                      <input
                        className="form-input"
                        id="major"
                        type="text"
                        placeholder="人工智能"
                        autoComplete="off"
                        value={major}
                        onChange={(e) => setMajor(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="email">邮箱</label>
                    <input
                      className="form-input"
                      id="email"
                      type="email"
                      placeholder="zhangmy@example.edu.cn"
                      autoComplete="off"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="phone">手机号</label>
                    <input
                      className={`form-input${phoneErr ? ' error' : ''}`}
                      id="phone"
                      type="tel"
                      placeholder="13800138000"
                      autoComplete="off"
                      value={phone}
                      onChange={(e) => {
                        setPhone(e.target.value)
                        if (phoneErr) setPhoneErr('')
                      }}
                    />
                    {phoneErr && <div className="form-error show">{phoneErr}</div>}
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="code">验证码</label>
                    <div className="code-row">
                      <input
                        className={`form-input${codeErr ? ' error' : ''}`}
                        id="code"
                        type="text"
                        placeholder="6 位验证码"
                        maxLength={6}
                        autoComplete="off"
                        value={code}
                        onChange={(e) => {
                          setCode(e.target.value)
                          if (codeErr) setCodeErr('')
                        }}
                      />
                      <button
                        type="button"
                        className="code-btn"
                        onClick={sendCode}
                        disabled={countdown > 0 || isSending}
                      >
                        {countdown > 0 ? `${countdown}s` : isSending ? '发送中...' : '获取验证码'}
                      </button>
                    </div>
                    {codeErr && <div className="form-error show">{codeErr}</div>}
                  </div>
                </div>

                {/* Student No */}
                <div className="form-group">
                  <label className="form-label" htmlFor="studentNo">学号</label>
                  <div className="form-input-wrap">
                    <input
                      className={`form-input${studentNoErr ? ' error' : ''}`}
                      id="studentNo"
                      type="text"
                      placeholder="2024001001"
                      autoComplete="off"
                      required
                      value={studentNo}
                      onChange={(e) => {
                        setStudentNo(e.target.value)
                        if (studentNoErr) setStudentNoErr('')
                      }}
                    />
                  </div>
                  {studentNoErr && <div className="form-error show">{studentNoErr}</div>}
                </div>

                {/* Password */}
                <div className="form-group">
                  <label className="form-label" htmlFor="password">密码</label>
                  <div className="form-input-wrap">
                    <input
                      className={`form-input${passwordErr ? ' error' : ''}`}
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="输入密码"
                      autoComplete="new-password"
                      required
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value)
                        if (passwordErr) setPasswordErr('')
                      }}
                    />
                    <span className="input-icon" onClick={togglePassword}>
                      {showPassword ? (
                        <svg id="eyeOn" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      ) : (
                        <svg id="eyeOff" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                          <line x1="1" y1="1" x2="23" y2="23" />
                        </svg>
                      )}
                    </span>
                  </div>
                  {passwordErr && <div className="form-error show">{passwordErr}</div>}
                </div>

                {/* Confirm password (register only) */}
                {tab === 'register' && (
                  <div className="form-group">
                    <label className="form-label" htmlFor="confirmPassword">确认密码</label>
                    <div className="form-input-wrap">
                      <input
                        className={`form-input${confirmErr ? ' error' : ''}`}
                        id="confirmPassword"
                        type="password"
                        placeholder="再次输入密码"
                        autoComplete="new-password"
                        value={confirmPassword}
                        onChange={(e) => {
                          setConfirmPassword(e.target.value)
                          if (confirmErr) setConfirmErr('')
                        }}
                      />
                    </div>
                    {confirmErr && <div className="form-error show">{confirmErr}</div>}
                  </div>
                )}

                {/* Remember me / Forgot */}
                {tab === 'login' && (
                  <div className="form-check">
                    <input
                      type="checkbox"
                      id="remember"
                      checked={remember}
                      onChange={(e) => setRemember(e.target.checked)}
                    />
                    <label htmlFor="remember">记住我</label>
                    <a href="#" className="forgot">忘记密码?</a>
                  </div>
                )}

                {/* Submit */}
                <button
                  type="submit"
                  className={`submit-btn${isLoading ? ' loading' : ''}`}
                  disabled={isLoading}
                >
                  <span className="btn-text">{tab === 'register' ? '注册' : '登录'}</span>
                  <span className="btn-loader">
                    <span className="dot"></span>
                    <span className="dot"></span>
                    <span className="dot"></span>
                  </span>
                </button>
              </form>

              <div className="form-divider">
                <span>或使用以下方式</span>
              </div>

              <div className="quick-login">
                <button type="button" className="quick-btn" onClick={() => quickLogin('wechat')}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                  </svg>
                  微信登录
                </button>
                <button type="button" className="quick-btn" onClick={() => quickLogin('campus')}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                    <path d="M6 12v5c0 1.1 2.7 2 6 2s6-.9 6-2v-5" />
                  </svg>
                  校园统一认证
                </button>
              </div>

              <div className="form-footer">
                登录即表示你同意 <a href="#">服务条款</a> 和 <a href="#">隐私政策</a>
                <br />
                <span style={{ marginTop: '4px', display: 'inline-block' }}>智枢 SmartHub · 第十五届中国软件杯 A3 赛题</span>
                <a href="/admin/login" style={{ fontSize: 12, opacity: 0.5, marginTop: 6, display: 'inline-block' }}>管理员入口 →</a>
              </div>
            </div>

            {/* Success screen */}
            <div className={`success-screen${successShown ? ' show' : ''}`}>
              <div className="success-check">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <h3 id="successTitle">{successTitle}</h3>
              <p id="successDesc">{successDesc}</p>
              <button className="submit-btn" style={{ maxWidth: '200px', margin: '0 auto' }} onClick={goToApp}>
                进入智枢
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
