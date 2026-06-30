// 从登录数据中获取 student_id
const LOGIN_KEY = 'zhishu_student'

// 缓存 studentId，避免每次都读取 localStorage
let cachedStudentId: string | null = null

export function getStudentId(): string {
  // 如果已缓存，直接返回
  if (cachedStudentId !== null) return cachedStudentId
  
  if (typeof window === 'undefined') return ''
  try {
    const raw = localStorage.getItem(LOGIN_KEY)
    if (raw) {
      const student = JSON.parse(raw)
      if (student?.id) {
        cachedStudentId = student.id
        return student.id
      }
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

// 清除缓存（登录/登出时调用）
export function clearStudentIdCache() {
  cachedStudentId = null
}
