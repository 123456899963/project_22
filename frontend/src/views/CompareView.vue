<script setup lang="ts">
/**
 * 六大茶类摘要对比（S3 / 阶段四 TASK-20261111-01）
 *
 * 纯前端页面：每个茶类取一款代表茶（收藏最多）→ 拉取详情 → 组装对比数据。
 * 提供「雷达图」与「明细表」两种视图；雷达图 5 维全部取现有字段，不改契约。
 */

import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import AppFooter from '@/components/AppFooter.vue'
import CategoryTag from '@/components/CategoryTag.vue'
import EmptyState from '@/components/EmptyState.vue'
import CompareLegend from '@/components/compare/CompareLegend.vue'
import RadarChart from '@/components/compare/RadarChart.vue'
import { getTeaDetail, getTeaList } from '@/api/teas'
import { CATEGORY_LABELS, TEA_CATEGORIES } from '@/utils/teaQuery'
import { buildCompareMatrix, hasDifference } from '@/utils/compare'
import type { CompareMap } from '@/utils/compare'
import { buildRadarSeries } from '@/utils/compareRadar'
import type { Tea, TeaCategory } from '@/types'

const loading = ref(true)
const teas = ref<CompareMap>({})
/** 视图切换：雷达图 / 明细表 */
const view = ref<'radar' | 'table'>('radar')
/** 雷达图当前显示哪些茶类，默认全部 */
const activeCategories = ref<TeaCategory[]>([])

const columns = computed(() =>
  TEA_CATEGORIES.map((category) => ({
    category,
    label: CATEGORY_LABELS[category],
    tea: teas.value[category] ?? null,
  })),
)

/** 明细表行：代表茶行必然不同，不做差异标记 */
const rows = computed(() =>
  buildCompareMatrix(teas.value).map((row, index) => ({
    ...row,
    hasDiff: index > 0 && hasDifference(row.values),
  })),
)

const radarSeries = computed(() => buildRadarSeries(teas.value))
const visibleSeries = computed(() =>
  radarSeries.value.filter((item) => activeCategories.value.includes(item.category)),
)

function toggleCategory(category: TeaCategory) {
  activeCategories.value = activeCategories.value.includes(category)
    ? activeCategories.value.filter((item) => item !== category)
    : [...activeCategories.value, category]
}

async function loadCategory(category: TeaCategory): Promise<[TeaCategory, Tea | null]> {
  try {
    const list = await getTeaList({ category, page: 1, page_size: 1, sort: 'favorite' })
    const first = list.data?.items?.[0]
    if (!first) return [category, null]
    const detail = await getTeaDetail(first.id)
    return [category, detail.data ?? null]
  } catch {
    return [category, null]
  }
}

async function load() {
  loading.value = true
  try {
    const results = await Promise.all(TEA_CATEGORIES.map((c) => loadCategory(c)))
    const map: CompareMap = {}
    for (const [category, tea] of results) map[category] = tea
    teas.value = map
    activeCategories.value = buildRadarSeries(map).map((item) => item.category)
  } finally {
    loading.value = false
  }
}

onMounted(() => void load())
</script>

<template>
  <AppHeader />

  <main class="compare-page">
    <div class="container">
      <nav class="breadcrumb" aria-label="面包屑">
        <RouterLink to="/">首页</RouterLink>
        <span class="breadcrumb__sep">›</span>
        <RouterLink to="/teas">茶品列表</RouterLink>
        <span class="breadcrumb__sep">›</span>
        <span class="breadcrumb__current">六大茶类对比</span>
      </nav>

      <header class="compare-header">
        <h1 class="compare-header__title">六大茶类摘要对比</h1>
        <p class="compare-header__desc">
          每类甄选一款代表茶，可切换雷达图查看客观参数，或查看外形、汤色、香气、滋味明细。
        </p>
      </header>

      <!-- 视图切换 -->
      <div class="compare-toolbar">
        <div class="compare-view-switch" role="tablist" aria-label="对比视图切换">
          <button
            type="button"
            role="tab"
            class="compare-view-switch__btn"
            :class="{ 'compare-view-switch__btn--active': view === 'radar' }"
            :aria-selected="view === 'radar'"
            @click="view = 'radar'"
          >
            雷达图
          </button>
          <button
            type="button"
            role="tab"
            class="compare-view-switch__btn"
            :class="{ 'compare-view-switch__btn--active': view === 'table' }"
            :aria-selected="view === 'table'"
            @click="view = 'table'"
          >
            明细表
          </button>
        </div>
      </div>

      <div v-if="loading" class="compare-loading">对比数据加载中…</div>

      <!-- 雷达图视图 -->
      <div v-else-if="view === 'radar'" class="compare-radar">
        <CompareLegend
          :series="radarSeries"
          :active="activeCategories"
          @toggle="toggleCategory"
        />
        <RadarChart v-if="visibleSeries.length" :series="visibleSeries" />
        <EmptyState
          v-else
          title="请至少选择一款茶"
          description="点击上方图例可显示或隐藏对应茶类"
        />
        <p class="compare-radar__note">
          雷达图对比客观冲泡参数（水温 / 投茶量 / 冲泡时间）以及价格、热度的组内相对水平，不代表口感评分。缺失值按 0 分计，图例以「!」提示。
        </p>
      </div>

      <!-- 明细表视图 -->
      <div v-else class="compare-table-wrap">
        <table class="compare-table">
          <thead>
            <tr>
              <th scope="col" class="compare-table__corner">维度</th>
              <th v-for="col in columns" :key="col.category" scope="col">
                <RouterLink
                  class="compare-table__cat"
                  :to="{ name: 'tea-list', query: { category: col.category } }"
                >
                  <CategoryTag :category="col.category" />
                  <span class="compare-table__cat-name">{{ col.label }}</span>
                </RouterLink>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, rowIndex) in rows" :key="row.label">
              <th scope="row" class="compare-table__row-label">
                {{ row.label }}
                <span v-if="row.hasDiff" class="compare-table__diff" title="各茶类该项存在差异"
                  >差异</span
                >
              </th>
              <td v-for="(value, colIndex) in row.values" :key="colIndex">
                <RouterLink
                  v-if="rowIndex === 0 && value && columns[colIndex]?.tea"
                  class="compare-table__tea-link"
                  :to="{ name: 'tea-detail', params: { id: columns[colIndex].tea!.id } }"
                >
                  {{ value }}
                </RouterLink>
                <template v-else>{{ value ?? '—' }}</template>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </main>

  <AppFooter />
</template>

<style scoped>
.compare-page {
  padding-top: 64px;
  padding-bottom: 48px;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 32px;
}

@media (max-width: 1024px) {
  .container {
    padding: 0 24px;
  }
}

@media (max-width: 640px) {
  .compare-page {
    padding-top: 56px;
  }
  .container {
    padding: 0 16px;
  }
  .compare-view-switch__btn {
    padding: 6px 16px;
  }
  .compare-radar__note {
    text-align: left;
  }
}

.breadcrumb {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: var(--text-small);
  color: var(--color-text-muted);
  padding: 8px 0 20px;
}

.breadcrumb__sep {
  color: var(--color-border-dark);
}

.breadcrumb__current {
  color: var(--color-text-primary);
}

.compare-header {
  text-align: center;
  margin-bottom: 32px;
}

.compare-header__title {
  font-family: var(--font-display);
  font-size: var(--text-h1);
  font-weight: 600;
  color: var(--color-text-primary);
  margin: 0 0 8px;
}

.compare-header__desc {
  font-size: var(--text-small);
  color: var(--color-text-muted);
  margin: 0;
}

.compare-loading {
  padding: 64px 0;
  text-align: center;
  color: var(--color-text-muted);
  font-size: var(--text-small);
}

/* 视图切换 */
.compare-toolbar {
  display: flex;
  justify-content: center;
  margin-bottom: 24px;
}

.compare-view-switch {
  display: inline-flex;
  gap: 4px;
  padding: 4px;
  border-radius: var(--radius-full);
  background: var(--color-bg-muted);
}

.compare-view-switch__btn {
  padding: 7px 22px;
  border-radius: var(--radius-full);
  font-size: var(--text-small);
  color: var(--color-text-secondary);
  transition:
    background-color 0.18s,
    color 0.18s;
}

.compare-view-switch__btn:hover {
  color: var(--color-primary);
}

.compare-view-switch__btn--active {
  background: var(--color-bg-surface);
  color: var(--color-primary);
  font-weight: 600;
  box-shadow: var(--shadow-card);
}

/* 雷达图视图 */
.compare-radar {
  padding: 4px 0 8px;
}

.compare-radar__note {
  max-width: 600px;
  margin: 8px auto 0;
  font-size: var(--text-caption);
  line-height: 1.8;
  color: var(--color-text-muted);
  text-align: center;
}

/* 明细表差异标记 */
.compare-table__diff {
  display: inline-block;
  margin-left: 6px;
  padding: 1px 6px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-full);
  background: var(--color-bg-surface);
  font-size: 10px;
  font-weight: 400;
  color: var(--color-primary);
}

.compare-table-wrap {
  overflow-x: auto;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-bg-surface);
}

.compare-table {
  width: 100%;
  border-collapse: collapse;
  min-width: 880px;
}

.compare-table th,
.compare-table td {
  padding: 16px;
  text-align: left;
  font-size: var(--text-small);
  color: var(--color-text-primary);
  border-bottom: 1px solid var(--color-border-light);
  vertical-align: top;
}

.compare-table tbody tr:last-child th,
.compare-table tbody tr:last-child td {
  border-bottom: none;
}

.compare-table__corner,
.compare-table__row-label {
  width: 88px;
  color: var(--color-text-muted);
  font-weight: 500;
  background: var(--color-bg-muted);
  white-space: nowrap;
}

.compare-table thead th {
  background: var(--color-bg-muted);
  border-bottom: 1px solid var(--color-border);
}

.compare-table__cat {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.compare-table__cat-name {
  font-weight: 600;
  color: var(--color-text-primary);
}

.compare-table__tea-link {
  color: var(--color-primary);
  font-weight: 600;
}

.compare-table__tea-link:hover {
  text-decoration: underline;
}
</style>
