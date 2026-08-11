import { reorderLesson } from '@/server/services/course-management-service'
import { handleApiError, readJsonObject, successResponse } from '@/server/http/api-response'
import { enumValue } from '@/server/validation/values'

interface ReorderLessonRouteContext {
  params: Promise<{ id: string }>
}

export async function POST(request: Request, { params }: ReorderLessonRouteContext) {
  try {
    const { id: lessonId } = await params
    const requestBody = await readJsonObject(request)
    const direction = enumValue(requestBody.direction, 'Direction', ['up', 'down'] as const)
    return successResponse(await reorderLesson(lessonId, direction))
  } catch (error) {
    return handleApiError(error, 'Failed to reorder lesson.', 'lessons.reorder')
  }
}
