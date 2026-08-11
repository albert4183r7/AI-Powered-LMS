import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'node:fs/promises'
import { extname, resolve, sep } from 'node:path'

const ALLOWED_PRESENTATION_EXTENSIONS = new Set(['.pdf', '.ppt', '.pptx'])

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path: pathSegments } = await params
    const uploadDirectory = resolve(process.cwd(), 'uploads')
    const filePath = resolve(uploadDirectory, ...pathSegments)
    if (!filePath.startsWith(`${uploadDirectory}${sep}`)) {
      return NextResponse.json({ error: 'Invalid file path.' }, { status: 400 })
    }

    const ext = extname(filePath).toLowerCase()
    if (!ALLOWED_PRESENTATION_EXTENSIONS.has(ext)) {
      return NextResponse.json({ error: 'Unsupported file type.' }, { status: 400 })
    }
    const buffer = await readFile(filePath)

    const mimeTypes: Record<string, string> = {
      '.pdf': 'application/pdf',
      '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      '.ppt': 'application/vnd.ms-powerpoint',
    }

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': mimeTypes[ext] || 'application/octet-stream',
        'Content-Disposition': `${ext === '.pdf' ? 'inline' : 'attachment'}; filename="${pathSegments[pathSegments.length - 1]}"`,
      },
    })
  } catch {
    return NextResponse.json({ error: 'File not found' }, { status: 404 })
  }
}
