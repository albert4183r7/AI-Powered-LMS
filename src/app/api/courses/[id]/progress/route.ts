import { getCourseProgress } from '@/server/services/enrollment-service'
import { handleApiError, successResponse } from '@/server/http/api-response'

interface CourseProgressRouteContext {
  params: Promise<{ id: string }>
}

export async function GET(_request: Request, { params }: CourseProgressRouteContext) {
  try {
    const { id: courseId } = await params
    return successResponse(await getCourseProgress(courseId))
  } catch (error) {
    return handleApiError(error, 'Failed to fetch progress.', 'courses.progress')
  }
}
