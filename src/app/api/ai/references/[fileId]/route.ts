import { requireAuthenticatedUser } from '@/server/auth/session'
import { requestAiService } from '@/server/ai/ai-service-client'
import { handleApiError, successResponse } from '@/server/http/api-response'

const AI_AUTHOR_ROLES = ['instructor', 'admin'] as const

interface ReferenceFileRouteContext {
  params: Promise<{ fileId: string }>
}

export async function GET(
  _request: Request,
  context: ReferenceFileRouteContext,
) {
  try {
    const authenticatedUser = await requireAuthenticatedUser(AI_AUTHOR_ROLES)
    const { fileId } = await context.params

    const metadata = await requestAiService(
      `/v1/references/${encodeURIComponent(fileId)}`,
      authenticatedUser.id,
    )
    return successResponse(metadata)
  } catch (error) {
    return handleApiError(
      error,
      'Unable to load reference file metadata.',
      'ai.references.metadata',
    )
  }
}

export async function DELETE(
  _request: Request,
  context: ReferenceFileRouteContext,
) {
  try {
    const authenticatedUser = await requireAuthenticatedUser(AI_AUTHOR_ROLES)
    const { fileId } = await context.params

    await requestAiService(
      `/v1/references/${encodeURIComponent(fileId)}`,
      authenticatedUser.id,
      { method: 'DELETE' },
    )
    return new Response(null, { status: 204 })
  } catch (error) {
    return handleApiError(
      error,
      'Unable to delete reference file.',
      'ai.references.delete',
    )
  }
}
