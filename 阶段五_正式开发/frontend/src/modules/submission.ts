import { http } from '@/api/http'
import type { PageData, TeaSummary } from '@/modules/catalog'

export type SubmissionType = 'T1' | 'T3' | 'T4'
export type SubmissionStatus = 'draft' | 'pending' | 'approved' | 'rejected' | 'locked' | 'revised'

export interface SubmissionItem {
  id: number
  type: SubmissionType
  status: SubmissionStatus
  teaId: number
  teaName: string
  title?: string
  summary?: string
  retryCount: number
  rejectReason?: string
  createdAt: string
  updatedAt: string
}

export interface SubmissionDetail extends SubmissionItem {
  body?: string
  images: Array<{ id: number; url: string; thumbUrl?: string }>
  correctionFieldKey?: string
  newValue?: string
  reason?: string
  anonymous: boolean
  licenseGranted?: boolean
  nickname?: string
}

export interface UploadedImage {
  id: number
  url: string
  thumbUrl?: string
  status: string
}

export interface CreateSubmissionPayload {
  type: SubmissionType
  teaId: number
  title?: string
  body?: string
  imageIds?: number[]
  licenseGranted?: boolean
  correctionFieldKey?: string
  newValue?: string
  reason?: string
  anonymous?: boolean
}

export const submissionApi = {
  list: (params: Record<string, unknown>) => http.get<PageData<SubmissionItem>>('/me/submissions', params),
  create: (payload: CreateSubmissionPayload) => http.post<SubmissionItem>('/me/submissions', payload),
  detail: (id: number) => http.get<SubmissionDetail>(`/me/submissions/${id}`),
  update: (id: number, payload: Partial<CreateSubmissionPayload>) =>
    http.patch<SubmissionItem>(`/me/submissions/${id}`, payload),
  remove: (id: number) => http.delete<void>(`/me/submissions/${id}`),
  submit: (id: number) => http.post<SubmissionItem>(`/me/submissions/${id}/submit`),
  resubmit: (id: number) => http.post<SubmissionItem>(`/me/submissions/${id}/resubmit`),
  preview: (id: number) => http.get<SubmissionDetail>(`/me/submissions/${id}/preview`),
  teaOptions: (keyword: string) =>
    http.get<PageData<TeaSummary>>('/teas', { keyword, page: 1, size: 20 }),
  uploadImage: (form: FormData) => http.post<UploadedImage>('/me/uploads', form)
}
