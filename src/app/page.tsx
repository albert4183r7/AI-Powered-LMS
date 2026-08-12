'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import { Navbar } from '@/components/training/Navbar'
import AuthPage from '@/components/training/AuthPage'
import { HomePage } from '@/components/training/HomePage'
import { CoursesPage } from '@/components/training/CoursesPage'
import { MyLearningPage } from '@/components/training/MyLearningPage'
import { ProfilePage } from '@/components/training/ProfilePage'
import { MyCoursesPage } from '@/components/training/MyCoursesPage'
import { CreateCoursePage } from '@/components/training/CreateCoursePage'
import { CourseDetailPage } from '@/components/training/CourseDetailPage'
import { SlideClassroom } from '@/components/training/SlideClassroom'
import { AdminPage } from '@/components/training/AdminPage'
import { useAppStore } from '@/store/app-store'
import { apiRequest } from '@/lib/api-client'
import type { AuthResponse } from '@/features/users/types'

const pages: Record<string, React.ComponentType> = {
  auth: AuthPage,
  home: HomePage,
  courses: CoursesPage,
  'my-learning': MyLearningPage,
  profile: ProfilePage,
  'my-courses': MyCoursesPage,
  'create-course': CreateCoursePage,
  'ai-generate': CreateCoursePage,
  'course-detail': CourseDetailPage,
  classroom: SlideClassroom,
  admin: AdminPage,
}

const emptySubscribe = () => () => {}

export default function App() {
  const currentPage = useAppStore((s) => s.currentPage)
  const user = useAppStore((s) => s.user)
  const setUser = useAppStore((s) => s.setUser)
  const setCurrentPage = useAppStore((s) => s.setCurrentPage)
  const [isSessionLoading, setIsSessionLoading] = useState(true)
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false)

  useEffect(() => {
    let isActive = true

    async function restoreSession() {
      try {
        const authenticationResponse = await apiRequest<AuthResponse>('/api/auth/me')
        if (isActive) {
          setUser(authenticationResponse.user)
          setCurrentPage('home')
        }
      } catch {
        // A missing or expired session is expected for signed-out visitors.
      } finally {
        if (isActive) {
          setIsSessionLoading(false)
        }
      }
    }

    void restoreSession()
    return () => {
      isActive = false
    }
  }, [setCurrentPage, setUser])

  // Redirect to auth when a resolved session has no authenticated user.
  useEffect(() => {
    if (!isSessionLoading && !user && currentPage !== 'auth') {
      setCurrentPage('auth')
    }
  }, [user, currentPage, isSessionLoading, setCurrentPage])

  // Avoid hydration mismatch — this is a pure SPA, no SSR benefit
  if (!mounted || isSessionLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin size-8 border-2 border-slate-200 border-t-slate-900 rounded-full" />
      </div>
    )
  }

  if (!user && currentPage !== 'auth') {
    return null
  }

  const Page = pages[currentPage] || HomePage
  const isClassroom = currentPage === 'classroom'
  const isAuth = currentPage === 'auth'
  const noPadding = ['profile', 'create-course', 'ai-generate', 'course-detail', 'my-learning', 'admin'].includes(currentPage)

  return (
    <div className='min-h-screen flex flex-col bg-gray-50'>
      {!isClassroom && !isAuth && <Navbar />}
      <div className={`flex-1 ${!isClassroom && !isAuth && !noPadding ? 'pb-14 lg:pb-0' : ''}`}>
        <Page />
      </div>
    </div>
  )
}
