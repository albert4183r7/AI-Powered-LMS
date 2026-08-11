import type { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import type { LearningListStatus } from '@/features/enrollments/types'
import { ApiError } from '@/server/http/api-response'

const LEARNING_STATUSES = ['in_progress', 'completed'] as const

type LearningEnrollment = Prisma.EnrollmentGetPayload<{
  include: { course: { include: { lessons: true } } }
}>

function enrollmentKey(enrollment: { userId: string; courseId: string }) {
  return `${enrollment.userId}:${enrollment.courseId}`
}

async function getProgressPercentages(enrollments: LearningEnrollment[]) {
  const lessonCourseIdByLessonId = new Map<string, string>()

  for (const enrollment of enrollments) {
    for (const lesson of enrollment.course.lessons) {
      lessonCourseIdByLessonId.set(lesson.id, enrollment.courseId)
    }
  }

  const learnerIds = [...new Set(enrollments.map((enrollment) => enrollment.userId))]
  const lessonIds = [...lessonCourseIdByLessonId.keys()]
  const progressRecords = learnerIds.length > 0 && lessonIds.length > 0
    ? await db.lessonProgress.findMany({
        where: { userId: { in: learnerIds }, lessonId: { in: lessonIds } },
        select: { userId: true, lessonId: true },
      })
    : []

  const completedLessonCountByEnrollment = new Map<string, number>()
  for (const progressRecord of progressRecords) {
    const courseId = lessonCourseIdByLessonId.get(progressRecord.lessonId)
    if (!courseId) continue
    const key = `${progressRecord.userId}:${courseId}`
    completedLessonCountByEnrollment.set(key, (completedLessonCountByEnrollment.get(key) ?? 0) + 1)
  }

  return new Map(enrollments.map((enrollment) => {
    const totalLessons = enrollment.course.lessons.length
    const completedLessons = completedLessonCountByEnrollment.get(enrollmentKey(enrollment)) ?? 0
    const progressPercent = totalLessons > 0
      ? Math.round((completedLessons / totalLessons) * 100)
      : 0
    return [enrollmentKey(enrollment), progressPercent]
  }))
}

export function emptyEnrollmentStats() {
  return { total: 0, inProgress: 0, completed: 0, favorites: 0, avgProgress: 0 }
}

export async function getEnrollmentStats(userId: string, role: string) {
  const isInstructor = role === 'instructor'
  const learningEnrollments = await db.enrollment.findMany({
    where: {
      status: { in: [...LEARNING_STATUSES] },
      ...(isInstructor
        ? { course: { authorId: userId, status: 'published' } }
        : { userId, course: { status: 'published' } }),
    },
    include: { course: { include: { lessons: true } } },
  })
  const progressPercentages = await getProgressPercentages(learningEnrollments)

  const total = learningEnrollments.length
  const inProgress = learningEnrollments.filter((enrollment) => enrollment.status === 'in_progress').length
  const completed = learningEnrollments.filter((enrollment) => enrollment.status === 'completed').length
  const favorites = isInstructor
    ? 0
    : await db.bookmark.count({ where: { userId } })
  const totalProgress = learningEnrollments.reduce((sum, enrollment) => (
    sum + (progressPercentages.get(enrollmentKey(enrollment)) ?? 0)
  ), 0)

  return {
    total,
    inProgress,
    completed,
    favorites,
    avgProgress: total > 0 ? Math.round(totalProgress / total) : 0,
  }
}

export async function listUserEnrollments(userId: string, status: LearningListStatus) {
  if (status === 'favorite') {
    const bookmarks = await db.bookmark.findMany({
      where: { userId, course: { status: 'published' } },
      include: {
        course: {
          include: {
            enrollments: {
              where: { userId },
              select: { progress: true },
              take: 1,
            },
            _count: { select: { lessons: true, enrollments: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return {
      enrollments: bookmarks.map((bookmark) => ({
        id: bookmark.id,
        status: 'favorite',
        progress: bookmark.course.enrollments[0]?.progress ?? 0,
        course: {
          id: bookmark.course.id,
          title: bookmark.course.title,
          cover: bookmark.course.cover,
          category: bookmark.course.category,
          studentCount: bookmark.course._count.enrollments,
          lessonCount: bookmark.course._count.lessons,
          createdAt: bookmark.course.createdAt.toISOString(),
          isBookmarked: true,
        },
      })),
    }
  }

  const enrollments = await db.enrollment.findMany({
    where: { userId, status, course: { status: 'published' } },
    include: {
      course: {
        include: {
          lessons: true,
          _count: { select: { lessons: true } },
        },
      },
    },
    orderBy: { updatedAt: 'desc' },
  })

  const allLessonIds = enrollments.flatMap((enrollment) => (
    enrollment.course.lessons.map((lesson) => lesson.id)
  ))
  const completedLessons = allLessonIds.length > 0
    ? await db.lessonProgress.findMany({
        where: { userId, lessonId: { in: allLessonIds } },
        select: { lessonId: true },
      })
    : []
  const completedLessonIds = new Set(completedLessons.map((progressRecord) => progressRecord.lessonId))

  const courseIds = enrollments.map((enrollment) => enrollment.courseId)
  const [activeLearners, favoriteEnrollments] = courseIds.length > 0
    ? await Promise.all([
        db.enrollment.findMany({
          where: { courseId: { in: courseIds }, status: { in: [...LEARNING_STATUSES] } },
          select: { courseId: true, userId: true },
          distinct: ['courseId', 'userId'],
        }),
        db.bookmark.findMany({
          where: { userId, courseId: { in: courseIds } },
          select: { courseId: true },
        }),
      ])
    : [[], []]
  const bookmarkedCourseIds = new Set(favoriteEnrollments.map((enrollment) => enrollment.courseId))
  const learnerCountByCourse = activeLearners.reduce((learnerCounts, enrollment) => {
    learnerCounts.set(enrollment.courseId, (learnerCounts.get(enrollment.courseId) ?? 0) + 1)
    return learnerCounts
  }, new Map<string, number>())

  return {
    enrollments: enrollments.map((enrollment) => {
      const totalLessons = enrollment.course.lessons.length
      const completedCount = enrollment.course.lessons.filter((lesson) => (
        completedLessonIds.has(lesson.id)
      )).length
      return {
        id: enrollment.id,
        status: enrollment.status,
        progress: totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0,
        course: {
          id: enrollment.course.id,
          title: enrollment.course.title,
          cover: enrollment.course.cover,
          category: enrollment.course.category,
          studentCount: learnerCountByCourse.get(enrollment.courseId) ?? 0,
          lessonCount: enrollment.course._count.lessons,
          createdAt: enrollment.course.createdAt.toISOString(),
          isBookmarked: bookmarkedCourseIds.has(enrollment.courseId),
        },
      }
    }),
  }
}

export async function enrollUser(courseId: string, userId: string) {
  const [user, course] = await Promise.all([
    db.user.findUnique({ where: { id: userId }, select: { id: true, role: true } }),
    db.course.findUnique({ where: { id: courseId }, select: { id: true, status: true } }),
  ])

  if (!user) throw new ApiError('User not found.', 404, 'USER_NOT_FOUND')
  if (user.role !== 'employee') {
    throw new ApiError('Only employees can enroll in courses.', 403, 'ENROLLMENT_FORBIDDEN')
  }
  if (!course) throw new ApiError('Course not found.', 404, 'COURSE_NOT_FOUND')
  if (course.status !== 'published') {
    throw new ApiError('This course is not available for enrollment.', 409, 'COURSE_NOT_PUBLISHED')
  }

  const enrollment = await db.enrollment.upsert({
    where: { userId_courseId: { userId, courseId } },
    update: {},
    create: { userId, courseId, status: 'in_progress' },
  })
  return { enrollment }
}

export async function unenrollUser(courseId: string, userId: string) {
  await db.enrollment.deleteMany({ where: { userId, courseId } })
  return { success: true }
}

export async function bookmarkCourse(courseId: string, userId: string) {
  const [user, course] = await Promise.all([
    db.user.findUnique({ where: { id: userId }, select: { id: true, role: true } }),
    db.course.findUnique({ where: { id: courseId }, select: { id: true, status: true } }),
  ])

  if (!user) throw new ApiError('User not found.', 404, 'USER_NOT_FOUND')
  if (user.role !== 'employee') {
    throw new ApiError('Only employees can bookmark courses.', 403, 'BOOKMARK_FORBIDDEN')
  }
  if (!course) throw new ApiError('Course not found.', 404, 'COURSE_NOT_FOUND')
  if (course.status !== 'published') {
    throw new ApiError('This course is not available for bookmarking.', 409, 'COURSE_NOT_PUBLISHED')
  }

  const bookmark = await db.bookmark.upsert({
    where: { userId_courseId: { userId, courseId } },
    update: {},
    create: { userId, courseId },
  })
  return { bookmark }
}

export async function removeBookmark(courseId: string, userId: string) {
  await db.bookmark.deleteMany({ where: { userId, courseId } })
  return { success: true }
}

export async function getCourseProgress(courseId: string) {
  const course = await db.course.findUnique({
    where: { id: courseId },
    include: {
      lessons: { select: { id: true, title: true, order: true }, orderBy: { order: 'asc' } },
      enrollments: {
        where: { status: { in: [...LEARNING_STATUSES] } },
        include: { user: { select: { id: true, name: true, email: true, role: true } } },
      },
    },
  })
  if (!course) throw new ApiError('Course not found.', 404, 'COURSE_NOT_FOUND')

  const learningEnrollments = course.enrollments.filter(
    (enrollment) => enrollment.user.role === 'employee',
  )
  const lessonIds = course.lessons.map((lesson) => lesson.id)
  const learnerIds = learningEnrollments.map((enrollment) => enrollment.userId)
  const progressRecords = lessonIds.length > 0 && learnerIds.length > 0
    ? await db.lessonProgress.findMany({
        where: { userId: { in: learnerIds }, lessonId: { in: lessonIds } },
        select: { userId: true, lessonId: true },
      })
    : []
  const completedLessonsByUser = new Map<string, Set<string>>()
  for (const progressRecord of progressRecords) {
    const completedLessons = completedLessonsByUser.get(progressRecord.userId) ?? new Set<string>()
    completedLessons.add(progressRecord.lessonId)
    completedLessonsByUser.set(progressRecord.userId, completedLessons)
  }

  const enrollments = learningEnrollments.map((enrollment) => {
    const completedLessonIds = [...(completedLessonsByUser.get(enrollment.userId) ?? new Set<string>())]
    const progressPercent = lessonIds.length > 0
      ? Math.round((completedLessonIds.length / lessonIds.length) * 100)
      : 0
    return {
      userId: enrollment.user.id,
      userName: enrollment.user.name || 'Unknown',
      userEmail: enrollment.user.email,
      status: enrollment.status,
      enrolledAt: enrollment.enrolledAt.toISOString(),
      completedAt: enrollment.completedAt?.toISOString() ?? null,
      completedLessons: completedLessonIds.length,
      totalLessons: lessonIds.length,
      progressPercent,
      completedLessonIds,
    }
  })
  const totalEnrolled = enrollments.length

  return {
    courseTitle: course.title,
    totalLessons: lessonIds.length,
    lessons: course.lessons,
    enrollments,
    summary: {
      totalEnrolled,
      totalCompleted: enrollments.filter((enrollment) => enrollment.status === 'completed').length,
      avgProgress: totalEnrolled > 0
        ? Math.round(enrollments.reduce((sum, enrollment) => sum + enrollment.progressPercent, 0) / totalEnrolled)
        : 0,
    },
  }
}

export async function completeLesson(lessonId: string, userId: string) {
  const [user, lesson] = await Promise.all([
    db.user.findUnique({ where: { id: userId }, select: { id: true, role: true } }),
    db.lesson.findUnique({ where: { id: lessonId }, select: { id: true, courseId: true } }),
  ])
  if (!user) throw new ApiError('User not found.', 404, 'USER_NOT_FOUND')
  if (user.role !== 'employee') {
    throw new ApiError('Only employees can complete lessons.', 403, 'COMPLETION_FORBIDDEN')
  }
  if (!lesson) throw new ApiError('Lesson not found.', 404, 'LESSON_NOT_FOUND')

  const course = await db.course.findUnique({
    where: { id: lesson.courseId },
    include: { lessons: { select: { id: true }, orderBy: [{ order: 'asc' }, { createdAt: 'asc' }] } },
  })
  if (!course) throw new ApiError('Course not found.', 404, 'COURSE_NOT_FOUND')

  const activeEnrollment = await db.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId: course.id } },
  })
  if (!activeEnrollment) {
    throw new ApiError('Enroll in this course before completing lessons.', 409, 'ENROLLMENT_REQUIRED')
  }

  const lessonIndex = course.lessons.findIndex((courseLesson) => courseLesson.id === lessonId)
  if (lessonIndex > 0) {
    const previousLessonId = course.lessons[lessonIndex - 1].id
    const previousLessonProgress = await db.lessonProgress.findUnique({
      where: { userId_lessonId: { userId, lessonId: previousLessonId } },
    })
    if (!previousLessonProgress) {
      throw new ApiError('Complete the previous lesson first.', 409, 'SEQUENTIAL_COMPLETION_REQUIRED')
    }
  }

  return db.$transaction(async (transaction) => {
    await transaction.lessonProgress.upsert({
      where: { userId_lessonId: { userId, lessonId } },
      update: {},
      create: { userId, lessonId },
    })

    const lessonIds = course.lessons.map((courseLesson) => courseLesson.id)
    const completedLessons = await transaction.lessonProgress.findMany({
      where: { userId, lessonId: { in: lessonIds } },
      select: { lessonId: true },
    })
    const completedLessonIds = completedLessons.map((progressRecord) => progressRecord.lessonId)
    const progress = lessonIds.length > 0
      ? Math.round((completedLessonIds.length / lessonIds.length) * 100)
      : 0
    const courseCompleted = lessonIds.length > 0 && completedLessonIds.length >= lessonIds.length

    await transaction.enrollment.update({
      where: { id: activeEnrollment.id },
      data: {
        status: courseCompleted ? 'completed' : 'in_progress',
        progress,
        completedAt: courseCompleted ? activeEnrollment.completedAt ?? new Date() : null,
      },
    })

    return { success: true, courseCompleted, progress, completedLessonIds }
  })
}
