/**
 * 管理员后台接口（API_CONTRACT §4.6）
 * —— 所有请求由后端 get_admin_user 鉴权；前端守卫仅做体验层
 */

import request from './request'
import type {
  AdminContentCreatePayload,
  AdminContentListData,
  AdminContentListParams,
  AdminContentUpdatePayload,
  AdminStatsData,
  AdminTeaCreatePayload,
  AdminTeaListData,
  AdminTeaListParams,
  AdminTeaPayload,
  AdminTipsData,
  AdminTipsPayload,
  AdminToggleData,
  AdminUploadData,
  AdminVideoUploadData,
  ApiEnvelope,
  ContributionItem,
  ContributionListData,
  ContributionListParams,
  ContentItem,
  Tea,
  TeaMediaItem,
} from '@/types'

/** GET /admin/stats 仪表盘统计 */
export function getAdminStats() {
  return request.get<unknown, ApiEnvelope<AdminStatsData>>('/admin/stats')
}

/** GET /admin/teas 后台茶品列表（含下架） */
export function getAdminTeas(params: AdminTeaListParams) {
  return request.get<unknown, ApiEnvelope<AdminTeaListData>>('/admin/teas', { params })
}

/** GET /admin/teas/{id} 后台茶品详情（下架仍可查看） */
export function getAdminTea(id: number) {
  return request.get<unknown, ApiEnvelope<Tea>>(`/admin/teas/${id}`)
}

/** POST /admin/teas 新增茶品 */
export function createAdminTea(payload: AdminTeaCreatePayload) {
  return request.post<unknown, ApiEnvelope<Tea>>('/admin/teas', payload)
}

/** PUT /admin/teas/{id} 全量编辑茶品（不含 tips_* 与 is_active） */
export function updateAdminTea(id: number, payload: AdminTeaPayload) {
  return request.put<unknown, ApiEnvelope<Tea>>(`/admin/teas/${id}`, payload)
}

/** PATCH /admin/teas/{id}/toggle 上下架 */
export function toggleAdminTea(id: number) {
  return request.patch<unknown, ApiEnvelope<AdminToggleData>>(`/admin/teas/${id}/toggle`)
}

/** PUT /admin/teas/{id}/tips 官方小贴士（省略保持 / null 清空） */
export function updateAdminTips(id: number, payload: AdminTipsPayload) {
  return request.put<unknown, ApiEnvelope<AdminTipsData>>(`/admin/teas/${id}/tips`, payload)
}

/** POST /admin/upload 图片上传（JPEG/PNG/WebP ≤ 5MB） */
export function uploadAdminImage(file: File) {
  const formData = new FormData()
  formData.append('file', file)
  return request.post<unknown, ApiEnvelope<AdminUploadData>>('/admin/upload', formData)
}

/** POST /admin/media/video 视频上传（MP4/MOV ≤ 50MB、≤ 3 分钟） */
export function uploadAdminVideo(file: File) {
  const formData = new FormData()
  formData.append('file', file)
  return request.post<unknown, ApiEnvelope<AdminVideoUploadData>>('/admin/media/video', formData)
}

/** POST /admin/teas/{id}/images 追加图片集条目（单茶上限 9 张） */
export function addAdminTeaImage(teaId: number, imageUrl: string) {
  return request.post<unknown, ApiEnvelope<TeaMediaItem>>(`/admin/teas/${teaId}/images`, {
    image_url: imageUrl,
  })
}

/** DELETE /admin/teas/{id}/images/{imageId} 删除图片集条目（物理删除） */
export function deleteAdminTeaImage(teaId: number, imageId: number) {
  return request.delete<unknown, ApiEnvelope<{ deleted: number }>>(
    `/admin/teas/${teaId}/images/${imageId}`,
  )
}

/** GET /admin/contributions 审核队列（默认 pending） */
export function getAdminContributions(params: ContributionListParams) {
  return request.get<unknown, ApiEnvelope<ContributionListData>>('/admin/contributions', { params })
}

/** POST /admin/contributions/{id}/approve 审核通过 */
export function approveContribution(id: number) {
  return request.post<unknown, ApiEnvelope<ContributionItem>>(
    `/admin/contributions/${id}/approve`,
  )
}

/** POST /admin/contributions/{id}/reject 审核拒绝（附理由 1–200 字） */
export function rejectContribution(id: number, reason: string) {
  return request.post<unknown, ApiEnvelope<ContributionItem>>(
    `/admin/contributions/${id}/reject`,
    { reason },
  )
}

// —— 批次五 R1–R5 内容管理 ——

/** GET /admin/contents/{id} 后台内容详情（编辑回填） */
export function getAdminContent(id: number) {
  return request.get<unknown, ApiEnvelope<ContentItem>>(`/admin/contents/${id}`)
}

/** GET /admin/contents 后台内容列表（含下架） */
export function getAdminContents(params: AdminContentListParams) {
  return request.get<unknown, ApiEnvelope<AdminContentListData>>('/admin/contents', { params })
}

/** POST /admin/contents 创建内容条目 */
export function createAdminContent(payload: AdminContentCreatePayload) {
  return request.post<unknown, ApiEnvelope<unknown>>('/admin/contents', payload)
}

/** PUT /admin/contents/{id} 更新内容条目（全量替换） */
export function updateAdminContent(id: number, payload: AdminContentUpdatePayload) {
  return request.put<unknown, ApiEnvelope<unknown>>(`/admin/contents/${id}`, payload)
}

/** DELETE /admin/contents/{id} 软删除 */
export function deleteAdminContent(id: number) {
  return request.delete<unknown, ApiEnvelope<{ deleted: number }>>(`/admin/contents/${id}`)
}

// —— 审计日志 ——

export interface AuditLogItem {
  id: number
  user_id: number | null
  username: string | null
  action: string
  target_type: string | null
  target_id: number | null
  detail: string | null
  created_at: string
}

export interface AuditLogListParams {
  user_id?: number
  action?: string
  from?: string
  to?: string
  page?: number
  page_size?: number
}

export interface AuditLogListData {
  items: AuditLogItem[]
  total: number
  page: number
  page_size: number
}

/** GET /admin/audit-logs 审计日志分页查询 */
export function getAdminAuditLogs(params: AuditLogListParams) {
  return request.get<unknown, ApiEnvelope<AuditLogListData>>('/admin/audit-logs', { params })
}

/** GET /admin/audit-logs/export CSV 导出 */
export function exportAdminAuditLogs() {
  return request.get<unknown, Blob>('/admin/audit-logs/export', { responseType: 'blob' })
}

// —— 用户管理 ——

export interface AdminUserItem {
  id: number
  username: string
  role: string
  created_at: string
}

export interface AdminUserListParams {
  role?: string
  keyword?: string
  page?: number
  page_size?: number
}

export interface AdminUserListData {
  items: AdminUserItem[]
  total: number
  page: number
  page_size: number
}

/** GET /admin/users 用户列表 */
export function getAdminUsers(params: AdminUserListParams) {
  return request.get<unknown, ApiEnvelope<AdminUserListData>>('/admin/users', { params })
}

/** PATCH /admin/users/{id}/role 变更用户角色 */
export function updateAdminUserRole(id: number, role: string) {
  return request.patch<unknown, ApiEnvelope<unknown>>(`/admin/users/${id}/role`, { role })
}

// —— 图片库 ——

export interface AdminMediaItem {
  id: number
  tea_id: number
  image_url: string
  sort_order: number
}

export interface AdminMediaListData {
  items: AdminMediaItem[]
  total: number
  page: number
  page_size: number
}

export interface AdminMediaListParams {
  page?: number
  page_size?: number
}

/** GET /admin/media 全部图片（跨茶品） */
export function getAdminMedia(params: AdminMediaListParams) {
  return request.get<unknown, ApiEnvelope<AdminMediaListData>>('/admin/media', { params })
}

/** GET /admin/media/teas/{tea_id} 某茶图片集 */
export function getAdminTeaMedia(teaId: number) {
  return request.get<unknown, ApiEnvelope<AdminMediaItem[]>>(`/admin/media/teas/${teaId}`)
}

// —— 设置页 ——

export interface AdminSettingsItem {
  key: string
  value: string
}

/** GET /admin/settings 返回全部配置项 */
export function getAdminSettings() {
  return request.get<unknown, ApiEnvelope<{ items: AdminSettingsItem[] }>>('/admin/settings')
}

/** PATCH /admin/settings 运行时改配置 */
export function updateAdminSettings(items: AdminSettingsItem[]) {
  return request.patch<unknown, ApiEnvelope<unknown>>('/admin/settings', { items })
}
