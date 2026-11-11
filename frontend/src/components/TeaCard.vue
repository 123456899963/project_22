<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import FavoriteButton from '@/components/FavoriteButton.vue'
import { CATEGORY_LABELS } from '@/utils/teaQuery'
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
const soupStyle = computed(() => ({ '--soup': `var(--soup-${props.tea.category})` }))
const noText = computed(() => `NO.${String(props.tea.id).padStart(3, '0')}`)
</script>

<template>
  <div class="tea-card-wrap" :style="soupStyle">
    <RouterLink
      class="tea-card"
      :class="{ 'tea-card--compact': compact }"
      :to="{ name: 'tea-detail', params: { id: tea.id } }"
    >
      <div class="tea-card__frame">
        <img
          v-if="showImage"
          class="tea-card__img"
          :src="tea.main_image_url as string"
          :alt="tea.name"
          loading="lazy"
          @error="imageFailed = true"
        />
        <div v-else class="tea-card__img tea-card__img--placeholder" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2">
            <path d="M5 19c0-8 5-13 14-14 0 9-5 14-13 14H5Z" />
            <path d="M5 19C8 14 12 10 17 7" />
          </svg>
        </div>
        <span class="tea-card__no" aria-hidden="true">{{ noText }}</span>
        <span class="tea-card__soup" aria-hidden="true"></span>
      </div>

      <div class="tea-card__body">
        <div class="tea-card__header">
          <h3 class="tea-card__name">{{ tea.name }}</h3>
          <span v-if="tea.origin" class="tea-card__origin-seal">{{ tea.origin }}</span>
        </div>
        <p class="tea-card__meta">
          <span class="tea-card__cat">{{ CATEGORY_LABELS[tea.category] }}</span>
          <span v-if="tea.season" class="tea-card__season">{{ tea.season }}</span>
        </p>
        <div class="tea-card__footer">
          <span class="tea-card__fav" title="收藏数">
            <svg
              viewBox="0 0 24 24"
              width="14"
              height="14"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              aria-hidden="true"
            >
              <path
                d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7Z"
              />
            </svg>
            <span class="tea-card__fav-count">{{ favoriteText }}</span>
          </span>
          <span class="tea-card__enter">展卷 →</span>
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
  height: 100%;
}

.tea-card__fav-btn {
  position: absolute;
  top: 10px;
  right: 10px;
}

.tea-card {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border-dark);
  border-radius: 2px;
  overflow: hidden;
  transition:
    transform 0.24s cubic-bezier(0.22, 1, 0.36, 1),
    box-shadow 0.24s,
    border-color 0.24s;
}

.tea-card:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-card);
  border-color: var(--color-primary);
}

.tea-card__frame {
  position: relative;
  overflow: hidden;
  background: var(--color-paper-deep);
}

.tea-card__img {
  width: 100%;
  aspect-ratio: 4 / 3;
  object-fit: cover;
  display: block;
  background: var(--color-bg-muted);
  filter: saturate(0.94) contrast(1.02);
  transition: transform 0.6s cubic-bezier(0.22, 1, 0.36, 1);
}

.tea-card:hover .tea-card__img {
  transform: scale(1.035);
}

.tea-card--compact .tea-card__img {
  aspect-ratio: 16 / 9;
}

.tea-card__img--placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-ink-faint);
}

.tea-card__img--placeholder svg {
  width: 40px;
  height: 40px;
  opacity: 0.45;
}

.tea-card__no {
  position: absolute;
  top: 10px;
  left: 10px;
  padding: 2px 6px;
  background: rgba(246, 241, 231, 0.9);
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.08em;
  color: var(--color-ink-soft);
}

.tea-card__soup {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 4px;
  background: var(--soup);
}

.tea-card__body {
  display: flex;
  flex-direction: column;
  flex: 1;
  padding: 14px 14px 12px;
}

.tea-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}

.tea-card__name {
  font-family: var(--font-display);
  font-size: var(--text-h3);
  font-weight: 400;
  letter-spacing: 0.03em;
  color: var(--color-ink);
  margin: 0;
  line-height: 1.35;
}

/* 产地：小印章 */
.tea-card__origin-seal {
  flex-shrink: 0;
  max-width: 84px;
  padding: 2px 5px;
  border: 1px solid var(--color-cinnabar);
  color: var(--color-cinnabar);
  font-family: var(--font-kai);
  font-size: 10px;
  letter-spacing: 0.04em;
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  opacity: 0.85;
}

.tea-card__meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 8px 0 10px;
  font-size: var(--text-caption);
  color: var(--color-ink-faint);
}

.tea-card__cat {
  letter-spacing: 0.08em;
}

.tea-card__season::before {
  content: '·';
  margin-right: 8px;
  color: var(--color-border-dark);
}

.tea-card__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: auto;
}

.tea-card__fav {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: var(--text-caption);
  color: var(--color-ink-faint);
}

.tea-card__enter {
  font-size: var(--text-caption);
  color: var(--color-cinnabar);
  opacity: 0;
  transform: translateX(-4px);
  transition:
    opacity 0.2s,
    transform 0.2s;
}

.tea-card:hover .tea-card__enter {
  opacity: 1;
  transform: none;
}

/* 收藏按钮：圆点改为方章 */
.tea-card__fav-btn :deep(.fav-btn--icon) {
  border-radius: 2px;
  border-color: var(--color-border-dark);
  background: rgba(246, 241, 231, 0.92);
}

@media (prefers-reduced-motion: reduce) {
  .tea-card,
  .tea-card__img,
  .tea-card__enter {
    transition: none;
  }

  .tea-card:hover {
    transform: none;
  }

  .tea-card:hover .tea-card__img {
    transform: none;
  }
}
</style>
