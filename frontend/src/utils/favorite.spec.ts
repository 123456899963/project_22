import { describe, expect, it } from 'vitest'
import { buildShareUrl, nextFavoriteState } from './favorite'

describe('nextFavoriteState', () => {
  it('未收藏时收藏：+1 并置为已收藏', () => {
    expect(nextFavoriteState({ is_favorited: false, favorite_count: 10 }, 'add')).toEqual({
      is_favorited: true,
      favorite_count: 11,
    })
  })

  it('已收藏时重复收藏：幂等不变', () => {
    const state = { is_favorited: true, favorite_count: 11 }
    expect(nextFavoriteState(state, 'add')).toEqual(state)
  })

  it('已收藏时取消：-1 并置为未收藏', () => {
    expect(nextFavoriteState({ is_favorited: true, favorite_count: 1 }, 'remove')).toEqual({
      is_favorited: false,
      favorite_count: 0,
    })
  })

  it('未收藏时重复取消：幂等不变', () => {
    const state = { is_favorited: false, favorite_count: 0 }
    expect(nextFavoriteState(state, 'remove')).toEqual(state)
  })

  it('取消收藏计数不会低于 0', () => {
    expect(nextFavoriteState({ is_favorited: true, favorite_count: 0 }, 'remove')).toEqual({
      is_favorited: false,
      favorite_count: 0,
    })
  })
})

describe('buildShareUrl', () => {
  it('拼接 origin 与 token', () => {
    expect(buildShareUrl('http://localhost:5173', 'AbCd1234')).toBe(
      'http://localhost:5173/c/AbCd1234',
    )
  })

  it('容忍 origin 末尾斜杠', () => {
    expect(buildShareUrl('https://tea.example.com/', 'AbCd1234')).toBe(
      'https://tea.example.com/c/AbCd1234',
    )
  })
})
