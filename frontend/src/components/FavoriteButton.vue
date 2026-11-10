<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { addFavorite, getFavoriteStatus, removeFavorite } from '@/api/favorites'
import { useUserStore } from '@/stores/user'
import { nextFavoriteState } from '@/utils/favorite'

const PENDING_KEY = 'pending_favorite_tea_id'

const props = withDefaults(
  defineProps<{
    teaId: number
    count?: number
    /** icon：卡片右上角心形；primary：详情页主按钮 */
    variant?: 'icon' | 'primary'
  }>(),
  { count: 0, variant: 'icon' },
)

const emit = defineEmits<{ change: [count: number] }>()

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const isFavorited = ref(false)
const favoriteCount = ref(props.count)
const pending = ref(false)

watch(
  () => props.count,
  (value) => {
    favoriteCount.value = value
  },
)

watch(
  () => userStore.isLoggedIn,
  (loggedIn) => {
    if (loggedIn) {
      void syncStatus()
    } else {
      isFavorited.value = false
    }
  },
)

onMounted(() => {
  if (userStore.isLoggedIn) {
    void syncStatus()
  }
})

function apply(state: { is_favorited: boolean; favorite_count: number }) {
  isFavorited.value = state.is_favorited
  favoriteCount.value = state.favorite_count
  emit('change', state.favorite_count)
}

async function syncStatus() {
  try {
    const res = await getFavoriteStatus(props.teaId)
    apply(res.data)
  } catch {
    // 茶品不存在或网络异常：保持未收藏展示，不阻断浏览
  }
  await replayPending()
}

/** 未登录点击 → 登录；登录成功回到原页后自动执行本次收藏 */
async function replayPending() {
  const raw = sessionStorage.getItem(PENDING_KEY)
  if (!raw || Number(raw) !== props.teaId) return
  sessionStorage.removeItem(PENDING_KEY)
  if (isFavorited.value) return
  await doToggle(false)
}

function requireLogin() {
  sessionStorage.setItem(PENDING_KEY, String(props.teaId))
  void router.push({ name: 'login', query: { redirect: route.fullPath } })
}

async function doToggle(optimistic = true) {
  if (pending.value) return
  const action = isFavorited.value ? 'remove' : 'add'
  const previous = { is_favorited: isFavorited.value, favorite_count: favoriteCount.value }

  if (optimistic) apply(nextFavoriteState(previous, action))

  pending.value = true
  try {
    const res =
      action === 'add' ? await addFavorite(props.teaId) : await removeFavorite(props.teaId)
    apply(res.data)
  } catch {
    apply(previous)
  } finally {
    pending.value = false
  }
}

function onClick() {
  if (pending.value) return
  if (!userStore.isLoggedIn) {
    requireLogin()
    return
  }
  void doToggle()
}
</script>

<template>
  <button
    type="button"
    class="fav-btn"
    :class="[
      `fav-btn--${variant}`,
      { 'fav-btn--active': isFavorited, 'fav-btn--pending': pending },
    ]"
    :aria-pressed="isFavorited"
    :aria-label="isFavorited ? '取消收藏' : '收藏茶品'"
    :title="isFavorited ? '取消收藏' : '加入我的清单'"
    @click.stop.prevent="onClick"
  >
    <svg
      class="fav-btn__heart"
      viewBox="0 0 24 24"
      :fill="isFavorited ? 'currentColor' : 'none'"
      stroke="currentColor"
      stroke-width="2"
      aria-hidden="true"
    >
      <path
        d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7Z"
      />
    </svg>
    <span v-if="variant === 'primary'" class="fav-btn__text">
      {{ isFavorited ? '已在我的清单' : '加入我的清单' }}
    </span>
  </button>
</template>

<style scoped>
.fav-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  cursor: pointer;
  font-family: inherit;
  transition:
    background 0.2s,
    border-color 0.2s,
    color 0.2s,
    transform 0.15s;
}

.fav-btn--icon {
  width: 36px;
  height: 36px;
  border-radius: var(--radius-full);
  border: 1px solid var(--color-border);
  background: rgba(255, 255, 255, 0.92);
  color: var(--color-text-secondary);
  backdrop-filter: blur(4px);
}

.fav-btn--icon:hover {
  color: var(--color-primary);
  border-color: var(--color-primary);
}

.fav-btn--icon.fav-btn--active {
  color: var(--color-error);
  border-color: var(--color-error);
}

.fav-btn--primary {
  height: 44px;
  padding: 0 24px;
  border-radius: var(--radius-full);
  border: 1px solid var(--color-primary);
  background: var(--color-primary);
  color: var(--color-text-inverse);
  font-size: var(--text-body);
  font-weight: 500;
}

.fav-btn--primary:hover {
  background: var(--color-primary-hover);
  border-color: var(--color-primary-hover);
}

.fav-btn--primary.fav-btn--active {
  background: transparent;
  color: var(--color-primary);
}

.fav-btn--pending {
  opacity: 0.7;
  cursor: wait;
}

.fav-btn__heart {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}

.fav-btn--primary .fav-btn__heart {
  width: 16px;
  height: 16px;
}
</style>
