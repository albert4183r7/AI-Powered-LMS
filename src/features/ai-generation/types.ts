
export type GenerationJobStatus =
  | 'queued'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelling'
  | 'cancelled'

export type GenerationJobStage =
  | 'queued'
  | 'analyzing_references'
  | 'planning_module'
  | 'generating_presentations'
  | 'completed'
  | 'failed'
  | 'cancelling'
  | 'cancelled'

export interface ModuleGenerationRequest {
  prompt: string
  output_language: string
  depth: number
  use_web_search: boolean
  reference_file_ids: string[]
  use_reference_visuals: boolean
}

export interface GeneratedLessonPlan {
  title: string
  description: string
  learning_objectives: string[]
  presentation_title: string
  presentations?: { fileName: string; filePath: string }[]
}

export interface GeneratedModulePlan {
  title: string
  description: string
  output_language: string
  lessons: GeneratedLessonPlan[]
}

export interface ModuleGenerationJob {
  id: string
  status: GenerationJobStatus
  stage: GenerationJobStage
  progress: number
  result: GeneratedModulePlan | null
  error: string | null
  created_at: string
  updated_at: string
}

export type ReferenceFileValidationErrorKey =
  | 'ai.unsupportedFile'
  | 'ai.fileTooLarge'
  | 'ai.tooManyFiles'

export type GenerationFormErrorKey =
  | ReferenceFileValidationErrorKey
  | 'home.aiPromptMinimum'
  | 'ai.referencesUnavailable'

export type ReferenceFileUploadStatus = 'pending' | 'uploading' | 'uploaded' | 'failed'

export interface ReferenceFileUploadRecord {
  file: File
  status: ReferenceFileUploadStatus
  fileId: string | null
  extractedTextLength: number
  extractedImageCount: number
  errorMessage: string | null
}

export interface ReferenceFileMergeResult {
  referenceFiles: File[]
  errorKey: ReferenceFileValidationErrorKey | null
}
