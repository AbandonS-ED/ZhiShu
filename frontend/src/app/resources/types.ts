// resources 页面专用类型（与 src/types/index.ts 完全隔离）

export type PhaseType = 'learn' | 'practice' | 'review'

export interface RecItem {
  knowledge_point: string
  reason: string
  reason_type: 'evaluation' | 'chat' | 'tiku' | 'path' | 'cold_start'
  priority_score: number
  suggested_phases: PhaseType[]
  existing_resources: { learn: boolean; practice: boolean; review: boolean }
  estimated_minutes: number
}

export interface LearningPackage {
  knowledge_point: string
  phase: PhaseType
  resources: ResourceItem[]
  next_phase: PhaseType | null
  progress: { learn: boolean; practice: boolean; review: boolean }
}

export interface ResourceItem {
  resource_id: string
  type: 'explanation' | 'mindmap' | 'audio' | 'exercise' | 'code' | 'summary_card'
  title?: string
  content?: string
  mermaid?: string
  exercises?: ExerciseItem[]
  code?: string
  duration_minutes?: number
  created_at?: string
  validation?: { passed: boolean; confidence: number; issues: string[] }
}

export interface ExerciseItem {
  question: string
  options?: string[]
  answer: string
  explanation?: string
  type?: string
}

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
