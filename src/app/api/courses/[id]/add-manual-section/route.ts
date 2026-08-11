import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { presentationInputs } from '@/server/validation/presentations'
import { ApiError, handleApiError, successResponse } from '@/server/http/api-response'
import { requiredString } from '@/server/validation/values'
import { getExpectedPresentationPreviewPath } from '@/server/presentations/presentation-preview'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const requestBody = await req.json() as Record<string, unknown>
    const sectionName = requiredString(requestBody.sectionName, 'Section name', { maxLength: 160 })
    const description = requiredString(requestBody.description, 'Description', {
      maxLength: 1000,
    })
    const presentations = presentationInputs(requestBody.presentations ?? [], { required: true })

    const course = await db.course.findUnique({
      where: { id },
      include: { lessons: true },
    })

    if (!course) {
      throw new ApiError('Course not found.', 404, 'COURSE_NOT_FOUND')
    }

    const duplicateSection = course.lessons.find(
      (l) => l.title.toLowerCase().trim() === sectionName.toLowerCase().trim()
    )
    if (duplicateSection) {
      throw new ApiError(
        `A section named "${sectionName}" already exists in this module.`,
        409,
        'DUPLICATE_LESSON_TITLE',
      )
    }

    const nextOrder = course.lessons.reduce((max: number, l) => Math.max(max, l.order), 0) + 1

    const lesson = await db.lesson.create({
      data: {
        title: sectionName,
        description,
        order: nextOrder,
        courseId: id,
        presentations: {
          create: presentations.map((presentation, index) => ({
            fileName: presentation.fileName,
            filePath: presentation.filePath,
            previewPath: getExpectedPresentationPreviewPath(presentation.filePath),
            order: index + 1,
          })),
        },
      },
      include: { presentations: { orderBy: { order: 'asc' } } },
    })

    return successResponse({
      lesson: {
        id: lesson.id,
        title: lesson.title,
        description: lesson.description,
        order: lesson.order,
        presentations: lesson.presentations,
      },
    }, 201)
  } catch (error) {
    return handleApiError(error, 'Failed to add section.', 'lessons.create')
  }
}
