<template>
  <div class="mm-container mm-page">
    <h1 class="mm-page__title">识茶自查</h1>
    <p class="mm-page__subtitle">按外形、色泽、汤色、发酵度、香气逐步选择，系统匹配最接近的茶品；结果仅作参考。</p>

    <div v-if="loadingOptions" class="mm-muted">正在加载选项…</div>
    <div v-else class="identify mm-card">
      <section v-for="group in options" :key="group.dimension" class="dimension">
        <h3>{{ dimensionLabel(group.dimension) }}</h3>
        <div class="chip-row">
          <button
            v-for="value in group.values"
            :key="value.code"
            class="chip"
            :class="{ 'chip--active': selected[group.dimension]?.includes(value.code) }"
            type="button"
            @click="toggle(group.dimension, value.code)"
          >{{ value.label }}</button>
        </div>
      </section>

      <p v-if="error" class="mm-error">{{ error }}</p>

      <div class="actions">
        <button class="mm-button" type="button" :disabled="!hasSelection || matching" @click="match">
          {{ matching ? '正在匹配…' : '查看匹配结果' }}
        </button>
        <button class="mm-button mm-button--ghost" type="button" @click="reset">清空选择</button>
      </div>
    </div>

    <section v-if="result" class="result">
      <h2 class="result__title">匹配结果</h2>
      <p class="mm-muted">
        共 {{ result.total }} 款相关茶品；同维度多选为「或」，跨维度为「且」。
      </p>

      <div v-if="result.items.length" class="result-grid">
        <router-link v-for="tea in result.items" :key="tea.id" :to="`/tea/${tea.id}`" class="result-card mm-card">
          <TeaImage :src="tea.coverUrl" :alt="tea.name" ratio="4 / 3" />
          <div class="result-card__body">
            <p class="result-card__name">{{ tea.name }}</p>
            <p class="mm-muted">{{ tea.categoryName }} · {{ tea.subcategoryName ?? '未分类' }}</p>
            <p class="mm-muted">{{ tea.originPrimary ?? '产地待补' }}</p>
          </div>
        </router-link>
      </div>
      <EmptyState v-else title="没有匹配的茶品" description="试着减少条件，或直接搜索茶名。" />

      <div v-if="result.suggestions.length" class="suggestions">
        <p class="mm-muted">也可以看看这些茶品：</p>
        <div class="suggest-row">
          <router-link v-for="tea in result.suggestions" :key="tea.id" :to="`/tea/${tea.id}`" class="link-button">
            {{ tea.name }}
          </router-link>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import EmptyState from '@/components/EmptyState.vue'
import TeaImage from '@/components/TeaImage.vue'
import { ApiError } from '@/api/http'
import { catalogApi, type IdentifyOption, type IdentifyResult } from '@/modules/catalog'

type Dimension = IdentifyOption['dimension']

const dimensionLabels: Record<string, string> = {
  shape: '外形',
  color: '色泽',
  soup: '汤色',
  ferment: '发酵度',
  aroma: '香气'
}

const options = ref<IdentifyOption[]>([])
const selected = reactive<Record<Dimension, string[]>>({
  shape: [],
  color: [],
  soup: [],
  ferment: [],
  aroma: []
})
const loadingOptions = ref(false)
const matching = ref(false)
const error = ref('')
const result = ref<IdentifyResult | null>(null)

const hasSelection = computed(() => Object.values(selected).some((values) => values.length > 0))

function dimensionLabel(value: string) {
  return dimensionLabels[value] ?? value
}

function toggle(dimension: Dimension, code: string) {
  const values = selected[dimension] ?? []
  selected[dimension] = values.includes(code)
    ? values.filter((item) => item !== code)
    : [...values, code]
}

function reset() {
  Object.keys(selected).forEach((key) => {
    selected[key as Dimension] = []
  })
  result.value = null
  error.value = ''
}

async function loadOptions() {
  loadingOptions.value = true
  try {
    options.value = await catalogApi.identifyOptions()
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : '选项加载失败'
  } finally {
    loadingOptions.value = false
  }
}

async function match() {
  matching.value = true
  error.value = ''
  try {
    result.value = await catalogApi.identifyResults({
      shape: selected.shape,
      color: selected.color,
      soup: selected.soup,
      ferment: selected.ferment,
      aroma: selected.aroma
    })
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : '匹配失败，请稍后重试'
  } finally {
    matching.value = false
  }
}

onMounted(loadOptions)
</script>

<style scoped>
.identify {
  padding: var(--space-5);
}

.dimension + .dimension {
  margin-top: var(--space-4);
}

.dimension h3 {
  font-size: var(--text-body-l);
  margin-bottom: var(--space-2);
}

.chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
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

.actions {
  display: flex;
  gap: var(--space-3);
  margin-top: var(--space-5);
}

.result {
  margin-top: var(--space-6);
}

.result__title {
  font-size: var(--text-h2);
  margin-bottom: var(--space-2);
}

.result-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-3);
  margin-top: var(--space-3);
}

.result-card {
  overflow: hidden;
}

.result-card__body {
  padding: var(--space-2) var(--space-3) var(--space-3);
}

.result-card__name {
  margin: 0 0 var(--space-1);
  font-family: var(--font-serif);
  font-size: var(--text-body-l);
}

.result-card .mm-muted {
  margin: 0;
}

.suggestions {
  margin-top: var(--space-4);
}

.suggest-row {
  display: flex;
  gap: var(--space-4);
  flex-wrap: wrap;
}

.link-button {
  border: none;
  background: none;
  padding: 0;
  color: var(--tea-900);
  font-size: var(--text-caption);
}

@media (max-width: 900px) {
  .result-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
