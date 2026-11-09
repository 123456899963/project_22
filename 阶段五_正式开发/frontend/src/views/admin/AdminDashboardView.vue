<template>
  <div>
    <h1 class="admin-title">工作台</h1>
    <p class="mm-muted">
      待办与内容概览。<template v-if="data">近 7 日上架 {{ data.publishedLast7Days }} 款。</template>
    </p>

    <div v-if="loading" class="mm-muted">正在加载…</div>
    <div v-else-if="error" class="admin-error">
      <p class="mm-error">{{ error }}</p>
      <el-button @click="load">重试</el-button>
    </div>
    <div v-else-if="data" class="stat-grid">
      <router-link to="/admin/teas" class="stat-card">
        <span class="stat-card__value">{{ data.pendingTeas }}</span>
        <span class="stat-card__label">待审核茶品</span>
      </router-link>
      <router-link to="/admin/submissions" class="stat-card">
        <span class="stat-card__value">{{ data.pendingSubmissions }}</span>
        <span class="stat-card__label">待审核投稿</span>
      </router-link>
      <router-link to="/admin/reports" class="stat-card">
        <span class="stat-card__value">{{ data.pendingReports }}</span>
        <span class="stat-card__label">待处理投诉</span>
      </router-link>
      <router-link to="/admin/reports" class="stat-card stat-card--warn">
        <span class="stat-card__value">{{ data.overdue }}</span>
        <span class="stat-card__label">超时项</span>
      </router-link>
    </div>

    <section class="quick-links">
      <router-link to="/admin/submissions" class="mm-button">处理投稿审核</router-link>
      <router-link to="/admin/comments" class="mm-button mm-button--ghost">处理评论审核</router-link>
      <router-link to="/admin/reports" class="mm-button mm-button--ghost">处理举报投诉</router-link>
      <router-link to="/admin/teas" class="mm-button mm-button--ghost">茶品管理</router-link>
    </section>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ElButton } from 'element-plus'
import { ApiError } from '@/api/http'
import { moderationApi, type DashboardData } from '@/modules/moderation'

const data = ref<DashboardData | null>(null)
const loading = ref(false)
const error = ref('')

async function load() {
  loading.value = true
  error.value = ''
  try {
    data.value = await moderationApi.dashboard()
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : '工作台加载失败'
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.admin-title {
  font-size: var(--text-h2);
  margin-bottom: var(--space-1);
}

.stat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: var(--space-3);
  margin: var(--space-5) 0;
}

.stat-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  padding: var(--space-4);
  background: var(--white);
  border: 1px solid var(--line-200);
  border-radius: var(--radius-md);
  border-top: 3px solid var(--tea-900);
  color: inherit;
  text-decoration: none;
}

.stat-card--warn {
  border-top-color: var(--warning);
}

.stat-card--ok {
  border-top-color: var(--success);
}

.stat-card__value {
  font-family: var(--font-serif);
  font-size: var(--text-h2);
}

.stat-card__label {
  color: var(--ink-500);
  font-size: var(--text-body-s);
}

.quick-links {
  display: flex;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.admin-error {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}
</style>
