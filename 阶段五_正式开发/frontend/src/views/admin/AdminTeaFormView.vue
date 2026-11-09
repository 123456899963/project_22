<template>
  <div>
    <div class="admin-head">
      <div>
        <h1 class="admin-title">{{ isNew ? '新建茶品' : '茶品编辑 / 审核' }}</h1>
        <p class="mm-muted">
          {{ isNew ? '保存草稿后可进入图鉴补图；补齐 4 张已发布图与五维标签后才能提交审核。' : `状态：${statusLabels[detail?.status ?? ''] ?? '—'}；仅草稿可编辑。` }}
        </p>
      </div>
      <div class="admin-head__actions">
        <el-button @click="router.push('/admin/teas')">返回列表</el-button>
        <el-button v-if="!isNew && detail?.status === 'draft'" type="success" :loading="acting" @click="submitReview">提交审核</el-button>
        <el-button v-if="!isNew" @click="router.push(`/admin/teas/${id}/images`)">图鉴与图片</el-button>
      </div>
    </div>

    <p v-if="error" class="mm-error">{{ error }}</p>
    <p v-if="!isNew && detail && detail.status !== 'draft'" class="mm-muted readonly-tip">
      该茶品已提交或已上架，如需修改请走修订流程；此处为只读查看。
    </p>

    <section class="mm-card form-card">
      <div class="form-grid">
        <label class="form-item">
          <span>茶名（必填，≤80 字）</span>
          <el-input v-model="form.name" maxlength="80" :disabled="readonly" />
        </label>
        <label class="form-item">
          <span>茶类</span>
          <el-select v-model="form.categoryId" :disabled="readonly" @change="onCategoryChange">
            <el-option v-for="category in categories" :key="category.code" :label="category.name" :value="category.code" />
          </el-select>
        </label>
        <label class="form-item">
          <span>亚类</span>
          <el-select v-model="form.subcategoryId" :disabled="readonly">
            <el-option v-for="sub in subcategoryOptions" :key="sub.id" :label="sub.name" :value="sub.id" />
          </el-select>
        </label>
        <label class="form-item">
          <span>年份（可空）</span>
          <el-input-number v-model="form.productionYear" :min="1900" :max="2100" :disabled="readonly" />
        </label>
        <label class="form-item form-item--full">
          <span>产地概述</span>
          <el-input v-model="form.originSummary" type="textarea" :rows="2" :disabled="readonly" />
        </label>
        <label class="form-item form-item--full">
          <span>品质描述</span>
          <el-input v-model="form.qualityDesc" type="textarea" :rows="3" :disabled="readonly" />
        </label>
        <label class="form-item">
          <span>水温下限 ℃</span>
          <el-input-number v-model="form.waterTempMin" :min="0" :max="100" :disabled="readonly" />
        </label>
        <label class="form-item">
          <span>水温上限 ℃</span>
          <el-input-number v-model="form.waterTempMax" :min="0" :max="100" :disabled="readonly" />
        </label>
        <label class="form-item">
          <span>投茶量 g</span>
          <el-input-number v-model="form.ratioGrams" :min="0" :precision="1" :step="0.5" :disabled="readonly" />
        </label>
        <label class="form-item">
          <span>水量 ml</span>
          <el-input-number v-model="form.ratioWaterMl" :min="0" :disabled="readonly" />
        </label>
        <label class="form-item">
          <span>器皿</span>
          <el-input v-model="form.vessel" :disabled="readonly" />
        </label>
        <label class="form-item">
          <span>出汤下限 秒</span>
          <el-input-number v-model="form.steepSecondsMin" :min="0" :max="600" :disabled="readonly" />
        </label>
        <label class="form-item">
          <span>出汤上限 秒</span>
          <el-input-number v-model="form.steepSecondsMax" :min="0" :max="600" :disabled="readonly" />
        </label>
        <label class="form-item">
          <span>冲泡次数</span>
          <el-input-number v-model="form.steepTimes" :min="1" :max="30" :disabled="readonly" />
        </label>
      </div>

      <p v-if="formError" class="mm-error">{{ formError }}</p>

      <div v-if="!readonly" class="form-actions">
        <el-button type="primary" :loading="acting" @click="save">保存草稿</el-button>
        <el-button v-if="isNew && savedId" @click="router.push(`/admin/teas/${savedId}/images`)">前往补图</el-button>
      </div>
    </section>

    <section v-if="!isNew && detail" class="mm-card review-card">
      <h2 class="review-title">审核动作</h2>
      <p v-if="detail.rejectReason" class="mm-muted">上次驳回理由：{{ detail.rejectReason }}</p>
      <div v-if="detail.status === 'pending'" class="form-actions">
        <el-button type="success" :loading="acting" @click="review('approve')">通过并上架</el-button>
        <el-button type="danger" :loading="acting" @click="review('reject')">驳回</el-button>
      </div>
      <div v-else-if="detail.status === 'published'" class="form-actions">
        <el-button type="danger" :loading="acting" @click="toggleOnline(false)">下架</el-button>
      </div>
      <div v-else-if="detail.status === 'offline'" class="form-actions">
        <el-button type="success" :loading="acting" @click="toggleOnline(true)">恢复上架</el-button>
      </div>
      <p v-else class="mm-muted">当前状态无可用审核动作。</p>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  ElButton,
  ElInput,
  ElInputNumber,
  ElMessage,
  ElMessageBox,
  ElOption,
  ElSelect
} from 'element-plus'
import { ApiError } from '@/api/http'
import { moderationApi, type AdminCategoryItem, type AdminTeaDetail } from '@/modules/moderation'

const route = useRoute()
const router = useRouter()
const isNew = route.path.endsWith('/new')
const id = isNew ? 0 : Number(route.params.id)

const categories = ref<AdminCategoryItem[]>([])
const detail = ref<AdminTeaDetail | null>(null)
const savedId = ref(0)
const acting = ref(false)
const error = ref('')
const formError = ref('')

const form = reactive({
  name: '',
  categoryId: '',
  subcategoryId: 0,
  productionYear: undefined as number | undefined,
  originSummary: '',
  qualityDesc: '',
  waterTempMin: undefined as number | undefined,
  waterTempMax: undefined as number | undefined,
  ratioGrams: undefined as number | undefined,
  ratioWaterMl: undefined as number | undefined,
  vessel: '',
  steepSecondsMin: undefined as number | undefined,
  steepSecondsMax: undefined as number | undefined,
  steepTimes: undefined as number | undefined,
  version: 0
})

const statusLabels: Record<string, string> = {
  draft: '草稿',
  pending: '待审核',
  published: '已上架',
  offline: '已下架'
}

const readonly = computed(() => !isNew && detail.value?.status !== 'draft')
const currentCategory = computed(() => categories.value.find((item) => item.code === form.categoryId))
const subcategoryOptions = computed(() => currentCategory.value?.subcategories ?? [])
const selectedSubcategory = computed(() =>
  subcategoryOptions.value.find((item) => item.id === form.subcategoryId)
)

function onCategoryChange() {
  form.subcategoryId = 0
}

async function loadCategories() {
  categories.value = await moderationApi.adminCategories()
  if (isNew && categories.value.length) {
    form.categoryId = categories.value[0].code
    form.subcategoryId = categories.value[0].subcategories[0]?.id ?? 0
  }
}

async function loadDetail() {
  const data = await moderationApi.teaDetail(id)
  detail.value = data
  const category = categories.value.find((item) => item.subcategories.some((sub) => sub.id === data.subcategoryId))
  form.name = data.name
  form.categoryId = category?.code ?? ''
  form.subcategoryId = data.subcategoryId
  form.productionYear = data.productionYear
  form.originSummary = data.originSummary ?? ''
  form.qualityDesc = data.qualityDesc ?? ''
  form.waterTempMin = data.waterTempMin
  form.waterTempMax = data.waterTempMax
  form.ratioGrams = data.ratioGrams
  form.ratioWaterMl = data.ratioWaterMl
  form.vessel = data.vessel ?? ''
  form.steepSecondsMin = data.steepSecondsMin
  form.steepSecondsMax = data.steepSecondsMax
  form.steepTimes = data.steepTimes
  form.version = data.version
}

async function load() {
  error.value = ''
  try {
    await loadCategories()
    if (!isNew) {
      await loadDetail()
    }
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : '茶品加载失败'
  }
}

async function save() {
  formError.value = ''
  if (!form.name.trim()) {
    formError.value = '茶名必填'
    return
  }
  if (!form.categoryId || !form.subcategoryId) {
    formError.value = '茶类与亚类必填'
    return
  }
  acting.value = true
  try {
    const payload = {
      name: form.name.trim(),
      categoryId: selectedSubcategory.value?.categoryId ?? 0,
      subcategoryId: form.subcategoryId,
      productionYear: form.productionYear,
      originSummary: form.originSummary || undefined,
      qualityDesc: form.qualityDesc || undefined,
      waterTempMin: form.waterTempMin,
      waterTempMax: form.waterTempMax,
      ratioGrams: form.ratioGrams,
      ratioWaterMl: form.ratioWaterMl,
      vessel: form.vessel || undefined,
      steepSecondsMin: form.steepSecondsMin,
      steepSecondsMax: form.steepSecondsMax,
      steepTimes: form.steepTimes,
      version: form.version
    }
    if (isNew) {
      const created = await moderationApi.createTea(payload)
      savedId.value = created.id
      ElMessage.success('草稿已保存，请前往补图')
    } else {
      await moderationApi.updateTea(id, payload)
      ElMessage.success('已保存')
      await loadDetail()
    }
  } catch (e) {
    formError.value = e instanceof ApiError ? e.message : '保存失败'
  } finally {
    acting.value = false
  }
}

async function submitReview() {
  if (!detail.value) {
    return
  }
  acting.value = true
  try {
    await moderationApi.submitTea(detail.value.id)
    ElMessage.success('已提交审核')
    await loadDetail()
  } catch (e) {
    ElMessage.error(e instanceof ApiError ? e.message : '提交失败')
  } finally {
    acting.value = false
  }
}

async function review(decision: 'approve' | 'reject') {
  if (!detail.value) {
    return
  }
  try {
    let reason = ''
    if (decision === 'reject') {
      const input = await ElMessageBox.prompt('请填写驳回理由（不少于 10 字）', '驳回茶品', {
        inputValidator: (value: string) => value.trim().length >= 10 || '理由至少 10 字'
      })
      reason = input.value
    }
    acting.value = true
    await moderationApi.reviewTea(detail.value.id, decision, reason || undefined, detail.value.version)
    ElMessage.success(decision === 'approve' ? '已通过并上架' : '已驳回')
    await loadDetail()
  } catch (e) {
    if (e instanceof ApiError) {
      ElMessage.error(e.message)
    }
  } finally {
    acting.value = false
  }
}

async function toggleOnline(online: boolean) {
  if (!detail.value) {
    return
  }
  try {
    const input = await ElMessageBox.prompt(online ? '请填写恢复上架原因' : '请填写下架原因', online ? '恢复上架' : '下架茶品', {
      inputValidator: (value: string) => value.trim().length > 0 || '原因不能为空'
    })
    acting.value = true
    if (online) {
      await moderationApi.onlineTea(detail.value.id, input.value)
    } else {
      await moderationApi.offlineTea(detail.value.id, input.value)
    }
    ElMessage.success(online ? '已恢复上架' : '已下架')
    await loadDetail()
  } catch (e) {
    if (e instanceof ApiError) {
      ElMessage.error(e.message)
    }
  } finally {
    acting.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.admin-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4);
  margin-bottom: var(--space-4);
  flex-wrap: wrap;
}

.admin-title {
  font-size: var(--text-h2);
  margin-bottom: var(--space-1);
}

.admin-head__actions {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.readonly-tip {
  margin-bottom: var(--space-3);
}

.form-card,
.review-card {
  padding: var(--space-4);
  margin-bottom: var(--space-4);
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: var(--space-3);
}

.form-item {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  font-size: var(--text-body-s);
  color: var(--ink-600);
}

.form-item--full {
  grid-column: 1 / -1;
}

.form-actions {
  display: flex;
  gap: var(--space-2);
  margin-top: var(--space-3);
  flex-wrap: wrap;
}

.review-title {
  margin: 0 0 var(--space-2);
  font-size: var(--text-body-l);
}
</style>
