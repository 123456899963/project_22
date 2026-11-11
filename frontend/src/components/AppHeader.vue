<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { useToastStore } from '@/stores/toast'

const router = useRouter()
const userStore = useUserStore()
const toast = useToastStore()

const keyword = ref('')

/** 无头像时的首字母占位（取用户名首字符） */
const initial = computed(() => (userStore.user?.username ?? '').slice(0, 1).toUpperCase())

function onSearch() {
  const q = keyword.value.trim()
  router.push({ name: 'tea-list', query: q ? { q } : {} })
}

async function onLogout() {
  await userStore.logout()
  toast.info('已退出登录')
  if (router.currentRoute.value.meta.requiresAuth) {
    router.push('/')
  }
}
</script>

<template>
  <header class="app-header">
    <div class="app-header__inner">
      <RouterLink to="/" class="app-header__brand" aria-label="返回首页">
        <span class="app-header__seal seal" aria-hidden="true">茶</span>
        <span class="app-header__brand-text">茶 · 图鉴</span>
      </RouterLink>

      <nav class="app-header__links" aria-label="主导航">
        <RouterLink to="/" class="app-header__link">首页</RouterLink>
        <RouterLink to="/teas" class="app-header__link">茶品列表</RouterLink>
        <div class="app-header__nav-group">
          <span class="app-header__link app-header__link--trigger">
            茶文化
            <span class="app-header__caret" aria-hidden="true"></span>
          </span>
          <div class="app-header__dropdown" role="menu">
            <RouterLink to="/contents/teaware" class="app-header__dropdown-item" role="menuitem">茶具茶器</RouterLink>
            <RouterLink to="/contents/origin" class="app-header__dropdown-item" role="menuitem">茶叶产地</RouterLink>
            <RouterLink to="/contents/culture" class="app-header__dropdown-item" role="menuitem">茶叶文化</RouterLink>
            <RouterLink to="/contents/brand" class="app-header__dropdown-item" role="menuitem">茶叶品牌</RouterLink>
            <RouterLink to="/contents/knowledge" class="app-header__dropdown-item" role="menuitem">茶叶知识</RouterLink>
          </div>
        </div>
      </nav>

      <div class="app-header__right">
        <form class="app-header__search" role="search" @submit.prevent="onSearch">
          <input
            v-model="keyword"
            class="app-header__search-input"
            type="search"
            placeholder="搜索茶名或产地"
            aria-label="搜索茶品"
          />
          <button class="app-header__search-btn" type="submit" aria-label="搜索">
            <svg
              viewBox="0 0 24 24"
              width="16"
              height="16"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
          </button>
        </form>

        <template v-if="userStore.isLoggedIn">
          <RouterLink
            to="/profile"
            class="app-header__profile"
            :title="userStore.user?.username"
          >
            <img
              v-if="userStore.user?.avatar_url"
              class="app-header__avatar"
              :src="userStore.user.avatar_url"
              :alt="`${userStore.user.username} 的头像`"
            />
            <span v-else class="app-header__avatar app-header__avatar--placeholder" aria-hidden="true">
              {{ initial }}
            </span>
            <span class="app-header__user">{{ userStore.user?.username }}</span>
          </RouterLink>
          <button class="app-header__logout" type="button" @click="onLogout">退出</button>
        </template>
        <RouterLink v-else to="/login" class="app-header__login">登录</RouterLink>
      </div>
    </div>
  </header>
</template>

<style scoped>
.app-header {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 50;
  height: 64px;
  background: rgba(246, 241, 231, 0.94);
  backdrop-filter: blur(8px);
  border-bottom: 1px solid var(--color-border-dark);
}

.app-header__inner {
  max-width: 1200px;
  height: 100%;
  margin: 0 auto;
  padding: 0 32px;
  display: flex;
  align-items: center;
  gap: 32px;
}

.app-header__brand {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.app-header__seal {
  width: 30px;
  height: 30px;
  font-size: 16px;
  background: var(--color-cinnabar);
  border-color: var(--color-cinnabar);
  color: var(--color-paper);
}

.app-header__brand-text {
  font-family: var(--font-display);
  font-size: var(--text-h3);
  font-weight: 400;
  letter-spacing: 0.12em;
  color: var(--color-ink);
}

.app-header__links {
  display: flex;
  align-items: center;
  gap: 24px;
}

.app-header__link {
  position: relative;
  font-family: var(--font-kai);
  font-size: var(--text-small);
  letter-spacing: 0.12em;
  font-weight: 400;
  color: var(--color-ink-soft);
  padding: 4px 0;
}

.app-header__link:hover,
.app-header__link.router-link-active {
  color: var(--color-cinnabar);
}

.app-header__link--trigger {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  cursor: default;
}

.app-header__caret {
  width: 5px;
  height: 5px;
  border-right: 1px solid currentColor;
  border-bottom: 1px solid currentColor;
  transform: translateY(-2px) rotate(45deg);
  opacity: 0.7;
}

.app-header__link.router-link-active::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: -1px;
  height: 2px;
  background: var(--color-cinnabar);
}

/* —— 茶文化下拉（批次五 R1–R5）—— */
.app-header__nav-group {
  position: relative;
}
.app-header__link--trigger {
  cursor: default;
}
.app-header__dropdown {
  position: absolute;
  top: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%);
  min-width: 168px;
  background: var(--color-bg-surface);
  border: 1px solid var(--color-ink-soft);
  border-radius: 0;
  box-shadow: var(--shadow-dropdown);
  padding: 6px;
  opacity: 0;
  visibility: hidden;
  transform: translateX(-50%) translateY(-4px);
  transition: opacity 0.15s, visibility 0.15s, transform 0.15s;
  z-index: 60;
}
.app-header__nav-group:hover .app-header__dropdown,
.app-header__link--trigger:hover + .app-header__dropdown {
  opacity: 1;
  visibility: visible;
  transform: translateX(-50%) translateY(0);
}
.app-header__dropdown-item {
  display: block;
  padding: 8px 14px;
  border-radius: 0;
  font-family: var(--font-kai);
  font-size: var(--text-small);
  letter-spacing: 0.08em;
  color: var(--color-ink-soft);
  text-decoration: none;
  line-height: 1.5;
  transition: background 0.15s, color 0.15s;
}
.app-header__dropdown-item:hover {
  background: var(--color-paper-deep);
  color: var(--color-cinnabar);
}

.app-header__right {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 12px;
}

.app-header__search {
  display: flex;
  align-items: center;
  height: 34px;
  border: 1px solid var(--color-border-dark);
  border-radius: 0;
  background: transparent;
  overflow: hidden;
}

.app-header__search-input {
  width: 150px;
  height: 100%;
  padding: 0 12px;
  border: none;
  outline: none;
  background: transparent;
  font-size: var(--text-small);
  color: var(--color-ink);
}

.app-header__search-input::placeholder {
  color: var(--color-ink-faint);
}

.app-header__search-btn {
  width: 36px;
  height: 100%;
  border: none;
  background: transparent;
  color: var(--color-text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.app-header__search-btn:hover {
  color: var(--color-cinnabar);
}

.app-header__profile {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px 4px 4px;
  border-radius: 0;
  transition: background 0.15s;
}

.app-header__profile:hover {
  background: var(--color-paper-deep);
}

.app-header__avatar {
  width: 30px;
  height: 30px;
  flex-shrink: 0;
  border-radius: 0;
  object-fit: cover;
  background: var(--color-paper-deep);
  border: 1px solid var(--color-border-dark);
}

.app-header__avatar--placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-kai);
  font-size: var(--text-small);
  color: var(--color-cinnabar);
}

.app-header__user {
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--text-small);
  color: var(--color-ink-soft);
}

.app-header__logout {
  border: none;
  background: transparent;
  font-size: var(--text-small);
  color: var(--color-ink-faint);
  cursor: pointer;
  padding: 4px;
}

.app-header__logout:hover {
  color: var(--color-cinnabar);
}

.app-header__login {
  display: inline-flex;
  align-items: center;
  height: 32px;
  padding: 0 16px;
  border: 1px solid var(--color-ink-soft);
  font-family: var(--font-kai);
  font-size: var(--text-small);
  letter-spacing: 0.14em;
  color: var(--color-ink);
  white-space: nowrap;
  transition:
    background 0.2s,
    color 0.2s;
}

.app-header__login:hover {
  background: var(--color-ink);
  color: var(--color-paper);
}

@media (max-width: 640px) {
  .app-header {
    height: 56px;
  }

  .app-header__inner {
    padding: 0 16px;
    gap: 16px;
  }

  .app-header__links,
  .app-header__search {
    display: none;
  }

  .app-header__brand-text {
    font-size: var(--text-body);
  }
}
</style>
