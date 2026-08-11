import type { CourseSummary } from '@/features/courses/types'

export type EnrollmentStatus = 'in_progress' | 'completed'
export type LearningListStatus = EnrollmentStatus | 'favorite'

export interface EnrollmentListItem {
  id: string
  status: string
  progress: number
  course: Pick<
    CourseSummary,
    'id' | 'title' | 'cover' | 'category' | 'studentCount' | 'lessonCount' | 'createdAt' | 'isBookmarked'
  > | null
}

export interface EnrollmentListResponse {
  enrollments: EnrollmentListItem[]
}

export interface EnrollmentStats {
  total: number
  inProgress: number
  completed: number
  favorites: number
  avgProgress: number
}
