'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import {
  isActiveGenerationStatus,
  parseModuleGenerationJob,
} from '@/features/ai-generation/generation-job-contract'
import type {
  ModuleGenerationJob,
  ModuleGenerationRequest,
  ReferenceFileUploadRecord,
  ReferenceFileUploadStatus,
} from '@/features/ai-generation/types'
import { apiRequest } from '@/lib/api-client'

const POLLING_DELAYS_MILLISECONDS = [750, 1_500, 3_000, 5_000, 8_000] as const

function getUserSafeErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'The generation request could not be completed.'
}

interface UploadedReferenceResult {
  file_id: string
  extracted_text_length: number
  extracted_image_count: number
}

async function uploadReferenceFile(file: File): Promise<UploadedReferenceResult> {
  const formData = new FormData()
  formData.append('file', file, file.name)

  const response = await fetch('/api/ai/references/upload', {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    let errorMessage = 'Failed to upload reference file.'
    try {
      const body = await response.json() as { error?: string; detail?: string }
      errorMessage = body.detail ?? body.error ?? errorMessage
    } catch {
      // keep the default message
    }
    throw new Error(errorMessage)
  }

  return response.json() as Promise<UploadedReferenceResult>
}

export function useModuleGenerationJob() {
  const [generationJob, setGenerationJob] = useState<ModuleGenerationJob | null>(null)
  const [lastGenerationRequest, setLastGenerationRequest] =
    useState<ModuleGenerationRequest | null>(null)
  const [requestError, setRequestError] = useState<string | null>(null)
  const [pollingError, setPollingError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)
  const [referenceUploadRecords, setReferenceUploadRecords] = useState<
    ReferenceFileUploadRecord[]
  >([])
  const pollingAttempt = useRef(0)
  const activeGenerationJobId = generationJob
    && isActiveGenerationStatus(generationJob.status)
    ? generationJob.id
    : null

  // Hydrate active job on initial mount
  useEffect(() => {
    let mounted = true
    const hydrateActiveJob = async () => {
      try {
        const responsePayload = await apiRequest<unknown[]>('/api/ai/generations/active')
        if (mounted && Array.isArray(responsePayload) && responsePayload.length > 0) {
          // Just hydrate the first active job we find
          const activeJob = parseModuleGenerationJob(responsePayload[0])
          setGenerationJob((prev) => {
            // only set if we don't already have one to avoid race conditions with the start mechanism
            if (!prev || !isActiveGenerationStatus(prev.status)) {
              return activeJob
            }
            return prev
          })
        }
      } catch {
        // ignore errors during hydration
      }
    }
    void hydrateActiveJob()
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    if (!activeGenerationJobId) return

    let stopped = false
    let pollingTimer: ReturnType<typeof setTimeout> | undefined
    const pollingController = new AbortController()

    const scheduleNextPoll = () => {
      const delayIndex = Math.min(
        pollingAttempt.current,
        POLLING_DELAYS_MILLISECONDS.length - 1,
      )
      const pollingDelay = POLLING_DELAYS_MILLISECONDS[delayIndex]
      pollingAttempt.current += 1
      pollingTimer = setTimeout(() => void pollGenerationJob(), pollingDelay)
    }

    const pollGenerationJob = async () => {
      try {
        const responsePayload = await apiRequest<unknown>(
          `/api/ai/generations/${encodeURIComponent(activeGenerationJobId)}`,
          { signal: pollingController.signal },
        )
        if (stopped) return
        const updatedGenerationJob = parseModuleGenerationJob(responsePayload)
        setGenerationJob(updatedGenerationJob)
        setPollingError(null)
        if (isActiveGenerationStatus(updatedGenerationJob.status)) {
          scheduleNextPoll()
        }
      } catch (error) {
        if (stopped || pollingController.signal.aborted) return
        setPollingError(getUserSafeErrorMessage(error))
        scheduleNextPoll()
      }
    }

    pollingAttempt.current = 0
    scheduleNextPoll()
    return () => {
      stopped = true
      pollingController.abort()
      if (pollingTimer) clearTimeout(pollingTimer)
    }
  }, [activeGenerationJobId])

  const updateUploadRecord = useCallback(
    (file: File, updates: Partial<ReferenceFileUploadRecord>) => {
      setReferenceUploadRecords((prev) =>
        prev.map((record) =>
          record.file === file ? { ...record, ...updates } : record,
        ),
      )
    },
    [],
  )

  const startGeneration = useCallback(async (
    generationRequest: ModuleGenerationRequest,
    referenceFiles: readonly File[],
  ): Promise<boolean> => {
    setLastGenerationRequest(generationRequest)
    setRequestError(null)
    setPollingError(null)
    setIsSubmitting(true)

    // Initialise upload records for all selected reference files.
    const initialRecords: ReferenceFileUploadRecord[] = referenceFiles.map((file) => ({
      file,
      status: 'pending' as ReferenceFileUploadStatus,
      fileId: null,
      extractedTextLength: 0,
      extractedImageCount: 0,
      errorMessage: null,
    }))
    setReferenceUploadRecords(initialRecords)

    // Upload each reference file sequentially.
    const uploadedFileIds: string[] = []
    for (const file of referenceFiles) {
      updateUploadRecord(file, { status: 'uploading' })
      try {
        const result = await uploadReferenceFile(file)
        uploadedFileIds.push(result.file_id)
        updateUploadRecord(file, {
          status: 'uploaded',
          fileId: result.file_id,
          extractedTextLength: result.extracted_text_length,
          extractedImageCount: result.extracted_image_count,
        })
      } catch (uploadError) {
        const errorMessage = getUserSafeErrorMessage(uploadError)
        updateUploadRecord(file, { status: 'failed', errorMessage })
        setRequestError(`Reference upload failed: ${errorMessage}`)
        setIsSubmitting(false)
        return false
      }
    }

    // Start generation with the collected file IDs.
    try {
      const requestWithFileIds: ModuleGenerationRequest = {
        ...generationRequest,
        reference_file_ids: uploadedFileIds,
      }
      const responsePayload = await apiRequest<unknown>(
        '/api/ai/generations/modules',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(requestWithFileIds),
        },
      )
      setGenerationJob(parseModuleGenerationJob(responsePayload))
      return true
    } catch (error) {
      setRequestError(getUserSafeErrorMessage(error))
      return false
    } finally {
      setIsSubmitting(false)
    }
  }, [updateUploadRecord])

  const retryGeneration = useCallback(async (
    referenceFiles: readonly File[],
  ): Promise<void> => {
    if (lastGenerationRequest) {
      await startGeneration(lastGenerationRequest, referenceFiles)
    }
  }, [lastGenerationRequest, startGeneration])

  const cancelGeneration = useCallback(async (): Promise<void> => {
    if (!generationJob || !isActiveGenerationStatus(generationJob.status)) return
    setRequestError(null)
    setIsCancelling(true)
    try {
      const responsePayload = await apiRequest<unknown>(
        `/api/ai/generations/${encodeURIComponent(generationJob.id)}/cancel`,
        { method: 'POST' },
      )
      setGenerationJob(parseModuleGenerationJob(responsePayload))
    } catch (error) {
      setRequestError(getUserSafeErrorMessage(error))
    } finally {
      setIsCancelling(false)
    }
  }, [generationJob])

  return {
    generationJob,
    requestError,
    pollingError,
    isSubmitting,
    isCancelling,
    referenceUploadRecords,
    startGeneration,
    retryGeneration,
    cancelGeneration,
  }
}
