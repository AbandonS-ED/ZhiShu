import { create } from 'zustand'
import type { Student } from '@/types'

interface AppState {
  student: Student | null
  setStudent: (student: Student) => void
}

export const useAppStore = create<AppState>((set) => ({
  student: null,
  setStudent: (student) => set({ student }),
}))
