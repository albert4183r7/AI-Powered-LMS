import { deleteLesson, updateLesson, type LessonUpdates } from '@/server/services/course-management-service'
import { handleApiError, readJsonObject, successResponse } from '@/server/http/api-response'
import { optionalString, requiredString } from '@/server/validation/values'
import { presentationInputs } from '@/server/validation/presentations'

interface LessonRouteContext {
  params: Promise<{ id: string }>
}

export async function PATCH(request: Request, { params }: LessonRouteContext) {
  try {
    const { id: lessonId } = await params
    const requestBody = await readJsonObject(request)
    const updates: LessonUpdates = {}
    if ('title' in requestBody) {
      updates.title = optionalString(requestBody.title, 'Title', { maxLength: 160 })
    }
    if ('description' in requestBody) {
      updates.description = requiredString(requestBody.description, 'Description', {
        maxLength: 1000,
      })
    }
    if ('presentations' in requestBody) {
      updates.presentations = presentationInputs(requestBody.presentations, { required: true })
    }
    return successResponse(await updateLesson(lessonId, updates))
  } catch (error) {
    return handleApiError(error, 'Failed to update lesson.', 'lessons.update')
  }
}

export async function DELETE(_request: Request, { params }: LessonRouteContext) {
  try {
    const { id: lessonId } = await params
    return successResponse(await deleteLesson(lessonId))
  } catch (error) {
    return handleApiError(error, 'Failed to delete lesson.', 'lessons.delete')
  }
}
