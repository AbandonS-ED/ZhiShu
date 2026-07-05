export interface ReviewDimension {
  score: number
  issues: string[]
  suggestions: string[]
}

export interface ReviewResult {
  overall_score: number
  passed: boolean
  dimensions: {
    content_quality: ReviewDimension
    knowledge_accuracy: ReviewDimension
    format_check: ReviewDimension
    learning_suggestions: ReviewDimension
  }
  summary: string
}

export interface ResourceContent {
  knowledge?: string
  code?: string
  mermaid_code?: string
  exercises?: ExerciseItem[]
}

export interface ExerciseItem {
  type: 'choice' | 'judge' | 'short_answer' | 'coding'
  question: string
  options?: string[]
  answer: string
  explanation?: string
  difficulty?: number
}

export interface ResourceItem {
  resource_id: string
  title: string
  resource_type: string
  knowledge_point: string
  content: ResourceContent
  difficulty: number
  is_favorited: boolean
  is_preset?: boolean
  created_at: string
}

export interface CreateMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

export interface AISourceCreateRequest {
  student_id: string
  message: string
  conversation_history?: CreateMessage[]
}

export interface ManualCreateRequest {
  student_id: string
  title: string
  resource_type: string
  content: ResourceContent
  knowledge_point: string
}

export interface ReviewRequest {
  content: ResourceContent
  knowledge_point: string
}
