import type { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { ApiError } from '@/server/http/api-response'

const ACTIVE_ENROLLMENT_STATUSES = ['in_progress', 'completed']
const MAX_INSTRUCTOR_COURSES = 10

export interface CatalogQuery {
  category: string
  sort: string
  range: string
  search: string
  tab: string
  userId?: string
}

async function getBookmarkedCourseIds(courseIds: string[], userId?: string) {
  if (!userId || courseIds.length === 0) return new Set<string>()
  const bookmarks = await db.bookmark.findMany({
    where: { userId, courseId: { in: courseIds } },
    select: { courseId: true },
  })
  return new Set(bookmarks.map((bookmark) => bookmark.courseId))
}

async function getLearnerCounts(courseIds: string[]) {
  if (courseIds.length === 0) return new Map<string, number>()

  const activeEnrollments = await db.enrollment.findMany({
    where: {
      courseId: { in: courseIds },
      status: { in: ACTIVE_ENROLLMENT_STATUSES },
    },
    select: { courseId: true, userId: true },
    distinct: ['courseId', 'userId'],
  })

  return activeEnrollments.reduce((learnerCountByCourse, enrollment) => {
    learnerCountByCourse.set(
      enrollment.courseId,
      (learnerCountByCourse.get(enrollment.courseId) ?? 0) + 1,
    )
    return learnerCountByCourse
  }, new Map<string, number>())
}

function getCreatedAfter(range: string) {
  const currentDate = new Date()
  if (range === 'Last Week') {
    return new Date(currentDate.getTime() - 7 * 24 * 60 * 60 * 1000)
  }
  if (range === 'Last Month') {
    return new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, currentDate.getDate())
  }
  return undefined
}

export async function listPublishedCourses(query: CatalogQuery) {
  const createdAfter = getCreatedAfter(query.range)
  const isAlphabeticalSort = ['A–Z', 'A-Z', 'Alphabetical'].includes(query.sort)
  const isEnrollmentSort = ['Most Enrolled', 'Most Students'].includes(query.sort)

  const where: Prisma.CourseWhereInput = {
    status: 'published',
    ...(query.category !== 'All' ? { category: query.category } : {}),
    ...(query.search ? { title: { startsWith: query.search } } : {}),
    ...(createdAfter ? { createdAt: { gte: createdAfter } } : {}),
  }

  const courses = await db.course.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { lessons: true } }, author: true },
  })
  const courseIds = courses.map((course) => course.id)
  const [learnerCounts, bookmarkedCourseIds] = await Promise.all([
    getLearnerCounts(courseIds),
    getBookmarkedCourseIds(courseIds, query.userId),
  ])

  let courseSummaries = courses.map((course) => {
    const studentCount = learnerCounts.get(course.id) ?? 0
    return {
      id: course.id,
      title: course.title,
      description: course.description,
      cover: course.cover,
      category: course.category,
      studentCount,
      enrollmentCount: studentCount,
      createdAt: course.createdAt.toISOString(),
      lessonCount: course._count.lessons,
      status: course.status,
      isBookmarked: bookmarkedCourseIds.has(course.id),
      isDummy: course.author?.email === 'instructor@learnova.example',
    }
  })

  if (query.tab === 'Hot' || query.tab === 'Popular' || isEnrollmentSort) {
    courseSummaries = courseSummaries.sort((firstCourse, secondCourse) => (
      secondCourse.studentCount - firstCourse.studentCount
    ))
  } else if (query.tab === 'New' || query.tab === 'Recent') {
    courseSummaries = courseSummaries.sort((firstCourse, secondCourse) => (
      Date.parse(secondCourse.createdAt) - Date.parse(firstCourse.createdAt)
    ))
  } else if (isAlphabeticalSort) {
    courseSummaries = courseSummaries.sort((firstCourse, secondCourse) => (
      firstCourse.title.localeCompare(secondCourse.title, undefined, { sensitivity: 'base' })
    ))
  }

  const categoryGroups = await db.course.groupBy({
    by: ['category'],
    where: { status: 'published' },
    _count: true,
  })

  return {
    courses: courseSummaries,
    total: courseSummaries.length,
    categories: categoryGroups.map((categoryGroup) => ({
      name: categoryGroup.category,
      count: categoryGroup._count,
    })),
  }
}

export async function getCourseDetails(courseId: string, userId?: string) {
  const course = await db.course.findUnique({
    where: { id: courseId },
    include: {
      author: true,
      lessons: {
        orderBy: { order: 'asc' },
        include: { presentations: { orderBy: { order: 'asc' } } },
      },
    },
  })

  if (!course) {
    throw new ApiError('Course not found.', 404, 'COURSE_NOT_FOUND')
  }

  const [learnerCounts, completedLessons, bookmarkedCourseIds] = await Promise.all([
    getLearnerCounts([courseId]),
    userId && course.lessons.length > 0
      ? db.lessonProgress.findMany({
          where: { userId, lessonId: { in: course.lessons.map((lesson) => lesson.id) } },
          select: { lessonId: true },
        })
      : Promise.resolve([]),
    getBookmarkedCourseIds([courseId], userId),
  ])
  const studentCount = learnerCounts.get(courseId) ?? 0

  return {
    course: {
      id: course.id,
      title: course.title,
      description: course.description,
      cover: course.cover,
      category: course.category,
      status: course.status,
      studentCount,
      enrollmentCount: studentCount,
      createdAt: course.createdAt.toISOString(),
      lessons: course.lessons.map((lesson) => ({
        id: lesson.id,
        title: lesson.title,
        description: lesson.description,
        order: lesson.order,
        presentations: lesson.presentations.map((presentation) => ({
          id: presentation.id,
          fileName: presentation.fileName,
          filePath: presentation.filePath,
          order: presentation.order,
        })),
      })),
      completedLessonIds: completedLessons.map((progressRecord) => progressRecord.lessonId),
      isBookmarked: bookmarkedCourseIds.has(courseId),
      isDummy: course.author?.email === 'instructor@learnova.example',
    },
  }
}

export async function listInstructorCourses(instructorId: string) {
  const courses = await db.course.findMany({
    where: { authorId: instructorId },
    include: { _count: { select: { lessons: true } } },
    orderBy: { createdAt: 'desc' },
  })
  const learnerCounts = await getLearnerCounts(courses.map((course) => course.id))
  const courseSummaries = courses.map((course) => ({
    id: course.id,
    title: course.title,
    cover: course.cover,
    category: course.category,
    status: course.status,
    lessonCount: course._count.lessons,
    studentCount: learnerCounts.get(course.id) ?? 0,
    createdAt: course.createdAt.toISOString(),
  }))

  return {
    courses: courseSummaries,
    used: courseSummaries.length,
    max: MAX_INSTRUCTOR_COURSES,
  }
}
