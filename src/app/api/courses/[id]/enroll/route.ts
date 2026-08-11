import { handleApiError, readJsonObject, successResponse } from '@/server/http/api-response'
import { enrollUser, unenrollUser } from '@/server/services/enrollment-service'
import { requiredString } from '@/server/validation/values'

interface EnrollmentRouteContext {
  params: Promise<{ id: string }>
}

export async function POST(request: Request, { params }: EnrollmentRouteContext) {
  try {
    const { id: courseId } = await params
    const requestBody = await readJsonObject(request)
    const userId = requiredString(requestBody.userId, 'User ID')
    return successResponse(await enrollUser(courseId, userId), 201)
  } catch (error) {
    return handleApiError(error, 'Failed to enroll.', 'enrollments.create')
  }
}

export async function DELETE(request: Request, { params }: EnrollmentRouteContext) {
  try {
    const { id: courseId } = await params
    const searchParams = new URL(request.url).searchParams
    const userId = requiredString(searchParams.get('userId'), 'User ID')
    return successResponse(await unenrollUser(courseId, userId))
  } catch (error) {
    return handleApiError(error, 'Failed to unenroll.', 'enrollments.delete')
  }
}
