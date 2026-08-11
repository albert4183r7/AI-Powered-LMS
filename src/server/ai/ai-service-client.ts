import 'server-only'

import { ApiError } from '@/server/http/api-response'

const DEVELOPMENT_AI_SERVICE_BASE_URL = 'http://127.0.0.1:8000'
const DEVELOPMENT_INTERNAL_API_KEY =
  'local-development-internal-key-change-before-production'
const AI_SERVICE_REQUEST_TIMEOUT_MILLISECONDS = 10_000

interface AiServiceErrorPayload {
  detail?: unknown
}

interface AiServiceRequestOptions {
  method?: 'GET' | 'POST' | 'DELETE'
  body?: string
}

function getAiServiceBaseUrl() {
  const configuredBaseUrl = process.env.AI_SERVICE_BASE_URL?.trim()
  if (configuredBaseUrl) {
    return configuredBaseUrl
  }
  if (process.env.NODE_ENV !== 'production') {
    return DEVELOPMENT_AI_SERVICE_BASE_URL
  }
  throw new ApiError(
    'AI generation is not configured.',
    503,
    'AI_SERVICE_NOT_CONFIGURED',
  )
}

function getInternalApiKey() {
  const configuredInternalApiKey = process.env.AI_SERVICE_INTERNAL_API_KEY?.trim()
  if (configuredInternalApiKey) {
    return configuredInternalApiKey
  }
  if (process.env.NODE_ENV !== 'production') {
    return DEVELOPMENT_INTERNAL_API_KEY
  }
  throw new ApiError(
    'AI generation is not configured.',
    503,
    'AI_SERVICE_NOT_CONFIGURED',
  )
}

function mapAiServiceError(responseStatus: number, responsePayload: AiServiceErrorPayload) {
  if (responseStatus === 404) {
    return new ApiError('Resource not found.', 404, 'AI_SERVICE_RESOURCE_NOT_FOUND')
  }
  if (responseStatus === 409) {
    return new ApiError(
      'Generation job can no longer be cancelled.',
      409,
      'GENERATION_JOB_NOT_CANCELLABLE',
    )
  }
  if (responseStatus === 401 || responseStatus === 403) {
    return new ApiError(
      'The LMS could not authenticate with the AI service.',
      502,
      'AI_SERVICE_AUTHENTICATION_FAILED',
    )
  }

  const hasSafeDetail = typeof responsePayload.detail === 'string'
    && responsePayload.detail.length <= 200
  return new ApiError(
    hasSafeDetail ? responsePayload.detail as string : 'The AI service request failed.',
    responseStatus === 422 ? 422 : 502,
    responseStatus === 422 ? 'INVALID_AI_SERVICE_REQUEST' : 'AI_SERVICE_REQUEST_FAILED',
  )
}

export async function requestAiService(
  servicePath: string,
  authenticatedUserId: string,
  requestOptions: AiServiceRequestOptions = {},
): Promise<Record<string, unknown>> {
  const baseUrl = getAiServiceBaseUrl()
  let requestUrl: URL
  try {
    requestUrl = new URL(servicePath, baseUrl.endsWith('/') ? baseUrl : baseUrl + '/')
  } catch {
    throw new ApiError(
      'The AI service URL is invalid.',
      503,
      'AI_SERVICE_NOT_CONFIGURED',
    )
  }

  let aiServiceResponse: Response
  try {
    aiServiceResponse = await fetch(requestUrl, {
      ...requestOptions,
      cache: 'no-store',
      signal: AbortSignal.timeout(AI_SERVICE_REQUEST_TIMEOUT_MILLISECONDS),
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'x-lumen-internal-key': getInternalApiKey(),
        'x-lumen-user-id': authenticatedUserId,
      },
    })
  } catch {
    throw new ApiError(
      'The AI service is currently unavailable.',
      503,
      'AI_SERVICE_UNAVAILABLE',
    )
  }

  const responsePayload = await aiServiceResponse.json().catch(() => null) as
    | Record<string, unknown>
    | null
  if (!aiServiceResponse.ok) {
    throw mapAiServiceError(
      aiServiceResponse.status,
      (responsePayload || {}) as AiServiceErrorPayload,
    )
  }
  if (!responsePayload) {
    throw new ApiError(
      'The AI service returned an invalid response.',
      502,
      'INVALID_AI_SERVICE_RESPONSE',
    )
  }
  return responsePayload
}

/**
 * Forward a multipart/form-data upload to the AI service.
 * Unlike requestAiService, this function does NOT set content-type so
 * the browser-compatible FormData boundary is preserved.
 */
export async function requestAiServiceMultipart(
  servicePath: string,
  authenticatedUserId: string,
  body: FormData,
): Promise<Record<string, unknown>> {
  const baseUrl = getAiServiceBaseUrl()
  let requestUrl: URL
  try {
    requestUrl = new URL(servicePath, baseUrl.endsWith('/') ? baseUrl : baseUrl + '/')
  } catch {
    throw new ApiError(
      'The AI service URL is invalid.',
      503,
      'AI_SERVICE_NOT_CONFIGURED',
    )
  }

  let aiServiceResponse: Response
  try {
    aiServiceResponse = await fetch(requestUrl, {
      method: 'POST',
      body,
      cache: 'no-store',
      signal: AbortSignal.timeout(AI_SERVICE_REQUEST_TIMEOUT_MILLISECONDS),
      headers: {
        accept: 'application/json',
        'x-lumen-internal-key': getInternalApiKey(),
        'x-lumen-user-id': authenticatedUserId,
        // Do NOT set content-type — the runtime adds the multipart boundary.
      },
    })
  } catch {
    throw new ApiError(
      'The AI service is currently unavailable.',
      503,
      'AI_SERVICE_UNAVAILABLE',
    )
  }

  const responsePayload = await aiServiceResponse.json().catch(() => null) as
    | Record<string, unknown>
    | null
  if (!aiServiceResponse.ok) {
    throw mapAiServiceError(
      aiServiceResponse.status,
      (responsePayload || {}) as AiServiceErrorPayload,
    )
  }
  if (!responsePayload) {
    throw new ApiError(
      'The AI service returned an invalid response.',
      502,
      'INVALID_AI_SERVICE_RESPONSE',
    )
  }
  return responsePayload
}
