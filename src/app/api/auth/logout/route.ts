import { clearSessionCookie } from '@/server/auth/session'
import { successResponse } from '@/server/http/api-response'

export async function POST() {
  const response = successResponse({ success: true })
  clearSessionCookie(response)
  return response
}
