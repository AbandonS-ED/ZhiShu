// 从登录数据中获取 student_id
const LOGIN_KEY = 'zhishu_student'

export function getStudentId(): string {
  if (typeof window === 'undefined') return ''
  try {
    const raw = localStorage.getItem(LOGIN_KEY)
    if (raw) {
      const student = JSON.parse(raw)
      if (student?.id) return student.id
    }
  } catch {}
  return ''
}

export function requireLogin(): string {
  const id = getStudentId()
  if (!id && typeof window !== 'undefined') {
    window.location.href = '/login'
  }
  return id
}
