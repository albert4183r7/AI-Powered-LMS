import type {
  GeneratedLessonPlan,
  GeneratedModulePlan,
  GenerationJobStage,
  GenerationJobStatus,
  ModuleGenerationJob,
} from '@/features/ai-generation/types'

const GENERATION_JOB_STATUSES = new Set<GenerationJobStatus>([
  'queued',
  'processing',
  'completed',
  'failed',
  'cancelling',
  'cancelled',
])

const GENERATION_JOB_STAGES = new Set<GenerationJobStage>([
  'queued',
  'analyzing_references',
  'planning_module',
  'generating_presentations',
  'completed',
  'failed',
  'cancelling',
  'cancelled',
])

function readObject(value: unknown, fieldName: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`AI service response field ${fieldName} is invalid.`)
  }
  return value as Record<string, unknown>
}

function readString(value: unknown, fieldName: string): string {
  if (typeof value !== 'string') {
    throw new Error(`AI service response field ${fieldName} is invalid.`)
  }
  return value
}

function parseLessonPlan(value: unknown): GeneratedLessonPlan {
  const lessonPlan = readObject(value, 'lesson')
  if (!Array.isArray(lessonPlan.learning_objectives)) {
    throw new Error('AI service response field learning_objectives is invalid.')
  }
  return {
    title: readString(lessonPlan.title, 'lesson.title'),
    description: readString(lessonPlan.description, 'lesson.description'),
    learning_objectives: lessonPlan.learning_objectives.map((objective) => (
      readString(objective, 'lesson.learning_objectives')
    )),
    presentation_title: readString(
      lessonPlan.presentation_title,
      'lesson.presentation_title',
    ),
    presentations: Array.isArray(lessonPlan.presentations)
      ? lessonPlan.presentations
          .filter((p): p is Record<string, unknown> => 
            p !== null && typeof p === 'object' && typeof (p as Record<string, unknown>).fileName === 'string' && typeof (p as Record<string, unknown>).filePath === 'string'
          )
          .map((p) => ({
            fileName: p.fileName as string,
            filePath: p.filePath as string,
          }))
      : [],
  }
}

function parseModulePlan(value: unknown): GeneratedModulePlan {
  const modulePlan = readObject(value, 'result')
  if (!Array.isArray(modulePlan.lessons)) {
    throw new Error('AI service response field lessons is invalid.')
  }
  return {
    title: readString(modulePlan.title, 'result.title'),
    description: readString(modulePlan.description, 'result.description'),
    output_language: readString(modulePlan.output_language, 'result.output_language'),
    lessons: modulePlan.lessons.map(parseLessonPlan),
  }
}

export function parseModuleGenerationJob(value: unknown): ModuleGenerationJob {
  const generationJob = readObject(value, 'job')
  const status = readString(generationJob.status, 'status') as GenerationJobStatus
  const stage = readString(generationJob.stage, 'stage') as GenerationJobStage
  if (!GENERATION_JOB_STATUSES.has(status) || !GENERATION_JOB_STAGES.has(stage)) {
    throw new Error('AI service returned an unsupported generation state.')
  }
  if (
    typeof generationJob.progress !== 'number'
    || generationJob.progress < 0
    || generationJob.progress > 100
  ) {
    throw new Error('AI service response field progress is invalid.')
  }
  if (generationJob.error !== null && typeof generationJob.error !== 'string') {
    throw new Error('AI service response field error is invalid.')
  }

  return {
    id: readString(generationJob.id, 'id'),
    status,
    stage,
    progress: generationJob.progress,
    result: generationJob.result === null ? null : parseModulePlan(generationJob.result),
    error: generationJob.error,
    created_at: readString(generationJob.created_at, 'created_at'),
    updated_at: readString(generationJob.updated_at, 'updated_at'),
  }
}

export function isActiveGenerationStatus(status: GenerationJobStatus): boolean {
  return status === 'queued' || status === 'processing' || status === 'cancelling'
}
