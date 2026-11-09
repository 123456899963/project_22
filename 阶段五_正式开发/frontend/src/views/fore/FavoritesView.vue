<template>
  <div class="mm-container mm-page">
    <h1 class="mm-page__title">我的收藏</h1>
    <p class="mm-page__subtitle">收藏上限 500 条，分为「想喝」与「已喝」两组。</p>

    <div class="tabs">
      <button
        v-for="tab in tabs"
        :key="tab.value"
        class="chip"
        :class="{ 'chip--active': group === tab.value }"
        type="button"
        @click="changeGroup(tab.value)"
      >{{ tab.label }}</button>
    </div>

    <div v-if="loading" class="mm-muted">正在加载收藏…</div>
    <div v-else-if="error" class="state-block">
      <p class="mm-error">{{ error }}</p>
      <button class="mm-button mm-button--ghost" type="button" @click="load">重试</button>
    </div>
    <EmptyState v-else-if="!items.length" title="这一组还没有收藏" description="在茶品详情页点击「加入收藏」。" />

    <div v-else class="fav-list">
      <article v-for="item in items" :key="item.teaId" class="fav-item mm-card">
        <router-link :to="`/tea/${item.teaId}`" class="fav-item__main">
          <TeaImage :src="item.tea.coverUrl" :alt="item.tea.name" ratio="1 / 1" />
          <div>
            <p class="fav-item__name">{{ item.tea.name }}</p>
            <p class="mm-muted">{{ item.tea.categoryName }} · {{ item.tea.originPrimary ?? '产地待补' }}</p>
            <p class="mm-muted">{{ formatDateTime(item.createdAt) }}</p>
          </div>
        </router-link>
        <div class="fav-item__actions">
          <button class="link-button" type="button" @click="move(item)">
            移到{{ item.group === 'want' ? '已喝' : '想喝' }}
          </button>
          <button class="link-button" type="button" @click="remove(item)">取消收藏</button>
        </div>
      </article>
      <div class="list-more">
        <span class="mm-muted">共 {{ total }} 条</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import EmptyState from '@/components/EmptyState.vue'
import TeaImage from '@/components/TeaImage.vue'
import { ApiError } from '@/api/http'
import { engagementApi, type FavoriteItem } from '@/modules/engagement'
import { formatDateTime } from '@/utils/datetime'

const tabs = [
  { value: 'want' as const, label: '想喝' },
  { value: 'drank' as const, label: '已喝' }
]

const group = ref<'want' | 'drank'>('want')
const items = ref<FavoriteItem[]>([])
const total = ref(0)
const loading = ref(false)
const error = ref('')

async function load() {
  loading.value = true
  error.value = ''
  try {
    const data = await engagementApi.favorites(group.value, 1, 50)
    items.value = data.items
    total.value = data.total
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : '收藏加载失败'
  } finally {
    loading.value = false
  }
}

function changeGroup(value: 'want' | 'drank') {
  group.value = value
  void load()
}

async function move(item: FavoriteItem) {
  try {
    const target = item.group === 'want' ? 'drank' : 'want'
    await engagementApi.moveFavorite(item.teaId, target)
    items.value = items.value.filter((row) => row.teaId !== item.teaId)
    total.value = Math.max(0, total.value - 1)
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : '移动分组失败'
  }
}

async function remove(item: FavoriteItem) {
  try {
    await engagementApi.removeFavorite(item.teaId)
    items.value = items.value.filter((row) => row.teaId !== item.teaId)
    total.value = Math.max(0, total.value - 1)
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : '取消收藏失败'
  }
}

onMounted(load)
</script>

<style scoped>
.tabs {
  display: flex;
  gap: var(--space-2);
  margin-bottom: var(--space-4);
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

.fav-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.fav-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  padding: var(--space-3);
  flex-wrap: wrap;
}

.fav-item__main {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-width: 0;
}

.fav-item__main :deep(.tea-image) {
  width: 72px;
  flex: none;
}

.fav-item__name {
  margin: 0 0 var(--space-1);
  font-family: var(--font-serif);
  font-size: var(--text-body-l);
}

.fav-item__main .mm-muted {
  margin: 0;
}

.fav-item__actions {
  display: flex;
  gap: var(--space-4);
}

.link-button {
  border: none;
  background: none;
  padding: 0;
  color: var(--ink-500);
  font-size: var(--text-caption);
}

.link-button:hover {
  color: var(--tea-900);
}

.state-block {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.list-more {
  padding: var(--space-3) 0;
}
</style>
