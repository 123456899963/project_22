import axios, { AxiosError, type AxiosInstance, type AxiosRequestConfig } from 'axios'

export interface ApiEnvelope<T> {
  code: string
  message: string
  data: T
  traceId?: string
  details?: Array<{ field: string; reason: string }>
}

export class ApiError extends Error {
  readonly code: string
  readonly status: number
  readonly details: Array<{ field: string; reason: string }>

  constructor(code: string, message: string, status: number, details: Array<{ field: string; reason: string }> = []) {
    super(message)
    this.code = code
    this.status = status
    this.details = details
  }
}

const TOKEN_KEY = 'mm_access_token'

const instance: AxiosInstance = axios.create({
  baseURL: '/api/v1',
  timeout: 15000,
  withCredentials: true
})

instance.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY)
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

instance.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiEnvelope<unknown>>) => {
    const status = error.response?.status ?? 0
    const body = error.response?.data
    if (status === 401 && body?.code !== 'MM-AUTH-005' && body?.code !== 'MM-AUTH-006') {
      localStorage.removeItem(TOKEN_KEY)
      const current = `${window.location.pathname}${window.location.search}`
      if (!current.startsWith('/login') && !current.startsWith('/admin/login')) {
        window.location.href = `/${current.includes('admin') ? 'admin/login' : 'login'}?redirect=${encodeURIComponent(current)}`
      }
    }
    throw new ApiError(
      body?.code ?? 'MM-SYS-003',
      body?.message ?? '网络或服务异常',
      status,
      body?.details ?? []
    )
  }
)

async function request<T>(config: AxiosRequestConfig): Promise<T> {
  const response = await instance.request<ApiEnvelope<T>>(config)
  const body = response.data
  if (body.code !== 'OK') {
    throw new ApiError(body.code, body.message, response.status, body.details ?? [])
  }
  return body.data
}

export const http = {
  get: <T>(url: string, params?: Record<string, unknown>) => request<T>({ method: 'GET', url, params }),
  post: <T>(url: string, data?: unknown) => request<T>({ method: 'POST', url, data }),
  patch: <T>(url: string, data?: unknown) => request<T>({ method: 'PATCH', url, data }),
  delete: <T>(url: string, params?: Record<string, unknown>) => request<T>({ method: 'DELETE', url, params })
}

export { TOKEN_KEY }
