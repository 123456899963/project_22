<template>
  <div class="mm-container mm-page">
    <div class="profile-head">
      <div class="profile-avatar">{{ initial }}</div>
      <div>
        <h1 class="profile-name">{{ auth.user?.nickname ?? '茶友' }}</h1>
        <p class="mm-muted">账号状态：{{ statusLabel }}</p>
      </div>
      <button class="mm-button mm-button--ghost" type="button" @click="handleLogout">退出登录</button>
    </div>

    <div v-if="overview" class="overview-grid">
      <router-link to="/me/favorites" class="overview-card mm-card">
        <span class="overview-card__value">{{ overview.favorites }}</span>
        <span class="mm-muted">收藏</span>
      </router-link>
      <router-link to="/me/history" class="overview-card mm-card">
        <span class="overview-card__value">{{ overview.history }}</span>
        <span class="mm-muted">浏览历史</span>
      </router-link>
      <router-link to="/me/submissions" class="overview-card mm-card">
        <span class="overview-card__value">{{ overview.submissions }}</span>
        <span class="mm-muted">我的投稿</span>
      </router-link>
      <router-link to="/me/messages" class="overview-card mm-card">
        <span class="overview-card__value">{{ overview.unread }}</span>
        <span class="mm-muted">未读消息</span>
      </router-link>
    </div>

    <section class="profile-links mm-card">
      <router-link to="/me/favorites" class="profile-link">我的收藏</router-link>
      <router-link to="/me/history" class="profile-link">浏览历史</router-link>
      <router-link to="/me/submissions" class="profile-link">投稿中心</router-link>
      <router-link to="/me/messages" class="profile-link">消息中心</router-link>
      <router-link to="/me/settings" class="profile-link">账号设置</router-link>
      <router-link v-if="auth.isAdmin" to="/admin" class="profile-link">进入管理后台</router-link>
    </section>

    <p v-if="error" class="mm-error">{{ error }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ApiError } from '@/api/http'
import { accountApi, type AccountOverview } from '@/modules/account'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()
const overview = ref<AccountOverview | null>(null)
const error = ref('')

const initial = computed(() => (auth.user?.nickname ?? '茶').slice(0, 1))

const statusLabel = computed(() => {
  const labels: Record<string, string> = {
    active: '正常',
    deleting: '注销冷静期',
    deleted: '已注销',
    muted: '禁言中',
    banned: '已封禁'
  }
  return labels[auth.user?.status ?? 'active'] ?? ''
})

async function load() {
  try {
    if (!auth.user) {
      await auth.fetchProfile()
    }
    overview.value = await accountApi.overview()
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : '个人中心加载失败'
  }
}

async function handleLogout() {
  await auth.logout()
  router.push('/login')
}

onMounted(load)
</script>

<style scoped>
.profile-head {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  margin-bottom: var(--space-5);
  flex-wrap: wrap;
}

.profile-avatar {
  display: grid;
  width: 64px;
  height: 64px;
  place-items: center;
  border-radius: 50%;
  background: var(--tea-900);
  color: var(--white);
  font-family: var(--font-serif);
  font-size: var(--text-h2);
}

.profile-name {
  font-size: var(--text-h2);
  margin: 0;
}

.profile-head .mm-button {
  margin-left: auto;
}

.overview-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: var(--space-3);
  margin-bottom: var(--space-5);
}

.overview-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-4);
}

.overview-card__value {
  font-family: var(--font-serif);
  font-size: var(--text-h2);
  color: var(--tea-900);
}

.profile-links {
  display: flex;
  flex-direction: column;
  padding: var(--space-2) var(--space-4);
}

.profile-link {
  padding: var(--space-3) 0;
  border-bottom: 1px solid var(--line-200);
  color: var(--ink-700);
}

.profile-link:last-child {
  border-bottom: none;
}

.profile-link:hover {
  color: var(--tea-900);
}
</style>
