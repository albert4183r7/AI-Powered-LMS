'use client'

import { useState } from 'react'
import {
  Building2, BookOpen, Target, Loader2, Mail, Lock, User,
  Briefcase, PencilRuler, ShieldCheck,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { useAppStore } from '@/store/app-store'
import { cn } from '@/lib/utils'
import { apiRequest } from '@/lib/api-client'
import type { AuthResponse } from '@/features/users/types'
import { t9, t9i, type Lang } from '@/lib/i18n'

export default function AuthPage() {
  const setUser = useAppStore((s) => s.setUser)
  const setCurrentPage = useAppStore((s) => s.setCurrentPage)
  const lang = useAppStore((s) => s.lang) as Lang

  const [loginLoading, setLoginLoading] = useState(false)
  const [registerLoading, setRegisterLoading] = useState(false)
  const [loginError, setLoginError] = useState('')
  const [registerError, setRegisterError] = useState('')
  const [loginForm, setLoginForm] = useState({ email: '', password: '' })
  const [registerForm, setRegisterForm] = useState({ name: '', email: '', password: '', role: 'employee' as 'instructor' | 'employee' })

  const handleLogin = async (formEvent: React.FormEvent) => {
    formEvent.preventDefault()
    setLoginError('')
    setLoginLoading(true)
    try {
      const authResponse = await apiRequest<AuthResponse>('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm),
      })
      setUser(authResponse.user)
      setCurrentPage('home')
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : t9('auth.somethingWentWrong', lang))
    } finally {
      setLoginLoading(false)
    }
  }

  const handleRegister = async (formEvent: React.FormEvent) => {
    formEvent.preventDefault()
    setRegisterError('')
    setRegisterLoading(true)
    try {
      const authResponse = await apiRequest<AuthResponse>('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(registerForm),
      })
      setUser(authResponse.user)
      setCurrentPage('home')
    } catch (error) {
      setRegisterError(error instanceof Error ? error.message : t9('auth.somethingWentWrong', lang))
    } finally {
      setRegisterLoading(false)
    }
  }

  const fillDemo = (role: 'instructor' | 'employee' | 'admin') => {
    const demoCredentials: Record<string, { email: string; password: string }> = {
      instructor: { email: 'instructor@learnova.example', password: 'instructor123' },
      employee: { email: 'employee@learnova.example', password: 'employee123' },
      admin: { email: 'admin@learnova.example', password: 'admin123' },
    }
    setLoginForm(demoCredentials[role])
  }

  const heroTitle = t9('auth.internalTrainingSimplified', lang)
  const heroTitleLines = heroTitle.split('\n')

  const demoAccounts = [
    { role: 'instructor' as const, icon: Briefcase, label: t9('auth.instructor', lang), email: 'instructor@learnova.example', pw: 'instructor123' },
    { role: 'employee' as const, icon: User, label: t9('auth.employee', lang), email: 'employee@learnova.example', pw: 'employee123' },
    { role: 'admin' as const, icon: ShieldCheck, label: t9('auth.admin', lang), email: 'admin@learnova.example', pw: 'admin123' },
  ]

  return (
    <div className='min-h-screen flex flex-col lg:flex-row'>
      {/* Left panel - branding */}
      <div className='hidden lg:flex lg:w-1/2 bg-slate-900 text-white flex-col justify-between p-12 relative overflow-hidden'>
        <div className='absolute inset-0 opacity-[0.03]' style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width="60" height="60" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg"%3E%3Cg fill="none" fill-rule="evenodd"%3E%3Cg fill="%23ffffff" fill-opacity="1"%3E%3Cpath d="M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z"/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")' }} />

        <div className='relative z-10 flex items-center gap-3'>
          <div className='flex h-11 w-11 items-center justify-center rounded-xl bg-white/10'>
            <Building2 className='h-6 w-6 text-white' />
          </div>
          <div>
            <span className='text-2xl font-bold tracking-tight'>Lumen</span>
            <p className='text-xs text-slate-400 font-medium tracking-wider uppercase'>{t9('auth.enterpriseTraining', lang)}</p>
          </div>
        </div>

        <div className='relative z-10 space-y-8'>
          <div className='space-y-4'>
            <h1 className='text-4xl xl:text-5xl font-bold leading-tight'>
              {heroTitleLines[0]}
              <br />
              <span className='text-slate-300'>{heroTitleLines[1]}</span>
            </h1>
            <p className='text-lg text-slate-400 max-w-md leading-relaxed'>{t9('auth.platformDescription', lang)}</p>
          </div>

          <div className='space-y-4'>
            {[
              { icon: BookOpen, title: t9('auth.structuredPrograms', lang), desc: t9('auth.structuredProgramsDesc', lang) },
              { icon: Target, title: t9('auth.complianceTracking', lang), desc: t9('auth.complianceTrackingDesc', lang) },
              { icon: PencilRuler, title: t9('auth.simpleAuthoring', lang), desc: t9('auth.simpleAuthoringDesc', lang) },
            ].map((item) => (
              <div key={item.title} className='flex items-center gap-4'>
                <div className='flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/5 border border-white/10'>
                  <item.icon className='h-5 w-5 text-slate-300' />
                </div>
                <div>
                  <p className='font-semibold text-sm'>{item.title}</p>
                  <p className='text-sm text-slate-500'>{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className='relative z-10 text-xs text-slate-600'>
          {t9i('auth.copyright', lang, { year: String(new Date().getFullYear()) })}
        </div>
      </div>

      {/* Right panel - forms */}
      <div className='flex-1 flex items-center justify-center p-6 sm:p-8 lg:p-12 bg-white'>
        <div className='w-full max-w-md space-y-8'>
          {/* Mobile brand */}
          <div className='flex lg:hidden items-center gap-3 justify-center'>
            <div className='flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-white'>
              <Building2 className='h-6 w-6' />
            </div>
            <div className='text-left'>
              <span className='text-2xl font-bold tracking-tight text-slate-900'>Lumen</span>
              <p className='text-[10px] text-muted-foreground font-medium tracking-wider uppercase'>{t9('auth.enterpriseTraining', lang)}</p>
            </div>
          </div>

          <Tabs defaultValue='login' className='w-full'>
            <TabsList className='w-full grid grid-cols-2'>
              <TabsTrigger value='login'>{t9('auth.signIn', lang)}</TabsTrigger>
              <TabsTrigger value='register'>{t9('auth.newAccount', lang)}</TabsTrigger>
            </TabsList>

            {/* Login form */}
            <TabsContent value='login'>
              <Card className='border-0 shadow-none lg:border lg:shadow-sm mt-4'>
                <form onSubmit={handleLogin} className='space-y-4'>
                  <CardHeader className='p-0 pb-2'>
                    <CardTitle className='text-lg'>{t9('auth.welcome', lang)}</CardTitle>
                    <CardDescription className='text-sm'>{t9('auth.enterCredentials', lang)}</CardDescription>
                  </CardHeader>
                  <CardContent className='p-0 space-y-4'>
                    {loginError && (
                      <div role='alert' className='rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600'>{loginError}</div>
                    )}
                    <div className='space-y-2'>
                      <Label htmlFor='login-email' className='text-sm'>{t9('auth.workEmail', lang)}</Label>
                      <div className='relative'>
                        <Mail className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground' />
                        <Input id='login-email' type='email' placeholder={t9('auth.emailPlaceholder', lang)} required value={loginForm.email} onChange={(event) => setLoginForm({ ...loginForm, email: event.target.value })} className='pl-9' />
                      </div>
                    </div>
                    <div className='space-y-2'>
                      <Label htmlFor='login-password' className='text-sm'>{t9('auth.password', lang)}</Label>
                      <div className='relative'>
                        <Lock className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground' />
                        <Input id='login-password' type='password' placeholder={t9('auth.enterPassword', lang)} required value={loginForm.password} onChange={(event) => setLoginForm({ ...loginForm, password: event.target.value })} className='pl-9' />
                      </div>
                    </div>
                    <Button type='submit' className='w-full bg-slate-900 hover:bg-slate-800 text-white' disabled={loginLoading}>
                      {loginLoading && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
                      {loginLoading ? t9('auth.signingIn', lang) : t9('auth.signIn', lang)}
                    </Button>
                  </CardContent>
                </form>
              </Card>
              <DemoAccountButtons lang={lang} accounts={demoAccounts} onSelect={fillDemo} selectedEmail={loginForm.email} showPassword={false} />
            </TabsContent>

            {/* Register form */}
            <TabsContent value='register'>
              <Card className='border-0 shadow-none lg:border lg:shadow-sm mt-4'>
                <form onSubmit={handleRegister} className='space-y-4'>
                  <CardHeader className='p-0 pb-2'>
                    <CardTitle className='text-lg'>{t9('auth.createAccountTitle', lang)}</CardTitle>
                    <CardDescription className='text-sm'>{t9('auth.setupAccess', lang)}</CardDescription>
                  </CardHeader>
                  <CardContent className='p-0 space-y-4'>
                    {registerError && (
                      <div role='alert' className='rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600'>{registerError}</div>
                    )}
                    <div className='space-y-2'>
                      <Label htmlFor='register-name' className='text-sm'>{t9('auth.fullName', lang)}</Label>
                      <div className='relative'>
                        <User className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground' />
                        <Input id='register-name' type='text' placeholder={t9('auth.namePlaceholder', lang)} required value={registerForm.name} onChange={(event) => setRegisterForm({ ...registerForm, name: event.target.value })} className='pl-9' />
                      </div>
                    </div>
                    <div className='space-y-2'>
                      <Label htmlFor='register-email' className='text-sm'>{t9('auth.workEmail', lang)}</Label>
                      <div className='relative'>
                        <Mail className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground' />
                        <Input id='register-email' type='email' placeholder={t9('auth.emailPlaceholder', lang)} required value={registerForm.email} onChange={(event) => setRegisterForm({ ...registerForm, email: event.target.value })} className='pl-9' />
                      </div>
                    </div>
                    <div className='space-y-2'>
                      <Label htmlFor='register-password' className='text-sm'>{t9('auth.password', lang)}</Label>
                      <div className='relative'>
                        <Lock className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground' />
                        <Input id='register-password' type='password' placeholder={t9('auth.createPassword', lang)} required minLength={6} value={registerForm.password} onChange={(event) => setRegisterForm({ ...registerForm, password: event.target.value })} className='pl-9' />
                      </div>
                    </div>
                    <div className='space-y-3'>
                      <Label className='text-sm'>{t9('auth.accessRole', lang)}</Label>
                      <RadioGroup value={registerForm.role} onValueChange={(v) => setRegisterForm({ ...registerForm, role: v as 'instructor' | 'employee' })} className='grid grid-cols-2 gap-3'>
                        {[{ value: 'instructor', desc: t9('auth.createManage', lang) }, { value: 'employee', desc: t9('auth.learnComplete', lang) }].map((r) => (
                          <label key={r.value} htmlFor={`role-${r.value}`} className={cn('flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-all', registerForm.role === r.value ? 'border-slate-400 bg-slate-50' : 'hover:border-slate-200')}>
                            <RadioGroupItem value={r.value} id={`role-${r.value}`} />
                            <div>
                              <p className='text-sm font-medium'>{t9(`auth.${r.value}`, lang)}</p>
                              <p className='text-xs text-muted-foreground'>{r.desc}</p>
                            </div>
                          </label>
                        ))}
                      </RadioGroup>
                    </div>
                    <Button type='submit' className='w-full bg-slate-900 hover:bg-slate-800 text-white' disabled={registerLoading}>
                      {registerLoading && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
                      {registerLoading ? t9('auth.creatingAccount', lang) : t9('auth.createAccount', lang)}
                    </Button>
                  </CardContent>
                </form>
              </Card>
              <DemoAccountButtons lang={lang} accounts={demoAccounts} onSelect={fillDemo} selectedEmail={registerForm.email} showPassword />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}

// Extracted demo account buttons to avoid duplication
function DemoAccountButtons({ lang, accounts, onSelect, selectedEmail, showPassword }: {
  lang: Lang
  accounts: Array<{ role: string; icon: React.ComponentType<{ className?: string }>; label: string; email: string; pw: string }>
  onSelect: (role: 'instructor' | 'employee' | 'admin') => void
  selectedEmail: string
  showPassword: boolean
}) {
  return (
    <div className='mt-6 space-y-3'>
      <p className='text-xs font-medium text-muted-foreground uppercase tracking-wider text-center'>{t9('auth.demoAccounts', lang)}</p>
      <div className='grid gap-3 sm:grid-cols-3'>
        {accounts.map((acct) => (
          <button key={acct.role} type='button' onClick={() => onSelect(acct.role as 'instructor' | 'employee' | 'admin')} className={cn('rounded-lg border p-3 text-left transition-all hover:border-slate-300 hover:bg-slate-50', selectedEmail === acct.email && 'border-slate-400 bg-slate-50')}>
            <div className='flex items-center gap-2 mb-1'>
              <acct.icon className='h-4 w-4 text-slate-600' />
              <span className='text-sm font-semibold text-foreground'>{acct.label}</span>
            </div>
            <p className='text-xs text-muted-foreground truncate'>{acct.email}</p>
            {showPassword && <p className='text-xs text-muted-foreground'>{acct.pw}</p>}
            {!showPassword && <p className='text-xs text-muted-foreground'>{'•'.repeat(12)}</p>}
          </button>
        ))}
      </div>
    </div>
  )
}
