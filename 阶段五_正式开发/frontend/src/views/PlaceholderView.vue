<template>
  <div class="mm-container mm-page">
    <h1 class="mm-page__title">{{ title }}</h1>
    <p class="mm-page__subtitle">该页面骨架已就绪，功能按阶段五计划逐步接入。</p>
    <div class="mm-card placeholder">
      <p class="placeholder__path">{{ route.path }}</p>
      <p class="mm-muted">页面职责与交互以 PAGE_SPECS 为准；当前未接入后端数据。</p>
      <router-link to="/" class="mm-button mm-button--ghost">返回首页</router-link>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const title = computed(() => String(route.meta.title ?? '页面'))
</script>

<style scoped>
.placeholder {
  padding: var(--space-6);
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-3);
}

.placeholder__path {
  font-family: var(--font-mono);
  color: var(--ink-500);
  margin: 0;
}
</style>
