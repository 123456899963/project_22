<script setup lang="ts">
/**
 * 茶品详情页（阶段二重构）：数据逻辑在 useTeaDetail，页面只做区块组装；
 * 各区块由 components/detail/ 下的子组件承载（含各自样式）。
 */
import { computed } from 'vue'
import AppHeader from '@/components/AppHeader.vue'
import AppFooter from '@/components/AppFooter.vue'
import AppBreadcrumb from '@/components/AppBreadcrumb.vue'
import DetailHero from '@/components/detail/DetailHero.vue'
import DetailVideo from '@/components/detail/DetailVideo.vue'
import DetailSenses from '@/components/detail/DetailSenses.vue'
import DetailTips from '@/components/detail/DetailTips.vue'
import DetailArticles from '@/components/detail/DetailArticles.vue'
import DetailRelated from '@/components/detail/DetailRelated.vue'
import DetailState from '@/components/detail/DetailState.vue'
import { useTeaDetail, type DetailPageState } from '@/composables/useTeaDetail'

const {
  state,
  tea,
  related,
  fallbackHot,
  errorMessage,
  imageFailed,
  videoFailed,
  activeImage,
  favoriteCount,
  galleryImages,
  displayImage,
  hasImage,
  hasVideo,
  videoDurationText,
  tips,
  contributedArticles,
  formatArticleDate,
  brewItems,
  hasBrew,
  favoriteText,
  onNoteAction,
  onShareAction,
  retry,
} = useTeaDetail()

/** 图集切换：换图时清除上一次的加载失败标记 */
function selectImage(url: string) {
  activeImage.value = url
  imageFailed.value = false
}

/** 异常态视图：loading / ready 不会走到 DetailState，这里收窄类型 */
const stateView = computed(() => state.value as Exclude<DetailPageState, 'loading' | 'ready'>)
</script>

<template>
  <AppHeader />

  <main class="detail-page">
    <div class="container">
      <AppBreadcrumb
        :current="tea?.name ?? '茶品详情'"
        parent-text="茶品列表"
        parent-to="/teas"
      />

      <!-- 骨架屏 -->
      <div v-if="state === 'loading'" class="detail-skeleton" aria-hidden="true">
        <div class="skeleton detail-skeleton__image"></div>
        <div class="detail-skeleton__right">
          <div class="skeleton skeleton__line skeleton__line--title"></div>
          <div class="skeleton skeleton__line"></div>
          <div class="skeleton skeleton__line" style="width: 40%"></div>
        </div>
      </div>

      <!-- 正文 -->
      <article v-else-if="state === 'ready' && tea" class="detail-content">
        <DetailHero
          :tea="tea"
          :gallery-images="galleryImages"
          :display-image="displayImage"
          :has-image="hasImage"
          :favorite-count="favoriteCount"
          :favorite-text="favoriteText"
          :brew-items="brewItems"
          :has-brew="hasBrew"
          @select-image="selectImage"
          @image-error="imageFailed = true"
          @update:favorite-count="favoriteCount = $event"
          @note="onNoteAction"
          @share="onShareAction"
        />

        <!-- 视频介绍（S5）：无视频或加载失败整块隐藏 -->
        <DetailVideo
          v-if="hasVideo && tea.video_url"
          :src="tea.video_url"
          :poster="tea.main_image_url ?? undefined"
          :duration-text="videoDurationText"
          @error="videoFailed = true"
        />

        <DetailSenses
          :shape="tea.shape_desc"
          :soup="tea.soup_desc"
          :aroma="tea.aroma_desc"
          :taste="tea.taste_desc"
        />

        <DetailTips v-if="tips.length" :tips="tips" />

        <!-- 茶友科普投稿（S11 / S12）：仅展示审核通过内容 -->
        <DetailArticles
          v-if="contributedArticles.length"
          :articles="contributedArticles"
          :format-date="formatArticleDate"
        />

        <DetailRelated v-if="related.length" :related="related" />
      </article>

      <!-- 下架 / 不存在 / 加载失败 -->
      <DetailState
        v-else
        :state="stateView"
        :error-message="errorMessage"
        :fallback-hot="fallbackHot"
        @retry="retry"
      />
    </div>
  </main>

  <AppFooter />
</template>

<style scoped>
.detail-page {
  padding-top: 64px;
  padding-bottom: 48px;
}

.container {
  max-width: 1240px;
  margin: 0 auto;
  padding: 0 32px;
}

@media (max-width: 1024px) {
  .container {
    padding: 0 24px;
  }
}

@media (max-width: 640px) {
  .detail-page {
    padding-top: 56px;
  }
  .container {
    padding: 0 16px;
  }
}

/* 面包屑、头部、视频、品鉴、贴士、科普、推荐、异常态样式均在各子组件内 */

/* 骨架屏 */
.detail-skeleton {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 48px;
  padding-top: 20px;
}

@media (max-width: 640px) {
  .detail-skeleton {
    grid-template-columns: 1fr;
    gap: 24px;
  }
}

.detail-skeleton__image {
  width: 100%;
  aspect-ratio: 4 / 3;
  border-radius: 2px;
}

.detail-skeleton__right {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding-top: 20px;
}

.skeleton {
  background: var(--color-bg-muted);
  border-radius: 2px;
  position: relative;
  overflow: hidden;
}

.skeleton::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(
    90deg,
    var(--color-bg-muted) 0%,
    var(--color-border) 50%,
    var(--color-bg-muted) 100%
  );
  animation: skeleton-shimmer 1.5s infinite;
}

@keyframes skeleton-shimmer {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(100%);
  }
}

.skeleton__line {
  height: 24px;
  border-radius: 2px;
}

.skeleton__line--title {
  height: 36px;
  width: 60%;
}
</style>
