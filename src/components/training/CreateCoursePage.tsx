'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useAppStore } from '@/store/app-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ArrowLeft, ImagePlus, Plus, FileText, X, Loader2, Save, FileDown, Trash2, Globe, Lock, Pencil, ChevronUp, ChevronDown, Sparkles } from 'lucide-react'
import AddSectionModal from './AddSectionModal'
import { AiModuleGeneratorView } from './AiModuleGeneratorView'
import { cn } from '@/lib/utils'
import { t9, type Lang } from '@/lib/i18n'
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

interface LessonItem {
  id: string
  title: string
  description: string | null
  order: number
  presentations: Array<{ id: string; fileName: string; filePath: string; order: number }>
}

export function CreateCoursePage() {
  const navigateBack = useAppStore((s) => s.navigateBack)
  const editorCourseId = useAppStore((s) => s.editorCourseId)
  const setEditorCourseId = useAppStore((s) => s.setEditorCourseId)
  const editorCover = useAppStore((s) => s.editorCover)
  const setEditorCover = useAppStore((s) => s.setEditorCover)
  const editorTitle = useAppStore((s) => s.editorTitle)
  const setEditorTitle = useAppStore((s) => s.setEditorTitle)
  const editorSaved = useAppStore((s) => s.editorSaved)
  const setEditorSaved = useAppStore((s) => s.setEditorSaved)
  const addSectionOpen = useAppStore((s) => s.addSectionOpen)
  const setAddSectionOpen = useAppStore((s) => s.setAddSectionOpen)
  const user = useAppStore((s) => s.user)
  const lang = useAppStore((s) => s.lang) as Lang
  const currentPage = useAppStore((s) => s.currentPage)

  const [saving, setSaving] = useState(false)
  const [lessons, setLessons] = useState<LessonItem[]>([])
  const [loadingLessons, setLoadingLessons] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [courseStatus, setCourseStatus] = useState<string>('draft')
  const [deletingLesson, setDeletingLesson] = useState<string | null>(null)
  const [publishing, setPublishing] = useState(false)
  const [updatingMeta, setUpdatingMeta] = useState(false)
  const [initialLoadDone, setInitialLoadDone] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const [showRemoveDialog, setShowRemoveDialog] = useState(false)
  const [removingModule, setRemovingModule] = useState(false)
  const [creationMode, setCreationMode] = useState<'manual' | 'ai'>(currentPage === 'ai-generate' ? 'ai' : 'manual')

  useEffect(() => {
    if (currentPage === 'ai-generate') setCreationMode('ai')
    else if (currentPage === 'create-course') setCreationMode('manual')
  }, [currentPage])

  const setEditLesson = useAppStore((s) => s.setEditLesson)
  const editLesson = useAppStore((s) => s.editLesson)
  const [reorderingId, setReorderingId] = useState<string | null>(null)

  const fetchCourseData = useCallback(async () => {
    if (!editorCourseId) return
    setLoadingLessons(true)
    try {
      const res = await fetch(`/api/courses/${editorCourseId}`)
      const data = await res.json()
      const course = data.course
      if (course) {
        setLessons(course.lessons || [])
        setCourseStatus(course.status || 'draft')
        if (!initialLoadDone) {
          setEditorTitle(course.title || '')
          setEditorCover(course.cover || null)
          setEditorSaved(true)
          setInitialLoadDone(true)
        }
      }
    } catch { /* ignore */ }
    setLoadingLessons(false)
  }, [editorCourseId, setEditorTitle, setEditorCover, setEditorSaved, initialLoadDone])

  useEffect(() => {
    if (!editorCourseId) return
    const loadTimer = window.setTimeout(() => { void fetchCourseData() }, 0)
    return () => window.clearTimeout(loadTimer)
  }, [editorCourseId, fetchCourseData])

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (ev) => setEditorCover(ev.target?.result as string)
      reader.readAsDataURL(file)
    }
  }

  const handleSave = async () => {
    if (!editorTitle.trim() || !user) { setSaveError(t9('create.enterTitle', lang)); return }
    setSaving(true); setSaveError('')
    try {
      const res = await fetch('/api/courses/create', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: editorTitle, cover: editorCover || 'gradient-teal', userId: user.id }),
      })
      const data = await res.json()
      if (!res.ok) { setSaveError(data.error || t9('create.failedSave', lang)); return }
      if (data.course?.id) { setEditorCourseId(data.course.id); setEditorSaved(true) }
    } catch { setSaveError(t9('create.failedSave', lang)) }
    finally { setSaving(false) }
  }

  const handleUpdateMeta = async () => {
    if (!editorCourseId || !user) return
    setUpdatingMeta(true)
    try {
      const res = await fetch(`/api/courses/${editorCourseId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: editorTitle, cover: editorCover }),
      })
      if (res.ok) { setEditorSaved(true); setSaveError('') }
      else { const data = await res.json(); setSaveError(data.error || t9('create.failedUpdate', lang)) }
    } catch { setSaveError(t9('create.failedUpdate', lang)) }
    finally { setUpdatingMeta(false) }
  }

  const handleDeleteLesson = async (lessonId: string) => {
    setDeletingLesson(lessonId)
    try {
      const res = await fetch(`/api/lessons/${lessonId}`, { method: 'DELETE' })
      if (res.ok) fetchCourseData()
    } catch { /* ignore */ }
    setDeletingLesson(null)
  }

  const handlePublish = async () => {
    if (!editorCourseId) return
    setPublishing(true)
    try {
      const res = await fetch(`/api/courses/${editorCourseId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'published' }),
      })
      if (res.ok) { setCourseStatus('published') }
      else { const data = await res.json(); alert(data.error || t9('error.failedPublish', lang)) }
    } catch { /* ignore */ }
    setPublishing(false)
  }

  const handleRemoveModule = async () => {
    if (!editorCourseId) return
    setRemovingModule(true)
    try {
      const res = await fetch(`/api/courses/${editorCourseId}`, { method: 'DELETE' })
      if (res.ok) {
        setEditorCourseId(null); setEditorTitle(''); setEditorCover(null); setEditorSaved(false)
        setShowRemoveDialog(false); navigateBack()
      } else { const data = await res.json(); alert(data.error || t9('courses.remove', lang)) }
    } catch { alert(t9('create.failedSave', lang)) }
    setRemovingModule(false)
  }

  const openEditLesson = (lesson: LessonItem) => {
    setEditLesson({
      id: lesson.id,
      title: lesson.title,
      description: lesson.description ?? '',
      presentations: lesson.presentations,
    })
    setAddSectionOpen(true)
  }

  const handleSectionSaved = () => { fetchCourseData() }

  const handleReorder = async (lessonId: string, direction: 'up' | 'down') => {
    setReorderingId(lessonId)
    try {
      const res = await fetch(`/api/lessons/${lessonId}/reorder`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ direction }),
      })
      if (res.ok) fetchCourseData()
    } catch { /* ignore */ }
    setReorderingId(null)
  }

  const isEditing = editorSaved && editorCourseId && initialLoadDone

  return (
    <div className='min-h-[calc(100vh-3.5rem)] bg-gray-50/50'>
      <div className='max-w-6xl mx-auto p-6'>
        <div className='flex items-center gap-3 mb-6'>
          <button onClick={navigateBack} className='flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors'>
            <ArrowLeft className='size-4' /> {t9('create.back', lang)}
          </button>
          <div className='h-4 w-px bg-border' />
          <h1 className='text-lg font-bold text-foreground'>{isEditing ? t9('create.editTitle', lang) : t9('create.title', lang)}</h1>
          {editorSaved && (
            courseStatus === 'published' ? (
              <span className='flex items-center gap-1 text-[10px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded'>
                <Globe className='size-3' /> {t9('courses.published', lang)}
              </span>
            ) : (
              <span className='flex items-center gap-1 text-[10px] font-medium text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded'>
                <Lock className='size-3' /> {t9('courses.draft', lang)}
              </span>
            )
          )}
        </div>

        {!isEditing && (
          <div className='mb-6 bg-slate-200/50 p-1 rounded-lg inline-flex'>
            <button
              onClick={() => setCreationMode('manual')}
              className={cn(
                'px-4 py-1.5 text-sm font-medium rounded-md transition-colors',
                creationMode === 'manual' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              )}
            >
              Manual Creation
            </button>
            <button
              onClick={() => setCreationMode('ai')}
              className={cn(
                'px-4 py-1.5 text-sm font-medium rounded-md transition-colors flex items-center gap-1.5',
                creationMode === 'ai' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-600 hover:text-emerald-700'
              )}
            >
              <Sparkles className='size-3.5' /> Generate with AI
            </button>
          </div>
        )}

        {creationMode === 'ai' ? (
          <AiModuleGeneratorView />
        ) : (
          <>
            <div className='grid grid-cols-1 lg:grid-cols-5 gap-6'>
          <div className='lg:col-span-2 space-y-5'>
            <div className='bg-white rounded-xl border border-border/60 p-5'>
              <h3 className='text-sm font-semibold text-foreground mb-3'>{t9('create.moduleCover', lang)}</h3>
              {editorCover ? (
                <div className='relative rounded-lg overflow-hidden h-44'>
                  {editorCover.startsWith('data:') ? (
                    <img src={editorCover} alt='Cover' className='w-full h-full object-cover' />
                  ) : (
                    <div className={cn('w-full h-full', editorCover)} />
                  )}
                  <button onClick={() => setEditorCover(null)} className='absolute top-2 right-2 p-1.5 rounded-full bg-black/50 text-white hover:bg-black/70'><X className='size-4' /></button>
                </div>
              ) : (
                <button onClick={() => fileRef.current?.click()} className='w-full h-44 border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center gap-2 text-muted-foreground hover:border-slate-400 hover:text-foreground transition-colors'>
                  <ImagePlus className='size-8' />
                  <span className='text-sm'>{t9('create.uploadCover', lang)}</span>
                  <span className='text-xs text-muted-foreground'>{t9('create.coverSize', lang)}</span>
                </button>
              )}
              <input ref={fileRef} type='file' accept='image/*' onChange={handleFileUpload} className='hidden' />
            </div>

            <div className='bg-white rounded-xl border border-border/60 p-5'>
              <h3 className='text-sm font-semibold text-foreground mb-3'>{t9('create.moduleTitle', lang)}</h3>
              <Input placeholder={t9('create.titlePlaceholder', lang)} value={editorTitle} onChange={(e) => setEditorTitle(e.target.value)} />
            </div>

            <div className='space-y-2'>
              {isEditing ? (
                <Button onClick={handleUpdateMeta} disabled={updatingMeta || !editorTitle.trim()} className='w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white'>
                  {updatingMeta ? <Loader2 className='size-4 animate-spin' /> : <><Save className='size-4' /> {t9('create.updateModule', lang)}</>}
                </Button>
              ) : (
                <Button onClick={handleSave} disabled={saving || !editorTitle.trim() || editorSaved} className={cn('w-full py-2.5', editorSaved ? 'bg-slate-700 hover:bg-slate-800' : 'bg-slate-900 hover:bg-slate-800 text-white')}>
                  {saving ? <Loader2 className='size-4 animate-spin' /> : editorSaved ? <><Save className='size-4' /> {t9('create.saved', lang)}</> : <><Save className='size-4' /> {t9('create.save', lang)}</>}
                </Button>
              )}
              {saveError && <p className='text-xs text-red-500 mt-2 text-center'>{saveError}</p>}
              {!editorSaved && !saveError && <p className='text-xs text-center text-muted-foreground mt-1'>{t9('create.saveFirst', lang)}</p>}
              {editorSaved && courseStatus === 'draft' && (
                <Button onClick={handlePublish} disabled={publishing || lessons.length === 0} variant='outline' className='w-full py-2.5 text-emerald-700 border-emerald-200 hover:bg-emerald-50'>
                  {publishing ? <Loader2 className='size-4 animate-spin' /> : <><Globe className='size-4' /> {t9('create.publish', lang)}</>}
                </Button>
              )}
              {isEditing && (
                <Button onClick={() => setShowRemoveDialog(true)} variant='outline' className='w-full py-2.5 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 hover:border-red-300'>
                  <Trash2 className='size-4' /> {t9('create.removeModule', lang)}
                </Button>
              )}
            </div>
          </div>

          <div className='lg:col-span-3'>
            <div className='bg-white rounded-xl border border-border/60 overflow-hidden'>
              <div className='flex items-center justify-between px-5 py-3 border-b border-border/60'>
                <h3 className='text-sm font-semibold text-foreground'>{t9('create.lessonSections', lang)}</h3>
                <Button variant='outline' size='sm' onClick={() => setAddSectionOpen(true)} disabled={!editorSaved}>
                  <Plus className='size-3.5' /> {t9('create.addSection', lang)} ({lessons.length})
                </Button>
              </div>

              <div className='p-5'>
                {loadingLessons ? (
                  <div className='space-y-3'>{Array.from({ length: 3 }).map((_, i) => <div key={i} className='h-16 bg-muted/40 rounded-lg animate-pulse' />)}</div>
                ) : !editorSaved ? (
                  <div className='text-center py-16'>
                    <Save className='size-12 mx-auto text-muted-foreground/20 mb-3' />
                    <p className='text-sm text-muted-foreground font-medium'>{t9('create.saveFirst', lang)}</p>
                    <p className='text-xs text-muted-foreground mt-1'>{t9('create.saveFirstDesc', lang)}</p>
                  </div>
                ) : lessons.length === 0 ? (
                  <div className='text-center py-16'>
                    <FileText className='size-12 mx-auto text-muted-foreground/20 mb-3' />
                    <p className='text-sm text-muted-foreground font-medium'>{t9('create.noSections', lang)}</p>
                    <p className='text-xs text-muted-foreground mt-1'>{t9('create.noSectionsDesc', lang)}</p>
                  </div>
                ) : (
                  <div className='space-y-3 max-h-[500px] overflow-y-auto custom-scrollbar'>
                    {lessons.map((lesson, idx) => (
                      <div key={lesson.id} className='p-4 rounded-xl border border-border/40 bg-muted/20 hover:bg-muted/30 transition-all group'>
                        <div className='flex items-start gap-3'>
                          <div className='flex flex-col items-center gap-0.5 shrink-0 mt-0.5'>
                            <button aria-label={`Move ${lesson.title} up`} onClick={() => handleReorder(lesson.id, 'up')} disabled={idx === 0 || reorderingId === lesson.id} className='p-0.5 rounded hover:bg-slate-200 text-muted-foreground hover:text-slate-600 disabled:opacity-20 disabled:hover:bg-transparent transition-colors'><ChevronUp className='size-3.5' /></button>
                            <span className='size-7 rounded-md bg-slate-100 text-slate-600 flex items-center justify-center text-xs font-bold'>{idx + 1}</span>
                            <button aria-label={`Move ${lesson.title} down`} onClick={() => handleReorder(lesson.id, 'down')} disabled={idx === lessons.length - 1 || reorderingId === lesson.id} className='p-0.5 rounded hover:bg-slate-200 text-muted-foreground hover:text-slate-600 disabled:opacity-20 disabled:hover:bg-transparent transition-colors'><ChevronDown className='size-3.5' /></button>
                          </div>
                          <div className='flex-1 min-w-0'>
                            <p className='text-sm font-semibold text-foreground truncate'>{lesson.title}</p>
                            {lesson.description && (
                              <p className='mt-1 line-clamp-2 text-xs text-muted-foreground'>{lesson.description}</p>
                            )}
                            <div className='flex items-center gap-3 mt-2'>
                              <span className='text-[10px] text-emerald-600 flex items-center gap-1'>
                                <FileDown className='size-3' /> {lesson.presentations.length} {t9('detail.presentations', lang)}
                              </span>
                            </div>
                            {lesson.presentations.length > 0 && (
                              <div className='mt-2 flex flex-wrap gap-1.5'>
                                {lesson.presentations.map((presentation) => (
                                  <a
                                    key={presentation.id}
                                    href={presentation.filePath}
                                    download
                                    className='max-w-48 truncate rounded-md bg-emerald-50 px-2 py-1 text-[10px] font-medium text-emerald-700 hover:bg-emerald-100'
                                  >
                                    {presentation.fileName}
                                  </a>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className='flex items-center gap-1 shrink-0'>
                            <Button aria-label={`Edit ${lesson.title}`} variant='ghost' size='sm' className='opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-slate-900 hover:bg-slate-100' onClick={() => openEditLesson(lesson)}><Pencil className='size-3.5' /></Button>
                            <Button aria-label={`Delete ${lesson.title}`} variant='ghost' size='sm' className='opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-red-600 hover:bg-red-50' onClick={() => handleDeleteLesson(lesson.id)} disabled={deletingLesson === lesson.id}>
                              {deletingLesson === lesson.id ? <Loader2 className='size-3.5 animate-spin' /> : <Trash2 className='size-3.5' />}
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {editorCourseId && (
          <AddSectionModal
            key={`${addSectionOpen ? 'open' : 'closed'}:${editLesson?.id || 'new'}`}
            open={addSectionOpen}
            onOpenChange={setAddSectionOpen}
            courseId={editorCourseId}
            onSaved={handleSectionSaved}
          />
        )}

        <AlertDialog open={showRemoveDialog} onOpenChange={(open) => !open && setShowRemoveDialog(false)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t9('courses.removeTitle', lang)}</AlertDialogTitle>
              <AlertDialogDescription>
                {t9('courses.removeDesc', lang).replace('{title}', editorTitle)}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={removingModule}>{t9('addSection.cancel', lang)}</AlertDialogCancel>
              <AlertDialogAction onClick={handleRemoveModule} disabled={removingModule} className='bg-red-600 hover:bg-red-700 text-white'>
                {removingModule ? t9('courses.removing', lang) : t9('courses.remove', lang)}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
          </>
        )}
      </div>
    </div>
  )
}
