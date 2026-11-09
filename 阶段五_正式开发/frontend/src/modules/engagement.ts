import { http } from '@/api/http'
import type { PageData, TeaSummary } from '@/modules/catalog'

export interface FavoriteItem {
  teaId: number
  tea: TeaSummary
  group: 'want' | 'drank'
  createdAt: string
}

export interface HistoryItem {
  teaId: number
  tea: TeaSummary
  viewedAt: string
}

export interface CompareItem {
  tea: TeaSummary
  detail?: Record<string, string>
}

export interface CompareData {
  items: CompareItem[]
  limit: number
}

export interface CommentItem {
  id: number
  content: string
  imageUrl?: string
  author: { nickname: string; avatarUrl?: string }
  likeCount: number
  liked: boolean
  status?: string
  createdAt: string
}

export const engagementApi = {
  favorites: (group: 'want' | 'drank', page = 1, size = 12) =>
    http.get<PageData<FavoriteItem>>('/me/favorites', { group, page, size }),
  addFavorite: (teaId: number, group: 'want' | 'drank' = 'want') =>
    http.post<void>('/me/favorites', { teaId, group }),
  moveFavorite: (teaId: number, group: 'want' | 'drank') =>
    http.patch<void>(`/me/favorites/${teaId}`, { group }),
  removeFavorite: (teaId: number) => http.delete<void>(`/me/favorites/${teaId}`),

  history: (page = 1, size = 12) => http.get<PageData<HistoryItem>>('/me/history', { page, size }),
  recordHistory: (teaId: number) => http.post<void>('/me/history', { teaId }),
  clearHistory: () => http.delete<void>('/me/history'),

  compare: () => http.get<CompareData>('/me/compare'),
  addCompare: (teaId: number) => http.post<CompareData>('/me/compare', { teaId }),
  removeCompare: (teaId: number) => http.delete<CompareData>('/me/compare', { teaId }),
  clearCompare: () => http.delete<CompareData>('/me/compare'),

  comments: (teaId: number, page = 1, size = 12) =>
    http.get<PageData<CommentItem>>(`/teas/${teaId}/comments`, { page, size }),
  addComment: (teaId: number, content: string, imageId?: number) =>
    http.post<CommentItem>(`/teas/${teaId}/comments`, { content, imageId }),
  deleteComment: (id: number) => http.delete<void>(`/me/comments/${id}`),
  likeComment: (id: number) => http.post<void>(`/comments/${id}/like`),
  unlikeComment: (id: number) => http.delete<void>(`/comments/${id}/like`)
}
