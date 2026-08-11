import { authenticateUser } from '@/server/services/user-service'
import { handleApiError, readJsonObject, successResponse } from '@/server/http/api-response'
import { requiredString } from '@/server/validation/values'
import { attachSessionCookie } from '@/server/auth/session'

export async function POST(request: Request) {
  try {
    const requestBody = await readJsonObject(request)
    const email = requiredString(requestBody.email, 'Email', { maxLength: 254 })
    const password = requiredString(requestBody.password, 'Password', { maxLength: 256 })
    const authenticationResult = await authenticateUser(email, password)
    const response = successResponse(authenticationResult)
    attachSessionCookie(response, authenticationResult.user.id)
    return response
  } catch (error) {
    return handleApiError(error, 'Login failed.', 'auth.login')
  }
}
