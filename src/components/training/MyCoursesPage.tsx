'use client'

import { useEffect, useState } from 'react'
import { useAppStore } from '@/store/app-store'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { apiRequest } from '@/lib/api-client'
import type { InstructorCourseSummary, InstructorCoursesResponse } from '@/features/courses/types'
import { Plus, Eye, Clock, PenSquare, Trash2, Globe, Lock, Pencil } from 'lucide-react'
import { t9, translateCategory, formatDate, type Lang } from '@/lib/i18n'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

export function MyCoursesPage() {
  const navigateTo = useAppStore((s) => s.navigateTo)
  const navigateToCourse = useAppStore((s) => s.navigateToCourse)
  const setEditorCourseId = useAppStore((s) => s.setEditorCourseId)
  const setEditorTitle = useAppStore((s) => s.setEditorTitle)
  const setEditorCover = useAppStore((s) => s.setEditorCover)
  const setEditorSaved = useAppStore((s) => s.setEditorSaved)
  const user = useAppStore((s) => s.user)
  const language = useAppStore((state) => state.lang) as Lang

  const handleNewModule = () => {
    useAppStore.getState().resetEditorState()
    navigateTo('create-course')
  }
  const [courses, setCourses] = useState<InstructorCourseSummary[]>([])
  const [usedCourseCount, setUsedCourseCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [deleteTarget, setDeleteTarget] = useState<InstructorCourseSummary | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [publishingCourseId, setPublishingCourseId] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    if (!user) return
    const abortController = new AbortController()
    apiRequest<InstructorCoursesResponse>(`/api/my-courses?userId=${encodeURIComponent(user.id)}`, {
      signal: abortController.signal,
    })
      .then((coursesResponse) => {
        setCourses(coursesResponse.courses)
        setUsedCourseCount(coursesResponse.used)
        setErrorMessage('')
      })
      .catch((error: unknown) => {
        if (abortController.signal.aborted) return
        setErrorMessage(error instanceof Error ? error.message : 'Unable to load your modules.')
      })
      .finally(() => {
        if (!abortController.signal.aborted) setIsLoading(false)
      })
    return () => abortController.abort()
  }, [user])

  const handleDelete = async () => {
    if (!deleteTarget) return
    setIsDeleting(true)
    setErrorMessage('')
    try {
      await apiRequest(`/api/courses/${deleteTarget.id}`, { method: 'DELETE' })
      setCourses((currentCourses) => currentCourses.filter((course) => course.id !== deleteTarget.id))
      setUsedCourseCount((currentCount) => Math.max(0, currentCount - 1))
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to remove this module.')
    } finally {
      setIsDeleting(false)
      setDeleteTarget(null)
    }
  }

  const handlePublish = async (courseId: string) => {
    setPublishingCourseId(courseId)
    setErrorMessage('')
    try {
      await apiRequest(`/api/courses/${courseId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'published' }),
      })
      setCourses((currentCourses) => currentCourses.map((course) => (
        course.id === courseId ? { ...course, status: 'published' } : course
      )))
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t9('error.failedPublish', language))
    } finally {
      setPublishingCourseId(null)
    }
  }

  return (
    <div className='min-h-[calc(100vh-3.5rem)] bg-gray-50/50'>
      <div className='max-w-5xl mx-auto p-4 sm:p-6'>
        <div className='flex items-center justify-between mb-6'>
          <div>
            <h1 className='text-lg font-bold text-foreground'>{t9('courses.title', language)}</h1>
            <p className='text-xs text-muted-foreground mt-0.5'>{t9('courses.subtitle', language)} ({usedCourseCount})</p>
          </div>
          <Button
            onClick={handleNewModule}
            className='bg-slate-900 hover:bg-slate-800 text-white'
          >
            <PenSquare className='size-4' />
            {t9('courses.newModule', language)}
          </Button>
        </div>

        {errorMessage && <p role='alert' className='mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700'>{errorMessage}</p>}

        {isLoading ? (
          <div className='space-y-3'>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className='h-20 bg-muted/40 rounded-xl animate-pulse' />
            ))}
          </div>
        ) : courses.length === 0 ? (
          <div className='bg-white rounded-xl border border-border/60 p-12 text-center'>
            <PenSquare className='size-10 mx-auto text-muted-foreground/30 mb-3' />
            <p className='text-sm text-muted-foreground'>{t9('courses.noModules', language)}</p>
            <Button onClick={handleNewModule} variant='outline' className='mt-4'>
              <Plus className='size-4' />
              {t9('courses.createFirst', language)}
            </Button>
          </div>
        ) : (
          <div className='space-y-3'>
            {courses.map((course) => (
              <div
                key={course.id}
                className='group flex flex-col gap-4 rounded-xl border border-border/60 bg-white p-4 transition-shadow hover:shadow-sm sm:flex-row sm:items-center sm:justify-between'
              >
                <div className='flex items-center gap-3'>
                  <div className='w-10 h-10 rounded-lg shrink-0 overflow-hidden'>
                    {course.cover?.startsWith('data:') ? (
                      <img src={course.cover} alt={`${course.title} cover`} className='w-full h-full object-cover' />
                    ) : (
                      <div className={cn('w-full h-full', course.cover || 'gradient-slate')} />
                    )}
                  </div>
                  <div>
                    <div className='flex items-center gap-2'>
                      <h3 className='text-sm font-semibold text-foreground'>{course.title}</h3>
                      {course.status === 'published' ? (
                        <span className='flex items-center gap-1 text-[10px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded'>
                          <Globe className='size-3' /> {t9('courses.published', language)}
                        </span>
                      ) : (
                        <span className='flex items-center gap-1 text-[10px] font-medium text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded'>
                          <Lock className='size-3' /> {t9('courses.draft', language)}
                        </span>
                      )}
                    </div>
                    <div className='mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground'>
                      <span>{course.lessonCount} {t9('courses.sections', language)}</span>
                      <span>{course.studentCount} {t9('courses.enrolled', language)}</span>
                      <span className='flex items-center gap-1'>
                        <Clock className='size-3' />
                        {formatDate(course.createdAt, language)}
                      </span>
                      <span className='text-[10px] bg-muted px-1.5 py-0.5 rounded'>{translateCategory(course.category, language)}</span>
                    </div>
                  </div>
                </div>
                <div className='flex w-full items-center justify-end gap-1.5 sm:w-auto sm:shrink-0'>
                  <Button
                    variant='ghost'
                    size='sm'
                    onClick={() => { setEditorCourseId(course.id); setEditorTitle(course.title); setEditorCover(course.cover); setEditorSaved(true); navigateTo('create-course') }}
                    aria-label={`Edit ${course.title}`}
                    className='text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  >
                    <Pencil className='size-3.5' />
                  </Button>
                  {course.status === 'draft' && (
                    <Button
                      variant='ghost'
                      size='sm'
                      onClick={() => handlePublish(course.id)}
                      disabled={publishingCourseId === course.id}
                      className='text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50'
                    >
                      {publishingCourseId === course.id ? <span className='size-3.5 border-2 border-emerald-300 border-t-emerald-600 rounded-full animate-spin' /> : <Globe className='size-3.5' />}
                      {t9('courses.publish', language)}
                    </Button>
                  )}
                  <Button variant='ghost' size='sm' onClick={() => navigateToCourse(course.id)} className='text-muted-foreground hover:text-foreground' aria-label={`View ${course.title}`}>
                    <Eye className='size-3.5' />
                  </Button>
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={() => setDeleteTarget(course)}
                    className='text-red-600 border-red-200 hover:text-red-700 hover:bg-red-50 hover:border-red-300'
                  >
                    <Trash2 className='size-3.5' />
                    <span className='ml-1 hidden sm:inline'>{t9('courses.remove', language)}</span>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t9('courses.removeTitle', language)}</AlertDialogTitle>
            <AlertDialogDescription>
              {t9('courses.removeDesc', language).replace('{title}', deleteTarget?.title || '')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>{t9('addSection.cancel', language)}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className='bg-red-600 hover:bg-red-700 text-white'
            >
              {isDeleting ? t9('courses.removing', language) : t9('courses.remove', language)}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
