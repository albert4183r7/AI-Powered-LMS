import { extname } from 'node:path'
import { ApiError } from '@/server/http/api-response'

export interface PresentationInput {
  fileName: string
  filePath: string
}

const ALLOWED_PRESENTATION_EXTENSIONS = new Set(['.pdf', '.ppt', '.pptx'])
export const MAX_PRESENTATIONS_PER_LESSON = 10

/** Validates presentation metadata previously returned by the upload endpoint. */
export function presentationInputs(
  value: unknown,
  options: { required?: boolean } = {},
): PresentationInput[] {
  if (!Array.isArray(value)) {
    throw new ApiError('Presentations must be an array.', 400, 'VALIDATION_ERROR')
  }
  if (value.length > MAX_PRESENTATIONS_PER_LESSON) {
    throw new ApiError(
      `A lesson can contain at most ${MAX_PRESENTATIONS_PER_LESSON} presentations.`,
      400,
      'PRESENTATION_LIMIT_EXCEEDED',
    )
  }
  if (options.required && value.length === 0) {
    throw new ApiError(
      'At least one presentation file is required.',
      400,
      'PRESENTATION_REQUIRED',
    )
  }

  return value.map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new ApiError(`Presentation ${index + 1} is invalid.`, 400, 'VALIDATION_ERROR')
    }
    const { fileName, filePath } = item as Record<string, unknown>
    if (typeof fileName !== 'string' || !fileName.trim() || fileName.trim().length > 255) {
      throw new ApiError(`Presentation ${index + 1} has an invalid file name.`, 400, 'VALIDATION_ERROR')
    }
    if (typeof filePath !== 'string' || !filePath.startsWith('/uploads/')) {
      throw new ApiError(`Presentation ${index + 1} has an invalid file path.`, 400, 'VALIDATION_ERROR')
    }
    if (!ALLOWED_PRESENTATION_EXTENSIONS.has(extname(filePath).toLowerCase())) {
      throw new ApiError(`Presentation ${index + 1} has an unsupported file type.`, 400, 'VALIDATION_ERROR')
    }
    return { fileName: fileName.trim(), filePath }
  })
}
