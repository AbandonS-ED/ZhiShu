// 智枢 API 客户端
// 开发环境直连后端 8001（CORS 已在后端配置 localhost:3000）
const BASE_URL = 'http://localhost:8001/api/v1'

import type { Resource, ResourceContent, Exercise } from '@/types'
export type { Resource, ResourceContent, Exercise }
import { createEventStream, type ChatEvent } from './sse'
import { clearStudentIdCache } from './student'

export type { ChatEvent }

// 学习包生成 SSE 事件类型
export interface GenerationEvent {
  type: 'progress' | 'token' | 'result' | 'error' | 'done' | 'validation'
  progress?: number
  message?: string
  current_agent?: string
  content?: string
  data?: {
    resource_id?: string
    knowledge_point?: string
    phase?: string
    content?: Record<string, unknown>
  }
  passed?: boolean
  confidence?: number
  issues?: string[]
}

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
    if (res.status === 401 && typeof window !== 'undefined'
        && !path.startsWith('/auth/login') && !path.startsWith('/auth/register')) {
      localStorage.removeItem('zhishu_token')
      localStorage.removeItem('zhishu_refresh_token')
      localStorage.removeItem('zhishu_student')
      clearStudentIdCache() // 清除缓存
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

export interface AssessmentStatus {
  status: string
  can_resume: boolean
  session_id?: string | null
  assessed_dimensions: string[]
  dimensions: Record<string, { score: number; confidence: number }>
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
      confidence: Record<string, number>
      background: Record<string, unknown>
      assessment_status: string
    }>('/profile/me'),

  reset: () =>
    request<{ status: string; message: string }>('/profile/reset', {
      method: 'POST',
    }),

  getAssessmentStatus: () =>
    request<AssessmentStatus>('/profile/assessment-status'),

  updateBackground: (background: Record<string, unknown>) =>
    request<{ status: string; message: string }>('/profile/background', {
      method: 'PUT',
      body: JSON.stringify({ background }),
    }),

  updateBehavior: (data: {
    exercise_correct_rate?: number
    resource_access_count?: number
    study_duration?: number
  }) =>
    request<{ status: string; message: string; updated: boolean }>('/profile/update-behavior', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  analyzeBehavior: (behavior_type: string, behavior_data: Record<string, unknown> = {}) =>
    request<{ status: string; updates?: Array<{ dimension: string; score_change: number; reason: string }>; summary?: string; updated_count?: number }>(
      '/profile/analyze-behavior',
      {
        method: 'POST',
        body: JSON.stringify({ behavior_type, behavior_data }),
      }
    ),

  forceAnalyze: () =>
    request<{ status: string; updates?: Array<{ dimension: string; score_change: number; reason: string }>; summary?: string; updated_count?: number }>(
      '/profile/force-analyze',
      { method: 'POST' }
    ),

  getAnalysisStatus: () =>
    request<{ has_profile: boolean; last_analyzed_at: string | null; assessment_status: string }>(
      '/profile/analysis-status'
    ),
}

// ===== Chat (SSE 流式) =====

export const chatApi = {
  stream(
    student_id: string,
    message: string,
    onEvent: (e: ChatEvent) => void,
    opts?: { session_id?: string; course_topics?: string[] }
  ): () => void {
    return createEventStream(`${BASE_URL}/chat/stream`, { student_id, message, ...opts }, onEvent)
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
  recommendQuestions: (session_id?: string, count = 4) =>
    request<{ questions: Array<{ text: string; tag: string; tagClass: string; reason: string }> }>(
      '/chat/recommend-questions',
      {
        method: 'POST',
        body: JSON.stringify({ session_id, count }),
      }
    ),
}

// ===== Resource =====

export const resourceApi = {
  generateStream(
    student_id: string,
    knowledge_point: string,
    onEvent: (e: ChatEvent) => void,
    resource_type = 'all'
  ): () => void {
    return createEventStream(`${BASE_URL}/resource/generate/stream`, { student_id, knowledge_point, resource_type }, onEvent)
  },
  generate: (student_id: string, knowledge_point: string, resource_type = 'all') =>
    request<Resource>('/resource/generate', {
      method: 'POST',
      body: JSON.stringify({ student_id, knowledge_point, resource_type }),
    }),
  list: (student_id: string) =>
    request<Array<{
      resource_id: string;
      title: string;
      resource_type: string;
      knowledge_point: string;
      content: Record<string, unknown>;
      difficulty: number;
      is_favorited: boolean;
      created_at: string;
    }>>(`/resource/list?student_id=${student_id}`),
  favorite: (resource_id: string) =>
    request<{ resource_id: string; is_favorited: boolean }>(
      `/resource/${resource_id}/favorite`,
      { method: 'POST' }
    ),
  batchGenerate: (student_id: string, knowledge_points: string[], resource_type = 'all') =>
    request<{
      total: number;
      success: number;
      results: Array<{ resource_id?: string; knowledge_point: string; status: string; message?: string }>;
    }>('/resource/batch-generate', {
      method: 'POST',
      body: JSON.stringify({ student_id, knowledge_points, resource_type }),
    }),
  saveFromChat: (student_id: string, title: string, resource_type: string, content: Record<string, unknown>, knowledge_point: string) =>
    request<{ resource_id: string; title: string; message: string }>('/resource/save-from-chat', {
      method: 'POST',
      body: JSON.stringify({ student_id, title, resource_type, content, knowledge_point }),
    }),

  // ── 推荐 + 学习包（新功能）───────────────────────────────
  getRecommendations: (student_id: string, limit = 10) =>
    request<{ recommendations: Array<{
      knowledge_point: string
      reason: string
      reason_type: string
      priority_score: number
      suggested_phases: string[]
      existing_resources: { learn: boolean; practice: boolean; review: boolean }
      estimated_minutes: number
    }> }>('/resource/recommendations', {
      method: 'POST',
      body: JSON.stringify({ student_id, limit }),
    }),

  getLearningPackage: (student_id: string, knowledge_point: string, phase: string) =>
    request<{
      knowledge_point: string
      phase: string
      resources: Array<Record<string, unknown>>
      next_phase: string | null
      progress: { learn: boolean; practice: boolean; review: boolean }
    }>(`/resource/learning-package?student_id=${student_id}&knowledge_point=${encodeURIComponent(knowledge_point)}&phase=${phase}`),

  // 生成学习包（JSON 完整返回）
  generateLearningPackage: (
    student_id: string,
    knowledge_point: string,
    phase: string
  ) =>
    request<{
      resource_id: string
      knowledge_point: string
      phase: string
      content: Record<string, unknown>
    }>('/resource/learning-package/generate/stream', {
      method: 'POST',
      body: JSON.stringify({ student_id, knowledge_point, phase }),
    }),

  // SSE 流式生成学习包
  generateLearningPackageStream(
    student_id: string,
    knowledge_point: string,
    phase: string,
    onEvent: (e: GenerationEvent) => void
  ): () => void {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 300_000) // 5min
    const token = typeof window !== 'undefined' ? localStorage.getItem('zhishu_token') : null
    fetch(`${BASE_URL}/resource/learning-package/generate/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ student_id, knowledge_point, phase }),
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
      .finally(() => clearTimeout(timeout))
    return () => { clearTimeout(timeout); controller.abort() }
  },
}

// ===== Exercise =====

export const exerciseApi = {
  generateStream(
    student_id: string,
    knowledge_point: string,
    onEvent: (e: ChatEvent) => void,
    count = 5,
    exercise_type = 'all'
  ): () => void {
    return createEventStream(`${BASE_URL}/resource/exercises/generate/stream`, { student_id, knowledge_point, count, exercise_type }, onEvent)
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
  generateStream(
    student_id: string,
    course_topics: string[],
    onEvent: (e: ChatEvent) => void,
    total_days = 30,
    daily_topics = 3
  ): () => void {
    return createEventStream(`${BASE_URL}/path/generate/stream`, { student_id, course_topics, total_days, daily_topics }, onEvent)
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
  delete: (student_id: string, path_id: string) =>
    request<{ message: string }>(`/path/${student_id}/${path_id}`, { method: 'DELETE' }),
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
  today_minutes: number
  daily_study_minutes: Array<{ date: string; minutes: number }>
  streak_days: number
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
  generated_at: string
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
  report: {
    overall_evaluation: string
    strengths: Array<{ name: string; mastery: number; description: string }>
    weak_points: Array<{ name: string; mastery: number; description: string }>
    error_prone_areas: Array<{ name: string; error_rate: number; description: string }>
    recommendations: string[]
    progress_trend: {
      score_change: number
      duration_change: number
      description: string
    }
  }
  profile: {
    comprehension: number
    memory: number
    application: number
    imagination: number
    focus: number
  }
}

export const evaluationApi = {
  getStats: (student_id: string) =>
    request<EvaluationStats>(`/evaluation/stats/${student_id}`),
  getReport: (student_id: string) =>
    request<EvaluationReport>(`/evaluation/report/${student_id}`),
  regenerateReport: (student_id: string) =>
    request<EvaluationReport>(`/evaluation/report/${student_id}/regenerate`, { method: 'POST' }),
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
    phone: string
    code: string
    name?: string
    email?: string
    major?: string
  }) =>
    request<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  sendCode: (phone: string) =>
    request<{ message: string }>('/auth/send-code', {
      method: 'POST',
      body: JSON.stringify({ phone }),
    }),
  verifyCode: (phone: string, code: string) =>
    request<{ message: string }>('/auth/verify-code', {
      method: 'POST',
      body: JSON.stringify({ phone, code }),
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

// ===== Admin (管理后台) =====

// 管理后台专用 request（自动带 admin token）
async function adminRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('zhishu_admin_token') : null
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
    if (res.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('zhishu_admin_token')
      localStorage.removeItem('zhishu_admin_user')
      window.location.href = '/admin/login'
    }
    throw new Error(msg)
  }
  return res.json()
}

export interface AdminStats {
  total_users: number
  admin_count: number
  total_resources: number
  total_exercises: number
  total_paths: number
  total_chats: number
  total_documents: number
  today_active: number
  today_new_resources: number
}

export interface AdminTrends {
  labels: string[]
  registrations: number[]
  resources: number[]
}

export interface AdminUser {
  id: string
  student_no: string
  name: string
  email: string
  role: string
  is_active: boolean
  resource_count: number
  exercise_count: number
  last_login: string | null
  created_at: string | null
}

export interface AdminResource {
  id: string
  student_id: string
  student_name: string
  title: string
  knowledge_point: string
  resource_type: string
  is_favorited: boolean
  created_at: string | null
}

export interface AdminPath {
  id: string
  student_id: string
  student_name: string
  title: string
  total_days: number
  node_count: number
  edge_count: number
  nodes: Array<{ id: string; label: string; difficulty: number; estimated_hours: number }>
  edges: Array<{ source: string; target: string; relation?: string }>
  created_at: string | null
}

export interface AdminChat {
  id: string
  student_id: string
  student_name: string
  title: string
  message_count: number
  created_at: string | null
}

export interface AdminChatMessage {
  id: string
  role: string
  content: string
  created_at: string | null
}

export interface AdminAgent {
  name: string
  role: string
  calls: number
  errors: number
  error_rate: number
  avg_ms: number
}

export interface AdminDocument {
  id: string
  source_file: string
  chunk_count: number
}

export const adminApi = {
  getStats: () => adminRequest<AdminStats>('/admin/stats'),
  getTrends: (days = 7) => adminRequest<AdminTrends>(`/admin/trends?days=${days}`),
  getUsers: (page = 1, pageSize = 20, search?: string, role?: string) => {
    const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) })
    if (search) params.set('search', search)
    if (role) params.set('role', role)
    return adminRequest<{ items: AdminUser[]; total: number; page: number; page_size: number }>(`/admin/users?${params}`)
  },
  getUserDetail: (id: string) => adminRequest<AdminUser>(`/admin/users/${id}`),
  updateUser: (id: string, data: { is_active?: boolean; name?: string }) =>
    adminRequest<{ message: string }>(`/admin/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteStudent: (id: string) =>
    adminRequest<{ message: string }>(`/admin/users/${id}`, { method: 'DELETE' }),
  getResources: (page = 1, pageSize = 20, studentId?: string, search?: string) => {
    const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) })
    if (studentId) params.set('student_id', studentId)
    if (search) params.set('search', search)
    return adminRequest<{ items: AdminResource[]; total: number; page: number; page_size: number }>(`/admin/resources?${params}`)
  },
  getPaths: (page = 1, pageSize = 20, studentId?: string) => {
    const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) })
    if (studentId) params.set('student_id', studentId)
    return adminRequest<{ items: AdminPath[]; total: number; page: number; page_size: number }>(`/admin/paths?${params}`)
  },
  getChats: (page = 1, pageSize = 20, studentId?: string) => {
    const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) })
    if (studentId) params.set('student_id', studentId)
    return adminRequest<{ items: AdminChat[]; total: number; page: number; page_size: number }>(`/admin/chats?${params}`)
  },
  getChatMessages: (sessionId: string) =>
    adminRequest<{ items: AdminChatMessage[] }>(`/admin/chats/${sessionId}/messages`),
  getAgents: () =>
    adminRequest<{ agents: AdminAgent[]; system: { cpu_percent: number; memory_mb: number } }>('/admin/agents'),
  getDocuments: (page = 1, pageSize = 20, search?: string) => {
    const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) })
    if (search) params.set('search', search)
    return adminRequest<{ items: AdminDocument[]; total: number; page: number; page_size: number }>(`/admin/documents?${params}`)
  },
}
