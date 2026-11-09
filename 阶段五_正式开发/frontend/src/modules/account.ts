import { http } from '@/api/http'

export type MessageType = 'review' | 'correction' | 'report' | 'system'

export interface MessageItem {
  id: number
  type: MessageType
  title: string
  summary?: string
  targetType?: string
  targetId?: number
  read: boolean
  createdAt: string
}

export interface MessagePageData {
  items: MessageItem[]
  page: number
  size: number
  total: number
  hasMore: boolean
  unread: number
}

export interface AccountOverview {
  favorites: number
  history: number
  submissions: number
  unread: number
}

export interface DeletionStatus {
  status: string
  requestedAt?: string
  effectiveAt?: string
}

export interface WhitelistItem {
  id: number
  userId?: number
  openidMasked: string
  role: string
  note?: string
  createdAt: string
}

export interface ProfilePayload {
  nickname?: string
  avatarUrl?: string
}

export const accountApi = {
  messages: (params: Record<string, unknown>) => http.get<MessagePageData>('/me/messages', params),
  markRead: (id: number) => http.patch<void>(`/me/messages/${id}/read`),
  markAllRead: () => http.patch<void>('/me/messages/read-all'),

  overview: () => http.get<AccountOverview>('/me/overview'),
  updateProfile: (payload: ProfilePayload) => http.patch<Record<string, unknown>>('/me/profile', payload),
  requestDeletion: () => http.post<DeletionStatus>('/me/deletion'),
  cancelDeletion: () => http.delete<void>('/me/deletion'),

  admins: () => http.get<WhitelistItem[]>('/admin/admins'),
  addAdmin: (payload: { openid: string; role: string; note?: string }) =>
    http.post<WhitelistItem>('/admin/admins', payload),
  removeAdmin: (id: number) => http.delete<void>(`/admin/admins/${id}`)
}
