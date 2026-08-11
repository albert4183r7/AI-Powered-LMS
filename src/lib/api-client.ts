export class ApiClientError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message)
    this.name = 'ApiClientError'
  }
}

type ErrorPayload = {
  error?: string
  code?: string
}

/**
 * Sends a JSON API request and converts non-success responses into a typed error.
 * Existing API payload shapes are returned unchanged for backward compatibility.
 */
export async function apiRequest<ResponseBody>(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<ResponseBody> {
  const response = await fetch(input, init)
  const responseBody = await response.json().catch(() => null) as ResponseBody | ErrorPayload | null

  if (!response.ok) {
    const errorPayload = responseBody as ErrorPayload | null
    throw new ApiClientError(
      errorPayload?.error || 'The request could not be completed.',
      response.status,
      errorPayload?.code,
    )
  }

  return responseBody as ResponseBody
}
