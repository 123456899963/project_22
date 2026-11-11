import axios from 'axios'
import router from '@/router'
import { useToastStore } from '@/stores/toast'

// 创建 axios 实例 —— 统一配置 + 拦截器
const request = axios.create({
  baseURL: '/api/v1', // 开发期经 Vite proxy 到 FastAPI；生产经 Nginx 同域反代
  timeout: 10000,
  withCredentials: true, // 关键：Cookie 会话（PRD FR-4.3 / API_CONTRACT §1.5）
})

// 不需要登录的路径（401 时不强制跳转，避免登录页自身死循环）
// /auth/me 用于启动时校验会话，游客必然 401，属于正常态，不能弹「登录已过期」并跳转
const PUBLIC_PATHS = ['/auth/login', '/auth/register', '/auth/username-availability', '/auth/me']

// —— 响应拦截器：统一错误处理 ——
request.interceptors.response.use(
  (res) => {
    // FastAPI 返回统一格式 { code: 0, message: "...", data: ... }
    const body = res.data
    if (body && typeof body.code === 'number' && body.code !== 0) {
      // 业务错误（后端 code != 0）
      useToastStore().error(body.message || '请求失败')
      return Promise.reject(new Error(body.message))
    }
    return body
  },
  (err) => {
    const status = err.response?.status
    const body = err.response?.data
    const msg = body?.message || err.message
    const toast = useToastStore()

    if (status === 401) {
      // 会话过期或未登录：非公开接口才跳转登录页
      const url: string = err.config?.url || ''
      const isPublic = PUBLIC_PATHS.some((p) => url.endsWith(p))
      if (url.startsWith('/admin')) {
        toast.warn('管理员会话已过期，请重新登录')
        router.push({ name: 'admin-login' })
      } else if (!isPublic) {
        const redirect = encodeURIComponent(window.location.pathname + window.location.search)
        toast.warn('登录已过期，请重新登录')
        router.push({ path: '/login', query: { redirect } })
      }
    } else {
      toast.error(msg || '网络异常')
    }
    return Promise.reject(err)
  },
)

export default request
