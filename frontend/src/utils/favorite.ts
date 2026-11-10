/**
 * 收藏状态纯函数（供 FavoriteButton 乐观更新与 Vitest 使用）
 */

export interface FavoriteSnapshot {
  is_favorited: boolean
  favorite_count: number
}

/**
 * 计算乐观更新后的状态：
 * - 已收藏再次收藏、未收藏再次取消均保持原状态（与后端幂等一致）
 * - 取消收藏时计数不低于 0
 */
export function nextFavoriteState(
  current: FavoriteSnapshot,
  action: 'add' | 'remove',
): FavoriteSnapshot {
  if (action === 'add') {
    if (current.is_favorited) return current
    return { is_favorited: true, favorite_count: current.favorite_count + 1 }
  }
  if (!current.is_favorited) return current
  return { is_favorited: false, favorite_count: Math.max(0, current.favorite_count - 1) }
}

/** 拼装分享链接（origin 末尾斜杠容错） */
export function buildShareUrl(origin: string, token: string): string {
  return `${origin.replace(/\/+$/, '')}/c/${token}`
}
