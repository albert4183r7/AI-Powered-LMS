import type { UserRole } from '@/features/users/types'
import { handleApiError, readJsonObject, successResponse } from '@/server/http/api-response'
import { listUsers, updateUser } from '@/server/services/user-service'
import { enumValue, optionalString, requiredString } from '@/server/validation/values'

const USER_ROLES = ['admin', 'instructor', 'employee'] as const

export async function GET(request: Request) {
  try {
    const searchTerm = new URL(request.url).searchParams.get('search')?.trim() || ''
    return successResponse(await listUsers(searchTerm))
  } catch (error) {
    return handleApiError(error, 'Failed to fetch users.', 'admin.users.list')
  }
}

export async function POST(request: Request) {
  try {
    const requestBody = await readJsonObject(request)
    const userId = requiredString(requestBody.userId, 'User ID')
    const name = optionalString(requestBody.name, 'Name', { maxLength: 100 })
    const role = requestBody.role === undefined
      ? undefined
      : enumValue(requestBody.role, 'Role', USER_ROLES) as UserRole
    return successResponse(await updateUser(userId, { name, role }))
  } catch (error) {
    return handleApiError(error, 'Failed to update user.', 'admin.users.update')
  }
}
