// 学习者画像六维数据
export interface ProfileDimensions {
  knowledge_mastery: Record<string, number>  // 知识掌握度
  learning_style: {
    visual: number
    textual: number
    auditory: number
    kinesthetic: number
  }
  cognitive_level: {
    memory: number
    understand: number
    apply: number
    analyze: number
  }
  interest: Record<string, number>  // 兴趣偏好
  weak_topics: string[]  // 薄弱环节
  learning_pace: {
    daily_hours: number
    preferred_time: string
    focus_duration: number
  }
}

// 学生信息
export interface Student {
  id: string
  student_no: string
  name: string
  avatar_url?: string
  grade?: string
  major?: string
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

// 学习资源
export interface Resource {
  id: string
  type: 'explanation' | 'mindmap' | 'exercise' | 'code' | 'audio' | 'path' | 'qa'
  title: string
  content: string
  kp_id: string
  difficulty?: string
  metadata: Record<string, any>
  source_refs: SourceRef[]
  is_verified: boolean
  created_at: string
}

// 来源引用
export interface SourceRef {
  doc_id: string
  chunk_id: string
  page: number
  quote: string
}

// 练习题
export interface Exercise {
  id: string
  type: 'choice' | 'fill' | 'code' | 'short_answer'
  difficulty: 'easy' | 'medium' | 'hard'
  question: string
  options?: { key: string; text: string; is_correct: boolean }[]
  answer: string
  explanation: string
  sample_code?: string
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
