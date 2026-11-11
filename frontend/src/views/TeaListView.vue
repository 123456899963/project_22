<script setup lang="ts">
/**
 * 茶品列表页（手卷五章 · 茶品总目）
 * 页面只负责结构与样式；筛选逻辑全部在 useTeaList，筛选面板在 FilterBar，网格在 TeaGrid。
 */
import AppHeader from '@/components/AppHeader.vue'
import AppFooter from '@/components/AppFooter.vue'
import AppBreadcrumb from '@/components/AppBreadcrumb.vue'
import TeaCard from '@/components/TeaCard.vue'
import FilterBar from '@/components/FilterBar.vue'
import FilterChips from '@/components/FilterChips.vue'
import TeaGrid from '@/components/TeaGrid.vue'
import TeaPagination from '@/components/TeaPagination.vue'
import MobilePullRefresh from '@/components/MobilePullRefresh.vue'
import { useTeaList } from '@/composables/useTeaList'
import { usePullToRefresh } from '@/composables/usePullToRefresh'

const {
  teaStore,
  state,
  suggestions,
  categoryOptions,
  activeFilters,
  hasPrice,
  hasAnyFilter,
  priceText,
  breadcrumbLabel,
  totalPages,
  pageItems,
  resultText,
  load,
  toggleCategory,
  toggleOrigin,
  toggleSeason,
  toggleFermentation,
  setPriceMin,
  setPriceMax,
  setFilterMode,
  removeFilter,
  clearPrice,
  clearAll,
  onSortChange,
  clearKeyword,
  goPage,
} = useTeaList()

// 移动端下拉刷新：重新拉取当前筛选条件下的列表
const { distance, status } = usePullToRefresh(() => load())
</script>

<template>
  <AppHeader />
  <MobilePullRefresh :distance="distance" :status="status" />

  <main class="tea-list-page">
    <div class="container">
      <!-- 面包屑 -->
      <AppBreadcrumb
        :current="breadcrumbLabel"
        extra-text="六大茶类对比 →"
        extra-to="/compare"
      />

      <!-- 章节题头 -->
      <header class="list-head">
        <p class="scroll-kicker">茶品总目</p>
        <h1 class="list-head__title">{{ breadcrumbLabel || '全部茶品' }}</h1>
        <p class="list-head__sub">按茶类、产地、季节逐层收窄，找到此刻想喝的那一盏。</p>
      </header>

      <div class="list-layout">
        <!-- 茶柜（筛选） -->
        <aside class="list-aside" aria-label="茶柜筛选">
          <FilterBar
            :state="state"
            :category-options="categoryOptions"
            :origins="teaStore.origins"
            @toggle-category="toggleCategory"
            @toggle-origin="toggleOrigin"
            @toggle-season="toggleSeason"
            @toggle-fermentation="toggleFermentation"
            @change-price-min="setPriceMin"
            @change-price-max="setPriceMax"
            @change-mode="setFilterMode"
          />
        </aside>

        <div class="list-main">
          <!-- 已选条件 -->
          <FilterChips
            :keyword="state.keyword"
            :filters="activeFilters"
            :has-price="hasPrice"
            :price-text="priceText"
            :has-any-filter="hasAnyFilter"
            @clear-keyword="clearKeyword"
            @remove="removeFilter"
            @clear-price="clearPrice"
            @clear-all="clearAll"
          />

          <!-- 排序栏 -->
          <div class="sort-bar">
            <!-- key 随结果文案变化，触发一次轻量高亮，让筛选结果"看得见" -->
            <div :key="resultText" class="sort-bar__result">{{ resultText }}</div>
            <label class="sort-bar__control">
              <span class="sort-bar__label">排序</span>
              <select
                class="sort-bar__select"
                :value="state.sort"
                aria-label="排序方式"
                @change="onSortChange"
              >
                <option value="newest">最新上架</option>
                <option value="favorite">收藏最多</option>
              </select>
            </label>
          </div>

          <!-- 结果网格（内部含骨架屏与失败态） -->
          <TeaGrid
            :teas="teaStore.list"
            :loading="teaStore.loading"
            :error="teaStore.error"
            @retry="load"
          />

          <!-- 分页 -->
          <TeaPagination
            v-if="!teaStore.loading && !teaStore.error && teaStore.list.length && totalPages > 1"
            :page="teaStore.page"
            :total-pages="totalPages"
            :items="pageItems"
            @go="goPage"
          />

          <!-- 空结果 -->
          <div
            v-else-if="!teaStore.loading && !teaStore.error && !teaStore.list.length"
            class="empty-state"
          >
            <svg
              class="empty-state__art"
              viewBox="0 0 160 120"
              fill="none"
              stroke="currentColor"
              stroke-width="1.2"
              aria-hidden="true"
            >
              <path d="M14 96h132" />
              <path d="M22 96V78h36v18" />
              <path d="M54 78V70h44v8" />
              <path d="M72 70V58h30v12" />
              <path d="M40 58h18" />
              <path d="M116 96v-8h18v8" />
              <path d="M120 78c-4-6-4-12 0-18" />
              <path d="M130 80c4-5 4-10 0-14" />
            </svg>
            <h3 class="empty-state__title">茶架暂空</h3>
            <p class="empty-state__desc">试试调整筛选条件，或者清除全部筛选看看</p>
            <button type="button" class="btn btn--secondary" @click="clearAll">清除全部筛选</button>

            <div v-if="suggestions.length" class="empty-state__suggest">
              <TeaCard v-for="tea in suggestions" :key="tea.id" :tea="tea" compact />
            </div>
          </div>
        </div>
      </div>
    </div>
  </main>

  <AppFooter />
</template>

<style scoped>
.tea-list-page {
  padding-top: 64px;
  padding-bottom: 64px;
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
  .tea-list-page {
    padding-top: 56px;
    padding-bottom: 40px;
  }

  .container {
    padding: 0 16px;
  }
}

/* 章节题头 */
.list-head {
  padding: 28px 0 26px;
}

.list-head__title {
  font-family: var(--font-display);
  font-size: var(--text-h1);
  font-weight: 400;
  letter-spacing: 0.06em;
  color: var(--color-ink);
  margin: 10px 0 8px;
}

.list-head__sub {
  margin: 0;
  font-size: var(--text-small);
  color: var(--color-ink-faint);
}

.list-layout {
  display: grid;
  grid-template-columns: 264px minmax(0, 1fr);
  gap: 36px;
  align-items: start;
}

.list-aside {
  position: sticky;
  top: 84px;
  max-height: calc(100vh - 104px);
  overflow-y: auto;
}

.list-main {
  min-width: 0;
}

@media (max-width: 1024px) {
  .list-layout {
    grid-template-columns: 1fr;
    gap: 24px;
  }

  .list-aside {
    position: static;
    max-height: none;
    overflow: visible;
  }
}

/* 排序栏 */
.sort-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 0 0 12px;
  border-bottom: 1px solid var(--color-border-dark);
  margin-bottom: 20px;
}

.sort-bar__result {
  font-family: var(--font-kai);
  font-size: var(--text-small);
  color: var(--color-ink-soft);
  animation: result-fade 0.28s ease-out;
}

@keyframes result-fade {
  from {
    opacity: 0.3;
    transform: translateY(2px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .sort-bar__result {
    animation: none;
  }
}

.sort-bar__control {
  display: flex;
  align-items: center;
  gap: 8px;
}

.sort-bar__label {
  font-size: var(--text-caption);
  letter-spacing: 0.16em;
  color: var(--color-ink-faint);
}

.sort-bar__select {
  height: 34px;
  padding: 0 30px 0 10px;
  border-radius: 0;
  border: 1px solid var(--color-border-dark);
  background: var(--color-bg-surface);
  font-size: var(--text-small);
  color: var(--color-ink-soft);
  cursor: pointer;
  outline: none;
  appearance: none;
}

.sort-bar__select:focus {
  border-color: var(--color-cinnabar);
}

/* 空态 */
.empty-state {
  text-align: center;
  padding: 48px 24px 32px;
  border: 1px dashed var(--color-border-dark);
  background: var(--color-bg-surface);
}

.empty-state__art {
  width: 150px;
  height: auto;
  margin: 0 auto 18px;
  display: block;
  color: var(--color-border-dark);
}

.empty-state__title {
  font-family: var(--font-display);
  font-size: var(--text-h3);
  font-weight: 400;
  letter-spacing: 0.08em;
  color: var(--color-ink-soft);
  margin: 0 0 8px;
}

.empty-state__desc {
  font-size: var(--text-small);
  color: var(--color-ink-faint);
  margin: 0 0 24px;
}

.empty-state__suggest {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  max-width: 560px;
  margin: 32px auto 0;
}

@media (max-width: 640px) {
  .empty-state__suggest {
    grid-template-columns: 1fr;
  }
}
</style>
