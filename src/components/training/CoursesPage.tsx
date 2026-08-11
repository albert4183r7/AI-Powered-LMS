'use client'

import { useDeferredValue, useEffect, useState } from 'react'
import { BookOpen, Search, Tag } from 'lucide-react'
import { CourseCard } from './CourseCard'
import { Input } from '@/components/ui/input'
import type { CategorySummary, CourseCatalogResponse, CourseSummary } from '@/features/courses/types'
import { apiRequest } from '@/lib/api-client'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store/app-store'
import { t9, translateCategory, type Lang } from '@/lib/i18n'

export function CoursesPage() {
  const sortBy = useAppStore((state) => state.sortBy)
  const setSortBy = useAppStore((state) => state.setSortBy)
  const user = useAppStore((state) => state.user)
  const language = useAppStore((state) => state.lang) as Lang
  const [courses, setCourses] = useState<CourseSummary[]>([])
  const [categories, setCategories] = useState<CategorySummary[]>([])
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [searchTerm, setSearchTerm] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const deferredSearchTerm = useDeferredValue(searchTerm.trim())

  useEffect(() => {
    const abortController = new AbortController()
    const searchParams = new URLSearchParams({ sort: sortBy })
    if (deferredSearchTerm) searchParams.set('search', deferredSearchTerm)
    if (selectedCategory !== 'All') searchParams.set('category', selectedCategory)
    if (user?.id) searchParams.set('userId', user.id)

    apiRequest<CourseCatalogResponse>(`/api/courses?${searchParams}`, {
      signal: abortController.signal,
    })
      .then((catalogResponse) => {
        setCourses(catalogResponse.courses)
        setCategories(catalogResponse.categories)
        setErrorMessage('')
      })
      .catch((error: unknown) => {
        if (abortController.signal.aborted) return
        setErrorMessage(error instanceof Error ? error.message : 'Unable to load courses.')
      })
      .finally(() => {
        if (!abortController.signal.aborted) setIsLoading(false)
      })

    return () => abortController.abort()
  }, [deferredSearchTerm, selectedCategory, sortBy, user?.id])

  const handleBookmarkChange = (courseId: string, isBookmarked: boolean) => {
    setCourses((currentCourses) => currentCourses.map((course) => (
      course.id === courseId ? { ...course, isBookmarked } : course
    )))
  }

  const sortOptions = [
    { key: 'Newest', label: t9('catalog.newest', language) },
    { key: 'Most Enrolled', label: t9('catalog.mostEnrolled', language) },
    { key: 'A–Z', label: t9('catalog.az', language) },
  ]

  return (
    <main className='min-h-[calc(100vh-3.5rem)]' aria-busy={isLoading}>
      <section className='border-b border-border/60 bg-white px-4 py-4 sm:px-6' aria-labelledby='catalog-heading'>
        <div className='mx-auto flex max-w-6xl flex-col items-start justify-between gap-3 sm:flex-row sm:items-center'>
          <div>
            <h1 id='catalog-heading' className='text-lg font-bold text-foreground'>{t9('catalog.title', language)}</h1>
            <p className='mt-0.5 text-xs text-muted-foreground'>{t9('catalog.subtitle', language)}</p>
          </div>
          <div className='flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center'>
            <label className='relative flex-1 sm:flex-none'>
              <span className='sr-only'>{t9('catalog.searchPlaceholder', language)}</span>
              <Search className='absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground' aria-hidden='true' />
              <Input
                type='search'
                placeholder={t9('catalog.searchPlaceholder', language)}
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className='h-9 w-full pl-9 sm:w-60'
              />
            </label>
            <div className='flex max-w-full items-center gap-0.5 overflow-x-auto rounded-lg bg-muted/50 p-0.5' aria-label='Sort courses'>
              {sortOptions.map((sortOption) => (
                <button
                  key={sortOption.key}
                  type='button'
                  onClick={() => setSortBy(sortOption.key)}
                  aria-pressed={sortBy === sortOption.key}
                  className={cn(
                    'whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                    sortBy === sortOption.key
                      ? 'bg-white text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {sortOption.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {categories.length > 0 && (
        <section className='border-b border-border/60 bg-muted/20 px-4 py-3 sm:px-6' aria-label='Course categories'>
          <div className='mx-auto flex max-w-6xl items-center gap-2 overflow-x-auto pb-1'>
            <Tag className='size-3.5 shrink-0 text-muted-foreground' aria-hidden='true' />
            <button
              type='button'
              onClick={() => setSelectedCategory('All')}
              aria-pressed={selectedCategory === 'All'}
              className={cn(
                'whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium transition-colors',
                selectedCategory === 'All'
                  ? 'bg-slate-900 text-white'
                  : 'border border-border/60 bg-white text-muted-foreground hover:text-foreground',
              )}
            >
              {t9('common.all', language)}
            </button>
            {categories.map((category) => (
              <button
                key={category.name}
                type='button'
                onClick={() => setSelectedCategory(category.name)}
                aria-pressed={selectedCategory === category.name}
                className={cn(
                  'whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium transition-colors',
                  selectedCategory === category.name
                    ? 'bg-slate-900 text-white'
                    : 'border border-border/60 bg-white text-muted-foreground hover:text-foreground',
                )}
              >
                {translateCategory(category.name, language)} <span className='ml-1 opacity-60'>({category.count})</span>
              </button>
            ))}
          </div>
        </section>
      )}

      <section className='p-4 sm:p-6' aria-live='polite'>
        <div className='mx-auto max-w-6xl'>
          <p className='mb-4 text-xs text-muted-foreground'>
            {t9('catalog.showing', language)} <span className='font-semibold text-foreground'>{courses.length}</span> {t9('catalog.modules', language)}
            {selectedCategory !== 'All' && (
              <span> {t9('catalog.in', language)} <span className='font-semibold text-foreground'>{translateCategory(selectedCategory, language)}</span></span>
            )}
          </p>

          {errorMessage ? (
            <div role='alert' className='rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700'>{errorMessage}</div>
          ) : isLoading ? (
            <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' aria-label='Loading courses'>
              {Array.from({ length: 8 }, (_, index) => (
                <div key={index} className='h-52 animate-pulse rounded-xl bg-muted/40' />
              ))}
            </div>
          ) : courses.length === 0 ? (
            <div className='py-16 text-center'>
              <BookOpen className='mx-auto mb-3 size-12 text-muted-foreground/30' aria-hidden='true' />
              <p className='text-sm text-muted-foreground'>
                {selectedCategory !== 'All' ? t9('catalog.noCategoryModules', language) : t9('catalog.noMatchSearch', language)}
              </p>
            </div>
          ) : (
            <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'>
              {courses.map((course, index) => (
                <CourseCard key={course.id} course={course} index={index} onBookmarkChange={handleBookmarkChange} />
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  )
}
