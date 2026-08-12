import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { detectEnterpriseCategory } from '@/features/courses/categories'

export async function POST(req: NextRequest) {
  try {
    const { userId, modulePlan } = await req.json()

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }
    if (!modulePlan || !modulePlan.title) {
      return NextResponse.json({ error: 'Valid module plan is required' }, { status: 400 })
    }

    const userExists = await db.user.findUnique({ where: { id: userId } })
    if (!userExists) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Auto-detect category
    const autoCategory = detectEnterpriseCategory(modulePlan.title)

    // Save as draft course with nested lessons and presentations
    const course = await db.course.create({
      data: {
        title: modulePlan.title,
        description: modulePlan.description,
        category: autoCategory,
        status: 'draft',
        authorId: userId,
        lessons: {
          create: modulePlan.lessons.map((lesson: any, index: number) => ({
            title: lesson.title,
            description: lesson.description,
            order: index,
            presentations: {
              create: lesson.presentations?.map((p: any, pIdx: number) => ({
                fileName: p.fileName,
                filePath: p.filePath,
                order: pIdx
              })) || []
            }
          }))
        }
      },
      include: {
        lessons: {
          include: {
            presentations: true
          }
        }
      }
    })

    return NextResponse.json({ course })
  } catch (error) {
    console.error('Error publishing draft:', error)
    return NextResponse.json({ error: 'Failed to publish draft' }, { status: 500 })
  }
}
