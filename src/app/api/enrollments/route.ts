import { handleApiError, successResponse } from '@/server/http/api-response'
import { emptyEnrollmentStats, getEnrollmentStats, listUserEnrollments } from '@/server/services/enrollment-service'
import { enumValue } from '@/server/validation/values'

const ENROLLMENT_STATUSES = ['in_progress', 'completed', 'favorite'] as const

export async function GET(request: Request) {
  try {
    const searchParams = new URL(request.url).searchParams
    const type = searchParams.get('type')
    const userId = searchParams.get('userId')?.trim() || ''

    if (type === 'stats') {
      return successResponse(userId
        ? await getEnrollmentStats(userId, searchParams.get('role') || '')
        : emptyEnrollmentStats())
    }
    if (!userId) return successResponse({ enrollments: [] })

    const status = enumValue(
      searchParams.get('status') || 'in_progress',
      'Status',
      ENROLLMENT_STATUSES,
    )
    return successResponse(await listUserEnrollments(userId, status))
  } catch (error) {
    return handleApiError(error, 'Failed to fetch enrollments.', 'enrollments.list')
  }
}
