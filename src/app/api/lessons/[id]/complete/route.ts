import { completeLesson } from '@/server/services/enrollment-service'
import { handleApiError, readJsonObject, successResponse } from '@/server/http/api-response'
import { requiredString } from '@/server/validation/values'

interface LessonCompletionRouteContext {
  params: Promise<{ id: string }>
}

export async function POST(request: Request, { params }: LessonCompletionRouteContext) {
  try {
    const { id: lessonId } = await params
    const requestBody = await readJsonObject(request)
    const userId = requiredString(requestBody.userId, 'User ID')
    return successResponse(await completeLesson(lessonId, userId))
  } catch (error) {
    return handleApiError(error, 'Failed to complete lesson.', 'lessons.complete')
  }
}
