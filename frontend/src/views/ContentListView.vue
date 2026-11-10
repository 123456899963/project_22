<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import AppFooter from '@/components/AppFooter.vue'
import { getContentList, getContentTypes } from '@/api/contents'
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

    <main class="content-list-page__main">
      <!-- 面包屑 -->
      <nav class="content-list-page__breadcrumb">
        <RouterLink to="/">首页</RouterLink>
        <span class="separator">/</span>
        <span>茶文化</span>
        <span class="separator">/</span>
        <span class="current">{{ headerItem?.name ?? typeCode }}</span>
      </nav>

      <!-- 板块头部 -->
      <section v-if="headerItem" class="content-list-page__hero">
        <span class="content-list-page__icon">{{ headerItem.icon ?? '📖' }}</span>
        <h1 class="content-list-page__title">{{ headerItem.name }}</h1>
        <p v-if="headerItem.description" class="content-list-page__desc">
          {{ headerItem.description }}
        </p>
      </section>

      <!-- 列表 -->
      <section class="content-list-page__grid-section">
        <div v-if="loading" class="content-list-page__loading">加载中...</div>

        <div v-else-if="items.length === 0" class="content-list-page__empty">
          <p>该板块暂无内容</p>
          <p class="hint">管理员正在持续补充中，敬请期待～</p>
        </div>

        <div v-else class="content-list-page__grid">
          <article
            v-for="item in items"
            :key="item.id"
            class="content-list-page__card"
          >
            <RouterLink :to="`/contents/${typeCode}/${item.id}`" class="card-link">
              <div v-if="item.cover_image" class="card-image">
                <img :src="item.cover_image" :alt="item.title" loading="lazy" />
              </div>
              <div v-else class="card-image card-image--placeholder">
                <span class="placeholder-icon">{{ headerItem?.icon ?? '📖' }}</span>
              </div>
              <div class="card-body">
                <h3 class="card-title">{{ item.title }}</h3>
                <p v-if="item.summary" class="card-summary">{{ item.summary }}</p>
              </div>
            </RouterLink>
          </article>
        </div>

        <!-- 分页 -->
        <nav
          v-if="totalPages > 1"
          class="content-list-page__pagination"
          aria-label="分页"
        >
          <button
            class="page-btn"
            :disabled="page <= 1"
            @click="onPageChange(page - 1)"
          >
            上一页
          </button>
          <span class="page-info">
            {{ page }} / {{ totalPages }}
          </span>
          <button
            class="page-btn"
            :disabled="page >= totalPages"
            @click="onPageChange(page + 1)"
          >
            下一页
          </button>
        </nav>
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
  text-align: center;
  padding: 32px 0 48px;
  border-bottom: 1px solid var(--color-border-light);
  margin-bottom: 48px;
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

.content-list-page__loading,
.content-list-page__empty {
  text-align: center;
  padding: 60px 0;
  color: var(--color-text-muted);
}
.content-list-page__empty p {
  margin: 8px 0;
}
.content-list-page__empty .hint {
  font-size: var(--text-small);
  color: var(--color-text-muted);
}

.content-list-page__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 24px;
}

.content-list-page__card {
  background: var(--color-bg-surface);
  border-radius: var(--radius-lg);
  overflow: hidden;
  border: 1px solid var(--color-border-light);
  transition: box-shadow 0.2s, transform 0.2s;
}
.content-list-page__card:hover {
  box-shadow: 0 4px 20px rgba(139, 115, 85, 0.1);
  transform: translateY(-2px);
}
.content-list-page__card .card-link {
  display: block;
  text-decoration: none;
  color: inherit;
}
.card-image {
  width: 100%;
  height: 180px;
  overflow: hidden;
  background: var(--color-bg-muted);
}
.card-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.card-image--placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
}
.placeholder-icon {
  font-size: 56px;
  opacity: 0.3;
}
.card-body {
  padding: 16px 20px 20px;
}
.card-title {
  font-size: var(--text-body);
  font-weight: 600;
  color: var(--color-primary-dark);
  margin: 0 0 8px;
  line-height: 1.4;
}
.card-summary {
  font-size: var(--text-small);
  color: var(--color-text-secondary);
  line-height: 1.6;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  margin: 0;
}

.content-list-page__pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  margin-top: 48px;
}
.page-btn {
  padding: 8px 20px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-bg-surface);
  color: var(--color-text-secondary);
  font-size: var(--text-small);
  cursor: pointer;
  transition: all 0.2s;
}
.page-btn:hover:not(:disabled) {
  border-color: var(--color-primary);
  color: var(--color-primary);
}
.page-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.page-info {
  font-size: var(--text-small);
  color: var(--color-text-muted);
}

@media (max-width: 767px) {
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
