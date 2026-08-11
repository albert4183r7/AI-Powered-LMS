import { requireAuthenticatedUser } from '@/server/auth/session'
import { requestAiService } from '@/server/ai/ai-service-client'
import {
  handleApiError,
  readJsonObject,
  successResponse,
} from '@/server/http/api-response'

const AI_AUTHOR_ROLES = ['instructor', 'admin'] as const

export async function POST(request: Request) {
  try {
    const authenticatedUser = await requireAuthenticatedUser(AI_AUTHOR_ROLES)
    const generationRequest = await readJsonObject(request)
    const generationJob = await requestAiService(
      '/v1/generations/modules',
      authenticatedUser.id,
      {
        method: 'POST',
        body: JSON.stringify(generationRequest),
      },
    )
    return successResponse(generationJob, 202)
  } catch (error) {
    return handleApiError(
      error,
      'Unable to start module generation.',
      'ai.generations.modules.create',
    )
  }
}
