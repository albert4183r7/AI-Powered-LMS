'use client'

import { useState } from 'react'
import { BookOpen, Bookmark, Eye, Loader2, Users } from 'lucide-react'
import type { CourseSummary } from '@/features/courses/types'
import { apiRequest } from '@/lib/api-client'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store/app-store'
import { t9, translateCategory, type Lang } from '@/lib/i18n'

const COVER_GRADIENTS = [
  'gradient-blue', 'gradient-green', 'gradient-amber', 'gradient-purple',
  'gradient-pink', 'gradient-orange', 'gradient-teal', 'gradient-rose',
  'gradient-violet', 'gradient-red', 'gradient-sky', 'gradient-indigo',
  'gradient-slate', 'gradient-emerald', 'gradient-lime', 'gradient-fuchsia',
  'gradient-gray', 'gradient-cyan', 'gradient-yellow',
]

type CourseCardData = Pick<CourseSummary, 'id' | 'title' | 'cover' | 'studentCount' | 'category'> & {
  lessonCount?: number
  isBookmarked?: boolean
}

interface CourseCardProps {
  course: CourseCardData
  index?: number
  showDetails?: boolean
  showProgress?: boolean
  progress?: number
  onBookmarkChange?: (courseId: string, isBookmarked: boolean) => void
}

export function CourseCard({
  course,
  index = 0,
  showDetails = true,
  showProgress = false,
  progress = 0,
  onBookmarkChange,
}: CourseCardProps) {
  const navigateToCourse = useAppStore((state) => state.navigateToCourse)
  const user = useAppStore((state) => state.user)
  const language = useAppStore((state) => state.lang) as Lang
  const isBookmarked = Boolean(course.isBookmarked)
  const [isUpdatingBookmark, setIsUpdatingBookmark] = useState(false)
  const [bookmarkError, setBookmarkError] = useState('')
  const gradientClass = course.cover?.startsWith('from-') || course.cover?.startsWith('gradient-')
    ? course.cover
    : COVER_GRADIENTS[index % COVER_GRADIENTS.length]
  const category = translateCategory(course.category, language)
  const normalizedProgress = Math.min(100, Math.max(0, progress))

  const toggleBookmark = async () => {
    if (!user || user.role !== 'employee' || isUpdatingBookmark) return
    const nextBookmarkedState = !isBookmarked
    setIsUpdatingBookmark(true)
    setBookmarkError('')
    try {
      if (nextBookmarkedState) {
        await apiRequest(`/api/courses/${course.id}/bookmark`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id }),
        })
      } else {
        await apiRequest(`/api/courses/${course.id}/bookmark?userId=${encodeURIComponent(user.id)}`, {
          method: 'DELETE',
        })
      }
      onBookmarkChange?.(course.id, nextBookmarkedState)
    } catch (error) {
      setBookmarkError(error instanceof Error ? error.message : 'Unable to update bookmark.')
    } finally {
      setIsUpdatingBookmark(false)
    }
  }

  return (
    <article className='group relative w-full overflow-hidden rounded-xl border border-border/60 bg-white text-left transition-all duration-200 hover:border-border hover:shadow-sm'>
      <div className={cn('relative flex h-28 items-end overflow-hidden p-3.5', gradientClass)}>
        {course.cover?.startsWith('data:') && (
          <img
            src={course.cover}
            alt={`${course.title} cover`}
            className='absolute inset-0 h-full w-full object-cover'
          />
        )}
        <div className='absolute inset-0 bg-black/10' aria-hidden='true' />
        <button
          type='button'
          onClick={() => navigateToCourse(course.id)}
          className='absolute inset-0 z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white'
          aria-label={`${t9('card.viewDetails', language)}: ${course.title}`}
        />
        {user?.role === 'employee' && (
          <button
            type='button'
            onClick={toggleBookmark}
            disabled={isUpdatingBookmark}
            className={cn(
              'absolute right-2.5 top-2.5 z-20 flex size-8 items-center justify-center rounded-full border border-white/30 backdrop-blur-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white',
              isBookmarked ? 'bg-white text-slate-900' : 'bg-slate-900/35 text-white hover:bg-slate-900/55',
            )}
            aria-label={isBookmarked ? t9('card.removeBookmark', language) : t9('card.addBookmark', language)}
            aria-pressed={isBookmarked}
            title={isBookmarked ? t9('card.removeBookmark', language) : t9('card.addBookmark', language)}
          >
            {isUpdatingBookmark
              ? <Loader2 className='size-3.5 animate-spin' aria-hidden='true' />
              : <Bookmark className={cn('size-3.5', isBookmarked && 'fill-current')} aria-hidden='true' />}
          </button>
        )}
        {showProgress && (
          <div className='absolute bottom-2.5 left-3.5 right-3.5'>
            <div
              className='h-1 overflow-hidden rounded-full bg-white/30'
              role='progressbar'
              aria-label={`${course.title} progress`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={normalizedProgress}
            >
              <div
                className='h-full rounded-full bg-white transition-all duration-500'
                style={{ width: `${normalizedProgress}%` }}
              />
            </div>
          </div>
        )}
        <div className='pointer-events-none relative z-10 w-full'>
          <div className='mb-1.5 flex items-center gap-1.5'>
            <span className='rounded bg-white/20 px-1.5 py-0.5 text-[10px] font-medium text-white/90 backdrop-blur-sm'>
              {category}
            </span>
          </div>
          <h3 className='line-clamp-2 text-sm font-semibold text-white drop-shadow-sm'>{course.title}</h3>
        </div>
      </div>

      <button
        type='button'
        onClick={() => navigateToCourse(course.id)}
        className='block w-full p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-slate-500'
        aria-label={`${t9('card.viewDetails', language)}: ${course.title}`}
      >
        <div className='flex items-center gap-3 text-[11px] text-muted-foreground'>
          <span className='flex items-center gap-1'>
            <BookOpen className='size-3' aria-hidden='true' />
            {course.lessonCount ?? 0} {t9('card.lessons', language)}
          </span>
          <span className='flex items-center gap-1'>
            <Users className='size-3' aria-hidden='true' />
            {course.studentCount} {t9('card.enrolled', language)}
          </span>
        </div>
        {showDetails && (
          <div className='mt-2.5 border-t border-border/40 pt-2.5'>
            <span className='flex items-center gap-1 text-xs font-medium text-foreground group-hover:underline'>
              {t9('card.viewDetails', language)} <Eye className='size-3' aria-hidden='true' />
            </span>
          </div>
        )}
        {showProgress && normalizedProgress > 0 && (
          <p className='mt-2 text-[11px] text-muted-foreground'>
            {t9('card.complete', language).replace('{pct}', String(normalizedProgress))}
          </p>
        )}
      </button>
      {bookmarkError && <p role='alert' className='border-t border-red-100 bg-red-50 px-3 py-1.5 text-[10px] text-red-700'>{bookmarkError}</p>}
    </article>
  )
}
