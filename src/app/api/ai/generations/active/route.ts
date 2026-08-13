import { requireAuthenticatedUser } from '@/server/auth/session'
import { requestAiService } from '@/server/ai/ai-service-client'
import {
  handleApiError,
  successResponse,
} from '@/server/http/api-response'

const AI_AUTHOR_ROLES = ['instructor', 'admin'] as const

export async function GET(request: Request) {
  try {
    const authenticatedUser = await requireAuthenticatedUser(AI_AUTHOR_ROLES)
    const activeJobs = await requestAiService(
      '/v1/generations/active',
      authenticatedUser.id,
      {
        method: 'GET',
      },
    )
    return successResponse(activeJobs, 200)
  } catch (error) {
    return handleApiError(
      error,
      'Unable to fetch active module generations.',
      'ai.generations.active.get',
    )
  }
}

