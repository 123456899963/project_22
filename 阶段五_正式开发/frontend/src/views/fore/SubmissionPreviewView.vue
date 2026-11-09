<template>
  <div class="mm-container mm-page">
    <h1 class="mm-page__title">投稿预览</h1>
    <p class="mm-page__subtitle">预览仅本人可见；待审核内容不会出现在前台。</p>

    <div v-if="loading" class="mm-muted">正在加载预览…</div>
    <div v-else-if="error" class="state-block">
      <p class="mm-error">{{ error }}</p>
      <router-link to="/me/submissions" class="link-button">返回投稿中心</router-link>
    </div>

    <article v-else-if="detail" class="preview mm-card">
      <div class="preview__head">
        <span class="type-badge">{{ typeLabel(detail.type) }}</span>
        <span class="status-badge" :class="`status-badge--${detail.status}`">{{ statusLabel(detail.status) }}</span>
        <span class="mm-muted">{{ detail.teaName }}</span>
      </div>

      <h2 v-if="detail.title" class="preview__title">{{ detail.title }}</h2>
      <p v-if="detail.rejectReason" class="reject-reason">驳回理由：{{ detail.rejectReason }}</p>

      <p v-if="detail.body" class="preview__body">{{ detail.body }}</p>

      <div v-if="detail.correctionFieldKey" class="diff">
        <p><strong>修改字段：</strong>{{ fieldLabel(detail.correctionFieldKey) }}</p>
        <p><strong>修改后内容：</strong>{{ detail.newValue ?? '未填写' }}</p>
        <p><strong>修改理由：</strong>{{ detail.reason ?? '未填写' }}</p>
      </div>

      <div v-if="detail.images.length" class="gallery">
        <img v-for="image in detail.images" :key="image.id" :src="image.thumbUrl ?? image.url" :alt="detail.teaName" />
      </div>

      <p class="mm-muted">署名：{{ detail.nickname }} · 重提 {{ detail.retryCount }}/2</p>

      <div class="preview__actions">
        <router-link v-if="detail.status === 'draft' || detail.status === 'rejected'" :to="`/me/submissions/new/correction?id=${detail.id}`" class="mm-button mm-button--ghost">
          修改内容
        </router-link>
        <router-link to="/me/submissions" class="link-button">返回投稿中心</router-link>
      </div>
    </article>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { ApiError } from '@/api/http'
import { submissionApi, type SubmissionDetail } from '@/modules/submission'

const route = useRoute()
const detail = ref<SubmissionDetail | null>(null)
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
const fieldLabels: Record<string, string> = {
  name: '茶名',
  category: '茶类',
  subcategory: '亚类',
  origin: '产地',
  grade: '等级',
  productionYear: '年份',
  standard: '标准号',
  brewing: '冲泡建议',
  quality: '品质特征',
  alias: '别名'
}

function typeLabel(value: string) {
  return typeLabels[value] ?? value
}

function statusLabel(value: string) {
  return statusLabels[value] ?? value
}

function fieldLabel(value: string) {
  return fieldLabels[value] ?? value
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    detail.value = await submissionApi.preview(Number(route.params.id))
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : '预览加载失败'
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.preview {
  padding: var(--space-5);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.preview__head {
  display: flex;
  align-items: center;
  gap: var(--space-2);
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

.preview__title {
  font-size: var(--text-h2);
}

.preview__body {
  margin: 0;
  white-space: pre-wrap;
}

.reject-reason {
  margin: 0;
  color: var(--danger);
  font-size: var(--text-body-s);
}

.diff {
  padding: var(--space-3);
  background: var(--surface-100);
  border-radius: var(--radius-sm);
}

.diff p {
  margin: 0 0 var(--space-1);
}

.gallery {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.gallery img {
  width: 120px;
  aspect-ratio: 4 / 3;
  object-fit: cover;
  border-radius: var(--radius-sm);
}

.preview__actions {
  display: flex;
  align-items: center;
  gap: var(--space-3);
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
