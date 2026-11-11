<script setup lang="ts">
/**
 * 首页（手卷五章）：只做区块组装，逻辑在 useHome，
 * 各区块由 components/home/ 下的子组件承载（含各自样式）。
 * 右侧 ChapterRail 依据 data-chapter 章节随滚动高亮。
 */
import AppHeader from '@/components/AppHeader.vue'
import AppFooter from '@/components/AppFooter.vue'
import HeroSearch from '@/components/home/HeroSearch.vue'
import CategoryGrid from '@/components/home/CategoryGrid.vue'
import HotTeas from '@/components/home/HotTeas.vue'
import RandomTea from '@/components/home/RandomTea.vue'
import TipsSection from '@/components/home/TipsSection.vue'
import ChapterRail from '@/components/home/ChapterRail.vue'
import { useHome } from '@/composables/useHome'

const {
  hotList,
  hotLoading,
  randomTea,
  randomLoading,
  spinning,
  randomTitle,
  randomDesc,
  latestTips,
  tipsLoading,
  categoryCards,
  shuffle,
} = useHome()
</script>

<template>
  <AppHeader />
  <ChapterRail />

  <main class="home-page">
    <HeroSearch id="chapter-1" data-chapter />

    <CategoryGrid id="chapter-2" data-chapter :items="categoryCards" />

    <HotTeas id="chapter-3" data-chapter :teas="hotList" :loading="hotLoading" />

    <RandomTea
      id="chapter-4"
      data-chapter
      :tea="randomTea"
      :loading="randomLoading"
      :spinning="spinning"
      :title="randomTitle"
      :desc="randomDesc"
      @shuffle="shuffle"
    />

    <TipsSection id="chapter-5" data-chapter :tips="latestTips" :loading="tipsLoading" />

    <div class="home-page__coda" aria-hidden="true">
      <hr class="ink-rule" />
      <span class="home-page__coda-seal seal">茶</span>
      <p>一席六笺 · 未完待续</p>
    </div>
  </main>

  <AppFooter />
</template>

<style scoped>
/* 固定顶栏占位（Header 高度 64px） */
.home-page {
  padding-top: 64px;
}

.home-page__coda {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 32px 72px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18px;
}

.home-page__coda .ink-rule {
  width: 100%;
  margin: 0;
}

.home-page__coda-seal {
  width: 38px;
  height: 38px;
  font-size: 18px;
}

.home-page__coda p {
  margin: 0;
  font-family: var(--font-kai);
  font-size: var(--text-caption);
  letter-spacing: 0.3em;
  color: var(--color-ink-faint);
}

@media (max-width: 640px) {
  .home-page {
    padding-top: 56px;
  }

  .home-page__coda {
    padding: 0 16px 56px;
  }
}
</style>
