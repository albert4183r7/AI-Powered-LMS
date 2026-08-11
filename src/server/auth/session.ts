import { createHmac, timingSafeEqual } from 'node:crypto'

import { cookies } from 'next/headers'
import type { NextResponse } from 'next/server'

import type { AuthenticatedUser, UserRole } from '@/features/users/types'
import { db } from '@/lib/db'
import { ApiError } from '@/server/http/api-response'

const SESSION_COOKIE_NAME = 'lumen_session'
const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 7
const SESSION_VERSION = 1
const DEVELOPMENT_SESSION_SECRET =
  'local-development-session-secret-change-before-production'
const VALID_USER_ROLES = new Set<UserRole>(['admin', 'instructor', 'employee'])

interface SessionPayload {
  version: number
  userId: string
  expiresAt: number
}

function getSessionSecret() {
  const configuredSessionSecret = process.env.SESSION_SECRET?.trim()
  if (configuredSessionSecret) {
    return configuredSessionSecret
  }
  if (process.env.NODE_ENV !== 'production') {
    return DEVELOPMENT_SESSION_SECRET
  }
  throw new ApiError(
    'Authentication is not configured.',
    500,
    'AUTHENTICATION_NOT_CONFIGURED',
  )
}

function signEncodedPayload(encodedPayload: string) {
  return createHmac('sha256', getSessionSecret())
    .update(encodedPayload)
    .digest('base64url')
}

function createSessionToken(userId: string) {
  const sessionPayload: SessionPayload = {
    version: SESSION_VERSION,
    userId,
    expiresAt: Math.floor(Date.now() / 1_000) + SESSION_DURATION_SECONDS,
  }
  const encodedPayload = Buffer.from(JSON.stringify(sessionPayload)).toString('base64url')
  return encodedPayload + '.' + signEncodedPayload(encodedPayload)
}

function verifySessionToken(sessionToken: string): SessionPayload | null {
  const [encodedPayload, providedSignature, unexpectedPart] = sessionToken.split('.')
  if (!encodedPayload || !providedSignature || unexpectedPart) {
    return null
  }

  const expectedSignature = signEncodedPayload(encodedPayload)
  const providedSignatureBuffer = Buffer.from(providedSignature)
  const expectedSignatureBuffer = Buffer.from(expectedSignature)
  if (
    providedSignatureBuffer.length !== expectedSignatureBuffer.length
    || !timingSafeEqual(providedSignatureBuffer, expectedSignatureBuffer)
  ) {
    return null
  }

  try {
    const parsedPayload = JSON.parse(
      Buffer.from(encodedPayload, 'base64url').toString('utf8'),
    ) as Partial<SessionPayload>
    if (
      parsedPayload.version !== SESSION_VERSION
      || typeof parsedPayload.userId !== 'string'
      || !parsedPayload.userId
      || typeof parsedPayload.expiresAt !== 'number'
      || parsedPayload.expiresAt <= Math.floor(Date.now() / 1_000)
    ) {
      return null
    }
    return parsedPayload as SessionPayload
  } catch {
    return null
  }
}

function isUserRole(role: string): role is UserRole {
  return VALID_USER_ROLES.has(role as UserRole)
}

export function attachSessionCookie(response: NextResponse, userId: string) {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: createSessionToken(userId),
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_DURATION_SECONDS,
  })
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  })
}

export async function getAuthenticatedUser(): Promise<AuthenticatedUser | null> {
  const sessionToken = (await cookies()).get(SESSION_COOKIE_NAME)?.value
  const sessionPayload = sessionToken ? verifySessionToken(sessionToken) : null
  if (!sessionPayload) {
    return null
  }

  const user = await db.user.findUnique({
    where: { id: sessionPayload.userId },
    select: { id: true, email: true, name: true, role: true },
  })
  if (!user || !isUserRole(user.role)) {
    return null
  }
  return user
}

export async function requireAuthenticatedUser(
  allowedRoles?: readonly UserRole[],
): Promise<AuthenticatedUser> {
  const authenticatedUser = await getAuthenticatedUser()
  if (!authenticatedUser) {
    throw new ApiError('Sign in to continue.', 401, 'AUTHENTICATION_REQUIRED')
  }
  if (
    allowedRoles
    && !allowedRoles.includes(authenticatedUser.role as UserRole)
  ) {
    throw new ApiError(
      'You do not have permission to perform this action.',
      403,
      'INSUFFICIENT_PERMISSION',
    )
  }
  return authenticatedUser
}
