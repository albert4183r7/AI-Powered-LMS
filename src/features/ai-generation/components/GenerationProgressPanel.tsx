import {
  Ban,
  CheckCircle2,
  FileStack,
  LoaderCircle,
  RefreshCw,
  XCircle,
  Download,
  BookOpenCheck,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { isActiveGenerationStatus } from '@/features/ai-generation/generation-job-contract'
import type { ModuleGenerationJob } from '@/features/ai-generation/types'
import { t9, type Lang } from '@/lib/i18n'

interface GenerationProgressPanelProps {
  language: Lang
  generationJob: ModuleGenerationJob | null
  requestError: string | null
  pollingError: string | null
  isCancelling: boolean
  onCancel: () => void
  onRetry: () => void
  isPublishing?: boolean
  onPublish?: () => void
}

const STATUS_TRANSLATION_KEYS: Record<ModuleGenerationJob['status'], string> = {
  queued: 'ai.statusQueued',
  processing: 'ai.statusProcessing',
  completed: 'ai.statusCompleted',
  failed: 'ai.statusFailed',
  cancelling: 'ai.statusCancelling',
  cancelled: 'ai.statusCancelled',
}

const STAGE_TRANSLATION_KEYS: Record<ModuleGenerationJob['stage'], string> = {
  queued: 'ai.stageQueued',
  planning_module: 'ai.stagePlanning',
  completed: 'ai.stageCompleted',
  failed: 'ai.stageFailed',
  cancelling: 'ai.stageCancelling',
  cancelled: 'ai.stageCancelled',
}

export function GenerationProgressPanel({
  language,
  generationJob,
  requestError,
  pollingError,
  isCancelling,
  onCancel,
  onRetry,
  isPublishing,
  onPublish,
}: GenerationProgressPanelProps) {
  if (!generationJob && !requestError) return null

  const isActive = generationJob
    ? isActiveGenerationStatus(generationJob.status)
    : false
  const canRetry = !isActive && (
    !generationJob
    || generationJob.status === 'failed'
    || generationJob.status === 'cancelled'
  )
  const modulePlan = generationJob?.status === 'completed'
    ? generationJob.result
    : null

  return (
    <section
      aria-labelledby='ai-generation-progress-title'
      className='rounded-2xl border border-border/70 bg-white p-4 shadow-sm sm:p-5'
    >
      <div aria-live='polite' aria-atomic='true' className='flex items-start gap-3'>
        <div className='mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-slate-100'>
          {isActive ? (
            <LoaderCircle className='size-5 animate-spin text-slate-700' />
          ) : generationJob?.status === 'completed' ? (
            <CheckCircle2 className='size-5 text-emerald-600' />
          ) : (
            <XCircle className='size-5 text-amber-600' />
          )}
        </div>
        <div className='min-w-0 flex-1'>
          <h2 id='ai-generation-progress-title' className='font-semibold text-slate-950'>
            {generationJob
              ? t9(STATUS_TRANSLATION_KEYS[generationJob.status], language)
              : t9('ai.statusRequestFailed', language)}
          </h2>
          {generationJob && (
            <p className='mt-1 text-sm text-muted-foreground'>
              {t9(STAGE_TRANSLATION_KEYS[generationJob.stage], language)}
            </p>
          )}
        </div>
      </div>

      {pollingError && isActive && (
        <p role='status' className='mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800'>
          {t9('ai.pollingDelayed', language)} {pollingError}
        </p>
      )}

      {(requestError || generationJob?.error) && (
        <p role='alert' className='mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700'>
          {requestError || generationJob?.error}
        </p>
      )}

      {isActive && generationJob?.status !== 'cancelling' && (
        <div className='mt-4'>
          <Button
            type='button'
            variant='outline'
            size='sm'
            disabled={isCancelling}
            onClick={onCancel}
          >
            <Ban className='size-4' />
            {isCancelling ? t9('ai.cancellingAction', language) : t9('ai.cancelGeneration', language)}
          </Button>
        </div>
      )}

      {canRetry && (
        <div className='mt-4'>
          <Button type='button' variant='outline' size='sm' onClick={onRetry}>
            <RefreshCw className='size-4' /> {t9('ai.retryGeneration', language)}
          </Button>
        </div>
      )}

      {modulePlan && (
        <div className='mt-5 border-t border-border/70 pt-5'>
          <div className='flex items-start gap-3'>
            <FileStack className='mt-0.5 size-5 shrink-0 text-emerald-700' />
            <div>
              <p className='text-[11px] font-semibold uppercase tracking-wider text-emerald-700'>
                {t9('ai.draftPreview', language)}
              </p>
              <h3 className='mt-1 text-lg font-bold text-slate-950'>{modulePlan.title}</h3>
              <p className='mt-2 text-sm leading-6 text-muted-foreground'>
                {modulePlan.description}
              </p>
            </div>
          </div>
          <ol className='mt-4 space-y-3'>
            {modulePlan.lessons.map((lesson, lessonIndex) => (
              <li
                key={`${lessonIndex}-${lesson.title}`}
                className='rounded-xl border border-border/60 bg-slate-50 p-3'
              >
                <p className='text-sm font-semibold text-slate-900'>
                  {lessonIndex + 1}. {lesson.title}
                </p>
                <p className='mt-1 text-xs leading-5 text-muted-foreground'>
                  {lesson.description}
                </p>
                <p className='mt-2 text-[11px] font-medium text-slate-600'>
                  {t9('ai.presentationPlan', language)}: {lesson.presentation_title}
                </p>
                <div className='mt-3 space-y-2'>
                  <p className='text-xs font-semibold text-slate-800 flex items-center gap-1.5'>
                    <BookOpenCheck className='size-3.5 text-emerald-600' /> {t9('ai.learningObjectives', language)}:
                  </p>
                  <ul className='ml-5 list-disc space-y-1 text-xs text-slate-600'>
                    {lesson.learning_objectives?.map((objective, i) => (
                      <li key={i}>{objective}</li>
                    ))}
                  </ul>
                </div>
                {lesson.presentations && lesson.presentations.length > 0 && (
                  <div className='mt-4 flex flex-wrap gap-2 border-t border-border/50 pt-3'>
                    {lesson.presentations.map((presentation, i) => {
                      const downloadUrl = `/api/ai/download?path=${encodeURIComponent(presentation.filePath)}`
                      return (
                        <a
                          key={i}
                          href={downloadUrl}
                          target='_blank'
                          rel='noopener noreferrer'
                          className='inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-emerald-700 transition-colors'
                        >
                          <Download className='size-3.5' />
                          {presentation.fileName}
                        </a>
                      )
                    })}
                  </div>
                )}
              </li>
            ))}
          </ol>
          {onPublish && (
            <div className='mt-6 border-t border-border/70 pt-5 flex justify-end'>
              <Button
                type='button'
                onClick={onPublish}
                disabled={isPublishing}
                className='w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white'
              >
                {isPublishing ? (
                  <>
                    <LoaderCircle className='mr-2 size-4 animate-spin' />
                    {t9('ai.publishing', language) || 'Publishing...'}
                  </>
                ) : (
                  t9('ai.publishModule', language) || 'Save & Publish Draft'
                )}
              </Button>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
