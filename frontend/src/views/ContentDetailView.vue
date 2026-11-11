﻿<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import AppFooter from '@/components/AppFooter.vue'
import ContentMetaBlock from '@/components/content/ContentMetaBlock.vue'
import ReadingProgress from '@/components/content/ReadingProgress.vue'
import ScrollReveal from '@/components/content/ScrollReveal.vue'
import { getContentDetail, getContentTypes } from '@/api/contents'
import { useScrollProgress } from '@/composables/useScrollProgress'
import type { ContentItem, ContentTypeCode, ContentTypeItem } from '@/types'

const route = useRoute()

const typeCode = computed<ContentTypeCode>(
  () => (route.params.code as ContentTypeCode) ?? 'teaware',
)
const itemId = computed(() => Number(route.params.id))

const item = ref<ContentItem | null>(null)
const types = ref<ContentTypeItem[]>([])
const loading = ref(true)
const notFound = ref(false)

async function load() {
  loading.value = true
  notFound.value = false
  try {
    types.value = await getContentTypes()
    item.value = await getContentDetail(itemId.value)
  } catch (e: unknown) {
    const err = e as { response?: { status?: number } }
    if (err?.response?.status === 404) {
      notFound.value = true
    } else {
      notFound.value = true
    }
  } finally {
    loading.value = false
  }
}

const currentType = computed(
  () => types.value.find((t) => t.code === typeCode.value) ?? null,
)

// 阅读进度 + 封面轻视差；减少动效时保持静止
const { progress, scrollY } = useScrollProgress()
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
const coverStyle = computed(() =>
  reduceMotion
    ? {}
    : { transform: `translateY(${Math.min(scrollY.value * 0.08, 32)}px) scale(1.04)` },
)

// 正文按空行拆段，每段进入视口时渐显
const bodyParagraphs = computed(() =>
  (item.value?.body ?? '')
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean),
)

onMounted(load)

// 同一路由记录下切换 id（如上一页/下一页、相关推荐）时实例被复用，需重新加载
watch(
  () => route.params.id,
  (id) => {
    if (id) void load()
  },
)
</script>

<template>
  <div class="content-detail-page">
    <AppHeader />
    <ReadingProgress :progress="progress" />

    <main class="content-detail-page__main">
      <!-- 面包屑 -->
      <nav class="breadcrumb">
        <RouterLink to="/">首页</RouterLink>
        <span class="sep">/</span>
        <RouterLink :to="`/contents/${typeCode}`">茶文化 · {{ currentType?.name ?? typeCode }}</RouterLink>
        <span class="sep">/</span>
        <span class="current">{{ item?.title ?? '详情' }}</span>
      </nav>

      <!-- 加载中 -->
      <div v-if="loading" class="loading">加载中...</div>

      <!-- 404 -->
      <div v-else-if="notFound || !item" class="not-found">
        <p>内容不存在或已下架</p>
        <RouterLink to="/" class="back-link">返回首页</RouterLink>
      </div>

      <!-- 详情 -->
      <article v-else class="detail">
        <!-- 封面图（随滚动轻微视差） -->
        <div v-if="item.cover_image" class="cover">
          <img :src="item.cover_image" :alt="item.title" :style="coverStyle" />
        </div>

        <header class="detail__header">
          <h1 class="detail__title">{{ item.title }}</h1>
          <p v-if="item.summary" class="detail__summary">{{ item.summary }}</p>
        </header>

        <!-- 板块特有字段（meta JSON），渲染逻辑见 ContentMetaBlock -->
        <ScrollReveal
          v-if="item.meta && Object.keys(item.meta).length > 0"
        >
          <ContentMetaBlock :type-code="typeCode" :meta="item.meta" />
        </ScrollReveal>

        <!-- 正文：按段落拆分，滚动进入视口时渐显 -->
        <section v-if="bodyParagraphs.length" class="detail__body">
          <ScrollReveal
            v-for="(paragraph, index) in bodyParagraphs"
            :key="index"
            :delay="Math.min(index, 6) * 60"
          >
            <p>{{ paragraph }}</p>
          </ScrollReveal>
        </section>

        <!-- 返回 -->
        <footer class="detail__footer">
          <RouterLink :to="`/contents/${typeCode}`" class="back-link">
            ← 返回{{ currentType?.name ?? '列表' }}
          </RouterLink>
        </footer>
      </article>
    </main>

    <AppFooter />
  </div>
</template>

<style scoped>
.content-detail-page__main {
  max-width: 720px;
  margin: 88px auto 0;
  padding: 0 32px 80px;
}

.breadcrumb {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: var(--text-small);
  color: var(--color-text-muted);
  margin-bottom: 32px;
}
.breadcrumb a {
  color: var(--color-text-secondary);
}
.breadcrumb a:hover {
  color: var(--color-primary);
}
.breadcrumb .sep {
  color: var(--color-border);
}
.breadcrumb .current {
  color: var(--color-text-primary);
}

.loading,
.not-found {
  text-align: center;
  padding: 80px 0;
  color: var(--color-text-muted);
}
.not-found p {
  margin-bottom: 16px;
}
.back-link {
  color: var(--color-primary);
  font-size: var(--text-small);
}

.cover {
  margin-bottom: 40px;
  border-radius: var(--radius-lg);
  overflow: hidden;
  background: var(--color-bg-muted);
}
.cover img {
  width: 100%;
  display: block;
  max-height: 400px;
  object-fit: cover;
  will-change: transform;
}

.detail__header {
  border-bottom: 1px solid var(--color-border-light);
  padding-bottom: 24px;
  margin-bottom: 32px;
}
.detail__title {
  font-family: var(--font-display);
  font-size: var(--text-h1);
  color: var(--color-primary-dark);
  margin: 0 0 12px;
  line-height: 1.3;
}
.detail__summary {
  font-size: var(--text-body);
  color: var(--color-text-secondary);
  line-height: 1.8;
  margin: 0;
}

/* 板块 meta 字段样式在 components/content/ContentMetaBlock.vue 内 */

.detail__body {
  font-size: var(--text-body);
  line-height: 2;
  color: var(--color-text-primary);
}
.detail__body p {
  margin: 0 0 20px;
  white-space: pre-wrap;
}

.detail__footer {
  margin-top: 48px;
  padding-top: 24px;
  border-top: 1px solid var(--color-border-light);
}

@media (max-width: 640px) {
  .content-detail-page__main {
    padding: 0 16px 40px;
    margin-top: 76px;
  }
  .detail__title {
    font-size: var(--text-h2);
  }
}
</style>
