'use client'

import { useEffect, useState } from 'react'
import { useAppStore } from '@/store/app-store'
import { t9, formatDate as formatDateI18n, type Lang } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { apiRequest } from '@/lib/api-client'
import type { AdminUser, AdminUsersResponse } from '@/features/users/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Search, Users, Loader2, Pencil, Shield, GraduationCap, UserCircle } from 'lucide-react'

export function AdminPage() {
  const language = useAppStore((state) => state.lang) as Lang
  const [users, setUsers] = useState<AdminUser[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null)
  const [editName, setEditName] = useState('')
  const [editRole, setEditRole] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [refreshVersion, setRefreshVersion] = useState(0)

  useEffect(() => {
    const abortController = new AbortController()
    const endpoint = searchTerm
      ? `/api/admin/users?search=${encodeURIComponent(searchTerm)}`
      : '/api/admin/users'

    apiRequest<AdminUsersResponse>(endpoint, { signal: abortController.signal })
      .then((usersResponse) => {
        setUsers(usersResponse.users)
        setErrorMessage('')
      })
      .catch((error: unknown) => {
        if (abortController.signal.aborted) return
        setErrorMessage(error instanceof Error ? error.message : t9('admin.failedUpdate', language))
      })
      .finally(() => {
        if (!abortController.signal.aborted) setIsLoading(false)
      })

    return () => abortController.abort()
  }, [language, refreshVersion, searchTerm])

  const handleSearch = (formEvent: React.FormEvent) => {
    formEvent.preventDefault()
    setIsLoading(true)
    setSearchTerm(searchInput.trim())
  }

  const openEditDialog = (user: AdminUser) => {
    setEditingUser(user)
    setEditName(user.name || '')
    setEditRole(user.role)
    setErrorMessage('')
  }

  const handleSave = async () => {
    if (!editingUser) return
    if (!editName.trim()) {
      setErrorMessage(t9('admin.nameEmpty', language))
      return
    }
    setIsSaving(true)
    setErrorMessage('')
    try {
      await apiRequest('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: editingUser.id, name: editName.trim(), role: editRole }),
      })
      setEditingUser(null)
      setIsLoading(true)
      setRefreshVersion((currentVersion) => currentVersion + 1)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t9('admin.failedUpdate', language))
    } finally {
      setIsSaving(false)
    }
  }

  const getRoleBadge = (role: string) => {
    const styles: Record<string, string> = {
      admin: 'bg-slate-900 text-white',
      instructor: 'bg-amber-100 text-amber-800',
      employee: 'bg-sky-50 text-sky-700',
    }
    const icons: Record<string, React.ReactNode> = {
      admin: <Shield className='size-3' />,
      instructor: <GraduationCap className='size-3' />,
      employee: <UserCircle className='size-3' />,
    }
    const roleLabels: Record<string, string> = {
      admin: t9('profile.admin', language),
      instructor: t9('profile.instructor', language),
      employee: t9('profile.employee', language),
    }
    return (
      <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium', styles[role] || styles.employee)}>
        {icons[role]}
        {roleLabels[role] || role}
      </span>
    )
  }

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-gray-50/50">
      <div className="bg-slate-900 px-6 py-8 text-white">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 rounded-lg bg-white/10">
              <Users className="size-5" />
            </div>
            <h1 className="text-lg font-bold">{t9('admin.userManagement', language)}</h1>
          </div>
          <p className="text-sm text-slate-400 ml-11">{t9('admin.allUsers', language)}</p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-6">
        <div className="mb-6">
          <form onSubmit={handleSearch} className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder={t9('admin.searchUsers', language)}
              aria-label={t9('admin.searchUsers', language)}
              className="pl-9 h-9 text-sm bg-white"
            />
          </form>
        </div>

        <div className="bg-white rounded-xl border border-border/60 overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : users.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Users className="size-10 mb-3 opacity-30" />
              <p className="text-sm">{t9('admin.noUsers', language)}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60 bg-muted/30">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">{t9('admin.name', language)}</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">{t9('admin.email', language)}</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">{t9('admin.role', language)}</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">{t9('admin.coursesCreated', language)}</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">{t9('admin.enrollments', language)}</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">{t9('admin.createdDate', language)}</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">{t9('admin.actions', language)}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {users.map((managedUser) => (
                    <tr key={managedUser.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="flex items-center justify-center size-8 rounded-full bg-slate-100 text-slate-600 text-xs font-semibold shrink-0">
                            {managedUser.name?.[0] || managedUser.email[0].toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-foreground truncate">{managedUser.name || '—'}</p>
                            <p className="text-xs text-muted-foreground sm:hidden truncate">{managedUser.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{managedUser.email}</td>
                      <td className="px-4 py-3">{getRoleBadge(managedUser.role)}</td>
                      <td className="px-4 py-3 text-right text-muted-foreground hidden md:table-cell">{managedUser.coursesCreated}</td>
                      <td className="px-4 py-3 text-right text-muted-foreground hidden md:table-cell">{managedUser.enrollmentCount}</td>
                      <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">{formatDateI18n(managedUser.createdAt, language)}</td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                          onClick={() => openEditDialog(managedUser)}
                          aria-label={`${t9('admin.editUser', language)}: ${managedUser.name || managedUser.email}`}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {!isLoading && users.length > 0 && (
          <p className="text-xs text-muted-foreground mt-3 px-1">
            {users.length === 1
              ? t9('admin.singleUserCount', language).replace('{count}', String(users.length))
              : t9('admin.userCount', language).replace('{count}', String(users.length))
            }
          </p>
        )}
      </div>

      <Dialog open={!!editingUser} onOpenChange={(open) => { if (!open) setEditingUser(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t9('admin.editUser', language)}</DialogTitle>
            <DialogDescription>{t9('admin.editDescription', language)}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="edit-name" className="text-sm font-medium">{t9('admin.editName', language)}</Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(event) => { setEditName(event.target.value); setErrorMessage('') }}
                placeholder={t9('admin.enterDisplayName', language)}
                className="h-9 text-sm"
                maxLength={50}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-role" className="text-sm font-medium">{t9('admin.editRole', language)}</Label>
              <Select value={editRole} onValueChange={setEditRole}>
                <SelectTrigger id="edit-role" className="h-9 text-sm">
                  <SelectValue placeholder={t9('admin.selectRole', language)} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">{t9('profile.admin', language)}</SelectItem>
                  <SelectItem value="instructor">{t9('profile.instructor', language)}</SelectItem>
                  <SelectItem value="employee">{t9('profile.employee', language)}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {editingUser && (
              <p className="text-xs text-muted-foreground">
                {t9('admin.email', language)}: {editingUser.email}
              </p>
            )}
            {errorMessage && <p role="alert" className="text-xs text-red-500">{errorMessage}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" className="border-slate-200" onClick={() => setEditingUser(null)}>
              {t9('admin.cancel', language)}
            </Button>
            <Button onClick={handleSave} disabled={isSaving || !editName.trim()} className="bg-slate-900 hover:bg-slate-800 text-white">
              {isSaving ? <><Loader2 className="size-4 animate-spin" /> {t9('admin.saving', language)}</> : t9('admin.save', language)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
