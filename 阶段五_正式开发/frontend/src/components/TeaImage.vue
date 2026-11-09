<template>
  <div class="tea-image" :style="{ aspectRatio: ratio }">
    <img v-if="src && !failed" :src="src" :alt="alt" loading="lazy" @error="failed = true" />
    <div v-else class="tea-image__placeholder">
      <span>{{ failed ? '图片加载失败' : '待补图' }}</span>
    </div>
    <span v-if="label" class="tea-image__label">{{ label }}</span>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const props = withDefaults(
  defineProps<{
    src?: string
    alt: string
    ratio?: string
    label?: string
  }>(),
  { src: '', ratio: '4 / 3', label: '' }
)

const failed = ref(false)
</script>

<style scoped>
.tea-image {
  position: relative;
  width: 100%;
  overflow: hidden;
  border-radius: var(--radius-md);
  background: var(--surface-100);
}

.tea-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.tea-image__placeholder {
  display: grid;
  width: 100%;
  height: 100%;
  place-items: center;
  color: var(--ink-500);
  font-size: var(--text-caption);
}

.tea-image__label {
  position: absolute;
  left: var(--space-2);
  bottom: var(--space-2);
  padding: 2px var(--space-2);
  border-radius: var(--radius-pill);
  background: rgba(26, 24, 21, 0.62);
  color: var(--white);
  font-size: var(--text-caption);
}
</style>
