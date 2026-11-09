import { describe, expect, it } from 'vitest'
import { resolveNavigation } from '@/router/guard'

const visitor = { isLoggedIn: false, isAdmin: false, isSuper: false }
const user = { isLoggedIn: true, isAdmin: false, isSuper: false }
const admin = { isLoggedIn: true, isAdmin: true, isSuper: false }
const superAdmin = { isLoggedIn: true, isAdmin: true, isSuper: true }

describe('resolveNavigation', () => {
  it('游客访问后台跳转后台登录并带回跳地址', () => {
    expect(
      resolveNavigation({ fullPath: '/admin/teas', requiresAdmin: true }, visitor)
    ).toEqual({ path: '/admin/login', query: { redirect: '/admin/teas' } })
  })

  it('普通用户访问后台回首页并标记 denied', () => {
    expect(
      resolveNavigation({ fullPath: '/admin', requiresAdmin: true }, user)
    ).toEqual({ path: '/', query: { denied: 'admin' } })
  })

  it('管理员访问仅超管页面被拦回工作台', () => {
    expect(
      resolveNavigation({ fullPath: '/admin/admins', requiresAdmin: true, requiresSuper: true }, admin)
    ).toEqual({ path: '/admin', query: { denied: 'super' } })
  })

  it('未登录访问个人中心跳转前台登录', () => {
    expect(
      resolveNavigation({ fullPath: '/me/favorites', requiresAuth: true }, visitor)
    ).toEqual({ path: '/login', query: { redirect: '/me/favorites' } })
  })

  it('超管访问超管页面放行', () => {
    expect(
      resolveNavigation({ fullPath: '/admin/settings', requiresAdmin: true, requiresSuper: true }, superAdmin)
    ).toBe(true)
  })

  it('公开页面直接放行', () => {
    expect(resolveNavigation({ fullPath: '/teas/green' }, visitor)).toBe(true)
  })
})
