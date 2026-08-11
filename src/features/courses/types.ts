export type CourseStatus = 'draft' | 'published'

export interface CategorySummary {
  name: string
  count: number
}

export interface CourseSummary {
  id: string
  title: string
  description: string | null
  cover: string | null
  category: string
  studentCount: number
  enrollmentCount?: number
  createdAt: string
  lessonCount: number
  status: string
  isBookmarked: boolean
}

export interface LessonSummary {
  id: string
  title: string
  description: string | null
  order: number
  presentations: LessonPresentation[]
}

export interface LessonPresentation {
  id: string
  fileName: string
  filePath: string
  order: number
}

export interface CourseDetails extends Omit<CourseSummary, 'lessonCount'> {
  lessons: LessonSummary[]
  completedLessonIds: string[]
}

export interface CourseCatalogResponse {
  courses: CourseSummary[]
  total: number
  categories: CategorySummary[]
}

export interface CourseDetailsResponse {
  course: CourseDetails
}

export interface InstructorCourseSummary {
  id: string
  title: string
  cover: string | null
  category: string
  status: string
  lessonCount: number
  studentCount: number
  createdAt: string
}

export interface InstructorCoursesResponse {
  courses: InstructorCourseSummary[]
  used: number
  max: number
}

export interface LearnerProgress {
  userId: string
  userName: string
  userEmail: string
  status: string
  enrolledAt: string
  completedAt: string | null
  completedLessons: number
  totalLessons: number
  progressPercent: number
  completedLessonIds: string[]
}

export interface CourseProgressResponse {
  courseTitle: string
  totalLessons: number
  lessons: Array<{ id: string; title: string; order: number }>
  enrollments: LearnerProgress[]
  summary: {
    totalEnrolled: number
    totalCompleted: number
    avgProgress: number
  }
}
