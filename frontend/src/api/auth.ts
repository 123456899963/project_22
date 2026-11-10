import request from '@/api/request'
import type { ApiResponse, LoginPayload, RegisterPayload, User } from '@/types'

/**
 * 认证相关 API
 * 会话由后端 HttpOnly Cookie 维护，前端不存储任何 Token。
 */

export interface UsernameAvailability {
  username: string
  available: boolean
}

export async function login(payload: LoginPayload): Promise<ApiResponse<User>> {
  return request.post('/auth/login', payload)
}

export async function register(payload: RegisterPayload): Promise<ApiResponse<User>> {
  return request.post('/auth/register', payload)
}

export async function logout(): Promise<ApiResponse<null>> {
  return request.post('/auth/logout')
}

export async function getMe(): Promise<ApiResponse<User>> {
  return request.get('/auth/me')
}

export async function checkUsernameAvailability(
  username: string,
): Promise<ApiResponse<UsernameAvailability>> {
  return request.get('/auth/username-availability', { params: { username } })
}
