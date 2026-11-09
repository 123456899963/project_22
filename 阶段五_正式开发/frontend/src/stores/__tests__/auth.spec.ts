import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { TOKEN_KEY } from '@/api/http'
import { useAuthStore } from '@/stores/auth'

describe('auth store 角色判定', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('游客未登录且非管理员', () => {
    const auth = useAuthStore()
    expect(auth.isLoggedIn).toBe(false)
    expect(auth.isAdmin).toBe(false)
    expect(auth.isSuper).toBe(false)
  })

  it('admin 角色可进后台但不是超管', () => {
    const auth = useAuthStore()
    auth.user = { id: 1, nickname: '管理员', role: 'admin', status: 'active' }
    expect(auth.isAdmin).toBe(true)
    expect(auth.isSuper).toBe(false)
  })

  it('super 角色同时具备后台与超管权限', () => {
    const auth = useAuthStore()
    auth.user = { id: 1, nickname: '超管', role: 'super', status: 'active' }
    expect(auth.isAdmin).toBe(true)
    expect(auth.isSuper).toBe(true)
  })

  it('setToken 与 localStorage 同步', () => {
    const auth = useAuthStore()
    auth.setToken('token-value')
    expect(auth.isLoggedIn).toBe(true)
    expect(localStorage.getItem(TOKEN_KEY)).toBe('token-value')
    auth.setToken(null)
    expect(auth.isLoggedIn).toBe(false)
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull()
  })
})
