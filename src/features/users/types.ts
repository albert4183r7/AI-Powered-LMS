export type UserRole = 'admin' | 'instructor' | 'employee'

export interface AuthenticatedUser {
  id: string
  email: string
  name: string | null
  role: string
}

export interface AdminUser extends AuthenticatedUser {
  createdAt: string
  updatedAt: string
  coursesCreated: number
  enrollmentCount: number
}

export interface AuthResponse {
  user: AuthenticatedUser
}

export interface AdminUsersResponse {
  users: AdminUser[]
}
