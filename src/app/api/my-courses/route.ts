import { ApiError, handleApiError, successResponse } from '@/server/http/api-response'
import { listInstructorCourses } from '@/server/services/catalog-service'

export async function GET(request: Request) {
  try {
    const userId = new URL(request.url).searchParams.get('userId')
    if (!userId) {
      throw new ApiError('User ID is required.', 400, 'USER_ID_REQUIRED')
    }
    return successResponse(await listInstructorCourses(userId))
  } catch (error) {
    return handleApiError(error, 'Failed to fetch your courses.', 'courses.instructorList')
  }
}
