import { cn } from '@/lib/utils'
import { t9, type Lang } from '@/lib/i18n'

interface GenerationDepthSectionProps {
  language: Lang
  selectedDepth: number
  onDepthChange: (depth: number) => void
}

export function GenerationDepthSection({
  language,
  selectedDepth,
  onDepthChange,
}: GenerationDepthSectionProps) {
  return (
    <section className='rounded-2xl border border-border/70 bg-white p-4 shadow-sm sm:p-5'>
      <h2 className='text-sm font-semibold'>{t9('ai.depthLabel', language)}</h2>
      <div className='mt-5 flex flex-col gap-4'>
        <div className='flex items-center justify-between text-xs font-semibold text-slate-900'>
          <span>1</span>
          <span className='rounded-md bg-emerald-50 px-3 py-1 text-sm text-emerald-700 border border-emerald-200'>
            {selectedDepth}
          </span>
          <span>10</span>
        </div>
        <input
          type='range'
          min='1'
          max='10'
          step='1'
          value={selectedDepth}
          onChange={(e) => onDepthChange(parseInt(e.target.value, 10))}
          className='h-2 w-full cursor-pointer appearance-none rounded-lg bg-slate-200 accent-emerald-600'
        />
      </div>
    </section>
  )
}
