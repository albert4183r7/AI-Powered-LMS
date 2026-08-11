import { handleApiError, readJsonObject, successResponse } from '@/server/http/api-response'
import { updateDisplayName } from '@/server/services/user-service'
import { requiredString } from '@/server/validation/values'

export async function POST(request: Request) {
  try {
    const requestBody = await readJsonObject(request)
    const userId = requiredString(requestBody.userId, 'User ID')
    const name = requiredString(requestBody.name, 'Name', { maxLength: 100 })
    return successResponse(await updateDisplayName(userId, name))
  } catch (error) {
    return handleApiError(error, 'Failed to update name.', 'users.updateName')
  }
}
