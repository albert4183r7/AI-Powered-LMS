import { NextResponse } from 'next/server'
import { requestAiService } from '@/server/ai/ai-service-client'
import { requireAuthenticatedUser } from '@/server/auth/session'
import { ApiError, handleApiError, successResponse } from '@/server/http/api-response'
import { db } from '@/lib/db'

const AI_AUTHOR_ROLES = ['instructor', 'admin'] as const
const GENERATION_JOB_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

interface SaveGenerationRouteContext {
  params: Promise<{ jobId: string }>
}

export async function POST(
  _request: Request,
  context: SaveGenerationRouteContext,
) {
  try {
    const authenticatedUser = await requireAuthenticatedUser(AI_AUTHOR_ROLES)
    const { jobId } = await context.params
    if (!GENERATION_JOB_ID_PATTERN.test(jobId)) {
      throw new ApiError(
        'Generation job ID is invalid.',
        400,
        'INVALID_GENERATION_JOB_ID',
      )
    }

    // Fetch the generation job from the AI service
    const generationJob = await requestAiService(
      '/v1/generations/' + encodeURIComponent(jobId),
      authenticatedUser.id,
    ) as any

    if (generationJob.status !== 'completed' || !generationJob.result) {
      throw new ApiError(
        'Generation job is not completed yet.',
        400,
        'GENERATION_JOB_NOT_COMPLETED',
      )
    }

    const modulePlan = generationJob.result

    // Map and save to the core LMS Database
    const course = await db.course.create({
      data: {
        title: modulePlan.title,
        description: modulePlan.description,
        language: modulePlan.output_language || 'English',
        category: 'AI Generated',
        status: 'draft',
        authorId: authenticatedUser.id,
        lessons: {
          create: (modulePlan.lessons || []).map((lesson: any, index: number) => ({
            title: lesson.title,
            description: lesson.description,
            order: index,
            presentations: {
              create: (lesson.presentations || []).map((pres: any, pIndex: number) => ({
                fileName: pres.fileName,
                filePath: pres.filePath,
                order: pIndex,
              })),
            },
          })),
        },
      },
      include: {
        lessons: true,
      }
    })

    return successResponse({ courseId: course.id })
  } catch (error) {
    return handleApiError(
      error,
      'Unable to save generated module.',
      'ai.generations.save',
    )
  }
}
