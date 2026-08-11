import { promisify } from 'node:util'
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import { db } from '@/lib/db'
import { ApiError } from '@/server/http/api-response'
import type { UserRole } from '@/features/users/types'

const scrypt = promisify(scryptCallback)
const PASSWORD_HASH_PREFIX = 'scrypt'
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex')
  const derivedKey = await scrypt(password, salt, 64) as Buffer
  return `${PASSWORD_HASH_PREFIX}$${salt}$${derivedKey.toString('hex')}`
}

async function verifyPassword(password: string, storedPassword: string) {
  const [prefix, salt, storedHash] = storedPassword.split('$')
  if (prefix !== PASSWORD_HASH_PREFIX || !salt || !storedHash) {
    return password === storedPassword
  }

  const derivedKey = await scrypt(password, salt, 64) as Buffer
  const storedKey = Buffer.from(storedHash, 'hex')
  return storedKey.length === derivedKey.length && timingSafeEqual(storedKey, derivedKey)
}

function toAuthenticatedUser(user: { id: string; email: string; name: string | null; role: string }) {
  return { id: user.id, email: user.email, name: user.name, role: user.role }
}

export async function authenticateUser(emailInput: string, password: string) {
  const email = normalizeEmail(emailInput)
  const user = await db.user.findUnique({ where: { email } })

  if (!user || !(await verifyPassword(password, user.password))) {
    throw new ApiError('Invalid credentials.', 401, 'INVALID_CREDENTIALS')
  }

  // Transparently upgrade legacy plaintext demo passwords after a valid login.
  if (!user.password.startsWith(`${PASSWORD_HASH_PREFIX}$`)) {
    await db.user.update({ where: { id: user.id }, data: { password: await hashPassword(password) } })
  }

  return { user: toAuthenticatedUser(user) }
}

export async function registerUser(input: {
  email: string
  password: string
  name?: string
  role: Exclude<UserRole, 'admin'>
}) {
  const email = normalizeEmail(input.email)
  if (!EMAIL_PATTERN.test(email)) {
    throw new ApiError('Enter a valid email address.', 400, 'INVALID_EMAIL')
  }
  if (input.password.length < 6) {
    throw new ApiError('Password must be at least 6 characters.', 400, 'WEAK_PASSWORD')
  }

  const existingUser = await db.user.findUnique({ where: { email } })
  if (existingUser) {
    throw new ApiError('Email already exists.', 409, 'EMAIL_ALREADY_EXISTS')
  }

  const user = await db.user.create({
    data: {
      email,
      password: await hashPassword(input.password),
      name: input.name?.trim() || email.split('@')[0],
      role: input.role,
    },
  })
  return { user: toAuthenticatedUser(user) }
}

export async function listUsers(searchTerm: string) {
  const users = await db.user.findMany({
    where: searchTerm
      ? { OR: [{ name: { contains: searchTerm } }, { email: { contains: searchTerm } }] }
      : undefined,
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { courses: true, enrollments: true } } },
  })

  return {
    users: users.map((user) => ({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
      coursesCreated: user._count.courses,
      enrollmentCount: user._count.enrollments,
    })),
  }
}

export async function updateUser(userId: string, updates: { name?: string; role?: UserRole }) {
  if (updates.name === undefined && updates.role === undefined) {
    throw new ApiError('No fields to update.', 400, 'NO_UPDATES')
  }

  const existingUser = await db.user.findUnique({ where: { id: userId }, select: { id: true } })
  if (!existingUser) {
    throw new ApiError('User not found.', 404, 'USER_NOT_FOUND')
  }

  const user = await db.user.update({ where: { id: userId }, data: updates })
  return toAuthenticatedUser(user)
}

export async function updateDisplayName(userId: string, name: string) {
  const existingUser = await db.user.findUnique({ where: { id: userId }, select: { id: true } })
  if (!existingUser) {
    throw new ApiError('User not found.', 404, 'USER_NOT_FOUND')
  }
  const user = await db.user.update({ where: { id: userId }, data: { name } })
  return { name: user.name }
}
