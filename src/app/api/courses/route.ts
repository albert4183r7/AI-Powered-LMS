import { handleApiError, successResponse } from '@/server/http/api-response'
import { listPublishedCourses } from '@/server/services/catalog-service'

export async function GET(request: Request) {
  try {
    const searchParams = new URL(request.url).searchParams
    return successResponse(await listPublishedCourses({
      category: searchParams.get('category') || 'All',
      sort: searchParams.get('sort') || 'Newest',
      range: searchParams.get('range') || 'All Time',
      search: searchParams.get('search')?.trim() || '',
      tab: searchParams.get('tab') || '',
      userId: searchParams.get('userId')?.trim() || undefined,
    }))
  } catch (error) {
    return handleApiError(error, 'Failed to fetch courses.', 'courses.list')
  }
}
