import { requireAuthenticatedUser } from '@/server/auth/session'
import { handleApiError, successResponse } from '@/server/http/api-response'

export async function GET() {
  try {
    return successResponse({ user: await requireAuthenticatedUser() })
  } catch (error) {
    return handleApiError(error, 'Unable to restore your session.', 'auth.me')
  }
}
