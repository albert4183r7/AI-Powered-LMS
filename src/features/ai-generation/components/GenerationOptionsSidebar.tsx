import { CheckCircle2, Globe2, ImageIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import type { GenerationDepth } from '@/features/ai-generation/types'
import { t9, type Lang } from '@/lib/i18n'

interface GenerationOptionsSidebarProps {
  language: Lang
  outputLanguage: string
  selectedDepth: GenerationDepth
  useWebSearch: boolean
  useReferenceVisuals: boolean
  referenceFileCount: number
  errorMessage: string
  isReviewReady: boolean
  isSubmitting: boolean
  hasActiveJob: boolean
  onOutputLanguageChange: (outputLanguage: string) => void
  onUseWebSearchChange: (useWebSearch: boolean) => void
  onUseReferenceVisualsChange: (useReferenceVisuals: boolean) => void
  onStartGeneration: () => void
}

export function GenerationOptionsSidebar({
  language,
  outputLanguage,
  selectedDepth,
  useWebSearch,
  useReferenceVisuals,
  referenceFileCount,
  errorMessage,
  isReviewReady,
  isSubmitting,
  hasActiveJob,
  onOutputLanguageChange,
  onUseWebSearchChange,
  onUseReferenceVisualsChange,
  onStartGeneration,
}: GenerationOptionsSidebarProps) {
  return (
    <aside className='space-y-4 lg:sticky lg:top-20 lg:self-start'>
      <section className='rounded-2xl border border-border/70 bg-white p-4 shadow-sm'>
        <Label htmlFor='ai-output-language' className='text-sm font-semibold'>
          {t9('ai.outputLanguage', language)}
        </Label>
        <select
          id='ai-output-language'
          value={outputLanguage}
          onChange={(event) => onOutputLanguageChange(event.target.value)}
          className='mt-2 h-9 w-full rounded-md border border-input bg-white px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30'
        >
          <option value='English'>English</option>
          <option value='Indonesian'>Bahasa Indonesia</option>
          <option value='Mandarin'>中文</option>
        </select>
      </section>

      <section className='rounded-2xl border border-border/70 bg-white p-4 shadow-sm'>
        <h2 className='text-sm font-semibold'>{t9('ai.researchOptions', language)}</h2>
        <label className='mt-3 flex cursor-pointer items-start gap-3'>
          <input
            type='checkbox'
            checked={useWebSearch}
            onChange={(event) => onUseWebSearchChange(event.target.checked)}
            className='mt-0.5 size-4 rounded border-slate-300 accent-slate-900'
          />
          <span>
            <span className='flex items-center gap-1.5 text-xs font-semibold'>
              <Globe2 className='size-3.5' /> {t9('ai.webSearch', language)}
            </span>
            <span className='mt-1 block text-[11px] leading-4 text-muted-foreground'>
              {t9('ai.webSearchHelp', language)}
            </span>
          </span>
        </label>
        <label className='mt-4 flex cursor-pointer items-start gap-3'>
          <input
            type='checkbox'
            checked={useReferenceVisuals}
            onChange={(event) => onUseReferenceVisualsChange(event.target.checked)}
            className='mt-0.5 size-4 rounded border-slate-300 accent-slate-900'
          />
          <span>
            <span className='flex items-center gap-1.5 text-xs font-semibold'>
              <ImageIcon className='size-3.5' /> {t9('ai.referenceVisuals', language)}
            </span>
            <span className='mt-1 block text-[11px] leading-4 text-muted-foreground'>
              {t9('ai.referenceVisualsHelp', language)}
            </span>
          </span>
        </label>
      </section>

      {errorMessage && (
        <p role='alert' className='rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700'>
          {errorMessage}
        </p>
      )}

      <Button
        type='submit'
        disabled={isSubmitting || hasActiveJob}
        className='w-full bg-slate-950 text-white hover:bg-slate-800'
      >
        <CheckCircle2 className='size-4' /> {t9('ai.reviewRequest', language)}
      </Button>

      {isReviewReady && (
        <section className='rounded-2xl border border-emerald-200 bg-emerald-50 p-4'>
          <p className='flex items-center gap-1.5 text-sm font-semibold text-emerald-900'>
            <CheckCircle2 className='size-4' /> {t9('ai.requestReady', language)}
          </p>
          <dl className='mt-3 space-y-2 text-xs'>
            <div className='flex justify-between gap-2'>
              <dt className='text-emerald-700'>{t9('ai.outputLanguage', language)}</dt>
              <dd className='font-medium text-emerald-950'>{outputLanguage}</dd>
            </div>
            <div className='flex justify-between gap-2'>
              <dt className='text-emerald-700'>{t9('ai.depthLabel', language)}</dt>
              <dd className='font-medium capitalize text-emerald-950'>{selectedDepth}</dd>
            </div>
            <div className='flex justify-between gap-2'>
              <dt className='text-emerald-700'>{t9('ai.referenceCount', language)}</dt>
              <dd className='font-medium text-emerald-950'>{referenceFileCount}</dd>
            </div>
          </dl>
          <Button
            type='button'
            size='sm'
            disabled={isSubmitting || hasActiveJob}
            onClick={onStartGeneration}
            className='mt-4 w-full bg-emerald-900 text-white hover:bg-emerald-800'
          >
            {isSubmitting ? t9('ai.submitting', language) : t9('ai.startGeneration', language)}
          </Button>
        </section>
      )}
    </aside>
  )
}
