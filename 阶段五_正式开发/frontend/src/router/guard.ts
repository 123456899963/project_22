export interface GuardState {
  isLoggedIn: boolean
  isAdmin: boolean
  isSuper: boolean
}

export interface GuardTarget {
  fullPath: string
  requiresAuth?: boolean
  requiresAdmin?: boolean
  requiresSuper?: boolean
}

export type GuardResult = true | { path: string; query?: Record<string, string> }

/** 路由守卫的纯函数部分：仅做跳转决策，便于单元测试；服务端权限判定仍为最终依据。 */
export function resolveNavigation(to: GuardTarget, state: GuardState): GuardResult {
  if (to.requiresAdmin && !state.isAdmin) {
    return state.isLoggedIn
      ? { path: '/', query: { denied: 'admin' } }
      : { path: '/admin/login', query: { redirect: to.fullPath } }
  }
  if (to.requiresSuper && !state.isSuper) {
    return { path: '/admin', query: { denied: 'super' } }
  }
  if (to.requiresAuth && !state.isLoggedIn) {
    return { path: '/login', query: { redirect: to.fullPath } }
  }
  return true
}
