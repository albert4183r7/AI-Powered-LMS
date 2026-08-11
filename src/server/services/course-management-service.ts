import { db } from '@/lib/db'
import { ApiError } from '@/server/http/api-response'
import type { PresentationInput } from '@/server/validation/presentations'
import { getExpectedPresentationPreviewPath } from '@/server/presentations/presentation-preview'

export interface CourseUpdates {
  title?: string
  cover?: string | null
  status?: 'draft' | 'published'
}

export interface LessonUpdates {
  title?: string
  description?: string | null
  presentations?: PresentationInput[]
}

export async function deleteCourse(courseId: string) {
  const course = await db.course.findUnique({ where: { id: courseId }, select: { id: true } })
  if (!course) throw new ApiError('Course not found.', 404, 'COURSE_NOT_FOUND')
  await db.course.delete({ where: { id: courseId } })
  return { success: true }
}

export async function updateCourse(courseId: string, updates: CourseUpdates) {
  if (Object.keys(updates).length === 0) {
    throw new ApiError('No fields to update.', 400, 'NO_UPDATES')
  }

  const existingCourse = await db.course.findUnique({
    where: { id: courseId },
    include: {
      lessons: {
        select: { id: true, _count: { select: { presentations: true } } },
      },
    },
  })
  if (!existingCourse) throw new ApiError('Course not found.', 404, 'COURSE_NOT_FOUND')

  const hasMissingPresentation = existingCourse.lessons.some(
    (lesson) => lesson._count.presentations === 0,
  )
  if (updates.status === 'published' && (existingCourse.lessons.length === 0 || hasMissingPresentation)) {
    throw new ApiError(
      'Cannot publish a module until every lesson has at least one presentation.',
      409,
      'PRESENTATION_REQUIRED',
    )
  }

  if (updates.title && existingCourse.authorId) {
    const duplicateCourse = await db.course.findFirst({
      where: {
        authorId: existingCourse.authorId,
        title: updates.title,
        NOT: { id: courseId },
      },
      select: { id: true },
    })
    if (duplicateCourse) {
      throw new ApiError('A module with this title already exists.', 409, 'DUPLICATE_COURSE_TITLE')
    }
  }

  const course = await db.course.update({ where: { id: courseId }, data: updates })
  return {
    course: {
      id: course.id,
      title: course.title,
      cover: course.cover,
      status: course.status,
    },
    success: true,
  }
}

export async function deleteLesson(lessonId: string) {
  const lesson = await db.lesson.findUnique({
    where: { id: lessonId },
    select: { id: true, courseId: true },
  })
  if (!lesson) throw new ApiError('Lesson not found.', 404, 'LESSON_NOT_FOUND')

  await db.$transaction(async (transaction) => {
    await transaction.lesson.delete({ where: { id: lessonId } })
    const remainingLessonCount = await transaction.lesson.count({ where: { courseId: lesson.courseId } })
    if (remainingLessonCount === 0) {
      await transaction.course.update({ where: { id: lesson.courseId }, data: { status: 'draft' } })
    }
  })
  return { success: true }
}

export async function updateLesson(lessonId: string, updates: LessonUpdates) {
  if (Object.keys(updates).length === 0) {
    throw new ApiError('No fields to update.', 400, 'NO_UPDATES')
  }
  const lesson = await db.lesson.findUnique({ where: { id: lessonId } })
  if (!lesson) throw new ApiError('Lesson not found.', 404, 'LESSON_NOT_FOUND')

  if (updates.title) {
    const duplicateLesson = await db.lesson.findFirst({
      where: { courseId: lesson.courseId, title: updates.title, NOT: { id: lessonId } },
      select: { id: true },
    })
    if (duplicateLesson) {
      throw new ApiError('A section with this title already exists.', 409, 'DUPLICATE_LESSON_TITLE')
    }
  }

  const updatedLesson = await db.lesson.update({
    where: { id: lessonId },
    data: {
      ...(updates.title !== undefined ? { title: updates.title } : {}),
      ...(updates.description !== undefined ? { description: updates.description } : {}),
      ...(updates.presentations !== undefined
        ? {
            presentations: {
              deleteMany: {},
              create: updates.presentations.map((presentation, index) => ({
                fileName: presentation.fileName,
                filePath: presentation.filePath,
                previewPath: getExpectedPresentationPreviewPath(presentation.filePath),
                order: index + 1,
              })),
            },
          }
        : {}),
    },
    include: { presentations: { orderBy: { order: 'asc' } } },
  })
  return {
    lesson: {
      id: updatedLesson.id,
      title: updatedLesson.title,
      description: updatedLesson.description,
      order: updatedLesson.order,
      presentations: updatedLesson.presentations,
    },
  }
}

export async function reorderLesson(lessonId: string, direction: 'up' | 'down') {
  const lesson = await db.lesson.findUnique({
    where: { id: lessonId },
    select: { id: true, order: true, courseId: true },
  })
  if (!lesson) throw new ApiError('Lesson not found.', 404, 'LESSON_NOT_FOUND')

  const siblingLessons = await db.lesson.findMany({
    where: { courseId: lesson.courseId },
    orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    select: { id: true, order: true },
  })
  const currentIndex = siblingLessons.findIndex((siblingLesson) => siblingLesson.id === lessonId)
  const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
  if (targetIndex < 0 || targetIndex >= siblingLessons.length) {
    throw new ApiError(
      direction === 'up' ? 'Already at top.' : 'Already at bottom.',
      409,
      'REORDER_LIMIT',
    )
  }

  const targetLesson = siblingLessons[targetIndex]
  await db.$transaction([
    db.lesson.update({ where: { id: lesson.id }, data: { order: targetLesson.order } }),
    db.lesson.update({ where: { id: targetLesson.id }, data: { order: lesson.order } }),
  ])
  return { success: true }
}
