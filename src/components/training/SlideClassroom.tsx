'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  FileText,
  Flag,
  Layers3,
  Lock,
  Maximize2,
  Minimize2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PdfSlideDeck } from '@/components/training/PdfSlideDeck'
import { t9, type Lang } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store/app-store'

type LessonItem = { id: string; title: string; order: number }
type LessonPresentation = { id: string; fileName: string; filePath: string; order: number }

interface ClassroomLesson {
  id: string
  title: string
  description: string | null
  presentations: LessonPresentation[]
}

export function SlideClassroom() {
  const selectedCourseId = useAppStore((state) => state.selectedCourseId)
  const selectedLessonId = useAppStore((state) => state.selectedLessonId)
  const navigateToLesson = useAppStore((state) => state.navigateToLesson)
  const navigateToCourse = useAppStore((state) => state.navigateToCourse)
  const user = useAppStore((state) => state.user)
  const lang = useAppStore((state) => state.lang) as Lang
  const viewOnly = useAppStore((state) => state.isInstructor)()

  const [lesson, setLesson] = useState<ClassroomLesson | null>(null)
  const [allLessons, setAllLessons] = useState<LessonItem[]>([])
  const [currentLessonIndex, setCurrentLessonIndex] = useState(0)
  const [expandedDeckIds, setExpandedDeckIds] = useState<Set<string>>(new Set())
  const [fullscreen, setFullscreen] = useState(false)
  const [showLessonList, setShowLessonList] = useState(false)
  const [completedLessonIds, setCompletedLessonIds] = useState<Set<string>>(new Set())
  const [completing, setCompleting] = useState(false)
  const [courseFinished, setCourseFinished] = useState(false)
  const completedRef = useRef<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadCourse() {
      if (!selectedCourseId) return
      setLesson(null)
      setExpandedDeckIds(new Set())
      setCourseFinished(false)
      completedRef.current = null

      try {
        const userQuery = user?.id ? `?userId=${encodeURIComponent(user.id)}` : ''
        const response = await fetch(`/api/courses/${selectedCourseId}${userQuery}`)
        const data = await response.json()
        if (cancelled || !response.ok) return

        const lessons = (data.course.lessons ?? []).map((courseLesson: LessonItem) => ({
          id: courseLesson.id,
          title: courseLesson.title,
          order: courseLesson.order,
        }))
        const selectedLesson = data.course.lessons.find(
          (courseLesson: ClassroomLesson) => courseLesson.id === selectedLessonId,
        ) ?? null
        setAllLessons(lessons)
        setCurrentLessonIndex(Math.max(0, lessons.findIndex((courseLesson: LessonItem) => courseLesson.id === selectedLessonId)))
        setLesson(selectedLesson)
        setExpandedDeckIds(new Set(selectedLesson?.presentations[0] ? [selectedLesson.presentations[0].id] : []))
        setCompletedLessonIds(new Set(data.course.completedLessonIds ?? []))
      } catch {
        // Keep the classroom empty state visible when loading fails.
      }
    }

    void loadCourse()
    return () => { cancelled = true }
  }, [selectedCourseId, selectedLessonId, user?.id])

  const presentationCount = lesson?.presentations.length ?? 0
  const hasPreviousLesson = currentLessonIndex > 0
  const hasNextLesson = currentLessonIndex < allLessons.length - 1
  const isCurrentLessonCompleted = selectedLessonId ? completedLessonIds.has(selectedLessonId) : false

  const isPreviousLessonCompleted = useCallback(() => {
    if (viewOnly || currentLessonIndex === 0) return true
    const previousLesson = allLessons[currentLessonIndex - 1]
    return previousLesson ? completedLessonIds.has(previousLesson.id) : true
  }, [allLessons, completedLessonIds, currentLessonIndex, viewOnly])

  const completeCurrentLesson = useCallback(async () => {
    if (!selectedLessonId || !selectedCourseId || !user || completing || viewOnly || presentationCount === 0) return
    if (completedRef.current === selectedLessonId || !isPreviousLessonCompleted()) return

    completedRef.current = selectedLessonId
    setCompleting(true)
    try {
      const response = await fetch(`/api/lessons/${selectedLessonId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      })
      if (response.ok) {
        const data = await response.json()
        setCompletedLessonIds(new Set(data.completedLessonIds))
        setCourseFinished(Boolean(data.courseCompleted))
      } else {
        completedRef.current = null
      }
    } catch {
      completedRef.current = null
    } finally {
      setCompleting(false)
    }
  }, [completing, isPreviousLessonCompleted, presentationCount, selectedCourseId, selectedLessonId, user, viewOnly])

  function goToLesson(direction: 'next' | 'previous') {
    const targetIndex = direction === 'next' ? currentLessonIndex + 1 : currentLessonIndex - 1
    const targetLesson = allLessons[targetIndex]
    if (!targetLesson || !selectedCourseId) return
    if (!viewOnly && direction === 'next' && !isCurrentLessonCompleted) return
    completedRef.current = null
    navigateToLesson(selectedCourseId, targetLesson.id)
  }

  function toggleDeck(presentationId: string) {
    setExpandedDeckIds((currentIds) => {
      const nextIds = new Set(currentIds)
      if (nextIds.has(presentationId)) nextIds.delete(presentationId)
      else nextIds.add(presentationId)
      return nextIds
    })
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      void document.documentElement.requestFullscreen()
      setFullscreen(true)
    } else {
      void document.exitFullscreen()
      setFullscreen(false)
    }
  }

  return (
    <div className={fullscreen ? 'fixed inset-0 z-[100] flex flex-col bg-black' : 'min-h-[calc(100vh-3.5rem)] flex flex-col'}>
      <div className='h-11 shrink-0 bg-slate-900 px-4 flex items-center justify-between'>
        <div className='flex min-w-0 items-center gap-3'>
          {!fullscreen && <button onClick={() => selectedCourseId && navigateToCourse(selectedCourseId)} className='flex items-center gap-1 text-slate-400 hover:text-white'><ArrowLeft className='size-4' /><span className='hidden text-[11px] sm:inline'>{t9('classroom.backToModule', lang)}</span></button>}
          <div className='flex items-center gap-1.5'><div className='size-5 rounded bg-white/10 flex items-center justify-center'><Building2 className='size-3 text-white' /></div><span className='text-[11px] font-bold tracking-widest text-white'>LUMEN</span></div>
          <div className='h-3.5 w-px bg-slate-700' />
          <button onClick={() => setShowLessonList((isOpen) => !isOpen)} className='flex min-w-0 items-center gap-1.5 text-slate-300 hover:text-white'><span className='max-w-[140px] truncate text-xs sm:max-w-xs'>{lesson?.title}</span><ChevronDown className={cn('size-3.5 transition-transform', showLessonList && 'rotate-180')} /></button>
          <span className='hidden text-[10px] text-slate-600 sm:inline'>{currentLessonIndex + 1}/{allLessons.length}</span>
          {viewOnly && <span className='flex items-center gap-1 rounded bg-amber-900/40 px-2 py-0.5 text-[10px] font-medium text-amber-300'><Eye className='size-3' />{t9('classroom.viewMode', lang)}</span>}
        </div>
        <div className='flex items-center gap-3'><span className='text-[11px] text-slate-500'>{presentationCount} {t9('classroom.decks', lang)}</span><button onClick={toggleFullscreen} className='text-slate-400 hover:text-white' aria-label={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}>{fullscreen ? <Minimize2 className='size-3.5' /> : <Maximize2 className='size-3.5' />}</button></div>
      </div>

      {showLessonList && (
        <div className='max-h-48 overflow-y-auto border-b border-slate-700 bg-slate-800 px-4 py-2'>
          <div className='mx-auto max-w-3xl space-y-0.5'>{allLessons.map((courseLesson, index) => {
            const isCurrent = courseLesson.id === selectedLessonId
            const isDone = completedLessonIds.has(courseLesson.id)
            const isLocked = !viewOnly && index > 0 && !completedLessonIds.has(allLessons[index - 1].id) && !isDone
            return <button key={courseLesson.id} disabled={isLocked} onClick={() => { if (selectedCourseId) navigateToLesson(selectedCourseId, courseLesson.id); setShowLessonList(false) }} className={cn('w-full flex items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm', isCurrent ? 'bg-slate-700 text-white' : isLocked ? 'cursor-not-allowed text-slate-600 opacity-50' : 'text-slate-300 hover:bg-slate-700/50 hover:text-white')}>{isDone ? <CheckCircle2 className='size-4 shrink-0 text-emerald-400' /> : isLocked ? <Lock className='size-4 shrink-0' /> : <span className='size-4 shrink-0 text-center text-[10px]'>{index + 1}</span>}<span className='truncate'>{courseLesson.title}</span></button>
          })}</div>
        </div>
      )}

      <div className='relative flex flex-1 flex-col overflow-hidden bg-slate-950'>
        <main className='flex-1 overflow-y-auto p-4 lg:p-8'>
          <div className='mx-auto max-w-6xl'>
            <div className='mb-5'><h1 className='text-xl font-semibold text-white'>{lesson?.title}</h1>{lesson?.description && <p className='mt-1 max-w-3xl text-sm text-slate-400'>{lesson.description}</p>}</div>
            {presentationCount > 0 ? (
              <div className='mx-auto w-full max-w-[808px] space-y-3'>
                {lesson?.presentations.map((presentation, index) => {
                  const isExpanded = expandedDeckIds.has(presentation.id)
                  return (
                    <section key={presentation.id} className='overflow-hidden rounded-xl border border-slate-700 bg-slate-900'>
                      <div className='flex items-center gap-2 px-4 py-3'>
                        <button type='button' onClick={() => toggleDeck(presentation.id)} aria-expanded={isExpanded} className='flex min-w-0 flex-1 items-center gap-3 text-left'>
                          <span className='flex size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400'><Layers3 className='size-4' /></span>
                          <span className='min-w-0 flex-1'><span className='block text-[10px] font-medium uppercase tracking-wider text-slate-500'>{t9('classroom.deck', lang)} {index + 1}</span><span className='block truncate text-sm font-medium text-white'>{presentation.fileName}</span></span>
                          <ChevronDown className={cn('size-4 shrink-0 text-slate-400 transition-transform', isExpanded && 'rotate-180')} />
                        </button>
                        <a href={presentation.filePath} download title={t9('classroom.downloadPresentation', lang)} className='rounded-md p-2 text-slate-400 hover:bg-white/10 hover:text-white'><Download className='size-4' /></a>
                      </div>
                      {isExpanded && <div className='border-t border-slate-700 bg-slate-950/60 p-3 sm:p-5'><PdfSlideDeck presentationId={presentation.id} fileName={presentation.fileName} lang={lang} /></div>}
                    </section>
                  )
                })}
              </div>
            ) : (
              <div className='rounded-xl border border-dashed border-slate-700 bg-slate-900/60 p-8 text-center'><FileText className='mx-auto mb-3 size-10 text-slate-600' /><h2 className='text-base font-semibold text-white'>{t9('classroom.noPresentations', lang)}</h2><p className='mt-2 text-sm text-slate-400'>{t9('classroom.noPresentationsDescription', lang)}</p></div>
            )}
          </div>
        </main>

        <div className='shrink-0 border-t border-slate-800 bg-slate-900 px-4 py-3'><div className='mx-auto flex max-w-6xl items-center justify-between gap-3'>
          <div>{hasPreviousLesson && <button onClick={() => goToLesson('previous')} className='flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:bg-white/10 hover:text-white'><ChevronLeft className='size-3.5' />{t9('classroom.previous', lang)}</button>}</div>
          <div className='flex items-center gap-2'>
            {!isCurrentLessonCompleted && !viewOnly && <button onClick={completeCurrentLesson} disabled={completing || !isPreviousLessonCompleted() || presentationCount === 0} className='flex items-center gap-1.5 rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-slate-600 disabled:text-slate-300'>{!isPreviousLessonCompleted() ? <Lock className='size-3.5' /> : <Flag className='size-3.5' />}{completing ? t9('classroom.finishing', lang) : t9('classroom.finish', lang)}</button>}
            {hasNextLesson && (viewOnly || isCurrentLessonCompleted) && <button onClick={() => goToLesson('next')} className='flex items-center gap-1 rounded-md bg-white px-3 py-1.5 text-xs font-medium text-slate-900 hover:bg-slate-100'>{t9('classroom.nextLesson', lang)}<ChevronRight className='size-3.5' /></button>}
          </div>
        </div></div>

        {courseFinished && <div className='absolute inset-0 z-30 flex flex-col items-center justify-center bg-emerald-500/95 text-white'><CheckCircle2 className='mb-4 size-16' /><h2 className='text-2xl font-bold'>{t9('classroom.moduleCompleted', lang)}</h2><p className='mb-6 mt-2 text-sm opacity-90'>{t9('classroom.completedMsg', lang)}</p><Button onClick={() => selectedCourseId && navigateToCourse(selectedCourseId)} className='bg-white text-emerald-700 hover:bg-emerald-50'>{t9('classroom.backToModule', lang)}</Button></div>}
      </div>
    </div>
  )
}
