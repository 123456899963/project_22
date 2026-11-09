<template>
  <div class="mm-container mm-page home">
    <section class="hero">
      <p class="hero__eyebrow">六大茶类 · 二十三亚类 · 四十六款</p>
      <h1 class="hero__title">循茶香，识茶脉</h1>
      <p class="hero__desc">从干茶到叶底，从产区到工艺，建立属于你的茶知识坐标。</p>
      <div class="hero__actions">
        <router-link to="/identify" class="mm-button">开始识茶自查</router-link>
        <router-link to="/gallery" class="mm-button mm-button--ghost">浏览图鉴</router-link>
      </div>
    </section>

    <section v-if="loading" class="mm-muted">正在加载首页内容…</section>
    <section v-else-if="error" class="error-block mm-card">
      <p class="mm-error">{{ error }}</p>
      <button class="mm-button mm-button--ghost" type="button" @click="load">重试</button>
    </section>

    <template v-else-if="home">
      <section>
        <div class="section-head">
          <h2 class="section-head__title">六大茶类</h2>
          <span class="mm-muted">更新于 {{ formatDateTime(home.updatedAt) }}</span>
        </div>
        <div class="category-grid">
          <router-link
            v-for="category in home.categories"
            :key="category.code"
            :to="`/teas/${category.code}`"
            class="category-card"
            :style="categoryStyle(category.name)"
          >
            <span class="category-card__name">{{ category.name }}</span>
            <span class="category-card__meta">{{ category.teaCount }} 款 · {{ category.subcategories.length }} 亚类</span>
            <span v-if="category.contentStatus === 'constructing'" class="category-card__badge">内容建设中</span>
          </router-link>
        </div>
      </section>

      <section>
        <div class="section-head">
          <h2 class="section-head__title">精选茶品</h2>
          <router-link to="/search" class="section-head__more">搜索全部</router-link>
        </div>
        <div class="tea-grid">
          <router-link v-for="tea in home.featured" :key="tea.id" :to="`/tea/${tea.id}`" class="tea-card">
            <TeaImage :src="tea.coverUrl" :alt="tea.name" label="图鉴" />
            <div class="tea-card__body">
              <p class="tea-card__name">{{ tea.name }}</p>
              <p class="mm-muted">{{ tea.categoryName }} · {{ tea.originPrimary ?? '产地待补' }}</p>
            </div>
          </router-link>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import TeaImage from '@/components/TeaImage.vue'
import { catalogApi, type HomeData } from '@/modules/catalog'
import { ApiError } from '@/api/http'
import { formatDateTime } from '@/utils/datetime'

const home = ref<HomeData | null>(null)
const loading = ref(false)
const error = ref('')

const accents: Record<string, { main: string; light: string }> = {
  绿茶: { main: 'var(--green)', light: 'var(--green-light)' },
  白茶: { main: 'var(--white-tea)', light: 'var(--white-tea-light)' },
  黄茶: { main: 'var(--yellow)', light: 'var(--yellow-light)' },
  青茶: { main: 'var(--oolong)', light: 'var(--oolong-light)' },
  红茶: { main: 'var(--red-tea)', light: 'var(--red-tea-light)' },
  黑茶: { main: 'var(--dark-tea)', light: 'var(--dark-tea-light)' }
}

function categoryStyle(name: string) {
  const accent = accents[name] ?? { main: 'var(--tea-900)', light: 'var(--surface-100)' }
  return { '--accent': accent.main, '--accent-light': accent.light }
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    home.value = await catalogApi.home()
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : '首页加载失败，请稍后重试'
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.hero {
  padding: var(--space-7) 0 var(--space-6);
  border-bottom: 1px solid var(--line-200);
  margin-bottom: var(--space-6);
}

.hero__eyebrow {
  color: var(--ink-500);
  letter-spacing: 0.16em;
  font-size: var(--text-caption);
  margin: 0 0 var(--space-3);
}

.hero__title {
  font-size: clamp(32px, 5vw, var(--text-display));
  line-height: 1.2;
  margin-bottom: var(--space-3);
}

.hero__desc {
  color: var(--ink-700);
  max-width: 560px;
  margin: 0 0 var(--space-5);
}

.hero__actions {
  display: flex;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.section-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--space-2) var(--space-3);
  margin-bottom: var(--space-4);
}

.section-head__title {
  font-size: var(--text-h2);
  flex-shrink: 0;
}

.section-head__more {
  color: var(--tea-900);
  font-size: var(--text-body-s);
  border-bottom: 1px solid var(--tea-900);
}

.category-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: var(--space-3);
  margin-bottom: var(--space-7);
}

.category-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  padding: var(--space-4);
  border-radius: var(--radius-md);
  background: var(--accent-light);
  border: 1px solid var(--line-200);
  border-left: 4px solid var(--accent);
  min-height: 96px;
  transition: transform 0.15s ease;
}

.category-card:hover {
  transform: translateY(-2px);
}

.category-card__name {
  font-family: var(--font-serif);
  font-size: var(--text-h3);
  color: var(--ink-900);
}

.category-card__meta {
  color: var(--ink-700);
  font-size: var(--text-caption);
}

.category-card__badge {
  align-self: flex-start;
  margin-top: auto;
  padding: 1px var(--space-2);
  border-radius: var(--radius-pill);
  background: var(--warning-light);
  color: var(--warning);
  font-size: var(--text-caption);
}

.tea-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: var(--space-4);
}

.tea-card {
  overflow: hidden;
  border-radius: var(--radius-md);
  background: var(--white);
  border: 1px solid var(--line-200);
  box-shadow: var(--shadow-card);
}

.tea-card__body {
  padding: var(--space-3);
}

.tea-card__name {
  margin: 0 0 var(--space-1);
  font-family: var(--font-serif);
  font-size: var(--text-body-l);
}

.tea-card__body .mm-muted {
  margin: 0;
}

.error-block {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-4);
}
</style>
