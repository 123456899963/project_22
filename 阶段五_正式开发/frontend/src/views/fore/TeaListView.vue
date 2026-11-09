<template>
  <div class="mm-container mm-page">
    <h1 class="mm-page__title">{{ category?.name ?? '茶类' }}</h1>
    <p class="mm-page__subtitle">
      {{ category?.teaCount ?? 0 }} 款茶品 · {{ category?.subcategories.length ?? 0 }} 个亚类
    </p>

    <div class="filters mm-card">
      <div class="filter-row">
        <span class="filter-row__label">亚类</span>
        <button
          class="chip"
          :class="{ 'chip--active': subcategory === '' }"
          type="button"
          @click="setSubcategory('')"
        >不限</button>
        <button
          v-for="item in category?.subcategories ?? []"
          :key="item.code"
          class="chip"
          :class="{ 'chip--active': subcategory === item.code }"
          type="button"
          @click="setSubcategory(item.code)"
        >{{ item.name }}</button>
      </div>
      <div class="filter-row">
        <span class="filter-row__label">等级</span>
        <button
          v-for="item in gradeOptions"
          :key="item"
          class="chip"
          :class="{ 'chip--active': grades.includes(item) }"
          type="button"
          @click=" toggleGrade(item)"
        >{{ item }}</button>
      </div>
      <div class="filter-row">
        <span class="filter-row__label">排序</span>
        <button
          v-for="item in sortOptions"
          :key="item.value"
          class="chip"
          :class="{ 'chip--active': sort === item.value }"
          type="button"
          @click="setSort(item.value)"
        >{{ item.label }}</button>
      </div>
    </div>

    <div v-if="loading" class="mm-muted list-state">正在加载茶品…</div>
    <div v-else-if="error" class="list-state">
      <p class="mm-error">{{ error }}</p>
      <button class="mm-button mm-button--ghost" type="button" @click="load()">重试</button>
    </div>
    <EmptyState
      v-else-if="items.length === 0"
      title="没有符合条件的茶品"
      description="尝试减少筛选条件，或查看全部亚类。"
    >
      <button class="mm-button mm-button--ghost" type="button" @click="resetFilters">清空筛选</button>
    </EmptyState>

    <template v-else>
      <div class="tea-grid">
        <router-link v-for="tea in items" :key="tea.id" :to="`/tea/${tea.id}`" class="tea-card">
          <TeaImage :src="tea.coverUrl" :alt="tea.name" />
          <div class="tea-card__body">
            <div class="tea-card__title-row">
              <p class="tea-card__name">{{ tea.name }}</p>
              <span v-if="!tea.grade" class="grade-badge">未分档</span>
            </div>
            <p class="mm-muted">{{ tea.subcategoryName ?? category?.name }} · {{ tea.originPrimary ?? '产地待补' }}</p>
            <p class="mm-muted">{{ tea.yearBand ?? '年份待补' }}<template v-if="tea.productionYear"> · {{ tea.productionYear }}</template></p>
          </div>
        </router-link>
      </div>
      <div class="list-more">
        <button v-if="hasMore" class="mm-button mm-button--ghost" type="button" :disabled="loadingMore" @click="loadMore">
          {{ loadingMore ? '加载中…' : '加载更多' }}
        </button>
        <span v-else class="mm-muted">已显示全部 {{ total }} 款</span>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import EmptyState from '@/components/EmptyState.vue'
import TeaImage from '@/components/TeaImage.vue'
import { ApiError } from '@/api/http'
import { catalogApi, type CategoryItem, type TeaSummary } from '@/modules/catalog'

const route = useRoute()
const category = ref<CategoryItem | null>(null)
const items = ref<TeaSummary[]>([])
const loading = ref(false)
const loadingMore = ref(false)
const error = ref('')
const page = ref(1)
const total = ref(0)
const hasMore = ref(false)

const subcategory = ref('')
const grades = ref<string[]>([])
const sort = ref('updated_desc')

const gradeOptions = ['特级', '一级', '二级', '未分档']
const sortOptions = [
  { value: 'updated_desc', label: '最近更新' },
  { value: 'name_pinyin', label: '名称' },
  { value: 'grade_desc', label: '等级' }
]

const categoryCode = computed(() => String(route.params.category ?? ''))

function toggleGrade(value: string) {
  grades.value = grades.value.includes(value)
    ? grades.value.filter((item) => item !== value)
    : [...grades.value, value]
  reload()
}

function setSubcategory(value: string) {
  subcategory.value = value
  reload()
}

function setSort(value: string) {
  sort.value = value
  reload()
}

function resetFilters() {
  subcategory.value = ''
  grades.value = []
  sort.value = 'updated_desc'
  reload()
}

async function load(reset = true) {
  if (reset) {
    page.value = 1
    loading.value = true
  } else {
    loadingMore.value = true
  }
  error.value = ''
  try {
    const data = await catalogApi.teas({
      category: categoryCode.value,
      subcategory: subcategory.value || undefined,
      grade: grades.value.length ? grades.value : undefined,
      sort: sort.value,
      page: page.value,
      size: 12
    })
    items.value = reset ? data.items : [...items.value, ...data.items]
    total.value = data.total
    hasMore.value = data.hasMore
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : '茶品加载失败'
  } finally {
    loading.value = false
    loadingMore.value = false
  }
}

async function loadMore() {
  page.value += 1
  await load(false)
}

function reload() {
  void load(true)
}

async function loadCategory() {
  try {
    const list = await catalogApi.categories()
    category.value = list.find((item) => item.code === categoryCode.value) ?? null
  } catch {
    category.value = null
  }
}

watch(
  () => route.params.category,
  async () => {
    await loadCategory()
    await load(true)
  }
)

onMounted(async () => {
  await loadCategory()
  await load(true)
})
</script>

<style scoped>
.filters {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-4);
  margin-bottom: var(--space-5);
}

.filter-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
}

.filter-row__label {
  width: 40px;
  color: var(--ink-500);
  font-size: var(--text-label, 14px);
}

.chip {
  padding: var(--space-1) var(--space-3);
  border: 1px solid var(--line-200);
  border-radius: var(--radius-pill);
  background: var(--white);
  color: var(--ink-700);
  font-size: var(--text-body-s);
}

.chip--active {
  border-color: var(--tea-900);
  background: var(--tea-900);
  color: var(--white);
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

.tea-card__title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}

.tea-card__name {
  margin: 0;
  font-family: var(--font-serif);
  font-size: var(--text-body-l);
}

.tea-card__body .mm-muted {
  margin: var(--space-1) 0 0;
}

.grade-badge {
  padding: 1px var(--space-2);
  border-radius: var(--radius-pill);
  background: var(--surface-100);
  color: var(--ink-500);
  font-size: var(--text-caption);
  white-space: nowrap;
}

.list-state {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-3);
  padding: var(--space-6) 0;
}

.list-more {
  display: flex;
  justify-content: center;
  padding: var(--space-6) 0 var(--space-3);
}

@media (max-width: 640px) {
  .tea-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-3);
  }
}
</style>
