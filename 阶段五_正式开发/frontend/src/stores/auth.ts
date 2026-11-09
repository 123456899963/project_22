import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { http, TOKEN_KEY } from '@/api/http'

export type UserRole = 'visitor' | 'user' | 'admin' | 'super'

export interface UserProfile {
  id: number
  nickname: string
  avatarUrl?: string
  role: UserRole
  status: 'active' | 'deleting' | 'deleted' | 'muted' | 'banned'
}

interface LoginResult {
  accessToken: string
  refreshToken: string
  expiresIn: number
  user: UserProfile
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<UserProfile | null>(null)
  const token = ref<string | null>(localStorage.getItem(TOKEN_KEY))
  const loading = ref(false)
  let restored = false

  const isLoggedIn = computed(() => Boolean(token.value))
  const isAdmin = computed(() => user.value?.role === 'admin' || user.value?.role === 'super')
  const isSuper = computed(() => user.value?.role === 'super')

  function setToken(value: string | null) {
    token.value = value
    if (value) {
      localStorage.setItem(TOKEN_KEY, value)
    } else {
      localStorage.removeItem(TOKEN_KEY)
    }
  }

  async function fetchProfile(): Promise<void> {
    user.value = await http.get<UserProfile>('/me/profile')
  }

  async function ensureLoaded(): Promise<void> {
    if (restored) {
      return
    }
    restored = true
    if (token.value) {
      loading.value = true
      try {
        await fetchProfile()
      } catch {
        user.value = null
      } finally {
        loading.value = false
      }
    }
  }

  async function loginWithWechat(code: string, state: string): Promise<void> {
    loading.value = true
    try {
      const result = await http.post<LoginResult>('/auth/wechat/callback', { code, state })
      setToken(result.accessToken)
      user.value = result.user
    } finally {
      loading.value = false
    }
  }

  async function loginDev(openid: string, nickname: string): Promise<void> {
    loading.value = true
    try {
      const result = await http.post<LoginResult>('/auth/dev-login', { openid, nickname })
      setToken(result.accessToken)
      user.value = result.user
    } finally {
      loading.value = false
    }
  }

  async function logout(): Promise<void> {
    try {
      await http.post<void>('/auth/logout')
    } catch {
      // 令牌已失效时也要清理本地登录态
    } finally {
      setToken(null)
      user.value = null
      restored = true
    }
  }

  return {
    user,
    token,
    loading,
    isLoggedIn,
    isAdmin,
    isSuper,
    setToken,
    fetchProfile,
    ensureLoaded,
    loginWithWechat,
    loginDev,
    logout
  }
})
