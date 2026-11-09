<template>
  <div class="mm-container mm-page">
    <h1 class="mm-page__title">浏览历史</h1>
    <p class="mm-page__subtitle">保留最近 50 条，重复浏览只更新时间。</p>

    <div v-if="loading" class="mm-muted">正在加载历史…</div>
    <div v-else-if="error" class="state-block">
      <p class="mm-error">{{ error }}</p>
      <button class="mm-button mm-button--ghost" type="button" @click="load">重试</button>
    </div>
    <EmptyState v-else-if="!items.length" title="还没有浏览记录" description="浏览茶品详情后会自动记录，最多保留 50 条。" />

    <template v-else>
      <div class="toolbar">
        <span class="mm-muted">共 {{ total }} 条</span>
        <button class="mm-button mm-button--ghost" type="button" @click="clear">清空历史</button>
      </div>
      <div class="history-list">
        <router-link v-for="item in items" :key="item.teaId" :to="`/tea/${item.teaId}`" class="history-item mm-card">
          <TeaImage :src="item.tea.coverUrl" :alt="item.tea.name" ratio="1 / 1" />
          <div>
            <p class="history-item__name">{{ item.tea.name }}</p>
            <p class="mm-muted">{{ item.tea.categoryName }} · {{ item.tea.originPrimary ?? '产地待补' }}</p>
            <p class="mm-muted">浏览于 {{ formatDateTime(item.viewedAt) }}</p>
          </div>
        </router-link>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import EmptyState from '@/components/EmptyState.vue'
import TeaImage from '@/components/TeaImage.vue'
import { ApiError } from '@/api/http'
import { engagementApi, type HistoryItem } from '@/modules/engagement'
import { formatDateTime } from '@/utils/datetime'

const items = ref<HistoryItem[]>([])
const total = ref(0)
const loading = ref(false)
const error = ref('')

async function load() {
  loading.value = true
  error.value = ''
  try {
    const data = await engagementApi.history(1, 50)
    items.value = data.items
    total.value = data.total
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : '历史加载失败'
  } finally {
    loading.value = false
  }
}

async function clear() {
  try {
    await engagementApi.clearHistory()
    items.value = []
    total.value = 0
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : '清空失败'
  }
}

onMounted(load)
</script>

<style scoped>
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-3);
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.history-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3);
}

.history-item :deep(.tea-image) {
  width: 72px;
  flex: none;
}

.history-item__name {
  margin: 0 0 var(--space-1);
  font-family: var(--font-serif);
  font-size: var(--text-body-l);
}

.history-item .mm-muted {
  margin: 0;
}

.state-block {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}
</style>
