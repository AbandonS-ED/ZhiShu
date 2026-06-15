// 学习者画像 — 5维个人底层能力
export interface AbilityScore {
  score: number
  confidence: number
}

export interface ProfileDimensions {
  comprehension: AbilityScore
  memory: AbilityScore
  application: AbilityScore
  imagination: AbilityScore
  focus: AbilityScore
}

export interface StudentProfile {
  dimensions: Record<string, number>  // {comprehension: 72, memory: 55, ...}
  background: Record<string, unknown>
  assessment_status: 'pending' | 'in_progress' | 'completed'
}

// 学生信息
export interface Student {
  id: string
  student_no: string
  name: string
  avatar_url?: string
  grade?: string
  major?: string
  email?: string
  role?: string
  created_at?: string
  last_login?: string
}

// 知识点
export interface KnowledgePoint {
  id: string
  name: string
  description: string
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  category: string
  prerequisites: string[]
  order_index: number
}

// 学习路径节点
export interface PathNode {
  id: string
  kp_id: string
  kp_name: string
  order: number
  difficulty: string
  status: 'locked' | 'available' | 'in_progress' | 'completed'
  estimated_hours: number
  resources: string[]
}

// 学习路径边
export interface PathEdge {
  from: string
  to: string
  relation: 'prerequisite'
}

// 学习路径
export interface LearningPath {
  id: string
  name: string
  description: string
  nodes: PathNode[]
  edges: PathEdge[]
  total_hours: number
  progress: number
  status: 'active' | 'completed' | 'paused'
}

// 学习资源 — 与后端返回格式一致
export interface Resource {
  resource_id: string
  knowledge_point: string
  content: ResourceContent
  title?: string
  resource_type?: string
  created_at?: string
}

export interface ResourceContent {
  knowledge?: string
  code?: string
  audio_script?: string
  [k: string]: any
}

// 来源引用
export interface SourceRef {
  doc_id: string
  chunk_id: string
  page: number
  quote: string
}

// 练习题 — 与后端返回格式一致
export interface Exercise {
  exercise_id: string
  type: 'choice' | 'judge' | 'short_answer' | 'coding'
  question: string
  options?: string[]
  answer?: string
  explanation?: string
  difficulty: number
  knowledge_point?: string
  source?: string
}

// 对话消息
export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  agent_name?: string
  source_refs: SourceRef[]
  created_at: string
}

// 生成任务
export interface GenerationTask {
  id: string
  task_type: 'profile_build' | 'resource_gen' | 'path_gen' | 'qa'
  status: 'pending' | 'running' | 'completed' | 'failed'
  progress: number
  current_step: string
  total_steps: number
  completed_steps: number
  created_at: string
}
