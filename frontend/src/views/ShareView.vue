<script setup lang="ts">
/**
 * 分享清单页（阶段二重构）：数据装载留在页面，头部 / 条目 / 撤销态
 * 分别由 components/share/ 下的子组件承载。
 */
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import AppFooter from '@/components/AppFooter.vue'
import AppBreadcrumb from '@/components/AppBreadcrumb.vue'
import StatePanel from '@/components/StatePanel.vue'
import ShareHero from '@/components/share/ShareHero.vue'
import ShareItemCard from '@/components/share/ShareItemCard.vue'
import RevokedPanel from '@/components/share/RevokedPanel.vue'
import CopyResultPanel from '@/components/share/CopyResultPanel.vue'
import ShareSkeleton from '@/components/share/ShareSkeleton.vue'
import ShareErrorPanel from '@/components/share/ShareErrorPanel.vue'
import { copyShare, getShareView } from '@/api/shares'
import { getHotTeas } from '@/api/teas'
import { buildShareUrl } from '@/utils/favorite'
import { downloadSharePoster } from '@/utils/poster'
import { useUserStore } from '@/stores/user'
import { useToastStore } from '@/stores/toast'
import type { CopyResult, ShareViewData, TeaListItem } from '@/types'

type PageState = 'loading' | 'ready' | 'revoked' | 'notfound' | 'error'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const toast = useToastStore()

const state = ref<PageState>('loading')
const data = ref<ShareViewData | null>(null)
const errorMessage = ref('')
const hot = ref<TeaListItem[]>([])
const copying = ref(false)
const copyResult = ref<CopyResult | null>(null)
const posterLoading = ref(false)

const items = computed(() => data.value?.items ?? [])
// 走到兜底分支时只可能是「不存在」或「加载失败」两种
const errorState = computed<'notfound' | 'error'>(() =>
  state.value === 'notfound' ? 'notfound' : 'error',
)
const createdText = computed(() => {
  if (!data.value) return ''
  const date = new Date(data.value.created_at)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })
})

onMounted(() => {
  void load()
})

async function load() {
  const raw = route.params.shareId
  const token = Array.isArray(raw) ? raw[0] : raw
  if (!token) {
    state.value = 'notfound'
    return
  }

  state.value = 'loading'
  try {
    const res = await getShareView(token)
    data.value = res.data
    state.value = res.data.revoked ? 'revoked' : 'ready'
    if (res.data.revoked) void loadRecommendations()
  } catch (err) {
    const code = (err as { response?: { data?: { code?: number } } }).response?.data?.code
    if (code === 40410) {
      state.value = 'notfound'
    } else {
      state.value = 'error'
      errorMessage.value = err instanceof Error ? err.message : '分享加载失败'
    }
  }
}

async function loadRecommendations() {
  try {
    const res = await getHotTeas(3)
    hot.value = res.data ?? []
  } catch {
    hot.value = []
  }
}

function goLogin() {
  void router.push({ name: 'login', query: { redirect: route.fullPath } })
}

/** S8：纯前端 canvas 生成分享海报并下载 PNG */
async function downloadPoster() {
  if (!data.value || posterLoading.value) return
  posterLoading.value = true
  try {
    await downloadSharePoster({
      title: data.value.title,
      shareUrl: buildShareUrl(window.location.origin, data.value.token),
      teaNames: items.value.map((item) => item.name),
      teaCount: data.value.tea_count,
      createdAt: createdText.value,
    })
    toast.success('海报已生成，请查看下载')
  } catch {
    toast.error('海报生成失败，请稍后重试')
  } finally {
    posterLoading.value = false
  }
}

async function copyAll() {
  if (!data.value || copying.value) return
  if (!userStore.isLoggedIn) {
    goLogin()
    return
  }
  copying.value = true
  try {
    const res = await copyShare(data.value.token)
    copyResult.value = res.data
    if (res.data.added > 0) {
      toast.success(`已收藏 ${res.data.added} 款茶`)
    } else {
      toast.info('清单中的茶都在你的收藏里了')
    }
  } catch {
    // 统一错误提示由请求拦截器处理
  } finally {
    copying.value = false
  }
}
</script>

<template>
  <AppHeader />

  <main class="share-page">
    <div class="container">
      <AppBreadcrumb current="分享清单" />

      <!-- 加载 -->
      <ShareSkeleton v-if="state === 'loading'" />

      <!-- 正常分享 -->
      <template v-else-if="state === 'ready' && data">
        <ShareHero
          :title="data.title"
          :tea-count="data.tea_count"
          :created-text="createdText"
          :is-owner="data.is_owner"
          :is-logged-in="userStore.isLoggedIn"
          :copying="copying"
          :poster-loading="posterLoading"
          @copy="copyAll"
          @login="goLogin"
          @poster="downloadPoster"
        />

        <CopyResultPanel v-if="copyResult" :result="copyResult" />

        <StatePanel
          v-if="!items.length"
          icon="🍃"
          title="这份清单还是空的"
          desc="所有者还没有收藏任何茶品。"
        >
          <RouterLink class="btn btn--primary" to="/teas">浏览茶品列表</RouterLink>
        </StatePanel>

        <ul v-else class="share-items">
          <ShareItemCard v-for="item in items" :key="item.tea_id" :item="item" />
        </ul>
      </template>

      <!-- 已撤销 -->
      <RevokedPanel v-else-if="state === 'revoked'" :hot="hot" />

      <!-- 不存在 / 加载失败 -->
      <ShareErrorPanel
        v-else
        :state="errorState"
        :message="errorMessage"
        @reload="load"
      />
    </div>
  </main>

  <AppFooter />
</template>

<style scoped>
.share-page {
  padding-top: 64px;
  padding-bottom: 48px;
  min-height: 100svh;
}

.container {
  max-width: 1000px;
  margin: 0 auto;
  padding: 0 32px;
}

@media (max-width: 640px) {
  .container {
    padding: 0 16px;
  }
}

/* 条目列表 */
.share-items {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* 面包屑、头部、条目、撤销态、复制结果、骨架与兜底面板样式均在各子组件内 */
</style>
