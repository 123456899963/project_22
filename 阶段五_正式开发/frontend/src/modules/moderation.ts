import { http } from '@/api/http'
import type { PageData } from '@/modules/catalog'
import type { SubmissionItem, SubmissionStatus, SubmissionType } from '@/modules/submission'

export interface DashboardData {
  pendingTeas: number
  pendingSubmissions: number
  pendingReports: number
  overdue: number
  publishedLast7Days: number
}

export interface AdminTeaItem {
  id: number
  teaCode: string
  name: string
  categoryId: number
  categoryName: string
  subcategoryId: number
  subcategoryName: string
  status: 'draft' | 'pending' | 'published' | 'offline'
  imageCount: number
  galleryReady: boolean
  productionYear?: number
  lastUpdateAt: string
  hasPendingRevision: boolean
}

export interface AdminTeaDetail {
  id: number
  teaCode: string
  name: string
  namePinyin?: string
  nameInitials?: string
  categoryId: number
  subcategoryId: number
  originSummary?: string
  qualityDesc?: string
  waterTempMin?: number
  waterTempMax?: number
  ratioGrams?: number
  ratioWaterMl?: number
  vessel?: string
  steepSecondsMin?: number
  steepSecondsMax?: number
  steepTimes?: number
  productionYear?: number
  status: 'draft' | 'pending' | 'published' | 'offline'
  imageCount: number
  galleryReady: boolean
  version: number
  lastUpdateAt: string
  rejectReason?: string
  images: Array<{ id: number; type: string; seq: number; url: string; thumbUrl?: string }>
}

export interface AdminMediaItem {
  id: number
  teaId: number
  type: string
  seq: number
  url: string
  thumbUrl?: string
  status: string
  sourceType?: string
  rightsHolder?: string
  licenseScope?: string
  licenseCertNo?: string
  createdAt: string
}

export interface AdminCategoryItem {
  code: string
  name: string
  sortOrder: number
  subcategories: Array<{
    id: number
    categoryId: number
    code: string
    name: string
    contentStatus: 'normal' | 'constructing'
    teaCount: number
    sortOrder: number
  }>
}

export interface TagItem {
  id: number
  dimension: string
  name: string
  status: string
}

export interface AdminSubmissionItem extends SubmissionItem {
  authorNickname: string
  overdue: boolean
}

export interface AdminSubmissionDetail {
  id: number
  type: SubmissionType
  status: SubmissionStatus
  teaId: number
  teaName: string
  userId: number
  nickname?: string
  title?: string
  body?: string
  images: Array<{ id: number; url: string; thumbUrl?: string }>
  correctionFieldKey?: string
  newValue?: string
  reason?: string
  anonymous: boolean
  retryCount: number
  rejectReason?: string
  lastReviewReason?: string
  createdAt: string
}

export interface ReportItem {
  id: number
  objectType: 'image' | 'comment' | 'user_shot'
  objectId: number
  teaName?: string
  reportType: string
  description: string
  status: 'pending' | 'processing' | 'resolved_valid' | 'resolved_invalid'
  reporterNickname: string
  createdAt: string
  slaDeadline?: string
  overdue: boolean
}

export interface AppealItem {
  id: number
  appellantId: number
  appellantNickname: string
  sanctionId?: number
  reason: string
  status: 'pending' | 'upheld' | 'overturned'
  reviewNote?: string
  reviewedAt?: string
  createdAt: string
}

export interface ReportDetail {
  item: ReportItem
  resultNote?: string
  handlerId?: number
  firstResponseAt?: string
  resolvedAt?: string
  evidence: Array<{ id: number; url: string; seq: number }>
  appeals: AppealItem[]
}

export interface AdminCommentItem {
  id: number
  teaId: number
  teaName: string
  content: string
  userId: number
  nickname: string
  status: 'pending' | 'published' | 'rejected' | 'deleted'
  rejectReason?: string
  createdAt: string
}

export interface AdminUserItem {
  id: number
  nickname: string
  avatarUrl?: string
  status: string
  sanctionStatus: 'none' | 'mute' | 'ban'
  registeredAt: string
}

export interface SanctionItem {
  id: number
  type: 'mute' | 'ban'
  reason: string
  startAt: string
  endAt?: string
  status: string
  createdAt: string
}

export interface AuditLogItem {
  id: number
  operatorId: number
  operatorRole: string
  action: string
  objectType: string
  objectId?: number
  reason?: string
  ip?: string
  requestId?: string
  createdAt: string
}

export interface ImportTaskItem {
  id: number
  fileName: string
  status: string
  totalRows: number
  successRows: number
  errorRows: number
  errorReportPath?: string
  createdAt: string
  startedAt?: string
  finishedAt?: string
}

export interface ImportRowErrorItem {
  rowNo: number
  columnName?: string
  errorMsg: string
}

export interface SettingsItem {
  key: string
  value: string
  valueType: string
  editable: boolean
  description?: string
}

export const moderationApi = {
  dashboard: () => http.get<DashboardData>('/admin/dashboard'),

  teas: (params: Record<string, unknown>) => http.get<PageData<AdminTeaItem>>('/admin/teas', params),
  teaDetail: (id: number) => http.get<AdminTeaDetail>(`/admin/teas/${id}`),
  createTea: (payload: Record<string, unknown>) => http.post<AdminTeaItem>('/admin/teas', payload),
  updateTea: (id: number, payload: Record<string, unknown>) =>
    http.patch<AdminTeaItem>(`/admin/teas/${id}`, payload),
  submitTea: (id: number) => http.post<void>(`/admin/teas/${id}/submit`),
  deleteTea: (id: number) => http.delete<void>(`/admin/teas/${id}`),
  reviewTea: (id: number, decision: 'approve' | 'reject', reason?: string, version?: number) =>
    http.post<void>(`/admin/teas/${id}/review`, { decision, reason, version }),
  offlineTea: (id: number, reason: string) => http.post<void>(`/admin/teas/${id}/unpublish`, { reason }),
  onlineTea: (id: number, reason: string) => http.post<void>(`/admin/teas/${id}/publish`, { reason }),

  adminCategories: () => http.get<AdminCategoryItem[]>('/admin/categories'),
  patchSubcategory: (id: number, contentStatus: 'normal' | 'constructing') =>
    http.patch<void>(`/admin/categories/${id}`, { contentStatus }),

  tags: (params: Record<string, unknown>) => http.get<TagItem[]>('/admin/tags', params),
  createTag: (payload: { dimension: string; name: string }) =>
    http.post<TagItem>('/admin/tags', payload),
  updateTagStatus: (id: number, status: string) =>
    http.patch<TagItem>(`/admin/tags/${id}`, { status }),

  media: (teaId: number) => http.get<AdminMediaItem[]>(`/admin/teas/${teaId}/media`),
  uploadMedia: (form: FormData) => http.post<AdminMediaItem>('/admin/media', form),
  deleteMedia: (id: number) => http.delete<void>(`/admin/media/${id}`),

  submissions: (params: Record<string, unknown>) =>
    http.get<PageData<AdminSubmissionItem>>('/admin/submissions', params),
  submissionDetail: (id: number) =>
    http.get<AdminSubmissionDetail>(`/admin/submissions/${id}`),
  reviewSubmission: (id: number, decision: 'approve' | 'reject', reason?: string) =>
    http.post<void>(`/admin/submissions/${id}/review`, { decision, reason }),
  submissionStatus: (type: SubmissionType, status: SubmissionStatus) => ({ type, status }),

  reports: (params: Record<string, unknown>) => http.get<PageData<ReportItem>>('/admin/reports', params),
  reportDetail: (id: number) => http.get<ReportDetail>(`/admin/reports/${id}`),
  handleReport: (id: number, payload: { decision: 'valid' | 'invalid'; action?: string; resultNote: string }) =>
    http.post<void>(`/admin/reports/${id}/handle`, payload),

  appeals: (params: Record<string, unknown>) =>
    http.get<PageData<AppealItem>>('/admin/appeals', params),
  reviewAppeal: (id: number, decision: 'uphold' | 'overturn', note: string) =>
    http.post<void>(`/admin/appeals/${id}/review`, { decision, note }),

  comments: (params: Record<string, unknown>) =>
    http.get<PageData<AdminCommentItem>>('/admin/comments', params),
  reviewComment: (id: number, decision: 'approve' | 'reject', reason?: string) =>
    http.post<void>(`/admin/comments/${id}/review`, { decision, reason }),

  users: (params: Record<string, unknown>) =>
    http.get<PageData<AdminUserItem>>('/admin/users', params),
  sanctions: (userId: number) => http.get<SanctionItem[]>(`/admin/users/${userId}/sanctions`),
  createSanction: (userId: number, payload: { type: 'mute' | 'ban'; reason: string; endAt?: string }) =>
    http.post<SanctionItem>(`/admin/users/${userId}/sanctions`, payload),
  revokeSanction: (userId: number, sanctionId: number, reason?: string) =>
    http.post<void>(`/admin/users/${userId}/sanctions/${sanctionId}/revoke?reason=${encodeURIComponent(reason ?? '')}`),

  createImport: (form: FormData) => http.post<ImportTaskItem>('/admin/imports', form),
  importDetail: (id: number) => http.get<ImportTaskItem>(`/admin/imports/${id}`),
  importErrors: (id: number) =>
    http.get<ImportRowErrorItem[]>(`/admin/imports/${id}/errors`),
  confirmImport: (id: number) => http.post<ImportTaskItem>(`/admin/imports/${id}/confirm`),

  auditLogs: (params: Record<string, unknown>) =>
    http.get<PageData<AuditLogItem>>('/admin/audit-logs', params),
  settings: () => http.get<SettingsItem[]>('/admin/settings'),
  updateSettings: (items: Array<{ key: string; value: string }>) =>
    http.patch<void>('/admin/settings', { items })
}
