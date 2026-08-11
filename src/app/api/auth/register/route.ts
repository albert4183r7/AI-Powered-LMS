import { registerUser } from '@/server/services/user-service'
import { handleApiError, readJsonObject, successResponse } from '@/server/http/api-response'
import { enumValue, optionalString, requiredString } from '@/server/validation/values'
import { attachSessionCookie } from '@/server/auth/session'

const REGISTRATION_ROLES = ['instructor', 'employee'] as const

export async function POST(request: Request) {
  try {
    const requestBody = await readJsonObject(request)
    const email = requiredString(requestBody.email, 'Email', { maxLength: 254 })
    const password = requiredString(requestBody.password, 'Password', { minLength: 6, maxLength: 256 })
    const name = optionalString(requestBody.name, 'Name', { maxLength: 100 })
    const role = enumValue(requestBody.role, 'Role', REGISTRATION_ROLES)

    const registrationResult = await registerUser({ email, password, name, role })
    const response = successResponse(registrationResult, 201)
    attachSessionCookie(response, registrationResult.user.id)
    return response
  } catch (error) {
    return handleApiError(error, 'Registration failed.', 'auth.register')
  }
}
