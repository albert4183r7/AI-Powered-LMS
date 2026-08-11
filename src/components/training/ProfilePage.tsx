'use client'

import { useEffect, useState } from 'react'
import { useAppStore } from '@/store/app-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { BookText, ChevronRight, Plus, Settings, Shield, LogOut, User, Mail, X, Save, Loader2, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { apiRequest } from '@/lib/api-client'
import type { EnrollmentStats } from '@/features/enrollments/types'
import { t9, type Lang } from '@/lib/i18n'

export function ProfilePage() {
  const navigateTo = useAppStore((s) => s.navigateTo)
  const user = useAppStore((s) => s.user)
  const setUser = useAppStore((s) => s.setUser)
  const logout = useAppStore((s) => s.logout)
  const isInstructor = useAppStore((s) => s.isInstructor)
  const isAdmin = useAppStore((s) => s.isAdmin)
  const lang = useAppStore((s) => s.lang) as Lang
  const [stats, setStats] = useState({ total: 0, completed: 0, inProgress: 0, avgProgress: 0 })
  const [showSettings, setShowSettings] = useState(false)
  const [editName, setEditName] = useState('')
  const [savingName, setSavingName] = useState(false)
  const [settingsError, setSettingsError] = useState('')
  const [settingsSuccess, setSettingsSuccess] = useState('')

  const roleLabel = user?.role === 'admin' ? t9('profile.admin', lang) : user?.role === 'instructor' ? t9('profile.instructor', lang) : t9('profile.employee', lang)

  useEffect(() => {
    if (!user) return
    const abortController = new AbortController()
    apiRequest<EnrollmentStats>(`/api/enrollments?type=stats&userId=${encodeURIComponent(user.id)}&role=${encodeURIComponent(user.role)}`, {
      signal: abortController.signal,
    })
      .then(setStats)
      .catch(() => { /* keep default 0s */ })
    return () => abortController.abort()
  }, [user])

  const openSettings = () => {
    setEditName(user?.name || '')
    setSettingsError('')
    setSettingsSuccess('')
    setShowSettings(true)
  }

  const handleSaveName = async () => {
    if (!editName.trim()) { setSettingsError(t9('profile.nameEmpty', lang)); return }
    if (!user) return
    setSavingName(true)
    setSettingsError('')
    setSettingsSuccess('')
    try {
      const updateResponse = await apiRequest<{ name: string | null }>('/api/user/update-name', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, name: editName.trim() }),
      })
      setUser({ ...user, name: updateResponse.name })
      setSettingsSuccess(t9('profile.nameUpdated', lang))
      window.setTimeout(() => setShowSettings(false), 1000)
    } catch (error) {
      setSettingsError(error instanceof Error ? error.message : t9('profile.failedUpdate', lang))
    } finally {
      setSavingName(false)
    }
  }

  const circumference = 2 * Math.PI * 40
  const strokeDashoffset = circumference - (stats.avgProgress / 100) * circumference

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-gray-50/50">
      <div className="bg-slate-900 px-6 py-8 text-white">
        <div className="max-w-5xl mx-auto flex items-center gap-4">
          <div className="size-14 rounded-full bg-white/10 flex items-center justify-center text-xl font-bold border border-white/20">
            {user?.name?.[0] || 'U'}
          </div>
          <div>
            <h1 className="text-lg font-bold">{user?.name || 'User'}</h1>
            <p className="text-slate-400 text-sm">{user?.email || '—'}</p>
            <div className='flex items-center gap-1.5 mt-1'>
              <Shield className='size-3 text-slate-500' />
              <span className='text-xs text-slate-400 font-medium'>{roleLabel}</span>
            </div>
          </div>
        </div>
      </div>
      <div className="max-w-5xl mx-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white rounded-xl border border-border/60 p-5">
            <h3 className="text-sm font-semibold text-foreground mb-4">{t9('profile.trainingOverview', lang)}</h3>
            <div className="space-y-3 mb-6">
              {[
                { label: t9('profile.modulesEnrolled', lang), value: stats.total },
                { label: t9('profile.completed', lang), value: stats.completed },
                { label: t9('profile.inProgress', lang), value: stats.inProgress },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between py-1.5">
                  <span className="text-sm text-muted-foreground">{item.label}</span>
                  <span className="text-sm font-semibold text-foreground">{item.value}</span>
                </div>
              ))}
            </div>
            <div className="flex flex-col items-center pt-4 border-t border-border/60">
              <div className="relative size-28">
                <svg className="size-28 -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="40" fill="none" stroke="#f1f5f9" strokeWidth="8" />
                  <circle
                    cx="50" cy="50" r="40" fill="none" stroke="#0f172a"
                    strokeWidth="8" strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    className="transition-all duration-700"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-bold text-foreground">{stats.avgProgress}%</span>
                  <span className="text-[10px] text-muted-foreground">{t9('profile.completion', lang)}</span>
                </div>
              </div>
            </div>
          </div>
          <div className="lg:col-span-2 space-y-6">
            {showSettings ? (
              <div className="bg-white rounded-xl border border-border/60 p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-foreground">{t9('profile.accountSettings', lang)}</h3>
                  <button type='button' onClick={() => setShowSettings(false)} className='p-1 rounded hover:bg-muted transition-colors' aria-label='Close settings'>
                    <X className='size-4 text-muted-foreground' />
                  </button>
                </div>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Mail className="size-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">{t9('profile.email', lang)}</span>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-lg">
                      <span className="text-sm text-foreground">{user?.email || '—'}</span>
                      <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{t9('profile.readOnly', lang)}</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <User className="size-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">{t9('profile.displayName', lang)}</span>
                    </div>
                    <Input
                      value={editName}
                      onChange={(event) => { setEditName(event.target.value); setSettingsError('') }}
                      placeholder={t9('profile.enterName', lang)}
                      className="h-9 text-sm"
                      maxLength={50}
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Shield className="size-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">{t9('profile.role', lang)}</span>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-lg">
                      <span className="text-sm text-foreground">{roleLabel}</span>
                      <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{t9('profile.fixedByAdmin', lang)}</span>
                    </div>
                  </div>
                  {settingsError && <p role='alert' className='text-xs text-red-500'>{settingsError}</p>}
                  {settingsSuccess && <p role='status' className='text-xs text-emerald-600'>{settingsSuccess}</p>}
                  <Button onClick={handleSaveName} disabled={savingName || !editName.trim()} className='w-full bg-slate-900 hover:bg-slate-800 text-white'>
                    {savingName ? <><Loader2 className='size-4 animate-spin' /> {t9('profile.saving', lang)}</> : <><Save className='size-4' /> {t9('profile.saveChanges', lang)}</>}
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="bg-white rounded-xl border border-border/60 p-5">
                  <h3 className="text-sm font-semibold text-foreground mb-4">{t9('profile.quickActions', lang)}</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {isInstructor() && (
                      <button
                        onClick={() => {
                          const { setEditorTitle, setEditorCover, setEditorSaved, setEditorCourseId } = useAppStore.getState()
                          setEditorTitle('')
                          setEditorCover(null)
                          setEditorSaved(false)
                          setEditorCourseId(null)
                          navigateTo('create-course')
                        }}
                        className="flex items-center gap-3 p-4 rounded-lg border border-border/60 hover:bg-muted/30 transition-colors text-left"
                      >
                        <div className="p-2 rounded-lg bg-muted/50">
                          <Plus className="size-5 text-slate-600" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-foreground">{t9('profile.newModule', lang)}</p>
                          <p className="text-xs text-muted-foreground">{t9('profile.createContent', lang)}</p>
                        </div>
                      </button>
                    )}
                    {isAdmin() && (
                      <button
                        onClick={() => navigateTo('admin')}
                        className="flex items-center gap-3 p-4 rounded-lg border border-border/60 hover:bg-muted/30 transition-colors text-left"
                      >
                        <div className="p-2 rounded-lg bg-muted/50">
                          <Users className="size-5 text-slate-600" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-foreground">{t9('profile.userManagement', lang)}</p>
                          <p className="text-xs text-muted-foreground">{t9('profile.viewManageUsers', lang)}</p>
                        </div>
                      </button>
                    )}
                    {!isInstructor() && !isAdmin() && (
                      <button
                        onClick={() => navigateTo('my-learning')}
                        className="flex items-center gap-3 p-4 rounded-lg border border-border/60 hover:bg-muted/30 transition-colors text-left"
                      >
                        <div className="p-2 rounded-lg bg-muted/50">
                          <BookText className="size-5 text-slate-600" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-foreground">{t9('profile.myTraining', lang)}</p>
                          <p className="text-xs text-muted-foreground">{t9('profile.viewEnrolled', lang)}</p>
                        </div>
                      </button>
                    )}
                  </div>
                </div>
                <div className="bg-white rounded-xl border border-border/60 p-5">
                  <h3 className="text-sm font-semibold text-foreground mb-4">{t9('profile.account', lang)}</h3>
                  <div className="space-y-1">
                    <button
                      onClick={openSettings}
                      className={cn(
                        'w-full flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-muted/50 transition-colors text-left'
                      )}
                    >
                      <div className='flex items-center gap-2.5'>
                        <Settings className='size-4 text-muted-foreground' />
                        <span className='text-sm text-foreground'>{t9('profile.accountSettings', lang)}</span>
                      </div>
                      <ChevronRight className='size-4 text-muted-foreground' />
                    </button>
                  </div>
                </div>
              </>
            )}
            <Button onClick={logout} variant='outline' className="w-full border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 py-2.5">
              <LogOut className='size-4' />
              {t9('profile.signOut', lang)}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
