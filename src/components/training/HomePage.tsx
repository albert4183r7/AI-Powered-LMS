'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAppStore, type CourseData } from '@/store/app-store'
import { CourseCard } from './CourseCard'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Search, BookOpen, PenSquare, BarChart3, Tag, Sparkles, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { t9, translateCategory, type Lang } from '@/lib/i18n'

type CategoryInfo = { name: string; count: number }

export function HomePage() {
  const homeTab = useAppStore((s) => s.homeTab)
  const setHomeTab = useAppStore((s) => s.setHomeTab)
  const navigateTo = useAppStore((s) => s.navigateTo)
  const setEditorTitle = useAppStore((s) => s.setEditorTitle)
  const setEditorCover = useAppStore((s) => s.setEditorCover)
  const setEditorSaved = useAppStore((s) => s.setEditorSaved)
  const setEditorCourseId = useAppStore((s) => s.setEditorCourseId)
  const setAiGenerationPrompt = useAppStore((s) => s.setAiGenerationPrompt)
  const isInstructor = useAppStore((s) => s.isInstructor)
  const user = useAppStore((s) => s.user)
  const userId = user?.id
  const lang = useAppStore((s) => s.lang) as Lang

  const [localSearch, setLocalSearch] = useState('')
  const [courses, setCourses] = useState<CourseData[]>([])
  const [categories, setCategories] = useState<CategoryInfo[]>([])
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [loading, setLoading] = useState(true)
  const [aiPrompt, setAiPrompt] = useState('')
  const [aiPromptError, setAiPromptError] = useState('')

  const openAiGenerator = () => {
    const normalizedPrompt = aiPrompt.trim()
    if (normalizedPrompt.length < 20) {
      setAiPromptError(t9('home.aiPromptMinimum', lang))
      return
    }
    setAiGenerationPrompt(normalizedPrompt)
    navigateTo('ai-generate')
  }

  const fetchCourses = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (homeTab) params.set('tab', homeTab)
      if (localSearch) params.set('search', localSearch)
      if (selectedCategory && selectedCategory !== 'All') params.set('category', selectedCategory)
      if (userId) params.set('userId', userId)
      const res = await fetch(`/api/courses?${params}`)
      const data = await res.json()
      setCourses(data.courses || [])
      if (data.categories) setCategories(data.categories)
    } catch (err) {
      console.error('Failed to fetch courses:', err)
    } finally {
      setLoading(false)
    }
  }, [homeTab, localSearch, selectedCategory, userId])

  const handleBookmarkChange = (courseId: string, isBookmarked: boolean) => {
    setCourses((currentCourses) => currentCourses.map((course) => (
      course.id === courseId ? { ...course, isBookmarked } : course
    )))
  }

  useEffect(() => {
    const loadTimer = window.setTimeout(() => { void fetchCourses() }, 0)
    return () => window.clearTimeout(loadTimer)
  }, [fetchCourses])

  const tabs = [
    { key: 'Popular', label: t9('common.popular', lang) },
    { key: 'Recent', label: t9('common.recent', lang) },
    { key: 'All', label: t9('common.all', lang) },
  ]

  const greeting = () => {
    const h = new Date().getHours()
    if (lang === 'Mandarin') {
      if (h < 12) return '早上好'
      if (h < 17) return '下午好'
      return '晚上好'
    }
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  }

  return (
    <div className='min-h-[calc(100vh-3.5rem)]'>
      <section className='bg-white border-b border-border/60 px-6 pt-6 pb-5'>
        <div className='max-w-6xl mx-auto'>
          <div className='flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 mb-5'>
            <div>
              <p className='text-sm text-muted-foreground mb-1'>{greeting()}, {user?.name || 'User'}</p>
              <h1 className='text-xl font-bold text-foreground'>{t9('home.trainingDashboard', lang)}</h1>
            </div>
            {isInstructor() && (
              <div className='flex items-center gap-2'>
                <Button variant='outline' size='sm' onClick={() => navigateTo('my-courses')} className='text-slate-700 border-slate-200'>
                  <BarChart3 className='size-3.5' />{t9('nav.manageModules', lang)}
                </Button>
                <Button size='sm' className='bg-slate-900 hover:bg-slate-800 text-white' onClick={() => {
                  setEditorTitle(''); setEditorCover(null); setEditorSaved(false); setEditorCourseId(null); navigateTo('create-course')
                }}>
                  <PenSquare className='size-3.5' />{t9('nav.newModule', lang)}
                </Button>
              </div>
            )}
          </div>
          {isInstructor() && (
            <div className='rounded-2xl border border-slate-800 bg-slate-950 p-4 text-white shadow-sm sm:p-5'>
              <div className='flex items-start gap-3'>
                <div className='flex size-9 shrink-0 items-center justify-center rounded-xl bg-white/10'>
                  <Sparkles className='size-4 text-emerald-300' />
                </div>
                <div>
                  <p className='text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-300'>{t9('home.aiEyebrow', lang)}</p>
                  <h2 className='mt-0.5 text-base font-semibold'>{t9('home.aiTitle', lang)}</h2>
                  <p className='mt-1 max-w-2xl text-xs leading-5 text-slate-300'>{t9('home.aiDescription', lang)}</p>
                </div>
              </div>
              <div className='mt-4 flex flex-col gap-2 sm:flex-row'>
                <Input
                  value={aiPrompt}
                  onChange={(event) => {
                    setAiPrompt(event.target.value)
                    setAiPromptError('')
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') openAiGenerator()
                  }}
                  placeholder={t9('home.aiPlaceholder', lang)}
                  className='h-10 flex-1 border-white/15 bg-white text-slate-950 placeholder:text-slate-400'
                />
                <Button type='button' onClick={openAiGenerator} className='h-10 bg-emerald-400 px-4 text-slate-950 hover:bg-emerald-300'>
                  {t9('home.aiCreate', lang)} <ArrowRight className='size-4' />
                </Button>
              </div>
              {aiPromptError && <p className='mt-2 text-xs text-red-300'>{aiPromptError}</p>}
            </div>
          )}
        </div>
      </section>

      <section className='px-6 pt-5 pb-4 bg-white border-b border-border/60'>
        <div className='max-w-6xl mx-auto'>
          <div className='flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3'>
            <h2 className='text-base font-bold text-foreground'>{t9('home.trainingCatalog', lang)}</h2>
            <div className='flex items-center gap-2 w-full sm:w-auto'>
              <div className='relative flex-1 sm:flex-none'>
                <Search className='absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground' />
                <Input placeholder={t9('home.searchPlaceholder', lang)} value={localSearch} onChange={(e) => setLocalSearch(e.target.value)} className='pl-9 w-full sm:w-56 h-9' />
              </div>
              <div className='flex items-center gap-0.5 bg-muted/50 rounded-lg p-0.5'>
                {tabs.map((tab) => (
                  <button key={tab.key} onClick={() => setHomeTab(tab.key)} className={cn('px-3 py-1.5 rounded-md text-xs font-medium transition-colors', homeTab === tab.key ? 'bg-white text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {categories.length > 0 && (
            <div className='flex items-center gap-2 mt-3 flex-wrap'>
              <Tag className='size-3 text-muted-foreground' />
              <button onClick={() => setSelectedCategory('All')} className={cn('px-2.5 py-0.5 rounded-full text-[11px] font-medium transition-colors', selectedCategory === 'All' ? 'bg-slate-900 text-white' : 'bg-muted/50 text-muted-foreground hover:text-foreground')}>
                {t9('common.all', lang)}
              </button>
              {categories.map((cat) => (
                <button key={cat.name} onClick={() => setSelectedCategory(cat.name)} className={cn('px-2.5 py-0.5 rounded-full text-[11px] font-medium transition-colors', selectedCategory === cat.name ? 'bg-slate-900 text-white' : 'bg-muted/50 text-muted-foreground hover:text-foreground')}>
                  {translateCategory(cat.name, lang)} <span className='opacity-60'>({cat.count})</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </section>
      <section className='p-6'>
        <div className='max-w-6xl mx-auto'>
          {loading ? (
            <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'>
              {Array.from({ length: 8 }).map((_, i) => <div key={i} className='bg-muted/40 rounded-xl h-52 animate-pulse' />)}
            </div>
          ) : courses.length === 0 ? (
            <div className='text-center py-16'>
              <BookOpen className='size-12 mx-auto text-muted-foreground/30 mb-3' />
              <p className='text-muted-foreground text-sm'>{t9('home.noModules', lang)}</p>
            </div>
          ) : (
            <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'>
              {courses.map((course, index) => (
                <CourseCard key={course.id} course={course} index={index} onBookmarkChange={handleBookmarkChange} />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
