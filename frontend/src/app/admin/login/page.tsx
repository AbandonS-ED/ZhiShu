'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAdmin } from '@/lib/admin/context'
import { authApi } from '@/lib/api'

export default function AdminLoginPage() {
  const router = useRouter()
  const { login } = useAdmin()
  const noRef = useRef<HTMLInputElement>(null)

  const [no, setNo] = useState('admin')
  const [pw, setPw] = useState('admin123')
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    noRef.current?.focus()
  }, [])

  function showErr(msg: string) {
    setErr(msg)
    const box = document.getElementById('lgErr')
    const txt = document.getElementById('lgErrT')
    if (box && txt) {
      txt.textContent = msg
      box.className = 'lg-err vis'
    }
  }

  function clearErr() {
    setErr('')
    const box = document.getElementById('lgErr')
    if (box) box.className = 'lg-err'
  }

  function setBtnOff(off: boolean, text?: string) {
    const btn = document.getElementById('adminLgBtn')
    if (!btn) return
    if (off) {
      btn.className = 'off'
      btn.textContent = text || '验证中...'
    } else {
      btn.className = ''
      btn.textContent = text || '登录管理后台'
    }
  }

  async function doLogin() {
    if (!no || !pw) {
      showErr('请输入账号和密码')
      return
    }
    clearErr()
    setLoading(true)
    setBtnOff(true)

    try {
      const data = await authApi.login({ student_no: no, password: pw })
      const role = (data?.student?.role || 'student').toString()
      if (role !== 'admin') {
        showErr('该账号不是管理员，无权访问管理后台')
        setBtnOff(false)
        setLoading(false)
        return
      }
      login(
        {
          id: data.student.id,
          student_no: data.student.student_no,
          name: data.student.name || '系统管理员',
          role,
        },
        data.token
      )
      setTimeout(() => {
        router.push('/admin')
      }, 200)
    } catch (e: any) {
      showErr('网络错误：' + (e?.message || '请确认后端已启动'))
      setBtnOff(false)
      setLoading(false)
    }
  }

  function onKeyNo(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      const pwdEl = document.getElementById('lgPwd') as HTMLInputElement
      pwdEl?.focus()
    }
  }

  function onKeyPw(e: React.KeyboardEvent) {
    if (e.key === 'Enter') doLogin()
  }

  return (
    <div id="adminLoginScreen">
      <div className="admin-login-card">
        <div className="mk">S</div>
        <h2>智枢 · 管理后台</h2>
        <p className="sub">仅限管理员登录，请使用管理员账号</p>
        <div className="lg-err" id="lgErr">
          <span id="lgErrT">{err}</span>
        </div>
        <div className="fg">
          <label className="fl">学号 / 管理员账号</label>
          <input
            ref={noRef}
            className="fi"
            id="lgNo"
            placeholder="admin"
            autoComplete="off"
            value={no}
            onChange={(e) => setNo(e.target.value)}
            onKeyDown={onKeyNo}
            onFocus={clearErr}
          />
        </div>
        <div className="fg">
          <label className="fl">密码</label>
          <input
            className="fi"
            id="lgPwd"
            type="password"
            placeholder="输入密码"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            onKeyDown={onKeyPw}
            onFocus={clearErr}
          />
        </div>
        <button
          id="adminLgBtn"
          onClick={doLogin}
          className={loading ? 'off' : ''}
          disabled={loading}
        >
          登录管理后台
        </button>
      </div>
    </div>
  )
}
