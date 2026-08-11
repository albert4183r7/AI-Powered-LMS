import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { detectEnterpriseCategory } from '@/features/courses/categories'

export async function POST(req: NextRequest) {
  try {
    const { title, cover, userId, description, category } = await req.json()

    if (!title) {
      return NextResponse.json({ error: 'Course title is required' }, { status: 400 })
    }
    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    const userExists = await db.user.findUnique({ where: { id: userId } })
    if (!userExists) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const existing = await db.course.findFirst({
      where: { title, authorId: userId },
      include: { _count: { select: { lessons: true } } },
    })
    if (existing) {
      // If the existing course is an empty draft (no lessons), auto-delete it
      if (existing.status === 'draft' && existing._count.lessons === 0) {
        await db.course.delete({ where: { id: existing.id } })
      } else {
        return NextResponse.json({ error: `A module named "${title}" already exists in your modules (status: ${existing.status}). Go to "My Modules" to manage it.` }, { status: 409 })
      }
    }

    const autoCategory = category || detectEnterpriseCategory(title)
    const autoDesc = description || `Learn about ${title} in this comprehensive training module.`

    const course = await db.course.create({
      data: {
        title,
        description: autoDesc,
        cover,
        category: autoCategory,
        status: 'draft',
        authorId: userId,
      },
      include: { lessons: { include: { presentations: true } } },
    })

    return NextResponse.json({ course })
  } catch (error) {
    console.error('Error creating course:', error)
    return NextResponse.json({ error: 'Failed to create course' }, { status: 500 })
  }
}
