'use client'

import { useEffect, useState } from 'react'
import { useAppStore } from '@/store/app-store'
import { Button } from '@/components/ui/button'
import type { CourseDetails, CourseDetailsResponse, CourseProgressResponse } from '@/features/courses/types'
import { apiRequest } from '@/lib/api-client'
import {
  ArrowLeft, Play, Eye, ChevronDown, ChevronUp, Calendar, BookOpen, Bookmark, Users, Clock, Tag, FileDown, CheckCircle2, BarChart3, Loader2, Lock,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { t9, translateCategory, translateDescription, formatDate, type Lang } from '@/lib/i18n'

export function CourseDetailPage() {
  const selectedCourseId = useAppStore((s) => s.selectedCourseId)
  const navigateToLesson = useAppStore((s) => s.navigateToLesson)
  const navigateBack = useAppStore((s) => s.navigateBack)
  const navigateTo = useAppStore((s) => s.navigateTo)
  const user = useAppStore((s) => s.user)
  const isInstructor = useAppStore((s) => s.isInstructor)
  const lang = useAppStore((s) => s.lang) as Lang

  const [course, setCourse] = useState<CourseDetails | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [expandedLesson, setExpandedLesson] = useState<string | null>(null)
  const [isEnrolling, setIsEnrolling] = useState(false)
  const [isUpdatingBookmark, setIsUpdatingBookmark] = useState(false)
  const [showProgress, setShowProgress] = useState(false)
  const [progressData, setProgressData] = useState<CourseProgressResponse | null>(null)
  const [isLoadingProgress, setIsLoadingProgress] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    if (!selectedCourseId) return
    const abortController = new AbortController()
    const userIdQuery = user?.id ? `?userId=${encodeURIComponent(user.id)}` : ''
    apiRequest<CourseDetailsResponse>(`/api/courses/${selectedCourseId}${userIdQuery}`, {
      signal: abortController.signal,
    })
      .then((courseResponse) => {
        setCourse(courseResponse.course)
        setErrorMessage('')
      })
      .catch((error: unknown) => {
        if (abortController.signal.aborted) return
        setErrorMessage(error instanceof Error ? error.message : 'Unable to load this course.')
      })
      .finally(() => {
        if (!abortController.signal.aborted) setIsLoading(false)
      })
    return () => abortController.abort()
  }, [selectedCourseId, user?.id])

  useEffect(() => {
    if (!selectedCourseId || !showProgress) return
    const abortController = new AbortController()
    apiRequest<CourseProgressResponse>(`/api/courses/${selectedCourseId}/progress`, {
      signal: abortController.signal,
    })
      .then((progressResponse) => {
        setProgressData(progressResponse)
        setErrorMessage('')
      })
      .catch((error: unknown) => {
        if (abortController.signal.aborted) return
        setErrorMessage(error instanceof Error ? error.message : 'Unable to load learner progress.')
      })
      .finally(() => {
        if (!abortController.signal.aborted) setIsLoadingProgress(false)
      })
    return () => abortController.abort()
  }, [selectedCourseId, showProgress])

  if (isLoading) {
    return (
      <div className='min-h-[calc(100vh-3.5rem)] flex items-center justify-center'>
        <div className='animate-spin size-8 border-2 border-slate-300 border-t-slate-900 rounded-full' />
      </div>
    )
  }

  if (!course) {
    return (
      <div className='min-h-[calc(100vh-3.5rem)] flex items-center justify-center'>
        <p role={errorMessage ? 'alert' : undefined} className='text-muted-foreground'>
          {errorMessage || t9('common.notFound', lang)}
        </p>
      </div>
    )
  }

  const gradientClass = course.cover && (course.cover.startsWith('from-') || course.cover.startsWith('gradient-')) ? course.cover : 'gradient-teal'
  const hasCustomCover = course.cover?.startsWith('data:')
  const categoryDisplay = translateCategory(course.category || '', lang) || t9('detail.generalTraining', lang)
  const presentationCount = course.lessons.reduce((count, lesson) => count + lesson.presentations.length, 0)
  const completedIds = new Set(course.completedLessonIds)
  const enrolledCount = course.enrollmentCount ?? course.studentCount ?? 0
  const completedCount = course.lessons.filter(l => completedIds.has(l.id)).length
  const isAllCompleted = course.lessons.length > 0 && completedCount === course.lessons.length
  const viewOnly = isInstructor()

  // Determine which lessons are locked (sequential: lesson N locked if lesson N-1 not completed)
  const isLessonLocked = (idx: number): boolean => {
    if (viewOnly) return false
    if (completedIds.has(course.lessons[idx].id)) return false
    if (idx === 0) return false
    return !completedIds.has(course.lessons[idx - 1].id)
  }

  // Find the first uncompleted, unlocked lesson for starting/continuing
  const getNextLesson = (): string | null => {
    for (let lessonIndex = 0; lessonIndex < course.lessons.length; lessonIndex++) {
      if (!completedIds.has(course.lessons[lessonIndex].id) && !isLessonLocked(lessonIndex)) {
        return course.lessons[lessonIndex].id
      }
    }
    return null
  }

  const handleStartTraining = async () => {
    const nextLessonId = getNextLesson()
    if (!nextLessonId || !user) return
    setIsEnrolling(true)
    setErrorMessage('')
    try {
      await apiRequest(`/api/courses/${course.id}/enroll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      })
      navigateToLesson(course.id, nextLessonId)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to start this course.')
    } finally {
      setIsEnrolling(false)
    }
  }

  const handleBookmark = async () => {
    if (!user || user.role !== 'employee' || isUpdatingBookmark) return
    const nextBookmarkedState = !course.isBookmarked
    setIsUpdatingBookmark(true)
    setErrorMessage('')
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
      setCourse({ ...course, isBookmarked: nextBookmarkedState })
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to update bookmark.')
    } finally {
      setIsUpdatingBookmark(false)
    }
  }

  return (
    <div className='min-h-[calc(100vh-3.5rem)]'>
      <div className='bg-white border-b border-border/60 px-6 py-3'>
        <div className='max-w-5xl mx-auto flex items-center gap-2 text-sm'>
          <button onClick={navigateBack} className='flex items-center gap-1 text-muted-foreground hover:text-foreground'>
            <ArrowLeft className='size-3.5' /> {t9('detail.back', lang)}
          </button>
          <span className='text-border'>/</span>
          <button onClick={() => navigateTo('home')} className='text-muted-foreground hover:text-foreground'>{t9('detail.dashboard', lang)}</button>
          <span className='text-border'>/</span>
          <button onClick={() => navigateTo('courses')} className='text-muted-foreground hover:text-foreground'>{t9('detail.catalog', lang)}</button>
          <span className='text-border'>/</span>
          <span className='font-medium text-foreground truncate max-w-xs'>{course.title}</span>
        </div>
      </div>
      {errorMessage && (
        <div role='alert' className='mx-auto mt-4 max-w-5xl px-4 sm:px-6'>
          <p className='rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700'>{errorMessage}</p>
        </div>
      )}
      <div className='bg-white border-b border-border/60'>
        <div className='max-w-5xl mx-auto p-6'>
          <div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
            <div className={cn('relative rounded-xl overflow-hidden h-44 lg:h-full min-h-[160px]', gradientClass)}>
              {hasCustomCover && <img src={course.cover!} alt={`${course.title} cover`} className='absolute inset-0 w-full h-full object-cover' />}
              <div className='absolute inset-0 bg-black/10' />
              <div className='absolute top-3 left-3'>
                <span className='text-xs font-medium text-white bg-white/20 backdrop-blur-sm px-2 py-1 rounded-md'>{categoryDisplay}</span>
              </div>
              <div className='absolute bottom-3 left-3'>
                <p className='text-[11px] text-white/80'>{course.lessons.length} {t9('detail.lessons', lang)} · {presentationCount} {t9('detail.presentations', lang)}</p>
              </div>
            </div>
            <div className='lg:col-span-2 flex flex-col justify-center'>
              <div className='flex items-center gap-2 mb-2'>
                <Tag className='size-3.5 text-muted-foreground' />
                <span className='text-xs text-muted-foreground font-medium uppercase tracking-wider'>{categoryDisplay}</span>
              </div>
              <h1 className='text-2xl font-bold text-foreground mb-3'>{course.title}</h1>
              {course.description && <p className='text-sm text-muted-foreground mb-4 line-clamp-2'>{translateDescription(course.description, lang)}</p>}
              <div className='flex items-center gap-4 text-sm text-muted-foreground mb-6'>
                <span className='flex items-center gap-1.5'><BookOpen className='size-3.5' />{course.lessons.length} {t9('detail.lessons', lang)}</span>
                <span className='flex items-center gap-1.5'><Users className='size-3.5' />{enrolledCount} {t9('detail.enrolled', lang)}</span>
                {presentationCount > 0 && <span className='flex items-center gap-1.5'><FileDown className='size-3.5' />{presentationCount} {t9('detail.presentations', lang)}</span>}
                <span className='flex items-center gap-1.5'><Calendar className='size-3.5' />{formatDate(course.createdAt, lang)}</span>
              </div>
              {completedCount > 0 && (
                <div className='mb-4'>
                  <div className='flex items-center justify-between text-xs mb-1.5'>
                    <span className='text-muted-foreground'>{t9('detail.progress', lang)}</span>
                    <span className='font-medium text-foreground'>{completedCount}/{course.lessons.length} {t9('detail.lessonsCompleted', lang)}</span>
                  </div>
                  <div className='h-1.5 bg-muted rounded-full overflow-hidden'>
                    <div className='h-full bg-emerald-500 rounded-full transition-all' style={{ width: `${course.lessons.length > 0 ? (completedCount / course.lessons.length) * 100 : 0}%` }} />
                  </div>
                </div>
              )}
              <div className='flex items-center gap-3'>
                {viewOnly ? (
                  <div className='flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-100 border border-slate-200 text-slate-500 text-sm font-medium'>
                    <BarChart3 className='size-4' /> {t9('detail.instructorView', lang)}
                  </div>
                ) : isAllCompleted ? (
                  <div className='flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-medium'>
                    <CheckCircle2 className='size-4' /> {t9('detail.moduleCompleted', lang)}
                  </div>
                ) : (
                  <Button onClick={handleStartTraining} disabled={isEnrolling} className='bg-slate-900 hover:bg-slate-800 text-white'>
                    <Play className='size-4' />{isEnrolling ? t9('detail.starting', lang) : completedCount > 0 ? t9('detail.continueTraining', lang) : t9('detail.startTraining', lang)}
                  </Button>
                )}
                {user?.role === 'employee' && (
                  <Button
                    variant='outline'
                    onClick={handleBookmark}
                    disabled={isUpdatingBookmark}
                    aria-pressed={course.isBookmarked}
                    className={cn('border-slate-200', course.isBookmarked && 'bg-slate-900 text-white hover:bg-slate-800 hover:text-white')}
                  >
                    {isUpdatingBookmark
                      ? <Loader2 className='size-4 animate-spin' />
                      : <Bookmark className={cn('size-4', course.isBookmarked && 'fill-current')} />}
                    {course.isBookmarked ? t9('card.bookmarked', lang) : t9('card.bookmark', lang)}
                  </Button>
                )}
                {viewOnly && (
                  <Button
                    variant='outline'
                    onClick={() => {
                      const nextShowProgress = !showProgress
                      setShowProgress(nextShowProgress)
                      if (nextShowProgress) {
                        setProgressData(null)
                        setIsLoadingProgress(true)
                      }
                    }}
                    aria-expanded={showProgress}
                    className='border-slate-200 text-slate-700 hover:bg-slate-50'
                  >
                    <BarChart3 className='size-4' />
                    {showProgress ? t9('detail.hideProgress', lang) : t9('detail.employeeProgress', lang)}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Employee Progress Panel (Instructor only) */}
      {viewOnly && showProgress && (
        <div className='max-w-5xl mx-auto px-6 pt-4'>
          <div className='bg-white rounded-xl border border-border/60 overflow-hidden'>
            <div className='px-5 py-3 border-b border-border/60'>
              <h3 className='text-sm font-semibold text-foreground flex items-center gap-2'>
                <Users className='size-4' /> {t9('detail.employeeProgress', lang)}
              </h3>
            </div>
            {isLoadingProgress ? (
              <div className='p-8 flex justify-center'><Loader2 className='size-6 animate-spin text-muted-foreground' /></div>
            ) : progressData ? (
              <div>
                <div className='grid grid-cols-3 border-b border-border/40'>
                  <div className='px-5 py-3 text-center border-r border-border/40'>
                    <p className='text-lg font-bold text-foreground'>{progressData.summary.totalEnrolled}</p>
                    <p className='text-[10px] text-muted-foreground'>{t9('detail.enrolled', lang)}</p>
                  </div>
                  <div className='px-5 py-3 text-center border-r border-border/40'>
                    <p className='text-lg font-bold text-emerald-600'>{progressData.summary.totalCompleted}</p>
                    <p className='text-[10px] text-muted-foreground'>{t9('detail.completed', lang)}</p>
                  </div>
                  <div className='px-5 py-3 text-center'>
                    <p className='text-lg font-bold text-foreground'>{progressData.summary.avgProgress}%</p>
                    <p className='text-[10px] text-muted-foreground'>{t9('learning.avgProgress', lang)}</p>
                  </div>
                </div>
                {progressData.enrollments.length === 0 ? (
                  <div className='p-8 text-center'>
                    <Users className='size-8 mx-auto text-muted-foreground/20 mb-2' />
                    <p className='text-sm text-muted-foreground'>{t9('detail.noEmployeeEnrollments', lang)}</p>
                  </div>
                ) : (
                  <div className='max-h-64 overflow-y-auto custom-scrollbar'>
                    {progressData.enrollments.map((learnerProgress) => (
                      <div key={learnerProgress.userId} className='flex items-center gap-4 px-5 py-3 border-b border-border/30 last:border-b-0 hover:bg-muted/20'>
                        <div className='size-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600 shrink-0'>
                          {learnerProgress.userName?.[0] || 'U'}
                        </div>
                        <div className='flex-1 min-w-0'>
                          <p className='text-sm font-medium text-foreground truncate'>{learnerProgress.userName}</p>
                          <p className='text-[11px] text-muted-foreground truncate'>{learnerProgress.userEmail}</p>
                        </div>
                        <div className='flex items-center gap-3 shrink-0'>
                          <span className='text-xs text-muted-foreground'>{learnerProgress.completedLessons}/{learnerProgress.totalLessons}</span>
                          <div className='w-20 h-1.5 bg-muted rounded-full overflow-hidden' role='progressbar' aria-valuemin={0} aria-valuemax={100} aria-valuenow={learnerProgress.progressPercent}>
                            <div
                              className={cn('h-full rounded-full transition-all',
                                learnerProgress.progressPercent >= 100 ? 'bg-emerald-500' : learnerProgress.progressPercent > 0 ? 'bg-amber-500' : 'bg-slate-300'
                              )}
                              style={{ width: `${learnerProgress.progressPercent}%` }}
                            />
                          </div>
                          <span className={cn(
                            'text-xs font-semibold w-10 text-right',
                            learnerProgress.progressPercent >= 100 ? 'text-emerald-600' : 'text-foreground'
                          )}>{learnerProgress.progressPercent}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      )}

      <div className='max-w-5xl mx-auto p-6'>
        <div className='flex items-center gap-2 mb-4'>
          <Clock className='size-4 text-muted-foreground' />
          <h2 className='text-base font-bold text-foreground'>{t9('detail.moduleContent', lang)}</h2>
          {completedCount > 0 && (
            <span className='text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full font-medium'>{completedCount}/{course.lessons.length}</span>
          )}
        </div>
        <div className='bg-white rounded-xl border border-border/60 overflow-hidden'>
          {course.lessons.map((lesson, idx) => {
            const isExpanded = expandedLesson === lesson.id
            const isDone = completedIds.has(lesson.id)
            const isLocked = isLessonLocked(idx)
            return (
              <div key={lesson.id} className='border-b border-border/40 last:border-b-0'>
                <button
                  type='button'
                  onClick={() => { if (!isLocked) setExpandedLesson(isExpanded ? null : lesson.id) }}
                  disabled={isLocked}
                  aria-expanded={isExpanded}
                  className={cn(
                    'w-full flex items-center gap-3 px-5 py-4 transition-colors text-left cursor-pointer',
                    isLocked ? 'opacity-60 cursor-not-allowed' : 'hover:bg-muted/30'
                  )}
                >
                  {isDone ? (
                    <div className='size-7 rounded-md bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0'>
                      <CheckCircle2 className='size-4' />
                    </div>
                  ) : isLocked ? (
                    <div className='size-7 rounded-md bg-slate-100 text-slate-400 flex items-center justify-center shrink-0'>
                      <Lock className='size-4' />
                    </div>
                  ) : (
                    <span className={cn(
                      'size-7 rounded-md flex items-center justify-center text-xs font-bold shrink-0',
                      'bg-slate-100 text-slate-600'
                    )}>{idx + 1}</span>
                  )}
                  <div className='flex-1 min-w-0'>
                    <span className={cn(
                      'text-sm font-medium block truncate',
                      isDone ? 'text-emerald-700' : isLocked ? 'text-slate-400' : 'text-foreground'
                    )}>{lesson.title}</span>
                    {lesson.description && (
                      <span className='mt-1 line-clamp-2 text-xs text-muted-foreground'>{lesson.description}</span>
                    )}
                    <div className='flex items-center gap-3 mt-0.5'>
                      <span className='text-[11px] text-emerald-600 flex items-center gap-0.5'>
                        <FileDown className='size-3' />{lesson.presentations.length} {t9('detail.presentations', lang)}
                      </span>
                      {isDone && <span className='text-[11px] text-emerald-600 font-medium'>{t9('detail.completed', lang)}</span>}
                      {isLocked && <span className='text-[11px] text-slate-400 font-medium'>{t9('detail.locked', lang)}</span>}
                    </div>
                  </div>
                  {idx === 0 && !isDone && !isLocked && <span className='text-[10px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded shrink-0'>{t9('common.startHere', lang)}</span>}
                  {isLocked && <span className='text-[10px] font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded shrink-0'>{t9('detail.completePreviousFirst', lang)}</span>}
                  {!isLocked && (isExpanded ? <ChevronUp className='size-4 text-muted-foreground shrink-0' /> : <ChevronDown className='size-4 text-muted-foreground shrink-0' />)}
                </button>
                {isExpanded && (
                  <div className='px-5 pb-4 pl-15 flex flex-wrap items-center gap-2'>
                    <Button size='sm' className='bg-slate-900 hover:bg-slate-800 text-white' onClick={() => navigateToLesson(course.id, lesson.id)}>
                      {viewOnly ? <><Eye className='size-3' /> {t9('detail.viewLesson', lang)}</> : isDone ? <><CheckCircle2 className='size-3' /> {t9('detail.reviewLesson', lang)}</> : <><Play className='size-3' /> {t9('detail.startLesson', lang)}</>}
                    </Button>
                    {lesson.presentations.map((presentation) => (
                      <Button key={presentation.id} asChild variant='outline' size='sm'>
                        <a href={presentation.filePath} download title={presentation.fileName}>
                          <FileDown className='size-3' />
                          <span className='max-w-44 truncate'>{presentation.fileName}</span>
                        </a>
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
