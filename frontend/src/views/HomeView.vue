<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import AppFooter from '@/components/AppFooter.vue'
import HeroBackground from '@/components/HeroBackground.vue'
import TeaCard from '@/components/TeaCard.vue'
import CategoryTag from '@/components/CategoryTag.vue'
import { useTeaStore } from '@/stores/tea'
import { useUserStore } from '@/stores/user'
import {
  getHotTeas,
  getLatestTips,
  getRandomTea,
  getRecommendedTeas,
  getTeaDetail,
  getTeaList,
} from '@/api/teas'
import { CATEGORY_LABELS, TEA_CATEGORIES } from '@/utils/teaQuery'
import type { LatestTipItem, Tea, TeaCategory, TeaListItem } from '@/types'

const router = useRouter()
const teaStore = useTeaStore()
const userStore = useUserStore()

const CATEGORY_EMOJI: Record<TeaCategory, string> = {
  green: '🍃',
  white: '🫖',
  yellow: '🌼',
  red: '☕',
  oolong: '🍵',
  dark: '🫗',
}

const hotList = ref<TeaListItem[]>([])
const hotLoading = ref(true)
const hotTrack = ref<HTMLElement | null>(null)
const randomTea = ref<Tea | null>(null)
const randomLoading = ref(true)
const spinning = ref(false)

/** 登录用户展示个性化推荐（S16），游客保持随机发现 */
const randomTitle = computed(() => (userStore.isLoggedIn ? '为你推荐' : '🎲 随机发现'))
const randomDesc = computed(() =>
  userStore.isLoggedIn
    ? '根据你收藏过的茶类，为你挑选一款可能合口味的新茶。每次点击都会换一款。'
    : '不知道喝什么？点下面按钮，让命运为你选一款。每次都不一样，说不定就能遇到你的下一杯心头好。',
)

const latestTips = ref<LatestTipItem[]>([])
const tipsLoading = ref(true)

const keyword = ref('')
const suggestOpen = ref(false)
const suggestLoading = ref(false)
const suggestions = ref<TeaListItem[]>([])
let suggestTimer: ReturnType<typeof setTimeout> | null = null
let suggestSeq = 0

const categoryCards = computed(() => {
  const countMap = new Map(teaStore.categories.map((c) => [c.category, c.count]))
  return TEA_CATEGORIES.map((category) => ({
    category,
    label: CATEGORY_LABELS[category],
    emoji: CATEGORY_EMOJI[category],
    count: countMap.get(category) ?? 0,
  }))
})

async function loadHot() {
  hotLoading.value = true
  try {
    const res = await getHotTeas(8)
    hotList.value = res.data ?? []
  } catch {
    hotList.value = []
  } finally {
    hotLoading.value = false
  }
}

async function loadRandom() {
  randomLoading.value = true
  try {
    if (userStore.isLoggedIn) {
      // 个性化推荐返回列表卡片，首页卡片需要冲泡信息，再取一次详情
      const res = await getRecommendedTeas(1)
      const item = res.data?.[0]
      randomTea.value = item ? (await getTeaDetail(item.id)).data : null
    } else {
      const res = await getRandomTea(randomTea.value?.id)
      randomTea.value = res.data
    }
  } catch {
    randomTea.value = null
  } finally {
    randomLoading.value = false
  }
}

/** 首页最新小贴士（S7） */
async function loadTips() {
  tipsLoading.value = true
  try {
    const res = await getLatestTips(3)
    latestTips.value = res.data ?? []
  } catch {
    latestTips.value = []
  } finally {
    tipsLoading.value = false
  }
}

function scrollHot(delta: number) {
  hotTrack.value?.scrollBy({ left: delta, behavior: 'smooth' })
}

function shuffle() {
  if (spinning.value || randomLoading.value) return
  spinning.value = true
  void loadRandom().finally(() => {
    setTimeout(() => {
      spinning.value = false
    }, 400)
  })
}

onMounted(() => {
  teaStore.fetchCategories().catch(() => {})
  void loadHot()
  void loadRandom()
  void loadTips()
  document.addEventListener('click', onDocumentClick)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', onDocumentClick)
  if (suggestTimer) clearTimeout(suggestTimer)
})

// —— Hero 搜索：150ms 防抖 + 真实后端搜索（最多 6 条）——
watch(keyword, (value) => {
  if (suggestTimer) clearTimeout(suggestTimer)
  const q = value.trim()
  if (!q) {
    suggestions.value = []
    suggestOpen.value = false
    suggestLoading.value = false
    return
  }
  suggestTimer = setTimeout(() => {
    void fetchSuggestions(q)
  }, 150)
})

async function fetchSuggestions(q: string) {
  const seq = ++suggestSeq
  suggestLoading.value = true
  suggestOpen.value = true
  try {
    const res = await getTeaList({ keyword: q, page: 1, page_size: 6, sort: 'newest' })
    if (seq !== suggestSeq) return
    suggestions.value = res.data?.items ?? []
  } catch {
    if (seq !== suggestSeq) return
    suggestions.value = []
  } finally {
    if (seq === suggestSeq) {
      suggestLoading.value = false
      suggestOpen.value = true
    }
  }
}

function submitSearch() {
  const q = keyword.value.trim()
  if (!q) return
  suggestOpen.value = false
  router.push({ name: 'tea-list', query: { q } })
}

function pickSuggestion(tea: TeaListItem) {
  suggestOpen.value = false
  keyword.value = tea.name
  router.push({ name: 'tea-list', query: { q: tea.name } })
}

function onDocumentClick(event: MouseEvent) {
  const target = event.target as HTMLElement | null
  if (!target?.closest('.hero__search')) {
    suggestOpen.value = false
  }
}

function categoryStyle(category: TeaCategory) {
  return { '--cat-color': `var(--color-tea-${category})` }
}
</script>

<template>
  <AppHeader />

  <main class="home-page">
    <!-- Hero -->
    <section class="hero">
      <!-- 纯装饰滚动背景（ADR-0003 R7）：不承载点击与跳转 -->
      <HeroBackground />
      <div class="container hero__content">
        <span class="hero__badge">🍵 六大茶类 · 结构化知识库</span>
        <h1 class="hero__title">一杯茶的千种风味</h1>
        <p class="hero__subtitle">完整图鉴，清晰对比，让每一款茶都有迹可循</p>

        <div class="hero__search">
          <svg
            class="hero__search-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            v-model="keyword"
            class="hero__search-input"
            type="search"
            placeholder="搜索茶品名称、产地，如：西湖龙井、福建"
            aria-label="搜索茶品"
            @focus="suggestOpen = !!keyword.trim()"
            @keydown.enter.prevent="submitSearch"
          />

          <div v-if="suggestOpen" class="hero__search-suggest">
            <div v-if="suggestLoading" class="hero__search-hint">搜索中…</div>
            <div v-else-if="!suggestions.length" class="hero__search-hint">没有找到相关茶品</div>
            <template v-else>
              <button
                v-for="tea in suggestions"
                :key="tea.id"
                type="button"
                class="hero__search-suggest-item"
                @click="pickSuggestion(tea)"
              >
                <img
                  v-if="tea.main_image_url"
                  class="hero__search-suggest-item__thumb"
                  :src="tea.main_image_url"
                  :alt="tea.name"
                />
                <span
                  v-else
                  class="hero__search-suggest-item__thumb hero__search-suggest-item__thumb--empty"
                ></span>
                <span class="hero__search-suggest-item__info">
                  <span class="hero__search-suggest-item__name">{{ tea.name }}</span>
                  <span class="hero__search-suggest-item__origin">{{ tea.origin }}</span>
                </span>
              </button>
            </template>
          </div>
        </div>
      </div>
    </section>

    <!-- 六大茶类入口 -->
    <section class="categories container">
      <h2 class="section-title">六大茶类</h2>
      <p class="section-subtitle">不同工艺，不同风味，点进去探索</p>
      <div class="categories__grid">
        <RouterLink
          v-for="item in categoryCards"
          :key="item.category"
          class="category-card"
          :style="categoryStyle(item.category)"
          :to="{ name: 'tea-list', query: { category: item.category } }"
        >
          <div class="category-card__icon">{{ item.emoji }}</div>
          <div class="category-card__name">{{ item.label }}</div>
          <div class="category-card__count">{{ item.count }} 款已收录</div>
        </RouterLink>
      </div>
    </section>

    <!-- 热门推荐 -->
    <section class="section">
      <div class="container">
        <div class="section-header">
          <h2 class="section-header__title">🔥 热门推荐</h2>
          <RouterLink class="section-header__action" to="/teas">查看全部 →</RouterLink>
        </div>

        <div v-if="hotLoading" class="hot-loading">热门推荐加载中…</div>
        <div v-else-if="!hotList.length" class="hot-loading">暂无热门茶品</div>
        <div v-else class="hot-scroll">
          <button
            type="button"
            class="hot-scroll__arrow hot-scroll__arrow--left"
            aria-label="向左滚动"
            @click="scrollHot(-440)"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              aria-hidden="true"
            >
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>

          <div ref="hotTrack" class="hot-scroll__track">
            <TeaCard v-for="tea in hotList" :key="tea.id" :tea="tea" class="hot-card" />
          </div>

          <button
            type="button"
            class="hot-scroll__arrow hot-scroll__arrow--right"
            aria-label="向右滚动"
            @click="scrollHot(440)"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              aria-hidden="true"
            >
              <path d="m9 18 6-6-6-6" />
            </svg>
          </button>
        </div>
      </div>
    </section>

    <!-- 随机发现 -->
    <section class="section">
      <div class="container">
        <div class="random">
          <div class="random__body">
            <RouterLink
              v-if="randomTea"
              class="card-random"
              :to="{ name: 'tea-detail', params: { id: randomTea.id } }"
            >
              <img
                v-if="randomTea.main_image_url"
                class="card-random__img"
                :src="randomTea.main_image_url"
                :alt="randomTea.name"
              />
              <div v-else class="card-random__img card-random__img--placeholder" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path
                    d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19.2 2.5c1 1.66.6 6-2 9-2 2.4-6.2 3-6.2 3zM2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"
                  />
                </svg>
              </div>
              <div class="card-random__body">
                <h3 class="card-random__name">{{ randomTea.name }}</h3>
                <div class="card-random__tags">
                  <CategoryTag :category="randomTea.category" />
                  <span class="card-random__fav"
                    >♡ {{ randomTea.favorite_count.toLocaleString('zh-CN') }}</span
                  >
                </div>
                <div class="card-random__brew">
                  <span v-if="randomTea.water_temp">🌡️ {{ randomTea.water_temp }}℃</span>
                  <span v-if="randomTea.tea_amount">🫖 {{ randomTea.tea_amount }}g</span>
                  <span v-if="randomTea.brew_time">⏱ {{ randomTea.brew_time }}s</span>
                </div>
              </div>
            </RouterLink>
            <div v-else class="card-random card-random--empty">
              {{ randomLoading ? '随机茶品加载中…' : '暂时没有可推荐的茶品' }}
            </div>

            <div class="random__desc">
              <h3>{{ randomTitle }}</h3>
              <p>{{ randomDesc }}</p>
              <button
                type="button"
                class="random__shuffle-btn"
                :class="{ spinning }"
                :disabled="randomLoading"
                @click="shuffle"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  aria-hidden="true"
                >
                  <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
                  <path d="M21 3v5h-5" />
                  <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
                  <path d="M3 21v-5h5" />
                </svg>
                <span>{{ randomLoading ? '加载中…' : '换一批' }}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
    <!-- 茶知识 · 小贴士（S7） -->
    <section v-if="tipsLoading || latestTips.length" class="section">
      <div class="container">
        <div class="section-header">
          <h2 class="section-header__title">📖 茶知识 · 小贴士</h2>
          <RouterLink class="section-header__action" to="/teas">探索更多 →</RouterLink>
        </div>

        <div v-if="tipsLoading" class="hot-loading">小贴士加载中…</div>
        <div v-else class="tips-grid">
          <RouterLink
            v-for="tip in latestTips"
            :key="tip.tea_id"
            class="tip-preview"
            :to="{ name: 'tea-detail', params: { id: tip.tea_id } }"
          >
            <div class="tip-preview__head">
              <span class="tip-preview__tea">{{ tip.tea_name }}</span>
              <CategoryTag :category="tip.category" />
            </div>
            <p class="tip-preview__summary">{{ tip.summary }}</p>
            <span class="tip-preview__more">了解详情 ›</span>
          </RouterLink>
        </div>
      </div>
    </section>
  </main>

  <AppFooter />
</template>

<style scoped>
.home-page {
  padding-top: 64px;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 32px;
}

@media (max-width: 1023px) {
  .container {
    padding: 0 24px;
  }
}

@media (max-width: 767px) {
  .home-page {
    padding-top: 56px;
  }
  .container {
    padding: 0 16px;
  }
}

/* Hero */
.hero {
  position: relative;
  padding: 80px 0;
  text-align: center;
  overflow: hidden;
  background: linear-gradient(160deg, var(--color-bg-muted) 0%, var(--color-border-light) 100%);
}

.hero__content {
  position: relative;
  z-index: 1;
}

.hero::before {
  content: '';
  position: absolute;
  top: -100px;
  left: -100px;
  width: 400px;
  height: 400px;
  background: radial-gradient(circle, rgba(139, 115, 85, 0.12) 0%, transparent 70%);
  pointer-events: none;
}

.hero::after {
  content: '';
  position: absolute;
  bottom: -120px;
  right: -80px;
  width: 360px;
  height: 360px;
  background: radial-gradient(circle, rgba(92, 184, 92, 0.08) 0%, transparent 70%);
  pointer-events: none;
}

.hero__badge {
  display: inline-block;
  padding: 6px 16px;
  border-radius: var(--radius-full);
  background: rgba(250, 248, 245, 0.78);
  border: 1px solid rgba(139, 115, 85, 0.25);
  color: var(--color-primary);
  font-size: var(--text-small);
  font-weight: 500;
  margin-bottom: 24px;
  backdrop-filter: blur(4px);
}

.hero__title {
  font-family: var(--font-display);
  font-size: var(--text-display);
  font-weight: 700;
  line-height: 1.2;
  color: var(--color-text-primary);
  margin: 0 0 20px;
  text-shadow:
    0 1px 2px rgba(250, 248, 245, 0.9),
    0 0 18px rgba(250, 248, 245, 0.7);
}

.hero__subtitle {
  font-size: var(--text-h3);
  font-weight: 400;
  color: var(--color-text-primary);
  opacity: 0.82;
  margin: 0 auto 40px;
  max-width: 600px;
  text-shadow:
    0 1px 2px rgba(250, 248, 245, 0.9),
    0 0 14px rgba(250, 248, 245, 0.65);
}

.hero__search {
  position: relative;
  max-width: 560px;
  margin: 0 auto;
}

.hero__search-input {
  width: 100%;
  height: 56px;
  border-radius: var(--radius-full);
  border: 1px solid var(--color-border);
  background: var(--color-bg-surface);
  padding: 0 24px 0 56px;
  font-size: var(--text-body);
  color: var(--color-text-primary);
  box-shadow: var(--shadow-hero);
  outline: none;
  transition:
    border-color 0.2s,
    box-shadow 0.2s;
}

.hero__search-input:focus {
  border-color: var(--color-primary);
  box-shadow:
    0 4px 20px rgba(0, 0, 0, 0.12),
    0 0 0 3px rgba(139, 115, 85, 0.12);
}

.hero__search-icon {
  position: absolute;
  left: 20px;
  top: 50%;
  transform: translateY(-50%);
  width: 20px;
  height: 20px;
  color: var(--color-text-muted);
  pointer-events: none;
}

.hero__search-suggest {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  margin-top: 8px;
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-dropdown);
  overflow: hidden;
  z-index: 20;
  text-align: left;
}

.hero__search-hint {
  padding: 16px 20px;
  text-align: center;
  color: var(--color-text-muted);
  font-size: var(--text-small);
}

.hero__search-suggest-item {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 12px 20px;
  border: none;
  background: transparent;
  text-align: left;
  cursor: pointer;
  transition: background 0.15s;
}

.hero__search-suggest-item:hover {
  background: var(--color-bg-muted);
}

.hero__search-suggest-item__thumb {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-sm);
  object-fit: cover;
  flex-shrink: 0;
  background: var(--color-bg-muted);
}

.hero__search-suggest-item__thumb--empty {
  display: block;
}

.hero__search-suggest-item__info {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.hero__search-suggest-item__name {
  font-size: var(--text-small);
  font-weight: 500;
  color: var(--color-text-primary);
}

.hero__search-suggest-item__origin {
  font-size: var(--text-caption);
  color: var(--color-text-muted);
}

/* 六大茶类 */
.categories {
  padding: 48px 0;
}

.section-title {
  font-family: var(--font-display);
  font-size: var(--text-h2);
  font-weight: 600;
  color: var(--color-text-primary);
  text-align: center;
  margin: 0 0 8px;
}

.section-subtitle {
  font-size: var(--text-small);
  color: var(--color-text-muted);
  text-align: center;
  margin: 0 0 32px;
}

.categories__grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 16px;
}

.category-card {
  position: relative;
  padding: 28px 16px;
  border-radius: var(--radius-lg);
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  text-align: center;
  transition:
    transform 0.2s,
    box-shadow 0.2s,
    border-color 0.2s;
  overflow: hidden;
}

.category-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: var(--cat-color, var(--color-primary));
  opacity: 0;
  transition: opacity 0.2s;
}

.category-card:hover {
  transform: translateY(-3px);
  box-shadow: var(--shadow-card);
  border-color: var(--cat-color, var(--color-primary));
}

.category-card:hover::before {
  opacity: 1;
}

.category-card__icon {
  font-size: 32px;
  margin-bottom: 12px;
  line-height: 1;
}

.category-card__name {
  font-size: var(--text-body);
  font-weight: 600;
  color: var(--color-text-primary);
  margin-bottom: 4px;
}

.category-card__count {
  font-size: var(--text-caption);
  color: var(--color-text-muted);
}

/* 通用区块 */
.section {
  padding: 56px 0;
}

.section-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 24px;
}

.section-header__title {
  font-family: var(--font-display);
  font-size: var(--text-h2);
  font-weight: 600;
  color: var(--color-text-primary);
  margin: 0;
}

.section-header__action {
  font-size: var(--text-small);
  color: var(--color-primary);
}

.hot-loading {
  padding: 32px 0;
  color: var(--color-text-muted);
  font-size: var(--text-small);
}

/* 茶知识 · 小贴士（S7） */
.tips-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.tip-preview {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 24px;
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  transition:
    transform 0.2s,
    box-shadow 0.2s,
    border-color 0.2s;
}

.tip-preview:hover {
  transform: translateY(-3px);
  box-shadow: var(--shadow-card);
  border-color: var(--color-primary);
}

.tip-preview__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.tip-preview__tea {
  font-family: var(--font-display);
  font-size: var(--text-h3);
  font-weight: 600;
  color: var(--color-text-primary);
}

.tip-preview__summary {
  flex: 1;
  margin: 0;
  font-size: var(--text-small);
  color: var(--color-text-secondary);
  line-height: 1.7;
}

.tip-preview__more {
  font-size: var(--text-caption);
  color: var(--color-primary);
}

@media (max-width: 767px) {
  .tips-grid {
    grid-template-columns: 1fr;
  }
}

/* 热门轨道 */
.hot-scroll {
  position: relative;
}

.hot-scroll__track {
  display: flex;
  gap: 16px;
  overflow-x: auto;
  scroll-behavior: smooth;
  padding-bottom: 8px;
  scrollbar-width: thin;
  scrollbar-color: var(--color-border-dark) transparent;
}

.hot-scroll__track::-webkit-scrollbar {
  height: 6px;
}

.hot-scroll__track::-webkit-scrollbar-thumb {
  background: var(--color-border-dark);
  border-radius: var(--radius-full);
}

.hot-scroll__track::-webkit-scrollbar-track {
  background: transparent;
}

:deep(.hot-card) {
  flex: 0 0 200px;
}

.hot-scroll__arrow {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 40px;
  height: 40px;
  border-radius: var(--radius-full);
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  box-shadow: var(--shadow-card);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-secondary);
  transition:
    background 0.2s,
    color 0.2s;
  z-index: 5;
}

.hot-scroll__arrow:hover {
  background: var(--color-bg-muted);
  color: var(--color-primary);
}

.hot-scroll__arrow--left {
  left: -8px;
}

.hot-scroll__arrow--right {
  right: -8px;
}

/* 随机发现 */
.random {
  background: var(--color-bg-muted);
  border-radius: var(--radius-xl);
  padding: 40px;
}

.random__body {
  display: flex;
  align-items: center;
  gap: 40px;
}

.card-random {
  position: relative;
  flex: 0 0 320px;
  background: var(--color-bg-surface);
  border-radius: var(--radius-xl);
  overflow: hidden;
  border: 1px solid var(--color-border);
  transition:
    transform 0.2s,
    box-shadow 0.2s;
}

.card-random:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-card-hover);
}

.card-random--empty {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 260px;
  color: var(--color-text-muted);
  font-size: var(--text-small);
  padding: 24px;
}

.card-random__img {
  width: 100%;
  aspect-ratio: 16 / 9;
  object-fit: cover;
  display: block;
  background: var(--color-bg-muted);
}

.card-random__img--placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-muted);
}

.card-random__img--placeholder svg {
  width: 40px;
  height: 40px;
  opacity: 0.5;
}

.card-random__body {
  padding: 20px;
}

.card-random__name {
  font-family: var(--font-display);
  font-size: var(--text-h2);
  font-weight: 600;
  color: var(--color-text-primary);
  margin: 0 0 8px;
}

.card-random__tags {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-bottom: 12px;
}

.card-random__fav {
  font-size: var(--text-caption);
  color: var(--color-text-muted);
}

.card-random__brew {
  font-size: var(--text-small);
  color: var(--color-text-secondary);
  padding-top: 12px;
  border-top: 1px solid var(--color-border-light);
}

.card-random__brew span {
  display: inline-block;
  margin-right: 12px;
}

.random__desc {
  flex: 1;
}

.random__desc h3 {
  font-family: var(--font-display);
  font-size: var(--text-h2);
  color: var(--color-text-primary);
  margin: 0 0 8px;
}

.random__desc p {
  font-size: var(--text-body);
  color: var(--color-text-secondary);
  margin: 0 0 20px;
  line-height: 1.7;
}

.random__shuffle-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 12px 28px;
  border-radius: var(--radius-full);
  background: var(--color-bg-surface);
  border: 1px solid var(--color-primary);
  color: var(--color-primary);
  font-size: var(--text-body);
  font-weight: 500;
  cursor: pointer;
  transition:
    background 0.2s,
    color 0.2s;
}

.random__shuffle-btn:hover:not(:disabled) {
  background: var(--color-primary);
  color: var(--color-bg-surface);
}

.random__shuffle-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.random__shuffle-btn svg {
  transition: transform 0.4s ease;
}

.random__shuffle-btn.spinning svg {
  transform: rotate(180deg);
}

@media (max-width: 1023px) {
  .categories__grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (max-width: 767px) {
  .hero {
    padding: 60px 0;
  }
  .hero__title {
    font-size: 28px;
  }
  .hero__subtitle {
    font-size: var(--text-body);
  }
  .hero__search-input {
    height: 48px;
  }
  .random__body {
    flex-direction: column;
    gap: 24px;
  }
  .card-random {
    flex: 1;
    width: 100%;
  }
}

@media (max-width: 639px) {
  .categories__grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
  }
  .hot-scroll__arrow {
    display: none;
  }
  :deep(.hot-card) {
    flex: 0 0 160px;
  }
  .random {
    padding: 24px;
  }
}
</style>
