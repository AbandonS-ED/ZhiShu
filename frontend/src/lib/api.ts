// 智枢 API 客户端
// 后端 baseURL: http://localhost:8000
const BASE_URL = 'http://localhost:8000/api/v1'

// 通用 fetch 封装（自动带 token）
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('zhishu_token') : null
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })
  if (!res.ok) {
    let msg = res.statusText
    try {
      const body = await res.json()
      msg = body.detail || body.message || JSON.stringify(body)
    } catch {
      msg = await res.text().catch(() => res.statusText)
    }
    // token 过期/无效 → 清 localStorage，跳登录页（白名单：login/register 不触发）
    if (res.status === 401 && typeof window !== 'undefined'
        && !path.startsWith('/auth/login') && !path.startsWith('/auth/register')) {
      localStorage.removeItem('zhishu_token')
      localStorage.removeItem('zhishu_refresh_token')
      localStorage.removeItem('zhishu_student')
      window.location.href = '/login'
    }
    throw new Error(msg)
  }
  return res.json()
}

// ===== Profile =====
export interface StudentProfile {
  dimensions?: Record<string, number>
  background?: Record<string, unknown>
  assessment_status?: string
}

export const profileApi = {
  assessStream: (data: { session_id?: string; answer?: string }) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('zhishu_token') : null
    return fetch(`${BASE_URL}/profile/assess/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(data),
    })
  },

  getMe: () =>
    request<{
      dimensions: Record<string, number>
      background: Record<string, unknown>
      assessment_status: string
    }>('/profile/me'),
}

// ===== Chat (SSE 流式) =====

// ===== Chat (SSE 流式) =====
export interface ChatEvent {
  type: 'session' | 'progress' | 'result' | 'done' | 'error' | 'token'
  session_id?: string
  progress?: number
  message?: string
  content?: string
  data?: any
}

export const chatApi = {
  // SSE 流式对话
  stream(
    student_id: string,
    message: string,
    onEvent: (e: ChatEvent) => void,
    opts?: { session_id?: string; course_topics?: string[] }
  ): () => void {
    const controller = new AbortController()
    const token = typeof window !== 'undefined' ? localStorage.getItem('zhishu_token') : null
    fetch(`${BASE_URL}/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ student_id, message, ...opts }),
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok || !res.body) throw new Error(`SSE ${res.status}`)
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                onEvent(JSON.parse(line.slice(6)))
              } catch {}
            }
          }
        }
      })
      .catch((err) => {
        if (err.name !== 'AbortError') onEvent({ type: 'error', message: err.message })
      })
    return () => controller.abort()
  },

  getSessions: (student_id: string) =>
    request<Array<{ id: string; title: string; created_at: string }>>(
      `/chat/sessions/${student_id}`
    ),
  getMessages: (session_id: string) =>
    request<Array<{ id: string; role: string; content: string; created_at: string }>>(
      `/chat/sessions/${session_id}/messages`
    ),
  deleteSession: (session_id: string) =>
    request<{ status: string }>(`/chat/sessions/${session_id}`, {
      method: 'DELETE',
    }),
}

// ===== Resource =====
export interface ResourceContent {
  knowledge?: string
  code?: string
  audio_script?: string
  [k: string]: any
}

export interface Resource {
  resource_id: string
  knowledge_point: string
  content: ResourceContent
  title?: string
  resource_type?: string
  created_at?: string
}

export const resourceApi = {
  // SSE 流式生成学习资源
  generateStream(
    student_id: string,
    knowledge_point: string,
    onEvent: (e: ChatEvent) => void,
    resource_type = 'all'
  ): () => void {
    const controller = new AbortController()
    const token = typeof window !== 'undefined' ? localStorage.getItem('zhishu_token') : null
    fetch(`${BASE_URL}/resource/generate/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ student_id, knowledge_point, resource_type }),
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok || !res.body) throw new Error(`SSE ${res.status}`)
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try { onEvent(JSON.parse(line.slice(6))) } catch {}
            }
          }
        }
      })
      .catch((err) => {
        if (err.name !== 'AbortError') onEvent({ type: 'error', message: err.message })
      })
    return () => controller.abort()
  },
  generate: (student_id: string, knowledge_point: string, resource_type = 'all') =>
    request<Resource>('/resource/generate', {
      method: 'POST',
      body: JSON.stringify({ student_id, knowledge_point, resource_type }),
    }),
  list: (student_id: string) =>
    request<Array<{ resource_id: string; title: string; knowledge_point: string; created_at: string }>>(
      `/resource/list?student_id=${student_id}`
    ),
}

// ===== Exercise =====
export interface Exercise {
  exercise_id: string
  type: 'choice' | 'judge' | 'short_answer' | 'coding'
  question: string
  options?: string[]
  answer?: string
  explanation?: string
  difficulty: number
  knowledge_point?: string
}

export const exerciseApi = {
  // SSE 流式生成练习题
  generateStream(
    student_id: string,
    knowledge_point: string,
    onEvent: (e: ChatEvent) => void,
    count = 5,
    exercise_type = 'all'
  ): () => void {
    const controller = new AbortController()
    const token = typeof window !== 'undefined' ? localStorage.getItem('zhishu_token') : null
    fetch(`${BASE_URL}/resource/exercises/generate/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ student_id, knowledge_point, count, exercise_type }),
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok || !res.body) throw new Error(`SSE ${res.status}`)
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try { onEvent(JSON.parse(line.slice(6))) } catch {}
            }
          }
        }
      })
      .catch((err) => {
        if (err.name !== 'AbortError') onEvent({ type: 'error', message: err.message })
      })
    return () => controller.abort()
  },
  generate: (
    student_id: string,
    knowledge_point: string,
    count = 5,
    exercise_type = 'all'
  ) =>
    request<{ knowledge_point: string; count: number; exercises: Exercise[] }>(
      '/resource/exercises/generate',
      {
        method: 'POST',
        body: JSON.stringify({ student_id, knowledge_point, count, exercise_type }),
      }
    ),
  list: (student_id: string) =>
    request<Array<Exercise & { created_at: string }>>(
      `/resource/exercises/${student_id}`
    ),
}

// ===== Path =====
export interface PathNode {
  id: string
  label: string
  type?: string
  difficulty: number
  estimated_hours: number
}

export interface PathEdge {
  source: string
  target: string
  relation?: string
}

export interface LearningPathData {
  path_id: string
  title: string
  description: string
  total_days: number
  nodes: PathNode[]
  edges: PathEdge[]
  daily_plan: any[]
}

export const pathApi = {
  // SSE 流式生成学习路径
  generateStream(
    student_id: string,
    course_topics: string[],
    onEvent: (e: ChatEvent) => void,
    total_days = 30
  ): () => void {
    const controller = new AbortController()
    const token = typeof window !== 'undefined' ? localStorage.getItem('zhishu_token') : null
    fetch(`${BASE_URL}/path/generate/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ student_id, course_topics, total_days }),
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok || !res.body) throw new Error(`SSE ${res.status}`)
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try { onEvent(JSON.parse(line.slice(6))) } catch {}
            }
          }
        }
      })
      .catch((err) => {
        if (err.name !== 'AbortError') onEvent({ type: 'error', message: err.message })
      })
    return () => controller.abort()
  },
  generate: (student_id: string, course_topics: string[], total_days = 30) =>
    request<LearningPathData>('/path/generate', {
      method: 'POST',
      body: JSON.stringify({ student_id, course_topics, total_days }),
    }),
  list: (student_id: string) =>
    request<Array<{ path_id: string; title: string; total_days: number; created_at: string }>>(
      `/path/${student_id}`
    ),
  get: (student_id: string, path_id: string) =>
    request<LearningPathData>(`/path/${student_id}/${path_id}`),
}

// ===== Tutor =====
export interface TutorAnswer {
  student_id: string
  question: string
  answer: string
  confidence: number
  sources: string[]
  related_topics: string[]
  suggestion: string
}

export const tutorApi = {
  ask: (student_id: string, question: string) =>
    request<TutorAnswer>('/tutor/ask', {
      method: 'POST',
      body: JSON.stringify({ student_id, question }),
    }),
}

// ===== Dashboard =====
export interface DashboardStats {
  knowledge_points: number
  knowledge_points_trend: string
  learning_hours: string
  learning_hours_trend: string
  accuracy: string
  accuracy_trend: string
  path_progress: string
  path_progress_trend: string
  recent_activities: Array<{
    type: string
    title: string
    time: string
    color: string
  }>
  recent_chats: Array<{
    type: string
    content: string
    time: string
  }>
}

export interface CourseProgress {
  name: string
  progress: number
  status: string
}

export const dashboardApi = {
  getStats: (student_id: string = '00000000-0000-0000-0000-000000000001') =>
    request<DashboardStats>(`/dashboard/stats?student_id=${student_id}`),
  getCourses: (student_id: string = '00000000-0000-0000-0000-000000000001') =>
    request<{ courses: CourseProgress[] }>(`/dashboard/courses?student_id=${student_id}`),
}

// ===== Evaluation =====
export interface EvaluationStats {
  total_actions: number
  total_duration_minutes: number
  action_breakdown: Record<string, number>
  knowledge_mastery: Record<string, { avg_score: number; attempt_count: number }>
  daily_activity: Array<{ date: string; count: number; duration_minutes: number }>
  weak_areas: string[]
}

export interface EvaluationReport {
  student_id: string
  summary: {
    total_resources: number
    total_exercises: number
    avg_score: number
    total_actions: number
    total_duration_minutes: number
    path_progress: string
  }
  knowledge_mastery: Record<string, { avg_score: number; attempt_count: number }>
  weak_areas: string[]
  daily_activity: Array<{ date: string; count: number; duration_minutes: number }>
  overall_score: number
  recommendations: string[]
}

export const evaluationApi = {
  getStats: (student_id: string) =>
    request<EvaluationStats>(`/evaluation/stats/${student_id}`),
  getReport: (student_id: string) =>
    request<EvaluationReport>(`/evaluation/report/${student_id}`),
  recordAction: (data: {
    student_id: string
    action: string
    resource_type?: string
    resource_id?: string
    knowledge_point?: string
    score?: number
    duration_seconds?: number
    detail?: Record<string, any>
    course_id?: string
  }) =>
    request<{ record_id: string; status: string }>('/evaluation/record', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
}

// ===== Auth (登录 / 注册 / 设置) =====
export interface AuthStudent {
  id: string
  student_no: string
  name?: string
  email?: string
  major?: string
  grade?: string
  role?: string
  created_at?: string
  last_login?: string
}

export interface AuthResponse {
  token: string
  refresh_token?: string
  student: AuthStudent
}

export const authApi = {
  login: (data: { student_no: string; password: string }) =>
    request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  register: (data: {
    student_no: string
    password: string
    name?: string
    email?: string
    major?: string
  }) =>
    request<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getMe: () => request<AuthStudent>('/auth/me', { method: 'GET' }),
  updateMe: (data: { name?: string; email?: string }) =>
    request<AuthStudent>('/auth/me', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  changePassword: (data: { old_password: string; new_password: string }) =>
    request<{ message: string }>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
}
