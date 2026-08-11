'use client'

import { BookOpen, Building2, Globe, GraduationCap, LayoutDashboard, LogOut, PenSquare, Shield, User, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useAppStore, type PageView } from '@/store/app-store'
import { t9, type Lang } from '@/lib/i18n'

export function Navbar() {
  const currentPage = useAppStore((state) => state.currentPage)
  const navigateTo = useAppStore((state) => state.navigateTo)
  const user = useAppStore((state) => state.user)
  const logout = useAppStore((state) => state.logout)
  const isInstructor = useAppStore((state) => state.isInstructor)
  const isAdmin = useAppStore((state) => state.isAdmin)
  const setEditorTitle = useAppStore((state) => state.setEditorTitle)
  const setEditorCover = useAppStore((state) => state.setEditorCover)
  const setEditorSaved = useAppStore((state) => state.setEditorSaved)
  const setEditorCourseId = useAppStore((state) => state.setEditorCourseId)
  const language = useAppStore((state) => state.lang) as Lang
  const setLanguage = useAppStore((state) => state.setLang)

  const handleCreateCourse = () => {
    setEditorTitle('')
    setEditorCover(null)
    setEditorSaved(false)
    setEditorCourseId(null)
    navigateTo('create-course')
  }

  const navigationItems: Array<{ key: PageView; label: string; icon: typeof LayoutDashboard }> = [
    { key: 'home', label: t9('nav.dashboard', language), icon: LayoutDashboard },
    { key: 'courses', label: t9('nav.catalog', language), icon: BookOpen },
    ...(!isInstructor() && !isAdmin()
      ? [{ key: 'my-learning' as PageView, label: t9('nav.myTraining', language), icon: GraduationCap }]
      : []),
    { key: 'profile', label: t9('nav.profile', language), icon: User },
    ...(isAdmin()
      ? [{ key: 'admin' as PageView, label: t9('admin.userManagement', language), icon: Users }]
      : []),
  ]
  const roleLabel = user?.role === 'admin'
    ? t9('profile.admin', language)
    : user?.role === 'instructor'
      ? t9('profile.instructor', language)
      : t9('profile.employee', language)

  return (
    <header className='sticky top-0 z-50 w-full border-b border-border/60 bg-white'>
      <div className='flex h-14 items-center justify-between px-4 lg:px-6'>
        <button
          type='button'
          className='flex items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500'
          onClick={() => navigateTo('home')}
          aria-label={t9('nav.dashboard', language)}
        >
          <span className='flex size-8 items-center justify-center rounded-lg bg-slate-900'>
            <Building2 className='size-4.5 text-white' aria-hidden='true' />
          </span>
          <span className='hidden flex-col text-left sm:flex'>
            <span className='text-sm font-bold leading-none tracking-tight text-slate-900'>Lumen</span>
            <span className='text-[10px] font-medium uppercase tracking-wide text-muted-foreground'>
              {language === 'Mandarin' ? '企业培训平台' : 'Enterprise Training'}
            </span>
          </span>
        </button>

        <nav className='hidden items-center gap-0.5 lg:flex' aria-label='Primary navigation'>
          {navigationItems.map((navigationItem) => {
            const Icon = navigationItem.icon
            const isActive = currentPage === navigationItem.key
            return (
              <button
                key={navigationItem.key}
                type='button'
                onClick={() => navigateTo(navigationItem.key)}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-slate-100 text-slate-900'
                    : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
                )}
              >
                <Icon className='size-4' aria-hidden='true' />{navigationItem.label}
              </button>
            )
          })}
        </nav>

        <div className='flex items-center gap-2'>
          <button
            type='button'
            onClick={() => setLanguage(language === 'English' ? 'Mandarin' : 'English')}
            className={cn(
              'hidden items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium transition-colors sm:inline-flex',
              language === 'Mandarin'
                ? 'border-slate-300 bg-slate-50 text-slate-900'
                : 'border-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground',
            )}
            aria-label={language === 'English' ? 'Switch to Mandarin' : 'Switch to English'}
          >
            <Globe className='size-3' aria-hidden='true' />{language === 'Mandarin' ? '中文' : 'EN'}
          </button>

          {isInstructor() && (
            <Button size='sm' variant='outline' className='hidden border-slate-200 text-slate-700 hover:bg-slate-50 sm:inline-flex' onClick={handleCreateCourse}>
              <PenSquare className='size-3.5' aria-hidden='true' />{t9('nav.newModule', language)}
            </Button>
          )}
          <button
            type='button'
            onClick={() => navigateTo('profile')}
            className='flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-muted/50'
            aria-label={`${t9('nav.profile', language)}: ${user?.name || 'User'}`}
          >
            <span className='flex size-8 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white'>
              {user?.name?.[0]?.toUpperCase() || 'U'}
            </span>
            <span className='hidden text-left md:block'>
              <span className='block text-xs font-medium leading-tight text-foreground'>{user?.name || 'User'}</span>
              <span className='flex items-center gap-0.5 text-[10px] text-muted-foreground'><Shield className='size-2.5' aria-hidden='true' />{roleLabel}</span>
            </span>
          </button>
          <button
            type='button'
            onClick={logout}
            className='rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-600'
            aria-label={t9('profile.signOut', language)}
          >
            <LogOut className='size-4' aria-hidden='true' />
          </button>
        </div>
      </div>

      <nav className='fixed inset-x-0 bottom-0 z-50 border-t border-border/60 bg-white lg:hidden' aria-label='Mobile navigation'>
        <div className='flex items-center justify-around py-1.5'>
          {navigationItems.map((navigationItem) => {
            const Icon = navigationItem.icon
            const isActive = currentPage === navigationItem.key
            return (
              <button
                key={navigationItem.key}
                type='button'
                onClick={() => navigateTo(navigationItem.key)}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'flex flex-col items-center gap-0.5 rounded-lg px-3 py-1.5 text-[10px] font-medium transition-colors',
                  isActive ? 'text-slate-900' : 'text-muted-foreground',
                )}
              >
                <Icon className={cn('size-5', isActive && 'stroke-[2.5px]')} aria-hidden='true' />
                {navigationItem.label}
              </button>
            )
          })}
        </div>
      </nav>
    </header>
  )
}
