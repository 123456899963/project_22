<template>
  <div class="mm-container mm-page">
    <h1 class="mm-page__title">搜索茶品</h1>
    <p class="mm-page__subtitle">支持茶名、别名、产地、工艺、品质特征与拼音的精确匹配。</p>

    <form class="search-bar" @submit.prevent="doSearch">
      <input v-model="keyword" class="mm-input" type="search" placeholder="例如：龙井、凤凰单丛、安溪" />
      <button class="mm-button" type="submit" :disabled="loading">搜索</button>
    </form>

    <p v-if="query" class="mm-muted result-meta">“{{ query }}” 共 {{ total }} 条结果</p>

    <div v-if="loading" class="mm-muted result-state">正在搜索…</div>
    <div v-else-if="error" class="result-state">
      <p class="mm-error">{{ error }}</p>
      <button class="mm-button mm-button--ghost" type="button" @click="doSearch">重试</button>
    </div>
    <EmptyState
      v-else-if="!items.length"
      title="没有匹配的茶品"
      description="换一个茶名、别名或产地关键词试试。"
    />

    <div v-else class="result-list">
      <router-link v-for="item in items" :key="item.id" :to="`/tea/${item.id}`" class="result-item mm-card">
        <TeaImage :src="item.coverUrl" :alt="item.name" ratio="1 / 1" />
        <div class="result-item__body">
          <p class="result-item__name">{{ item.name }}</p>
          <p class="mm-muted">{{ item.categoryName }} · {{ item.originPrimary ?? '产地待补' }}</p>
          <p v-if="item.matchedAlias" class="result-item__alias">命中别名：{{ item.matchedAlias }}</p>
        </div>
      </router-link>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import EmptyState from '@/components/EmptyState.vue'
import TeaImage from '@/components/TeaImage.vue'
import { ApiError } from '@/api/http'
import { catalogApi, type SearchResult } from '@/modules/catalog'

const route = useRoute()
const router = useRouter()

const keyword = ref(String(route.query.q ?? ''))
const query = ref('')
const items = ref<SearchResult['items']>([])
const total = ref(0)
const loading = ref(false)
const error = ref('')

async function doSearch() {
  const q = keyword.value.trim()
  if (!q) {
    return
  }
  loading.value = true
  error.value = ''
  try {
    const data = await catalogApi.search(q)
    items.value = data.items
    total.value = data.total
    query.value = q
    if (route.query.q !== q) {
      router.replace({ path: '/search', query: { q } })
    }
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : '搜索失败'
    items.value = []
    total.value = 0
  } finally {
    loading.value = false
  }
}

watch(
  () => route.query.q,
  (value) => {
    if (value && value !== query.value) {
      keyword.value = String(value)
      void doSearch()
    }
  }
)

onMounted(() => {
  if (route.query.q) {
    void doSearch()
  }
})
</script>

<style scoped>
.search-bar {
  display: flex;
  gap: var(--space-2);
  margin-bottom: var(--space-4);
}

.result-meta {
  margin-bottom: var(--space-3);
}

.result-state {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-4) 0;
}

.result-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.result-item {
  display: flex;
  gap: var(--space-4);
  padding: var(--space-3);
  align-items: center;
}

.result-item :deep(.tea-image) {
  width: 96px;
  flex: none;
}

.result-item__body {
  min-width: 0;
}

.result-item__name {
  margin: 0 0 var(--space-1);
  font-family: var(--font-serif);
  font-size: var(--text-body-l);
}

.result-item__body .mm-muted {
  margin: 0;
}

.result-item__alias {
  margin: var(--space-1) 0 0;
  color: var(--info);
  font-size: var(--text-caption);
}
</style>
