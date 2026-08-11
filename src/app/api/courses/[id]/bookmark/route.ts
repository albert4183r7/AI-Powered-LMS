import { handleApiError, readJsonObject, successResponse } from '@/server/http/api-response'
import { bookmarkCourse, removeBookmark } from '@/server/services/enrollment-service'
import { requiredString } from '@/server/validation/values'

interface BookmarkRouteContext {
  params: Promise<{ id: string }>
}

export async function POST(request: Request, { params }: BookmarkRouteContext) {
  try {
    const { id: courseId } = await params
    const requestBody = await readJsonObject(request)
    const userId = requiredString(requestBody.userId, 'User ID')
    return successResponse(await bookmarkCourse(courseId, userId), 201)
  } catch (error) {
    return handleApiError(error, 'Failed to bookmark course.', 'bookmarks.create')
  }
}

export async function DELETE(request: Request, { params }: BookmarkRouteContext) {
  try {
    const { id: courseId } = await params
    const userId = requiredString(
      new URL(request.url).searchParams.get('userId'),
      'User ID',
    )
    return successResponse(await removeBookmark(courseId, userId))
  } catch (error) {
    return handleApiError(error, 'Failed to remove bookmark.', 'bookmarks.delete')
  }
}
