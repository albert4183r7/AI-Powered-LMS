import { NextResponse } from 'next/server'

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export function successResponse<ResponseBody>(body: ResponseBody, status = 200) {
  return NextResponse.json(body, { status })
}

export function errorResponse(message: string, status: number, code: string) {
  return NextResponse.json({ error: message, code }, { status })
}

export function handleApiError(error: unknown, fallbackMessage: string, context: string) {
  if (error instanceof ApiError) {
    return errorResponse(error.message, error.status, error.code)
  }

  console.error(`[${context}]`, error)
  return errorResponse(fallbackMessage, 500, 'INTERNAL_ERROR')
}

export async function readJsonObject(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = await request.json()
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw new ApiError('Request body must be a JSON object.', 400, 'INVALID_JSON_BODY')
    }
    return body as Record<string, unknown>
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError('Request body must contain valid JSON.', 400, 'INVALID_JSON_BODY')
  }
}
