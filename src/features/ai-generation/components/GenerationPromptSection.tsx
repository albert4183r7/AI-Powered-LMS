import { Label } from '@/components/ui/label'
import { t9, type Lang } from '@/lib/i18n'

interface GenerationPromptSectionProps {
  language: Lang
  prompt: string
  onPromptChange: (prompt: string) => void
}

export function GenerationPromptSection({
  language,
  prompt,
  onPromptChange,
}: GenerationPromptSectionProps) {
  return (
    <section className='rounded-2xl border border-border/70 bg-white p-4 shadow-sm sm:p-5'>
      <Label htmlFor='ai-module-prompt' className='text-sm font-semibold'>
        {t9('ai.promptLabel', language)}
      </Label>
      <p className='mt-1 text-xs leading-5 text-muted-foreground'>
        {t9('ai.promptHelp', language)}
      </p>
      <textarea
        id='ai-module-prompt'
        value={prompt}
        onChange={(event) => onPromptChange(event.target.value)}
        maxLength={5_000}
        rows={6}
        placeholder={t9('ai.promptPlaceholder', language)}
        className='mt-3 w-full resize-y rounded-xl border border-input bg-transparent px-3 py-2.5 text-sm leading-6 outline-none transition focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30'
      />
      <div className='mt-1.5 flex justify-between text-[11px] text-muted-foreground'>
        <span>{t9('ai.promptMinimum', language)}</span>
        <span>{prompt.length}/5000</span>
      </div>
    </section>
  )
}
