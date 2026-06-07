// 智枢 API 客户端
// 后端 baseURL: http://localhost:8000

const BASE_URL = 'http://localhost:8000/api/v1'

// 通用 fetch 封装
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`API ${res.status}: ${text || res.statusText}`)
  }
  return res.json()
}

// ===== Profile =====
export interface ProfileDimensions {
  knowledge_mastery?: Record<string, number>
  learning_style?: { visual: number; textual: number; auditory: number; kinesthetic: number }
  cognitive_level?: { memory: number; understand: number; apply: number; analyze: number }
  interest?: Record<string, number>
  weak_topics?: string[]
  learning_pace?: { daily_hours: number; preferred_time: string; focus_duration: number }
}

export interface StudentProfile {
  student_id: string
  dimensions: ProfileDimensions
  version: number
  completeness_score: number
}

export const profileApi = {
  build: (student_id: string, messages: Array<{ role: string; content: string }>) =>
    request<StudentProfile>('/profile/build', {
      method: 'POST',
      body: JSON.stringify({ student_id, messages }),
    }),
  get: (student_id: string) => request<StudentProfile>(`/profile/${student_id}`),
}

// ===== Chat (SSE 流式) =====
export interface ChatEvent {
  type: 'session' | 'progress' | 'result' | 'done' | 'error'
  session_id?: string
  progress?: number
  message?: string
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
    fetch(`${BASE_URL}/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
  difficulty: number
  knowledge_point?: string
}

export const exerciseApi = {
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
