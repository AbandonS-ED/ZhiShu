// 智枢 API 客户端
// 开发环境直连后端 8001（CORS 已在后端配置 localhost:3000）
const BASE_URL = 'http://localhost:8001/api/v1'

import type { Resource, ResourceContent, Exercise, WrongQuestion, WrongQuestionStats } from '@/types'
export type { Resource, ResourceContent, Exercise, WrongQuestion, WrongQuestionStats }
import type { AISourceCreateRequest, ManualCreateRequest, ReviewRequest, ResourceItem, ReviewResult } from '@/app/resources/types'
export type { AISourceCreateRequest, ManualCreateRequest, ReviewRequest, ResourceItem, ReviewResult }

export interface SaveResourceRequest {
  student_id: string
  title: string
  resource_type: string
  content: {
    knowledge?: string
    code?: string
    mermaid_code?: string
    exercises?: Array<{
      type: string
      question: string
      options?: string[]
      answer: string
      explanation?: string
      difficulty?: number
    }>
    message?: string
  }
  knowledge_point?: string
  difficulty?: number
}

import { createEventStream, type ChatEvent } from './sse'
import { clearStudentIdCache } from './student'

export type { ChatEvent }

// 学习包生成 SSE 事件类型
export interface GenerationEvent {
  type: 'progress' | 'token' | 'result' | 'error' | 'done'
    | 'agent_result' | 'agent_error' | 'extend_menu' | 'validation'
  progress?: number
  message?: string
  current_agent?: string
  content?: string
  // agent_result / agent_error
  agent?: string
  variant?: string
  error?: string
  data?: Record<string, unknown>
  // extend_menu
  options?: { key: string; label: string; desc: string }[]
  saved_resources?: { agent: string; resource_id: string; variant: string }[]
  // result (backward compat)
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

// ===== Exercise =====

export const exerciseApi = {
  pool: (student_id: string, count = 30) =>
    request<{ exercises: Exercise[] }>(
      `/resource/exercises/pool?student_id=${student_id}&count=${count}`
    ),
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
    exercise_type = 'all',
    types?: string[]
  ) =>
    request<{ 
      knowledge_point: string; 
      count: number; 
      exercises: Exercise[];
      generation_time?: number;
    }>(
      '/resource/exercises/generate',
      {
        method: 'POST',
        body: JSON.stringify({ 
          student_id, 
          knowledge_point, 
          count, 
          exercise_type,
          types: types || ['choice', 'judge', 'short_answer']
        }),
      }
    ),
  list: (student_id: string) =>
    request<Array<Exercise & { created_at: string }>>(
      `/resource/exercises/${student_id}`
    ),
}

// ===== Scoring =====
export interface ScoreResult {
  score: number
  correct: boolean
  feedback: string
  key_points_covered: string[]
  key_points_missing: string[]
  suggestion: string
}

export const scoreApi = {
  scoreAnswer: (
    question: string,
    correct_answer: string,
    student_answer: string,
    knowledge_point: string = ''
  ) =>
    request<ScoreResult>(
      '/resource/score-answer',
      {
        method: 'POST',
        body: JSON.stringify({
          question,
          correct_answer,
          student_answer,
          knowledge_point,
        }),
      }
    ),
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
  getStats: (student_id: string) =>
    request<DashboardStats>(`/dashboard/stats?student_id=${student_id}`),
  getCourses: (student_id: string) =>
    request<{ courses: CourseProgress[] }>(`/dashboard/courses?student_id=${student_id}`),
}

// ===== Resource =====
export const resourceApi = {
  createStream: (data: AISourceCreateRequest) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('zhishu_token') : null
    return fetch(`${BASE_URL}/resource/create/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(data),
    })
  },

  createManual: (data: ManualCreateRequest) =>
    request<ResourceItem>('/resource/create/manual', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  review: (data: ReviewRequest) =>
    request<ReviewResult>('/resource/review', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  list: (studentId: string) =>
    request<ResourceItem[]>(`/resource/list?student_id=${studentId}`),

  save: (data: SaveResourceRequest) =>
    request<ResourceItem>('/resource/save', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  toggleFavorite: (resourceId: string) =>
    request<{ is_favorited: boolean }>(`/resource/${resourceId}/favorite`, { method: 'POST' }),

  delete: (resourceId: string) =>
    request<{ message: string }>(`/resource/${resourceId}`, { method: 'DELETE' }),

  getLearningPackage: (student_id: string, knowledge_point: string, phase: string) =>
    request<{
      knowledge_point: string
      phase: string
      resources: Array<Record<string, unknown>>
      next_phase: string | null
      progress: { learn: boolean; practice: boolean; review: boolean }
    }>(`/resource/learning-package?student_id=${student_id}&knowledge_point=${encodeURIComponent(knowledge_point)}&phase=${phase}`),

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
  updateMe: (data: { name?: string; email?: string; major?: string; grade?: string }) =>
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

// ===== Wrong Questions (错题本) =====

export interface WrongQuestionListResponse {
  items: WrongQuestion[]
  total: number
  page: number
  page_size: number
  stats: WrongQuestionStats
}

export interface AnalyzeResponse {
  error_type: string
  error_analysis: string
  ai_explanation: string
  similar_exercises: Array<{
    type: string
    question: string
    options?: string[]
    answer: string
    explanation?: string
  }>
}

export const wrongQuestionsApi = {
  add: (data: { student_id: string; exercise_id: string; wrong_answer: string }) =>
    request<WrongQuestion>('/wrong-questions', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  list: (params: {
    student_id: string
    filter_type?: 'all' | 'unmastered' | 'mastered'
    error_type?: string
    keyword?: string
    page?: number
    page_size?: number
  }) => {
    const search = new URLSearchParams()
    search.set('student_id', params.student_id)
    if (params.filter_type && params.filter_type !== 'all') search.set('filter_type', params.filter_type)
    if (params.error_type) search.set('error_type', params.error_type)
    if (params.keyword) search.set('keyword', params.keyword)
    if (params.page) search.set('page', String(params.page))
    if (params.page_size) search.set('page_size', String(params.page_size))
    return request<WrongQuestionListResponse>(`/wrong-questions?${search.toString()}`)
  },
  get: (id: string) => request<WrongQuestion>(`/wrong-questions/${id}`),
  analyze: (id: string) =>
    request<AnalyzeResponse>(`/wrong-questions/${id}/analyze`, { method: 'POST' }),
  analyzeStream: (id: string, onEvent: (e: ChatEvent) => void) => new Promise<void>((resolve, reject) => {
    let cancel: (() => void) | null = null
    let settled = false

    cancel = createEventStream(`${BASE_URL}/wrong-questions/${id}/analyze/stream`, {}, (e) => {
      onEvent(e)
      if (settled) return
      if (e.type === 'done') {
        settled = true
        resolve()
        cancel?.()
      } else if (e.type === 'error') {
        settled = true
        reject(new Error(e.message || '分析失败'))
        cancel?.()
      }
    })

    setTimeout(() => {
      if (!settled) {
        settled = true
        cancel?.()
        reject(new Error('分析超时，请稍后再试'))
      }
    }, 140_000)
  }),
  review: (id: string, is_correct: boolean) =>
    request<{ mastery_level: number; is_mastered: boolean; review_count: number; correct_count: number }>(
      `/wrong-questions/${id}/review`,
      { method: 'POST', body: JSON.stringify({ is_correct }) },
    ),
  delete: (id: string) =>
    request<{ message: string }>(`/wrong-questions/${id}`, { method: 'DELETE' }),
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
  total_exercises: number
  total_chats: number
  total_documents: number
  today_active: number
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
  exercise_count: number
  last_login: string | null
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

// ===== Study Plan (学习计划) =====

export interface StudyPlanStep {
  id: string
  order: number
  title: string
  description: string
  estimated_minutes: number
  status: 'pending' | 'current' | 'completed' | 'skipped'
  step_type?: string
  content_hint?: string
  resource_id?: string | null
  completed_at?: string | null
}

export interface StudyPlan {
  id: string
  knowledge_point: string
  title?: string
  description?: string
  status: 'planning' | 'learning' | 'completed' | 'abandoned'
  total_steps: number
  completed_steps: number
  estimated_minutes?: number
  actual_minutes?: number
  difficulty?: string
  prerequisites?: string[]
  steps?: StudyPlanStep[]
  created_at?: string | null
  completed_at?: string | null
}

export interface LearningPathNode {
  id: string
  knowledge_point: string
  order: number
  status: 'completed' | 'current' | 'pending'
  prerequisites: string[]
}

export interface LearningPath {
  id: string
  name: string
  description?: string
  nodes: LearningPathNode[]
  status?: string
  created_at?: string | null
}

export const studyPlanApi = {
  // 创建学习计划
  create: (data: { knowledge_point: string; difficulty?: string; prerequisites?: string[] }) =>
    request<{ success: boolean; data: StudyPlan }>('/study-plan/create', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // 获取学习计划列表
  list: (status?: string) => {
    const params = status ? `?status=${status}` : ''
    return request<{ success: boolean; data: StudyPlan[] }>(`/study-plan/list${params}`)
  },

  // 获取学习计划详情
  get: (planId: string) =>
    request<{ success: boolean; data: StudyPlan }>(`/study-plan/${planId}`),

  // 完成学习步骤
  completeStep: (planId: string, stepId: string) =>
    request<{ success: boolean; data: { completed_steps: number; total_steps: number; all_completed: boolean; plan_status: string } }>(
      `/study-plan/${planId}/complete-step`,
      {
        method: 'POST',
        body: JSON.stringify({ step_id: stepId }),
      }
    ),

  // 生成学习路径
  generatePath: (data: { target_knowledge: string; current_level?: string }) =>
    request<{ success: boolean; data: LearningPath }>('/study-plan/generate-path', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // 获取学习路径列表
  getPaths: () =>
    request<{ success: boolean; data: LearningPath[] }>('/study-plan/paths/list'),

  // 完成学习节点
  completeNode: (pathId: string, nodeId: string) =>
    request<{ success: boolean; message: string }>(`/study-plan/paths/${pathId}/nodes/${nodeId}/complete`, {
      method: 'POST',
    }),
}
