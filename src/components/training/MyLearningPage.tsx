'use client'

import { useEffect, useState } from 'react'
import { BarChart3, BookOpen, CheckCircle2, Clock, Library } from 'lucide-react'
import { CourseCard } from './CourseCard'
import type { EnrollmentListItem, EnrollmentListResponse, EnrollmentStats } from '@/features/enrollments/types'
import { apiRequest } from '@/lib/api-client'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store/app-store'
import { t9, type Lang } from '@/lib/i18n'

const EMPTY_STATS: EnrollmentStats = {
  total: 0,
  inProgress: 0,
  completed: 0,
  favorites: 0,
  avgProgress: 0,
}

export function MyLearningPage() {
  const learningTab = useAppStore((state) => state.learningTab)
  const setLearningTab = useAppStore((state) => state.setLearningTab)
  const user = useAppStore((state) => state.user)
  const language = useAppStore((state) => state.lang) as Lang
  const [enrollments, setEnrollments] = useState<EnrollmentListItem[]>([])
  const [stats, setStats] = useState<EnrollmentStats>(EMPTY_STATS)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    if (!user) return
    const abortController = new AbortController()
    const userParams = `userId=${encodeURIComponent(user.id)}`

    Promise.all([
      apiRequest<EnrollmentListResponse>(`/api/enrollments?status=${learningTab}&${userParams}`, { signal: abortController.signal }),
      apiRequest<EnrollmentStats>(`/api/enrollments?type=stats&${userParams}&role=${encodeURIComponent(user.role)}`, { signal: abortController.signal }),
    ])
      .then(([enrollmentResponse, statsResponse]) => {
        setEnrollments(enrollmentResponse.enrollments)
        setStats(statsResponse)
        setErrorMessage('')
      })
      .catch((error: unknown) => {
        if (abortController.signal.aborted) return
        setErrorMessage(error instanceof Error ? error.message : 'Unable to load your learning data.')
      })
      .finally(() => {
        if (!abortController.signal.aborted) setIsLoading(false)
      })

    return () => abortController.abort()
  }, [learningTab, user])

  const statCards = [
    { icon: BookOpen, value: stats.total, label: t9('learning.enrolled', language) },
    { icon: Clock, value: stats.inProgress, label: t9('learning.inProgress', language) },
    { icon: CheckCircle2, value: stats.completed, label: t9('learning.completed', language) },
    { icon: BarChart3, value: `${stats.avgProgress}%`, label: t9('learning.avgProgress', language) },
  ]
  const tabs = [
    { key: 'in_progress', label: t9('learning.inProgress', language) },
    { key: 'completed', label: t9('learning.completed', language) },
    { key: 'favorite', label: t9('learning.bookmarked', language) },
  ]
  const emptyText = learningTab === 'in_progress'
    ? t9('learning.noActiveTraining', language)
    : learningTab === 'completed'
      ? t9('learning.noCompletedTraining', language)
      : t9('learning.noBookmarkedTraining', language)
  const emptyHint = learningTab === 'in_progress'
    ? t9('learning.browseCatalog', language)
    : learningTab === 'completed'
      ? t9('learning.completeToSee', language)
      : t9('learning.bookmarkToFind', language)

  const handleBookmarkChange = (courseId: string, isBookmarked: boolean) => {
    setEnrollments((currentEnrollments) => currentEnrollments
      .filter((enrollment) => !(learningTab === 'favorite' && enrollment.course?.id === courseId && !isBookmarked))
      .map((enrollment) => enrollment.course?.id === courseId
        ? { ...enrollment, course: { ...enrollment.course, isBookmarked } }
        : enrollment))
    setStats((currentStats) => ({
      ...currentStats,
      favorites: Math.max(0, currentStats.favorites + (isBookmarked ? 1 : -1)),
    }))
  }

  return (
    <main className='min-h-[calc(100vh-3.5rem)] bg-gray-50/50' aria-busy={isLoading}>
      <div className='mx-auto max-w-6xl p-4 sm:p-6'>
        <div className='mb-6'>
          <h1 className='text-lg font-bold text-foreground'>{t9('learning.title', language)}</h1>
          <p className='mt-0.5 text-xs text-muted-foreground'>{t9('learning.subtitle', language)}</p>
        </div>

        <div className='mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4'>
          {statCards.map((statCard) => {
            const Icon = statCard.icon
            return (
              <div key={statCard.label} className='flex items-center gap-3 rounded-xl border border-border/60 bg-white p-4'>
                <div className='rounded-lg bg-muted/50 p-2'><Icon className='size-5 text-slate-600' aria-hidden='true' /></div>
                <div>
                  <p className='text-2xl font-bold leading-tight text-foreground'>{statCard.value}</p>
                  <p className='text-xs text-muted-foreground'>{statCard.label}</p>
                </div>
              </div>
            )
          })}
        </div>

        <section className='overflow-hidden rounded-xl border border-border/60 bg-white' aria-label={t9('learning.title', language)}>
          <div className='flex border-b border-border/60' role='tablist'>
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type='button'
                role='tab'
                aria-selected={learningTab === tab.key}
                onClick={() => setLearningTab(tab.key)}
                className={cn(
                  'relative flex-1 px-2 py-3 text-sm font-medium transition-colors sm:px-4',
                  learningTab === tab.key ? 'text-slate-900' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {tab.label}
                {learningTab === tab.key && <span className='absolute inset-x-0 bottom-0 h-0.5 bg-slate-900' />}
              </button>
            ))}
          </div>

          <div className='p-4 sm:p-6' role='tabpanel' aria-live='polite'>
            {errorMessage ? (
              <div role='alert' className='rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700'>{errorMessage}</div>
            ) : isLoading ? (
              <div className='space-y-3' aria-label='Loading learning data'>
                {Array.from({ length: 3 }, (_, index) => <div key={index} className='h-16 animate-pulse rounded-lg bg-muted/40' />)}
              </div>
            ) : enrollments.length === 0 ? (
              <div className='py-16 text-center'>
                <Library className='mx-auto mb-3 size-14 text-muted-foreground/20' aria-hidden='true' />
                <p className='font-medium text-foreground'>{emptyText}</p>
                <p className='mt-1 text-xs text-muted-foreground'>{emptyHint}</p>
              </div>
            ) : (
              <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3'>
                {enrollments.map((enrollment, index) => enrollment.course && (
                  <CourseCard
                    key={enrollment.id}
                    course={enrollment.course}
                    index={index}
                    showDetails={false}
                    showProgress
                    progress={enrollment.progress}
                    onBookmarkChange={handleBookmarkChange}
                  />
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  )
}
