﻿<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import AppFooter from '@/components/AppFooter.vue'
import EmptyState from '@/components/EmptyState.vue'
import ContentCard from '@/components/content/ContentCard.vue'
import ContentPager from '@/components/content/ContentPager.vue'
import ContentTypeNav from '@/components/content/ContentTypeNav.vue'
import MobilePullRefresh from '@/components/MobilePullRefresh.vue'
import { getContentList, getContentTypes } from '@/api/contents'
import { usePullToRefresh } from '@/composables/usePullToRefresh'
import { useScrollProgress } from '@/composables/useScrollProgress'
import type { ContentItem, ContentTypeCode, ContentTypeItem } from '@/types'

const route = useRoute()
const typeCode = computed<ContentTypeCode>(() => (route.params.code as ContentTypeCode) ?? 'teaware')

const types = ref<ContentTypeItem[]>([])
const items = ref<ContentItem[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = 12
const loading = ref(true)
const headerItem = ref<ContentTypeItem | null>(null)

async function loadTypes() {
  try {
    types.value = await getContentTypes()
    headerItem.value = types.value.find((t) => t.code === typeCode.value) ?? null
  } catch {
    types.value = []
  }
}

async function loadList() {
  loading.value = true
  try {
    const data = await getContentList({
      type: typeCode.value,
      page: page.value,
      page_size: pageSize,
    })
    items.value = data.items
    total.value = data.total
  } catch {
    items.value = []
    total.value = 0
  } finally {
    loading.value = false
  }
}

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize)))

// 移动端下拉刷新：重新拉取当前板块列表
const { distance, status } = usePullToRefresh(() => loadList())

// hero 背景水印随滚动缓慢平移，形成轻量视差；减少动效时不启用
const { scrollY } = useScrollProgress()
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
const heroStyle = computed(() =>
  reduceMotion ? {} : { '--hero-shift': `${Math.min(scrollY.value * 0.25, 80)}px` },
)

function onPageChange(p: number) {
  page.value = p
  void loadList()
}

onMounted(async () => {
  await loadTypes()
  await loadList()
})

// 五个板块共用 /contents/:code，切换时组件实例被复用，
// 必须监听参数变化重新加载，否则内容停留在旧板块。
watch(
  () => route.params.code,
  async (code) => {
    if (!code || code === headerItem.value?.code) return
    page.value = 1
    headerItem.value = types.value.find((t) => t.code === code) ?? null
    if (types.value.length === 0) {
      await loadTypes()
    }
    await loadList()
  },
)
</script>

<template>
  <div class="content-list-page">
    <AppHeader />
    <MobilePullRefresh :distance="distance" :status="status" />

    <main class="content-list-page__main">
      <!-- 面包屑 -->
      <nav class="content-list-page__breadcrumb">
        <RouterLink to="/">首页</RouterLink>
        <span class="separator">/</span>
        <span>茶文化</span>
        <span class="separator">/</span>
        <span class="current">{{ headerItem?.name ?? typeCode }}</span>
      </nav>

      <!-- 五大板块切换 -->
      <ContentTypeNav :types="types" :current="typeCode" />

      <!-- 板块头部 -->
      <section v-if="headerItem" class="content-list-page__hero" :style="heroStyle">
        <span class="content-list-page__icon">{{ headerItem.icon ?? '📖' }}</span>
        <h1 class="content-list-page__title">{{ headerItem.name }}</h1>
        <p v-if="headerItem.description" class="content-list-page__desc">
          {{ headerItem.description }}
        </p>
      </section>

      <!-- 列表 -->
      <section class="content-list-page__grid-section">
        <div v-if="loading" class="content-list-page__loading">加载中...</div>

        <EmptyState
          v-else-if="items.length === 0"
          icon="📖"
          title="该板块暂无内容"
          description="管理员正在持续补充中，先去六大茶类看看，或稍后再来逛逛。"
          action-text="浏览茶品列表"
          action-to="/teas"
        />

        <div v-else class="content-list-page__grid">
          <ContentCard
            v-for="(item, index) in items"
            :key="item.id"
            :item="item"
            :type-code="typeCode"
            :icon="headerItem?.icon ?? '📖'"
            :style="{ animationDelay: `${Math.min(index, 9) * 50}ms` }"
          />
        </div>

        <!-- 分页 -->
        <ContentPager
          v-if="totalPages > 1"
          :page="page"
          :total-pages="totalPages"
          @change="onPageChange"
        />
      </section>
    </main>

    <AppFooter />
  </div>
</template>

<style scoped>
.content-list-page__main {
  max-width: 1200px;
  margin: 88px auto 0;
  padding: 0 32px 80px;
}

.content-list-page__breadcrumb {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: var(--text-small);
  color: var(--color-text-muted);
  margin-bottom: 24px;
}
.content-list-page__breadcrumb a {
  color: var(--color-text-secondary);
}
.content-list-page__breadcrumb a:hover {
  color: var(--color-primary);
}
.content-list-page__breadcrumb .separator {
  color: var(--color-border);
}
.content-list-page__breadcrumb .current {
  color: var(--color-text-primary);
}

.content-list-page__hero {
  position: relative;
  overflow: hidden;
  text-align: center;
  padding: 32px 0 48px;
  border-bottom: 1px solid var(--color-border-light);
  margin-bottom: 48px;
}
/* 背景「茶」字水印：随滚动平移，形成轻量视差 */
.content-list-page__hero::before {
  content: '茶';
  position: absolute;
  top: -56px;
  left: 50%;
  font-family: var(--font-display);
  font-size: 200px;
  line-height: 1;
  color: var(--color-primary);
  opacity: 0.06;
  transform: translateX(-50%) translateY(var(--hero-shift, 0px));
  pointer-events: none;
  will-change: transform;
}
.content-list-page__icon,
.content-list-page__title,
.content-list-page__desc {
  position: relative;
  z-index: 1;
}
.content-list-page__icon {
  font-size: 48px;
  display: block;
  margin-bottom: 12px;
}
.content-list-page__title {
  font-family: var(--font-display);
  font-size: var(--text-h1);
  color: var(--color-primary-dark);
  margin: 0 0 8px;
}
.content-list-page__desc {
  font-size: var(--text-body);
  color: var(--color-text-secondary);
  max-width: 560px;
  margin: 0 auto;
  line-height: 1.8;
}

.content-list-page__loading {
  text-align: center;
  padding: 60px 0;
  color: var(--color-text-muted);
}

.content-list-page__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 24px;
}

/* 卡片逐条入场：delay 由列表下标控制 */
.content-list-page__grid :deep(.content-card) {
  animation: content-card-enter 0.45s ease-out backwards;
}

@keyframes content-card-enter {
  from {
    opacity: 0;
    transform: translateY(14px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .content-list-page__grid :deep(.content-card) {
    animation: none;
  }
  .content-list-page__hero::before {
    transform: translateX(-50%);
  }
}

/* 卡片与分页样式分别在 components/content/{ContentCard,ContentPager}.vue 内 */

@media (max-width: 640px) {
  .content-list-page__main {
    padding: 0 16px 40px;
    margin-top: 76px;
  }
  .content-list-page__grid {
    grid-template-columns: 1fr;
  }
  .content-list-page__hero {
    padding: 24px 0 32px;
    margin-bottom: 32px;
  }
}
</style>
