'use client'

import { useEffect, useState } from 'react'
import { useAppStore } from '@/store/app-store'
import { Loader2, Sparkles, ChevronRight } from 'lucide-react'
import type { ModuleGenerationJob } from '@/features/ai-generation/types'
import { t9, type Lang } from '@/lib/i18n'

export function GlobalAITracker() {
  const [activeJob, setActiveJob] = useState<ModuleGenerationJob | null>(null)
  const user = useAppStore(s => s.user)
  const currentPage = useAppStore(s => s.currentPage)
  const navigateTo = useAppStore(s => s.navigateTo)
  const lang = useAppStore(s => s.lang) as Lang

  useEffect(() => {
    let mounted = true
    let timeout: ReturnType<typeof setTimeout>

    const checkActiveJobs = async () => {
      // Check user state directly without making it a dependency of this effect
      const currentUser = useAppStore.getState().user
      if (!currentUser) {
        if (mounted) timeout = setTimeout(checkActiveJobs, 5000)
        return
      }

      try {
        const res = await fetch('/api/ai/generations/active')
        if (mounted && res.ok) {
          const jobs: ModuleGenerationJob[] = await res.json()
          if (jobs.length > 0) {
            setActiveJob(jobs[0])
          } else {
            setActiveJob(null)
          }
        }
      } catch (err) {
        // ignore errors to avoid console spam
      }

      if (mounted) {
        // Poll every 5 seconds
        timeout = setTimeout(checkActiveJobs, 5000)
      }
    }

    void checkActiveJobs()
    return () => {
      mounted = false
      clearTimeout(timeout)
    }
  }, [])

  // Don't show if we are already on the AI generate page or if there's no active job
  if (!activeJob || currentPage === 'ai-generate') return null

  // Ensure we only track active status
  if (activeJob.status === 'completed' || activeJob.status === 'failed') {
    return null
  }

  return (
    <button
      onClick={() => navigateTo('ai-generate')}
      className="fixed bottom-6 right-6 z-50 flex flex-col items-start gap-1.5 p-4 bg-white/95 backdrop-blur-md border border-emerald-200 shadow-xl shadow-emerald-900/10 rounded-xl hover:bg-emerald-50 hover:border-emerald-300 transition-all cursor-pointer group text-left animate-in slide-in-from-bottom-5 fade-in duration-300"
    >
      <div className="flex items-center justify-between w-full gap-4">
        <div className="flex items-center gap-2 text-emerald-700 font-semibold text-sm">
          <Sparkles className="size-4 text-emerald-500" />
          {lang === 'Mandarin' ? 'AI 正在生成模块...' : 'AI is generating a module...'}
        </div>
        <ChevronRight className="size-4 text-emerald-400 group-hover:text-emerald-600 transition-colors group-hover:translate-x-0.5" />
      </div>
      
      <div className="flex items-center gap-2 text-xs text-slate-500 font-medium ml-6">
        <Loader2 className="size-3.5 animate-spin text-emerald-600" />
        <span className="capitalize">{activeJob.stage}</span> 
        <span className="text-slate-300">•</span>
        <span>{activeJob.progress}%</span>
      </div>
      
      {/* Mini Progress Bar */}
      <div className="w-full h-1 bg-emerald-100 rounded-full mt-1 overflow-hidden">
        <div 
          className="h-full bg-emerald-500 transition-all duration-500 ease-out" 
          style={{ width: `${activeJob.progress}%` }} 
        />
      </div>
    </button>
  )
}
