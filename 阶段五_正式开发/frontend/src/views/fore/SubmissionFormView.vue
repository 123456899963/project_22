<template>
  <div class="mm-container mm-page">
    <h1 class="mm-page__title">{{ isEdit ? '编辑投稿' : '新建投稿' }}</h1>
    <p class="mm-page__subtitle">提交后进入待审核；驳回后可修改重提，最多 2 次。</p>

    <div v-if="loadingDetail" class="mm-muted">正在加载投稿…</div>
    <div v-else class="form-card mm-card">
      <div class="form-row">
        <label>投稿类型</label>
        <div class="type-row">
          <button
            v-for="option in typeOptions"
            :key="option.value"
            class="chip"
            :class="{ 'chip--active': type === option.value }"
            type="button"
            :disabled="isEdit"
            @click="type = option.value"
          >{{ option.label }}</button>
        </div>
      </div>

      <div class="form-row">
        <label>关联茶品</label>
        <div v-if="teaSelected" class="tea-selected">
          <span>{{ teaName }}</span>
          <button v-if="!isEdit" class="link-button" type="button" @click="clearTea">更换</button>
        </div>
        <template v-else>
          <div class="tea-search">
            <input v-model="keyword" class="mm-input" type="search" placeholder="输入茶名检索" @keyup.enter="searchTea" />
            <button class="mm-button mm-button--ghost" type="button" :disabled="!keyword.trim()" @click="searchTea">搜索</button>
          </div>
          <ul v-if="teaOptions.length" class="tea-options">
            <li v-for="item in teaOptions" :key="item.id">
              <button class="link-button" type="button" @click="selectTea(item.id, item.name)">
                {{ item.name }}（{{ item.categoryName }}）
              </button>
            </li>
          </ul>
        </template>
      </div>

      <template v-if="type === 'T1'">
        <div class="form-row">
          <label>标题（≤60 字）</label>
          <input v-model="title" class="mm-input" maxlength="60" placeholder="例如：武夷岩茶的岩韵从何而来" />
        </div>
        <div class="form-row">
          <label>正文（≥300 字）</label>
          <textarea v-model="body" class="mm-input mm-textarea" rows="10" placeholder="记录你的品鉴过程与感受" />
          <span class="mm-muted">当前 {{ body.trim().length }} 字</span>
        </div>
      </template>

      <template v-else-if="type === 'T4'">
        <div class="form-row">
          <label>修改字段</label>
          <select v-model="fieldKey" class="mm-input">
            <option value="">请选择</option>
            <option v-for="option in fieldOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
          </select>
        </div>
        <div class="form-row">
          <label>修改后内容</label>
          <input v-model="newValue" class="mm-input" maxlength="500" placeholder="填写更正后的内容" />
        </div>
        <div class="form-row">
          <label>修改理由（20–200 字）</label>
          <textarea v-model="reason" class="mm-input mm-textarea" rows="4" maxlength="200" placeholder="说明依据，例如官方标准号或产区资料" />
          <span class="mm-muted">当前 {{ reason.trim().length }} 字</span>
        </div>
      </template>

      <template v-else>
        <div class="form-row">
          <label>补图图片（1–5 张，jpg/png/webp，单张 ≤5MB）</label>
          <div class="upload-row">
            <select v-model="imageType" class="mm-input upload-type">
              <option v-for="option in imageTypeOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
            </select>
            <input
              class="mm-input"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              :disabled="uploading || uploadedImages.length >= 5"
              @change="onFileChange"
            />
          </div>
          <span v-if="uploading" class="mm-muted">图片上传中…</span>
          <div v-if="uploadedImages.length" class="upload-grid">
            <div v-for="image in uploadedImages" :key="image.id" class="upload-item">
              <img :src="image.thumbUrl || image.url" alt="补图预览" />
              <button class="link-button" type="button" @click="removeImage(image.id)">移除</button>
            </div>
          </div>
          <label class="license-row">
            <input v-model="licenseGranted" type="checkbox" />
            我确认拥有该图片著作权或已取得授权，同意平台在茶品图鉴中展示
          </label>
        </div>
      </template>

      <div class="form-row">
        <label>署名方式</label>
        <div class="type-row">
          <button class="chip" :class="{ 'chip--active': !anonymous }" type="button" @click="anonymous = false">昵称</button>
          <button class="chip" :class="{ 'chip--active': anonymous }" type="button" @click="anonymous = true">匿名</button>
        </div>
      </div>

      <p v-if="error" class="mm-error">{{ error }}</p>

      <div class="form-actions">
        <button class="mm-button mm-button--ghost" type="button" :disabled="saving" @click="save(false)">保存草稿</button>
        <button class="mm-button" type="button" :disabled="saving" @click="save(true)">
          {{ originalStatus === 'rejected' ? '修改并重提' : '提交审核' }}
        </button>
        <router-link to="/me/submissions" class="link-button">返回投稿中心</router-link>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ApiError } from '@/api/http'
import type { TeaSummary } from '@/modules/catalog'
import { submissionApi, type SubmissionType, type UploadedImage } from '@/modules/submission'

const route = useRoute()
const router = useRouter()

const typeOptions = [
  { value: 'T1' as const, label: '品鉴长文' },
  { value: 'T3' as const, label: '补图' },
  { value: 'T4' as const, label: '纠错' }
]
const imageTypeOptions = [
  { value: 'dry', label: '干茶' },
  { value: 'soup', label: '汤色' },
  { value: 'leaf', label: '叶底' },
  { value: 'pack', label: '包装' },
  { value: 'detail', label: '细节' }
]
const fieldOptions = [
  { value: 'name', label: '茶名' },
  { value: 'category', label: '茶类' },
  { value: 'subcategory', label: '亚类' },
  { value: 'origin', label: '产地' },
  { value: 'grade', label: '等级' },
  { value: 'productionYear', label: '年份' },
  { value: 'standard', label: '标准号' },
  { value: 'brewing', label: '冲泡建议' },
  { value: 'quality', label: '品质特征' },
  { value: 'alias', label: '别名' }
]

const editId = ref<number | null>(null)
const originalStatus = ref('')
const loadingDetail = ref(false)
const saving = ref(false)
const error = ref('')

const requestedType = route.query.type
const type = ref<SubmissionType>(
  requestedType === 'T3' || requestedType === 'T4'
    ? requestedType
    : route.name === 'submission-correction' ? 'T4' : 'T1'
)
const teaId = ref<number | null>(null)
const teaName = ref('')
const keyword = ref('')
const teaOptions = ref<TeaSummary[]>([])
const title = ref('')
const body = ref('')
const fieldKey = ref('')
const newValue = ref('')
const reason = ref('')
const anonymous = ref(false)
const imageType = ref('dry')
const uploadedImages = ref<UploadedImage[]>([])
const uploading = ref(false)
const licenseGranted = ref(false)

const isEdit = computed(() => editId.value !== null)
const teaSelected = computed(() => teaId.value !== null)

async function searchTea() {
  const q = keyword.value.trim()
  if (!q) {
    return
  }
  error.value = ''
  try {
    const data = await submissionApi.teaOptions(q)
    teaOptions.value = data.items
    if (!data.items.length) {
      error.value = '没有找到相关茶品，请换关键词'
    }
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : '茶品检索失败'
  }
}

function selectTea(id: number, name: string) {
  teaId.value = id
  teaName.value = name
  teaOptions.value = []
}

function clearTea() {
  teaId.value = null
  teaName.value = ''
}

function validate(submitAfter: boolean): string {
  if (teaId.value === null) {
    return '请先选择关联茶品'
  }
  if (type.value === 'T1' && submitAfter) {
    if (!title.value.trim()) {
      return '请填写标题'
    }
    if (body.value.trim().length < 300) {
      return '正文不少于 300 字'
    }
  }
  if (type.value === 'T4' && submitAfter) {
    if (!fieldKey.value) {
      return '请选择需要修改的字段'
    }
    if (!newValue.value.trim()) {
      return '请填写更正后的内容'
    }
    const length = reason.value.trim().length
    if (length < 20 || length > 200) {
      return '修改理由需 20–200 字'
    }
  }
  if (type.value === 'T3' && submitAfter) {
    if (!uploadedImages.value.length) {
      return '请先上传至少 1 张补图'
    }
    if (!licenseGranted.value) {
      return '请勾选图片授权声明'
    }
  }
  return ''
}

async function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) {
    return
  }
  if (teaId.value === null) {
    error.value = '请先选择关联茶品'
    input.value = ''
    return
  }
  uploading.value = true
  error.value = ''
  try {
    const form = new FormData()
    form.append('teaId', String(teaId.value))
    form.append('type', imageType.value)
    form.append('file', file)
    uploadedImages.value.push(await submissionApi.uploadImage(form))
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : '图片上传失败'
  } finally {
    uploading.value = false
    input.value = ''
  }
}

function removeImage(id: number) {
  uploadedImages.value = uploadedImages.value.filter((image) => image.id !== id)
}

function buildPayload() {
  return {
    type: type.value,
    teaId: teaId.value as number,
    title: type.value === 'T1' ? title.value.trim() : undefined,
    body: type.value === 'T1' ? body.value : undefined,
    correctionFieldKey: type.value === 'T4' ? fieldKey.value : undefined,
    newValue: type.value === 'T4' ? newValue.value.trim() : undefined,
    reason: type.value === 'T4' ? reason.value.trim() : undefined,
    imageIds: type.value === 'T3' ? uploadedImages.value.map((image) => image.id) : undefined,
    licenseGranted: type.value === 'T3' ? licenseGranted.value : undefined,
    anonymous: anonymous.value
  }
}

async function save(submitAfter: boolean) {
  const message = validate(submitAfter)
  if (message) {
    error.value = message
    return
  }
  saving.value = true
  error.value = ''
  try {
    let id = editId.value
    if (id === null) {
      const created = await submissionApi.create(buildPayload())
      id = created.id
      editId.value = id
      originalStatus.value = created.status
    } else {
      await submissionApi.update(id, buildPayload())
    }
    if (submitAfter) {
      if (originalStatus.value === 'rejected') {
        await submissionApi.resubmit(id)
      } else {
        await submissionApi.submit(id)
      }
    }
    router.push('/me/submissions')
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : '保存失败，请重试'
  } finally {
    saving.value = false
  }
}

async function loadDetail(id: number) {
  loadingDetail.value = true
  try {
    const detail = await submissionApi.detail(id)
    editId.value = detail.id
    originalStatus.value = detail.status
    type.value = detail.type
    teaId.value = detail.teaId
    teaName.value = detail.teaName
    title.value = detail.title ?? ''
    body.value = detail.body ?? ''
    fieldKey.value = detail.correctionFieldKey ?? ''
    newValue.value = detail.newValue ?? ''
    reason.value = detail.reason ?? ''
    anonymous.value = detail.anonymous
    uploadedImages.value = detail.images.map((image) => ({
      id: image.id,
      url: image.url,
      thumbUrl: image.thumbUrl,
      status: ''
    }))
    licenseGranted.value = Boolean(detail.licenseGranted)
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : '投稿加载失败'
  } finally {
    loadingDetail.value = false
  }
}

onMounted(() => {
  const id = Number(route.query.id ?? 0)
  if (id > 0) {
    void loadDetail(id)
  }
})
</script>

<style scoped>
.form-card {
  padding: var(--space-5);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.form-row {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.form-row > label {
  font-weight: 500;
}

.type-row {
  display: flex;
  gap: var(--space-2);
}

.chip {
  padding: var(--space-1) var(--space-4);
  border: 1px solid var(--line-200);
  border-radius: var(--radius-pill);
  background: var(--white);
  color: var(--ink-700);
}

.chip--active {
  border-color: var(--tea-900);
  background: var(--tea-900);
  color: var(--white);
}

.chip:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.mm-textarea {
  padding: var(--space-2) var(--space-3);
  resize: vertical;
  font-family: inherit;
}

.tea-search {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.tea-search .mm-button {
  flex-shrink: 0;
  white-space: nowrap;
}

.tea-options {
  margin: 0;
  padding: var(--space-2) 0 0;
  list-style: none;
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
}

.tea-selected {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-3);
  background: var(--surface-100);
  border-radius: var(--radius-sm);
}

.upload-row {
  display: flex;
  gap: var(--space-2);
  align-items: center;
}

.upload-type {
  max-width: 120px;
}

.upload-grid {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
}

.upload-item {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  width: 120px;
}

.upload-item img {
  width: 120px;
  height: 90px;
  object-fit: cover;
  border-radius: var(--radius-sm);
  border: 1px solid var(--line-200);
}

.license-row {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
  font-size: var(--text-caption);
  color: var(--ink-700);
}

.form-actions {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.link-button {
  border: none;
  background: none;
  padding: 0;
  color: var(--ink-500);
  font-size: var(--text-caption);
}

.link-button:hover {
  color: var(--tea-900);
}
</style>
