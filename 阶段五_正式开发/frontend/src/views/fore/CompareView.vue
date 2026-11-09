<template>
  <div class="mm-container mm-page">
    <h1 class="mm-page__title">茶品对比</h1>
    <p class="mm-page__subtitle">对比篮最多 3 款，结果按账号持久化，Web 与小程序同源。</p>

    <div v-if="loading" class="mm-muted">正在加载对比篮…</div>
    <div v-else-if="error" class="state-block">
      <p class="mm-error">{{ error }}</p>
      <button class="mm-button mm-button--ghost" type="button" @click="load">重试</button>
    </div>
    <EmptyState v-else-if="!data.items.length" title="对比篮是空的" description="在茶品详情页点击「加入对比」，最多可选择 3 款。" />

    <template v-else>
      <div class="toolbar">
        <span class="mm-muted">已选 {{ data.items.length }} / {{ data.limit }} 款</span>
        <button class="mm-button mm-button--ghost" type="button" @click="clear">清空对比篮</button>
      </div>

      <div class="compare-scroll mm-card">
        <table class="compare-table">
          <thead>
            <tr>
              <th class="compare-table__key">对比项</th>
              <th v-for="item in data.items" :key="item.tea.id">
                <router-link :to="`/tea/${item.tea.id}`" class="compare-table__name">{{ item.tea.name }}</router-link>
                <button class="link-button" type="button" @click="remove(item.tea.id)">移除</button>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in rows" :key="row.key">
              <th class="compare-table__key">{{ row.key }}</th>
              <td v-for="item in data.items" :key="item.tea.id">{{ row.values[item.tea.id] ?? '未录入' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import EmptyState from '@/components/EmptyState.vue'
import { ApiError } from '@/api/http'
import { engagementApi, type CompareData } from '@/modules/engagement'

const data = ref<CompareData>({ items: [], limit: 3 })
const loading = ref(false)
const error = ref('')

const rows = computed(() => {
  const keys = new Set<string>()
  data.value.items.forEach((item) => Object.keys(item.detail ?? {}).forEach((key) => keys.add(key)))
  return Array.from(keys).map((key) => ({
    key,
    values: Object.fromEntries(data.value.items.map((item) => [item.tea.id, item.detail?.[key] ?? '未录入']))
  }))
})

async function load() {
  loading.value = true
  error.value = ''
  try {
    data.value = await engagementApi.compare()
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : '对比篮加载失败'
  } finally {
    loading.value = false
  }
}

async function remove(teaId: number) {
  try {
    data.value = await engagementApi.removeCompare(teaId)
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : '移除失败'
  }
}

async function clear() {
  try {
    data.value = await engagementApi.clearCompare()
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
  gap: var(--space-3);
  margin-bottom: var(--space-3);
}

.compare-scroll {
  overflow-x: auto;
  padding: var(--space-3);
}

.compare-table {
  width: 100%;
  border-collapse: collapse;
  min-width: 480px;
}

.compare-table th,
.compare-table td {
  padding: var(--space-2) var(--space-3);
  border-bottom: 1px solid var(--line-200);
  text-align: left;
  vertical-align: top;
  font-size: var(--text-body-s);
}

.compare-table__key {
  width: 120px;
  color: var(--ink-500);
  font-weight: 500;
}

.compare-table__name {
  display: block;
  font-family: var(--font-serif);
  font-size: var(--text-body);
  margin-bottom: var(--space-1);
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
</style>
