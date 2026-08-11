import { cn } from '@/lib/utils'
import { t9, type Lang } from '@/lib/i18n'
import type { GenerationDepth } from '@/features/ai-generation/types'

interface GenerationDepthSectionProps {
  language: Lang
  selectedDepth: GenerationDepth
  onDepthChange: (depth: GenerationDepth) => void
}

export function GenerationDepthSection({
  language,
  selectedDepth,
  onDepthChange,
}: GenerationDepthSectionProps) {
  const depthOptions: Array<{
    value: GenerationDepth
    title: string
    description: string
  }> = [
    {
      value: 'short',
      title: t9('ai.depthShort', language),
      description: t9('ai.depthShortDescription', language),
    },
    {
      value: 'standard',
      title: t9('ai.depthStandard', language),
      description: t9('ai.depthStandardDescription', language),
    },
    {
      value: 'comprehensive',
      title: t9('ai.depthComprehensive', language),
      description: t9('ai.depthComprehensiveDescription', language),
    },
  ]

  return (
    <section className='rounded-2xl border border-border/70 bg-white p-4 shadow-sm sm:p-5'>
      <h2 className='text-sm font-semibold'>{t9('ai.depthLabel', language)}</h2>
      <div className='mt-3 grid gap-2 sm:grid-cols-3'>
        {depthOptions.map((depthOption) => {
          const isSelected = selectedDepth === depthOption.value
          return (
            <button
              key={depthOption.value}
              type='button'
              onClick={() => onDepthChange(depthOption.value)}
              className={cn(
                'rounded-xl border p-3 text-left transition-colors',
                isSelected
                  ? 'border-slate-900 bg-slate-950 text-white'
                  : 'border-border bg-white hover:border-slate-300 hover:bg-slate-50',
              )}
            >
              <span className='block text-sm font-semibold'>{depthOption.title}</span>
              <span
                className={cn(
                  'mt-1 block text-xs leading-5',
                  isSelected ? 'text-slate-300' : 'text-muted-foreground',
                )}
              >
                {depthOption.description}
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
