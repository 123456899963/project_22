<script setup lang="ts">
/**
 * 个人中心（阶段二重构）：页面只保留数据装载与区块组装；
 * 头部 / 头像面板 / 收藏预览 / 快捷入口分别在 components/profile/ 下。
 */
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import AppFooter from '@/components/AppFooter.vue'
import AppBreadcrumb from '@/components/AppBreadcrumb.vue'
import ProfileHero from '@/components/profile/ProfileHero.vue'
import AvatarPanel from '@/components/profile/AvatarPanel.vue'
import FavoritePreview from '@/components/profile/FavoritePreview.vue'
import CategoryDistribution from '@/components/profile/CategoryDistribution.vue'
import NotesSection from '@/components/profile/NotesSection.vue'
import QuickLinks from '@/components/profile/QuickLinks.vue'
import { getListDetail, getMyLists } from '@/api/lists'
import { getMyNotes, getMyStats, setPresetAvatar, uploadAvatar } from '@/api/me'
import { useUserStore } from '@/stores/user'
import { useToastStore } from '@/stores/toast'
import type { ListItem, ListSummary, NoteItem, UserStats } from '@/types'

const router = useRouter()
const userStore = useUserStore()
const toast = useToastStore()

const loading = ref(true)
const stats = ref<UserStats | null>(null)
const notes = ref<NoteItem[]>([])
const lists = ref<ListSummary[]>([])
const preview = ref<ListItem[]>([])

const avatarOpen = ref(false)
const uploading = ref(false)
const savingPreset = ref<string | null>(null)

const avatarUrl = computed(() => userStore.user?.avatar_url ?? null)
const initial = computed(() => (userStore.user?.username ?? '').slice(0, 1).toUpperCase())
const roleLabel = computed(() => (userStore.isAdmin ? '管理员' : '注册用户'))
const joinedText = computed(() => formatDate(userStore.user?.created_at))

onMounted(() => {
  void load()
})

async function load() {
  loading.value = true
  try {
    // 统计 / 笔记 / 清单失败不阻断页面其余部分展示（错误提示由请求拦截器统一处理）
    const [statsRes, notesRes, listsRes] = await Promise.all([
      getMyStats().catch(() => null),
      getMyNotes().catch(() => null),
      getMyLists().catch(() => null),
    ])
    stats.value = statsRes?.data ?? null
    notes.value = notesRes?.data ?? []
    lists.value = listsRes?.data ?? []

    const defaultList = lists.value.find((item) => item.is_default) ?? lists.value[0]
    if (defaultList) {
      const detail = await getListDetail(defaultList.id).catch(() => null)
      preview.value = (detail?.data.items ?? []).slice(0, 6)
    }
  } finally {
    loading.value = false
  }
}

function formatDate(value?: string): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

async function onUpload(file: File) {
  uploading.value = true
  try {
    const res = await uploadAvatar(file)
    userStore.user = res.data
    avatarOpen.value = false
    toast.success('头像已更新')
  } catch {
    // 统一错误提示由请求拦截器处理
  } finally {
    uploading.value = false
  }
}

async function choosePreset(preset: string) {
  if (savingPreset.value) return
  savingPreset.value = preset
  try {
    const res = await setPresetAvatar(preset)
    userStore.user = res.data
    avatarOpen.value = false
    toast.success('头像已更新')
  } catch {
    // 统一错误提示由请求拦截器处理
  } finally {
    savingPreset.value = null
  }
}

async function onLogout() {
  await userStore.logout()
  toast.info('已退出登录')
  router.push('/')
}
</script>

<template>
  <AppHeader />

  <main class="profile-page">
    <div class="container">
      <AppBreadcrumb current="个人中心" />

      <ProfileHero
        :username="userStore.user?.username ?? ''"
        :initial="initial"
        :role-label="roleLabel"
        :is-admin="userStore.isAdmin"
        :joined-text="joinedText"
        :avatar-url="avatarUrl"
        :avatar-open="avatarOpen"
        :stats="stats"
        @toggle-avatar="avatarOpen = !avatarOpen"
      />

      <AvatarPanel
        v-if="avatarOpen"
        :avatar-url="avatarUrl"
        :uploading="uploading"
        :saving-preset="savingPreset"
        @upload="onUpload"
        @preset="choosePreset"
        @close="avatarOpen = false"
      />

      <CategoryDistribution
        v-if="stats"
        :distribution="stats.category_distribution ?? []"
      />

      <NotesSection
        v-if="stats"
        :loading="loading"
        :notes="notes"
        :total="stats.note_count"
      />

      <FavoritePreview
        :loading="loading"
        :items="preview"
        :list-count="lists.length"
        :favorite-count="stats?.favorite_count ?? 0"
      />

      <QuickLinks :is-admin="userStore.isAdmin" @logout="onLogout" />
    </div>
  </main>

  <AppFooter />
</template>

<style scoped>
.profile-page {
  padding-top: 64px;
  padding-bottom: 48px;
  min-height: 100svh;
}

.container {
  max-width: 960px;
  margin: 0 auto;
  padding: 0 32px;
}

@media (max-width: 640px) {
  .container {
    padding: 0 16px;
  }
}

/* 面包屑、头部、头像面板、收藏预览与快捷入口样式均在各子组件内 */
</style>
