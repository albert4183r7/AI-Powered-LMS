import { requireAuthenticatedUser } from '@/server/auth/session'
import { requestAiServiceMultipart } from '@/server/ai/ai-service-client'
import { handleApiError, successResponse } from '@/server/http/api-response'

const AI_AUTHOR_ROLES = ['instructor', 'admin'] as const

export async function POST(request: Request) {
  try {
    const authenticatedUser = await requireAuthenticatedUser(AI_AUTHOR_ROLES)
    const formData = await request.formData()
    const referenceFile = formData.get('file')

    if (!(referenceFile instanceof File)) {
      return Response.json(
        { error: 'A file is required.', code: 'FILE_REQUIRED' },
        { status: 400 },
      )
    }

    const uploadFormData = new FormData()
    uploadFormData.append('file', referenceFile, referenceFile.name)

    const uploadedFile = await requestAiServiceMultipart(
      '/v1/references/upload',
      authenticatedUser.id,
      uploadFormData,
    )

    return successResponse(uploadedFile, 201)
  } catch (error) {
    return handleApiError(
      error,
      'Unable to upload reference file.',
      'ai.references.upload',
    )
  }
}
