<template>
  <div class="empty-state">
    <div class="empty-state__mark">茶</div>
    <p class="empty-state__title">{{ title }}</p>
    <p v-if="description" class="mm-muted">{{ description }}</p>
    <slot />
  </div>
</template>

<script setup lang="ts">
defineProps<{
  title: string
  description?: string
}>()
</script>

<style scoped>
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-7) var(--space-4);
  text-align: center;
}

.empty-state__mark {
  display: grid;
  width: 48px;
  height: 48px;
  place-items: center;
  border-radius: 50%;
  background: var(--surface-100);
  color: var(--ink-500);
  font-family: var(--font-serif);
}

.empty-state__title {
  margin: 0;
  font-family: var(--font-serif);
  font-size: var(--text-body-l);
}
</style>
