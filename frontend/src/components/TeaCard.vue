<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import CategoryTag from '@/components/CategoryTag.vue'
import FavoriteButton from '@/components/FavoriteButton.vue'
import type { TeaListItem } from '@/types'

const props = defineProps<{
  tea: TeaListItem
  /** 紧凑模式：图片更矮、正文更少（空状态推荐 / 横向推荐轨道） */
  compact?: boolean
}>()

const imageFailed = ref(false)
const favoriteCount = ref(props.tea.favorite_count)

watch(
  () => props.tea.favorite_count,
  (value) => {
    favoriteCount.value = value
  },
)

const showImage = computed(() => !!props.tea.main_image_url && !imageFailed.value)
const favoriteText = computed(() => favoriteCount.value.toLocaleString('zh-CN'))
</script>

<template>
  <div class="tea-card-wrap">
    <RouterLink
      class="tea-card"
      :class="{ 'tea-card--compact': compact }"
      :to="{ name: 'tea-detail', params: { id: tea.id } }"
    >
      <img
        v-if="showImage"
        class="tea-card__img"
        :src="tea.main_image_url as string"
        :alt="tea.name"
        loading="lazy"
        @error="imageFailed = true"
      />
      <div v-else class="tea-card__img tea-card__img--placeholder" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path
            d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19.2 2.5c1 1.66.6 6-2 9-2 2.4-6.2 3-6.2 3zM2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"
          />
        </svg>
      </div>

      <div class="tea-card__body">
        <div class="tea-card__header">
          <h3 class="tea-card__name">{{ tea.name }}</h3>
          <CategoryTag :category="tea.category" />
        </div>
        <p class="tea-card__origin">{{ tea.origin }}</p>
        <div class="tea-card__footer">
          <span class="tea-card__fav" title="收藏数">
            <svg
              viewBox="0 0 24 24"
              width="14"
              height="14"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              aria-hidden="true"
            >
              <path
                d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7Z"
              />
            </svg>
            <span class="tea-card__fav-count">{{ favoriteText }}</span>
          </span>
          <span v-if="tea.season" class="tea-card__season">{{ tea.season }}</span>
        </div>
      </div>
    </RouterLink>

    <FavoriteButton
      class="tea-card__fav-btn"
      :tea-id="tea.id"
      :count="favoriteCount"
      @change="favoriteCount = $event"
    />
  </div>
</template>

<style scoped>
.tea-card-wrap {
  position: relative;
}

.tea-card__fav-btn {
  position: absolute;
  top: 12px;
  right: 12px;
}

.tea-card {
  display: block;
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
  transition:
    transform 0.2s,
    box-shadow 0.2s,
    border-color 0.2s;
}

.tea-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-card);
  border-color: var(--color-border-dark);
}

.tea-card__img {
  width: 100%;
  aspect-ratio: 16 / 10;
  object-fit: cover;
  display: block;
  background: var(--color-bg-muted);
}

.tea-card--compact .tea-card__img {
  aspect-ratio: 16 / 9;
}

.tea-card__img--placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-muted);
}

.tea-card__img--placeholder svg {
  width: 32px;
  height: 32px;
  opacity: 0.5;
}

.tea-card__body {
  padding: 16px;
}

.tea-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}

.tea-card__name {
  font-size: var(--text-h3);
  font-weight: 600;
  color: var(--color-text-primary);
  margin: 0;
}

.tea-card__origin {
  font-size: var(--text-small);
  color: var(--color-text-secondary);
  margin: 0 0 12px;
}

.tea-card__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.tea-card__fav {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: var(--text-small);
  color: var(--color-text-muted);
}

.tea-card__season {
  font-size: var(--text-caption);
  color: var(--color-text-muted);
}
</style>
