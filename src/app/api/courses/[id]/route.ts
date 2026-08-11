import { getCourseDetails } from '@/server/services/catalog-service'
import { deleteCourse, updateCourse, type CourseUpdates } from '@/server/services/course-management-service'
import { ApiError, handleApiError, readJsonObject, successResponse } from '@/server/http/api-response'
import { enumValue, optionalString } from '@/server/validation/values'

interface CourseRouteContext {
  params: Promise<{ id: string }>
}

export async function GET(request: Request, { params }: CourseRouteContext) {
  try {
    const { id: courseId } = await params
    const userId = new URL(request.url).searchParams.get('userId') || undefined
    return successResponse(await getCourseDetails(courseId, userId))
  } catch (error) {
    return handleApiError(error, 'Failed to fetch course.', 'courses.get')
  }
}

export async function PATCH(request: Request, { params }: CourseRouteContext) {
  try {
    const { id: courseId } = await params
    const requestBody = await readJsonObject(request)
    const updates: CourseUpdates = {}

    if ('title' in requestBody) {
      updates.title = optionalString(requestBody.title, 'Title', { maxLength: 160 })
    }
    if ('cover' in requestBody) {
      if (requestBody.cover !== null && typeof requestBody.cover !== 'string') {
        throw new ApiError('Cover must be a string or null.', 400, 'VALIDATION_ERROR')
      }
      updates.cover = requestBody.cover as string | null
    }
    if ('status' in requestBody) {
      updates.status = enumValue(requestBody.status, 'Status', ['draft', 'published'] as const)
    }

    return successResponse(await updateCourse(courseId, updates))
  } catch (error) {
    return handleApiError(error, 'Failed to update course.', 'courses.update')
  }
}

export async function DELETE(_request: Request, { params }: CourseRouteContext) {
  try {
    const { id: courseId } = await params
    return successResponse(await deleteCourse(courseId))
  } catch (error) {
    return handleApiError(error, 'Failed to delete course.', 'courses.delete')
  }
}
