import { create } from 'zustand'
import type { Student, ProfileDimensions, ChatMessage } from '@/types'

interface AppState {
  // 用户信息
  student: Student | null
  setStudent: (student: Student) => void

  // 画像数据
  profile: ProfileDimensions | null
  setProfile: (profile: ProfileDimensions) => void

  // 当前选中的知识点
  selectedKP: string | null
  setSelectedKP: (kpId: string | null) => void

  // 对话消息
  messages: ChatMessage[]
  addMessage: (message: ChatMessage) => void
  clearMessages: () => void

  // 侧边栏状态
  sidebarOpen: boolean
  toggleSidebar: () => void

  // 当前页面
  currentPage: string
  setCurrentPage: (page: string) => void
}

export const useAppStore = create<AppState>((set) => ({
  // 用户信息
  student: null,
  setStudent: (student) => set({ student }),

  // 画像数据
  profile: null,
  setProfile: (profile) => set({ profile }),

  // 当前选中的知识点
  selectedKP: null,
  setSelectedKP: (kpId) => set({ selectedKP: kpId }),

  // 对话消息
  messages: [],
  addMessage: (message) => set((state) => ({
    messages: [...state.messages, message]
  })),
  clearMessages: () => set({ messages: [] }),

  // 侧边栏状态
  sidebarOpen: true,
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),

  // 当前页面
  currentPage: 'dashboard',
  setCurrentPage: (page) => set({ currentPage: page }),
}))
