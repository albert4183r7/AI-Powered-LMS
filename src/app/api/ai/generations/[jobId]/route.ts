import { requestAiService } from '@/server/ai/ai-service-client'
import { requireAuthenticatedUser } from '@/server/auth/session'
import { ApiError, handleApiError, successResponse } from '@/server/http/api-response'

const AI_AUTHOR_ROLES = ['instructor', 'admin'] as const
const GENERATION_JOB_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

interface GenerationStatusRouteContext {
  params: Promise<{ jobId: string }>
}

export async function GET(
  _request: Request,
  context: GenerationStatusRouteContext,
) {
  try {
    const authenticatedUser = await requireAuthenticatedUser(AI_AUTHOR_ROLES)
    const { jobId } = await context.params
    if (!GENERATION_JOB_ID_PATTERN.test(jobId)) {
      throw new ApiError(
        'Generation job ID is invalid.',
        400,
        'INVALID_GENERATION_JOB_ID',
      )
    }

    const generationJob = await requestAiService(
      '/v1/generations/' + encodeURIComponent(jobId),
      authenticatedUser.id,
    )
    return successResponse(generationJob)
  } catch (error) {
    return handleApiError(
      error,
      'Unable to load module-generation progress.',
      'ai.generations.status',
    )
  }
}
