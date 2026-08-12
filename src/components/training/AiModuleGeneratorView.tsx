'use client'

import { useState } from 'react'
import { ArrowLeft, Sparkles } from 'lucide-react'

import { GenerationDepthSection } from '@/features/ai-generation/components/GenerationDepthSection'
import { GenerationOptionsSidebar } from '@/features/ai-generation/components/GenerationOptionsSidebar'
import { GenerationPromptSection } from '@/features/ai-generation/components/GenerationPromptSection'
import { GenerationProgressPanel } from '@/features/ai-generation/components/GenerationProgressPanel'
import { ReferenceFilesSection } from '@/features/ai-generation/components/ReferenceFilesSection'
import { isActiveGenerationStatus } from '@/features/ai-generation/generation-job-contract'
import { mergeValidReferenceFiles } from '@/features/ai-generation/reference-file-validation'
import type {
  GenerationFormErrorKey,
} from '@/features/ai-generation/types'
import { useModuleGenerationJob } from '@/features/ai-generation/use-module-generation-job'
import { t9, type Lang } from '@/lib/i18n'
import { useAppStore } from '@/store/app-store'

export function AiModuleGeneratorView() {
  const storedPrompt = useAppStore((state) => state.aiGenerationPrompt)
  const interfaceLanguage = useAppStore((state) => state.lang) as Lang
  const user = useAppStore((state) => state.user)
  const setCurrentPage = useAppStore((state) => state.setCurrentPage)
  const setSelectedCourseId = useAppStore((state) => state.setSelectedCourseId)

  const [prompt, setPrompt] = useState(storedPrompt)
  const [outputLanguage, setOutputLanguage] = useState(
    interfaceLanguage === 'Mandarin' ? 'Mandarin' : 'English',
  )
  const [selectedDepth, setSelectedDepth] = useState<number>(5)
  const [useWebSearch, setUseWebSearch] = useState(false)
  const [useReferenceVisuals, setUseReferenceVisuals] = useState(true)
  const [referenceFiles, setReferenceFiles] = useState<File[]>([])
  const [validationErrorKey, setValidationErrorKey] =
    useState<GenerationFormErrorKey | null>(null)
  const [isReviewReady, setIsReviewReady] = useState(false)
  const {
    generationJob,
    requestError,
    pollingError,
    isSubmitting,
    isCancelling,
    referenceUploadRecords,
    startGeneration,
    retryGeneration,
    cancelGeneration,
  } = useModuleGenerationJob()
  const [isPublishing, setIsPublishing] = useState(false)
  const hasActiveJob = generationJob
    ? isActiveGenerationStatus(generationJob.status)
    : false

  const markGenerationRequestChanged = () => {
    setValidationErrorKey(null)
    setIsReviewReady(false)
  }

  const handleReferenceFilesSelected = (selectedReferenceFiles: File[]) => {
    const mergeResult = mergeValidReferenceFiles(referenceFiles, selectedReferenceFiles)
    setReferenceFiles(mergeResult.referenceFiles)
    setValidationErrorKey(mergeResult.errorKey)
    setIsReviewReady(false)
  }

  const handlePublishDraft = async () => {
    if (!generationJob?.result || !user?.id) return
    
    setIsPublishing(true)
    try {
      const res = await fetch('/api/courses/publish-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          modulePlan: generationJob.result
        })
      })
      
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to publish draft')
      
      // Redirect to course editor
      setSelectedCourseId(data.course.id)
      setCurrentPage('course-detail')
    } catch (err) {
      console.error(err)
      alert(err instanceof Error ? err.message : 'Publish failed')
    } finally {
      setIsPublishing(false)
    }
  }

  const handleReferenceFileRemoved = (referenceFileToRemove: File) => {
    setReferenceFiles((currentReferenceFiles) => currentReferenceFiles.filter(
      (referenceFile) => referenceFile !== referenceFileToRemove,
    ))
    markGenerationRequestChanged()
  }

  const handleReviewRequested = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (hasActiveJob) return
    if (prompt.trim().length < 20) {
      setValidationErrorKey('home.aiPromptMinimum')
      return
    }
    setValidationErrorKey(null)
    setIsReviewReady(true)
  }

  const handleGenerationStart = async () => {
    const generationStarted = await startGeneration(
      {
        prompt: prompt.trim(),
        output_language: outputLanguage,
        depth: selectedDepth,
        use_web_search: useWebSearch,
        reference_file_ids: [],
        use_reference_visuals: useReferenceVisuals,
      },
      referenceFiles,
    )
    if (generationStarted) {
      setIsReviewReady(false)
    }
  }

  const validationErrorMessage = validationErrorKey
    ? t9(validationErrorKey, interfaceLanguage)
    : ''

  return (
    <div className='mt-6'>
      <div className='mb-5 flex items-start gap-3'>
        <div className='flex size-10 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-emerald-300'>
          <Sparkles className='size-5' />
        </div>
        <div>
          <h2 className='text-xl font-bold text-slate-950 sm:text-2xl'>
            {t9('ai.title', interfaceLanguage)}
          </h2>
          <p className='mt-1 max-w-2xl text-sm leading-6 text-muted-foreground'>
            {t9('ai.subtitle', interfaceLanguage)}
          </p>
        </div>
      </div>

      <form
        onSubmit={handleReviewRequested}
        className='grid gap-5 lg:grid-cols-[minmax(0,1fr)_19rem]'
        >
          <div className='space-y-5'>
            <GenerationPromptSection
              language={interfaceLanguage}
              prompt={prompt}
              onPromptChange={(updatedPrompt) => {
                setPrompt(updatedPrompt)
                markGenerationRequestChanged()
              }}
            />
            <GenerationDepthSection
              language={interfaceLanguage}
              selectedDepth={selectedDepth}
              onDepthChange={(updatedDepth) => {
                setSelectedDepth(updatedDepth)
                markGenerationRequestChanged()
              }}
            />
            <ReferenceFilesSection
              language={interfaceLanguage}
              referenceFiles={referenceFiles}
              referenceUploadRecords={referenceUploadRecords}
              onReferenceFilesSelected={handleReferenceFilesSelected}
              onReferenceFileRemoved={handleReferenceFileRemoved}
            />
            <GenerationProgressPanel
              language={interfaceLanguage}
              generationJob={generationJob}
              requestError={requestError}
              pollingError={pollingError}
              isCancelling={isCancelling}
              onCancel={() => void cancelGeneration()}
              onRetry={() => void retryGeneration(referenceFiles)}
              isPublishing={isPublishing}
              onPublish={generationJob?.status === 'completed' ? () => void handlePublishDraft() : undefined}
            />
          </div>

          <GenerationOptionsSidebar
            language={interfaceLanguage}
            outputLanguage={outputLanguage}
            selectedDepth={selectedDepth}
            useWebSearch={useWebSearch}
            useReferenceVisuals={useReferenceVisuals}
            referenceFileCount={referenceFiles.length}
            errorMessage={validationErrorMessage}
            isReviewReady={isReviewReady}
            isSubmitting={isSubmitting}
            hasActiveJob={hasActiveJob}
            onOutputLanguageChange={(updatedOutputLanguage) => {
              setOutputLanguage(updatedOutputLanguage)
              markGenerationRequestChanged()
            }}
            onUseWebSearchChange={(shouldUseWebSearch) => {
              setUseWebSearch(shouldUseWebSearch)
              markGenerationRequestChanged()
            }}
            onUseReferenceVisualsChange={(shouldUseReferenceVisuals) => {
              setUseReferenceVisuals(shouldUseReferenceVisuals)
              markGenerationRequestChanged()
            }}
            onStartGeneration={() => void handleGenerationStart()}
          />
        </form>
    </div>
  )
}
