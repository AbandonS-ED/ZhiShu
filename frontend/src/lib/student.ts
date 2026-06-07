// 简易本地存储的 student_id (开发阶段固定 UUID)
const KEY = 'zhishu_student_id'
const DEFAULT = 'e198c489-e9e7-456c-9ba6-21d09af280da'

export function getStudentId(): string {
  if (typeof window === 'undefined') return DEFAULT
  let id = localStorage.getItem(KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(KEY, id)
  }
  return id
}
