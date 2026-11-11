/** 我的模块接口（S15 / ADR-0004 / API_CONTRACT §4.7） */

import request from './request'
import type { ApiEnvelope, NoteItem, User, UserStats } from '@/types'

/** GET /me/stats 当前用户统计与等级（需登录） */
export function getMyStats() {
  return request.get<unknown, ApiEnvelope<UserStats>>('/me/stats')
}

/** GET /me/notes 当前用户品鉴笔记，每款茶 1 条（需登录，§4.7.4） */
export function getMyNotes() {
  return request.get<unknown, ApiEnvelope<NoteItem[]>>('/me/notes')
}

/** POST /me/avatar 上传本地图片设为头像（需登录，multipart） */
export function uploadAvatar(file: File) {
  const form = new FormData()
  form.append('file', file)
  return request.post<unknown, ApiEnvelope<User>>('/me/avatar', form)
}

/** PUT /me/avatar 选择预置头像（需登录） */
export function setPresetAvatar(preset: string) {
  return request.put<unknown, ApiEnvelope<User>>('/me/avatar', { preset })
}
