import { randomUUID } from 'node:crypto'
import { mkdir, unlink, writeFile } from 'node:fs/promises'
import { extname, join } from 'node:path'
import { NextResponse } from 'next/server'
import { ensurePresentationPreview } from '@/server/presentations/presentation-preview'

const ALLOWED_EXTENSIONS = new Set(['.pdf', '.ppt', '.pptx'])
const PRESENTATION_MAX_BYTES = 200 * 1024 * 1024

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file')

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No file provided.', code: 'FILE_REQUIRED' }, { status: 400 })
    }
    const extension = extname(file.name).toLowerCase()
    if (!ALLOWED_EXTENSIONS.has(extension)) {
      return NextResponse.json({ error: 'Unsupported file type.', code: 'UNSUPPORTED_FILE_TYPE' }, { status: 400 })
    }
    if (file.size > PRESENTATION_MAX_BYTES) {
      return NextResponse.json({
        error: `File size exceeds the ${PRESENTATION_MAX_BYTES / 1024 / 1024} MB limit.`,
        code: 'FILE_TOO_LARGE',
      }, { status: 413 })
    }

    const storedFilename = `${Date.now()}-${randomUUID().slice(0, 8)}${extension}`
    const uploadDirectory = join(process.cwd(), 'uploads')
    await mkdir(uploadDirectory, { recursive: true })
    const storedFilePath = join(uploadDirectory, storedFilename)
    await writeFile(storedFilePath, new Uint8Array(await file.arrayBuffer()))
    const publicFilePath = `/uploads/${storedFilename}`
    let previewPath: string
    try {
      previewPath = await ensurePresentationPreview(publicFilePath)
    } catch (conversionError) {
      await unlink(storedFilePath).catch(() => undefined)
      console.error('Presentation preview conversion error:', conversionError)
      return NextResponse.json({
        error: 'The presentation could not be converted into a classroom preview. Check that the file opens correctly, then upload it again.',
        code: 'PREVIEW_CONVERSION_FAILED',
      }, { status: 422 })
    }

    return NextResponse.json({
      filePath: publicFilePath,
      previewPath,
      filename: file.name,
      size: file.size,
    }, { status: 201 })
  } catch (error) {
    console.error('File upload error:', error)
    return NextResponse.json({ error: 'File upload failed.', code: 'UPLOAD_FAILED' }, { status: 500 })
  }
}
