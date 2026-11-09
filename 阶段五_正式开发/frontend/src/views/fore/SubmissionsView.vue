<template>
  <div class="mm-container mm-page">
    <h1 class="mm-page__title">投稿中心</h1>
    <p class="mm-page__subtitle">T1 品鉴长文、T3 补图、T4 纠错；每日最多 3 条，驳回后可重提 2 次。</p>

    <div class="create-row">
      <router-link class="mm-button" to="/me/submissions/new/review">写品鉴长文</router-link>
      <router-link class="mm-button mm-button--ghost" to="/me/submissions/new/correction?type=T3">补图</router-link>
      <router-link class="mm-button mm-button--ghost" to="/me/submissions/new/correction?type=T4">纠错</router-link>
    </div>

    <div class="tabs">
      <button
        v-for="tab in statusTabs"
        :key="tab.value"
        class="chip"
        :class="{ 'chip--active': status === tab.value }"
        type="button"
        @click="changeStatus(tab.value)"
      >{{ tab.label }}</button>
    </div>

    <div v-if="loading" class="mm-muted">正在加载投稿…</div>
    <div v-else-if="error" class="state-block">
      <p class="mm-error">{{ error }}</p>
      <button class="mm-button mm-button--ghost" type="button" @click="load">重试</button>
    </div>
    <EmptyState v-else-if="!items.length" title="还没有投稿" description="从茶品详情页进入补图或纠错，或新建品鉴长文。" />

    <div v-else class="sub-list">
      <article v-for="item in items" :key="item.id" class="sub-item mm-card">
        <div class="sub-item__head">
          <span class="type-badge">{{ typeLabel(item.type) }}</span>
          <span class="status-badge" :class="`status-badge--${item.status}`">{{ statusLabel(item.status) }}</span>
          <span class="mm-muted">{{ formatDateTime(item.updatedAt) }}</span>
        </div>
        <p class="sub-item__title">{{ item.title || item.teaName }}</p>
        <p class="mm-muted">关联茶品：{{ item.teaName }} · 重提 {{ item.retryCount }}/2</p>
        <p v-if="item.rejectReason" class="reject-reason">驳回理由：{{ item.rejectReason }}</p>
        <div class="sub-item__actions">
          <router-link :to="`/me/submissions/${item.id}/preview`" class="link-button">预览</router-link>
          <button v-if="item.status === 'draft'" class="link-button" type="button" @click="submit(item)">提交审核</button>
          <button v-if="item.status === 'draft'" class="link-button" type="button" @click="remove(item)">删除</button>
          <router-link v-if="item.status === 'rejected'" class="link-button" :to="`/me/submissions/new/correction?id=${item.id}`">修改重提</router-link>
        </div>
      </article>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import EmptyState from '@/components/EmptyState.vue'
import { ApiError } from '@/api/http'
import { submissionApi, type SubmissionItem, type SubmissionStatus } from '@/modules/submission'
import { formatDateTime } from '@/utils/datetime'

const statusTabs = [
  { value: '', label: '全部' },
  { value: 'draft', label: '草稿' },
  { value: 'pending', label: '待审核' },
  { value: 'approved', label: '已通过' },
  { value: 'rejected', label: '已驳回' },
  { value: 'locked', label: '已锁定' }
]

const status = ref('')
const items = ref<SubmissionItem[]>([])
const loading = ref(false)
const error = ref('')

const typeLabels: Record<string, string> = { T1: '品鉴长文', T3: '补图', T4: '纠错' }
const statusLabels: Record<string, string> = {
  draft: '草稿',
  pending: '待审核',
  approved: '已通过',
  rejected: '已驳回',
  locked: '已锁定',
  revised: '已修订'
}

function typeLabel(value: string) {
  return typeLabels[value] ?? value
}

function statusLabel(value: SubmissionStatus) {
  return statusLabels[value] ?? value
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const data = await submissionApi.list({ status: status.value || undefined, page: 1, size: 50 })
    items.value = data.items
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : '投稿加载失败'
  } finally {
    loading.value = false
  }
}

function changeStatus(value: string) {
  status.value = value
  void load()
}

async function submit(item: SubmissionItem) {
  try {
    await submissionApi.submit(item.id)
    await load()
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : '提交失败'
  }
}

async function remove(item: SubmissionItem) {
  try {
    await submissionApi.remove(item.id)
    items.value = items.value.filter((row) => row.id !== item.id)
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : '删除失败'
  }
}

onMounted(load)
</script>

<style scoped>
.create-row {
  display: flex;
  gap: var(--space-2);
  margin-bottom: var(--space-4);
}

.tabs {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-bottom: var(--space-4);
}

.chip {
  padding: var(--space-1) var(--space-3);
  border: 1px solid var(--line-200);
  border-radius: var(--radius-pill);
  background: var(--white);
  color: var(--ink-700);
  font-size: var(--text-body-s);
}

.chip--active {
  border-color: var(--tea-900);
  background: var(--tea-900);
  color: var(--white);
}

.sub-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.sub-item {
  padding: var(--space-4);
}

.sub-item__head {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-2);
  flex-wrap: wrap;
}

.type-badge,
.status-badge {
  padding: 1px var(--space-2);
  border-radius: var(--radius-pill);
  font-size: var(--text-caption);
  background: var(--surface-100);
  color: var(--ink-700);
}

.status-badge--approved {
  background: var(--success-light);
  color: var(--success);
}

.status-badge--rejected,
.status-badge--locked {
  background: var(--danger-light);
  color: var(--danger);
}

.status-badge--pending {
  background: var(--warning-light);
  color: var(--warning);
}

.sub-item__title {
  margin: 0 0 var(--space-1);
  font-family: var(--font-serif);
  font-size: var(--text-body-l);
}

.sub-item .mm-muted {
  margin: 0;
}

.reject-reason {
  margin: var(--space-2) 0 0;
  color: var(--danger);
  font-size: var(--text-body-s);
}

.sub-item__actions {
  display: flex;
  gap: var(--space-4);
  margin-top: var(--space-3);
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
