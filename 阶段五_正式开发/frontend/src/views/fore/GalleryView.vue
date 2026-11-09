<template>
  <div class="mm-container mm-page">
    <h1 class="mm-page__title">图鉴浏览</h1>
    <p class="mm-page__subtitle">官方图鉴仅采用授权来源；用户实拍单独成册，标注投稿人与授权状态。</p>

    <div class="filters">
      <div class="chip-row">
        <button
          v-for="tab in tabs"
          :key="tab.value"
          class="chip"
          :class="{ 'chip--active': activeTab === tab.value }"
          type="button"
          @click="changeTab(tab.value)"
        >{{ tab.label }}</button>
      </div>
      <select v-model="category" class="mm-input category-select" @change="load">
        <option value="">全部茶类</option>
        <option v-for="item in categories" :key="item.code" :value="item.code">{{ item.name }}</option>
      </select>
    </div>

    <div v-if="loading" class="mm-muted">正在加载图鉴…</div>
    <div v-else-if="error" class="state-block">
      <p class="mm-error">{{ error }}</p>
      <button class="mm-button mm-button--ghost" type="button" @click="load">重试</button>
    </div>
    <EmptyState v-else-if="!items.length" title="暂无图鉴" description="图鉴需至少 4 张已授权图片；新的图片正在整理中。" />

    <div v-else class="gallery-grid">
      <router-link v-for="item in items" :key="item.id" :to="`/tea/${item.teaId}`" class="gallery-card mm-card">
        <TeaImage :src="item.thumbUrl ?? item.url" :alt="item.teaName" ratio="4 / 3" />
        <div class="gallery-card__body">
          <p class="gallery-card__name">{{ item.teaName }}</p>
          <p class="mm-muted">{{ imageTypeLabel(item.imageType) }} · 第 {{ item.seq }} 张</p>
          <p v-if="activeTab === 'user'" class="mm-muted">
            投稿人：{{ item.anonymous ? '匿名茶友' : item.authorNickname ?? '茶友' }}
          </p>
        </div>
      </router-link>
    </div>

    <p v-if="items.length" class="mm-muted total-line">共 {{ total }} 张</p>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import EmptyState from '@/components/EmptyState.vue'
import TeaImage from '@/components/TeaImage.vue'
import { ApiError } from '@/api/http'
import { catalogApi, type CategoryItem, type GalleryItem } from '@/modules/catalog'

const tabs = [
  { value: 'official', label: '官方图鉴' },
  { value: 'user', label: '用户实拍' }
]
const imageTypes: Record<string, string> = {
  dry: '干茶',
  soup: '汤色',
  leaf: '叶底',
  pack: '包装',
  detail: '细节'
}

const activeTab = ref('official')
const category = ref('')
const categories = ref<CategoryItem[]>([])
const items = ref<GalleryItem[]>([])
const total = ref(0)
const loading = ref(false)
const error = ref('')

function imageTypeLabel(value: string) {
  return imageTypes[value] ?? value
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const data = await catalogApi.gallery(activeTab.value, category.value || undefined)
    items.value = data.items
    total.value = data.total
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : '图鉴加载失败'
  } finally {
    loading.value = false
  }
}

function changeTab(value: string) {
  activeTab.value = value
  void load()
}

onMounted(async () => {
  try {
    categories.value = await catalogApi.categories()
  } catch {
    categories.value = []
  }
  await load()
})
</script>

<style scoped>
.filters {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  margin-bottom: var(--space-4);
  flex-wrap: wrap;
}

.chip-row {
  display: flex;
  gap: var(--space-2);
}

.chip {
  padding: var(--space-1) var(--space-4);
  border: 1px solid var(--line-200);
  border-radius: var(--radius-pill);
  background: var(--white);
  color: var(--ink-700);
}

.chip--active {
  border-color: var(--tea-900);
  background: var(--tea-900);
  color: var(--white);
}

.category-select {
  width: 180px;
}

.gallery-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-3);
}

.gallery-card {
  overflow: hidden;
}

.gallery-card__body {
  padding: var(--space-2) var(--space-3) var(--space-3);
}

.gallery-card__name {
  margin: 0 0 var(--space-1);
  font-family: var(--font-serif);
  font-size: var(--text-body-l);
}

.gallery-card .mm-muted {
  margin: 0;
}

.total-line {
  margin-top: var(--space-4);
}

.state-block {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

@media (max-width: 900px) {
  .gallery-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
