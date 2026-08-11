import { readFile } from 'node:fs/promises'
import { basename, extname } from 'node:path'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  ensurePresentationPreview,
  getAbsoluteUploadPath,
} from '@/server/presentations/presentation-preview'

interface PresentationPreviewContext {
  params: Promise<{ id: string }>
}

function fileTitle(fileName: string) {
  return basename(fileName, extname(fileName)).trim().toLowerCase()
}

export async function GET(_request: Request, { params }: PresentationPreviewContext) {
  try {
    const { id: presentationId } = await params
    const presentation = await db.lessonPresentation.findUnique({
      where: { id: presentationId },
      include: {
        lesson: {
          select: {
            presentations: {
              select: { id: true, fileName: true, filePath: true },
            },
          },
        },
      },
    })
    if (!presentation) {
      return NextResponse.json({ error: 'Presentation not found.', code: 'PRESENTATION_NOT_FOUND' }, { status: 404 })
    }

    const matchingPdf = extname(presentation.fileName).toLowerCase() !== '.pdf'
      ? presentation.lesson.presentations.find((candidate) => (
          candidate.id !== presentation.id
          && extname(candidate.fileName).toLowerCase() === '.pdf'
          && fileTitle(candidate.fileName) === fileTitle(presentation.fileName)
        ))
      : null

    const previewPath = matchingPdf?.filePath ?? await ensurePresentationPreview(
      presentation.filePath,
      presentation.previewPath,
    )
    if (previewPath !== presentation.previewPath) {
      await db.lessonPresentation.update({
        where: { id: presentation.id },
        data: { previewPath },
      })
    }

    const previewBuffer = await readFile(getAbsoluteUploadPath(previewPath))
    const safePreviewFileName = presentation.fileName
      .replace(/\.(ppt|pptx)$/i, '.pdf')
      .replace(/["\\\r\n]/g, '_')
    return new NextResponse(previewBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${safePreviewFileName}"`,
        'Cache-Control': 'private, max-age=3600',
      },
    })
  } catch (error) {
    console.error('Presentation preview error:', error)
    return NextResponse.json({
      error: 'This presentation preview is unavailable. Ask the instructor to upload a valid PDF, PPT, or PPTX file.',
      code: 'PREVIEW_UNAVAILABLE',
    }, { status: 422 })
  }
}
