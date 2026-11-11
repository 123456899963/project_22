<script setup lang="ts">
/**
 * 投稿页（阶段二重构）：页面只负责 Hero 与 Tab 切换，
 * 两个表单分别在 components/contribute/{NewTeaForm,ArticleForm}.vue。
 */
import { ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import AppFooter from '@/components/AppFooter.vue'
import AppBreadcrumb from '@/components/AppBreadcrumb.vue'
import NewTeaForm from '@/components/contribute/NewTeaForm.vue'
import ArticleForm from '@/components/contribute/ArticleForm.vue'
import type { ContributionType } from '@/types'

const route = useRoute()
const router = useRouter()

const tab = ref<ContributionType>(route.query.type === 'article' ? 'article' : 'new_tea')
const presetTeaId = route.query.tea_id ? Number(route.query.tea_id) : null

function onSubmitted() {
  void router.push({ name: 'my-contributions' })
}
</script>

<template>
  <AppHeader />

  <main class="contribute-page">
    <div class="container">
      <AppBreadcrumb current="投稿" />

      <header class="contribute-hero">
        <div>
          <h1 class="contribute-hero__title">让图鉴更丰富</h1>
          <p class="contribute-hero__desc">
            补充一款尚未收录的茶，或为已有茶品撰写科普。提交后由管理员审核，通过即公开展示。
          </p>
        </div>
        <RouterLink class="btn btn--ghost" :to="{ name: 'my-contributions' }">
          查看我的提交
        </RouterLink>
      </header>

      <div class="tabs" role="tablist">
        <button
          type="button"
          class="tabs__item"
          :class="{ 'tabs__item--active': tab === 'new_tea' }"
          role="tab"
          :aria-selected="tab === 'new_tea'"
          @click="tab = 'new_tea'"
        >
          补充新茶
        </button>
        <button
          type="button"
          class="tabs__item"
          :class="{ 'tabs__item--active': tab === 'article' }"
          role="tab"
          :aria-selected="tab === 'article'"
          @click="tab = 'article'"
        >
          投稿科普
        </button>
      </div>

      <NewTeaForm v-if="tab === 'new_tea'" @submitted="onSubmitted" />
      <ArticleForm v-else :preset-tea-id="presetTeaId" @submitted="onSubmitted" />
    </div>
  </main>

  <AppFooter />
</template>

<style scoped>
.contribute-page {
  padding: 32px 0 64px;
}

.contribute-hero {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  margin: 20px 0 24px;
}

.contribute-hero__title {
  font-size: var(--text-h1);
  color: var(--color-primary-dark);
}

.contribute-hero__desc {
  max-width: 640px;
  margin-top: 8px;
  color: var(--color-text-secondary);
  line-height: 1.8;
}

.tabs {
  display: inline-flex;
  padding: 4px;
  margin-bottom: 20px;
  border-radius: var(--radius-full);
  background: var(--color-bg-muted);
}

.tabs__item {
  padding: 8px 20px;
  border: none;
  border-radius: var(--radius-full);
  background: transparent;
  color: var(--color-text-secondary);
  cursor: pointer;
}

.tabs__item--active {
  background: var(--color-bg-surface);
  color: var(--color-primary-dark);
  box-shadow: var(--shadow-card);
}

/* 面包屑、表单卡片与字段样式分别在 AppBreadcrumb 与 components/contribute 内 */
</style>
