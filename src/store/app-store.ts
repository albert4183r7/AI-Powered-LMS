'use client'

import { create } from 'zustand'

export type PageView = 'auth' | 'home' | 'courses' | 'my-learning' | 'profile' | 'my-courses' | 'create-course' | 'ai-generate' | 'course-detail' | 'classroom' | 'admin'

export interface CourseData {
  id: string; title: string; description: string | null; cover: string | null
  category: string; studentCount: number; createdAt: string
  lessonCount?: number; status?: string; language?: string; isBookmarked?: boolean
}

export interface LessonData {
  id: string; title: string; description: string | null; order: number
  presentations: Array<{ id: string; fileName: string; filePath: string; order: number }>
}

interface AppState {
  currentPage: PageView; setCurrentPage: (page: PageView) => void
  previousPage: PageView | null; setPreviousPage: (page: PageView | null) => void
  selectedCourseId: string | null; setSelectedCourseId: (id: string | null) => void
  selectedLessonId: string | null; setSelectedLessonId: (id: string | null) => void
  sortBy: string; setSortBy: (sort: string) => void
  homeTab: string; setHomeTab: (tab: string) => void
  learningTab: string; setLearningTab: (tab: string) => void
  sidebarOpen: boolean; setSidebarOpen: (open: boolean) => void
  // Auth
  user: { id: string; email: string; name: string | null; role: string } | null
  setUser: (user: { id: string; email: string; name: string | null; role: string } | null) => void
  isAuth: () => boolean
  isInstructor: () => boolean
  isAdmin: () => boolean
  // Language
  lang: string; setLang: (lang: string) => void
  // Course editor
  editorCourseId: string | null; setEditorCourseId: (id: string | null) => void
  editorCover: string | null; setEditorCover: (cover: string | null) => void
  editorTitle: string; setEditorTitle: (title: string) => void
  editorSaved: boolean; setEditorSaved: (saved: boolean) => void
  // AI module generation
  aiGenerationPrompt: string; setAiGenerationPrompt: (prompt: string) => void
  // Add section modal
  addSectionOpen: boolean; setAddSectionOpen: (open: boolean) => void
  editLesson: {
    id: string
    title: string
    description: string
    presentations: Array<{ id: string; fileName: string; filePath: string; order: number }>
  } | null
  setEditLesson: (lesson: {
    id: string
    title: string
    description: string
    presentations: Array<{ id: string; fileName: string; filePath: string; order: number }>
  } | null) => void
  // Navigation helpers
  navigateToCourse: (courseId: string) => void
  navigateToLesson: (courseId: string, lessonId: string) => void
  navigateBack: () => void
  navigateTo: (page: PageView) => void
  resetEditorState: () => void
  logout: () => Promise<void>
}

export const useAppStore = create<AppState>((set, get) => ({
  currentPage: 'auth',
  setCurrentPage: (page) => set((s) => ({ previousPage: s.currentPage, currentPage: page })),
  previousPage: null,
  setPreviousPage: (page) => set({ previousPage: page }),
  selectedCourseId: null, setSelectedCourseId: (id) => set({ selectedCourseId: id }),
  selectedLessonId: null, setSelectedLessonId: (id) => set({ selectedLessonId: id }),
  sortBy: 'Newest', setSortBy: (sort) => set({ sortBy: sort }),
  homeTab: 'Popular', setHomeTab: (tab) => set({ homeTab: tab }),
  learningTab: 'in_progress', setLearningTab: (tab) => set({ learningTab: tab }),
  sidebarOpen: false, setSidebarOpen: (open) => set({ sidebarOpen: open }),
  // Auth
  user: null,
  setUser: (user) => set({ user }),
  isAuth: () => get().user !== null,
  isInstructor: () => get().user?.role === 'instructor' || get().user?.role === 'admin',
  isAdmin: () => get().user?.role === 'admin',
  // Language
  lang: 'English', setLang: (lang) => set({ lang }),
  // Course editor
  editorCourseId: null, setEditorCourseId: (id) => set({ editorCourseId: id }),
  editorCover: null, setEditorCover: (cover) => set({ editorCover: cover }),
  editorTitle: '', setEditorTitle: (title) => set({ editorTitle: title }),
  editorSaved: false, setEditorSaved: (saved) => set({ editorSaved: saved }),
  // AI module generation
  aiGenerationPrompt: '', setAiGenerationPrompt: (prompt) => set({ aiGenerationPrompt: prompt }),
  // Add section modal
  addSectionOpen: false, setAddSectionOpen: (open) => set({ addSectionOpen: open }),
  editLesson: null, setEditLesson: (lesson) => set({ editLesson: lesson }),
  // Navigation helpers
  navigateTo: (page) => set((_prev) => ({ previousPage: _prev.currentPage, currentPage: page })),
  navigateToCourse: (courseId) => set({ selectedCourseId: courseId, currentPage: 'course-detail' }),
  navigateToLesson: (courseId, lessonId) => set({
    selectedCourseId: courseId, selectedLessonId: lessonId, currentPage: 'classroom',
  }),
  navigateBack: () => { const p = get().previousPage; set({ currentPage: p || 'home', previousPage: null }) },
  resetEditorState: () => set({ editorCourseId: null, editorCover: null, editorTitle: '', editorSaved: false, aiGenerationPrompt: '', editLesson: null }),
  logout: async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } finally {
      set({ user: null, currentPage: 'auth', previousPage: null, selectedCourseId: null, selectedLessonId: null, editorCourseId: null, editorSaved: false, editorCover: null, editorTitle: '', aiGenerationPrompt: '', lang: 'English' })
    }
  },
}))
