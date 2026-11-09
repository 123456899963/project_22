<template>
  <div>
    <div class="admin-head">
      <div>
        <h1 class="admin-title">茶品图鉴</h1>
        <p class="mm-muted">每款茶需 1 张干茶、1 张汤色、1 张叶底，另需 1 张以上包装或细节；已发布图需填写授权信息。</p>
      </div>
      <div class="admin-head__actions">
        <el-button @click="router.push(`/admin/teas/${teaId}`)">返回茶品</el-button>
        <el-button @click="load">刷新</el-button>
      </div>
    </div>

    <p v-if="teaName" class="mm-muted">当前茶品：{{ teaName }}</p>
    <p v-if="error" class="mm-error">{{ error }}</p>

    <section class="mm-card rights-card">
      <h2 class="rights-title">授权信息（上传时随图提交）</h2>
      <div class="rights-grid">
        <el-select v-model="rights.sourceType" placeholder="来源">
          <el-option label="官方拍摄" value="official" />
          <el-option label="合作方授权" value="partner" />
          <el-option label="用户授权" value="user" />
        </el-select>
        <el-input v-model="rights.rightsHolder" placeholder="权利人" />
        <el-input v-model="rights.licenseScope" placeholder="授权范围，如站内展示" />
        <el-input v-model="rights.licenseCertNo" placeholder="授权凭证编号" />
      </div>
      <p class="mm-muted">三项（来源 / 权利人 / 凭证编号）缺任意一项，图片只能存为草稿，不计入图鉴就绪。</p>
    </section>

    <section class="mm-card slot-card">
      <h2 class="rights-title">各类型图片</h2>
      <div class="slots">
        <div v-for="slot in slots" :key="slot.type" class="slot">
          <div class="slot-head">
            <strong>{{ slot.label }}</strong>
            <span class="mm-muted">{{ countOf(slot.type) }} 张</span>
          </div>
          <div class="slot-grid">
            <div v-for="image in imagesOf(slot.type)" :key="image.id" class="thumb">
              <img :src="image.thumbUrl || image.url" :alt="image.type" />
              <div class="thumb-meta">
                <el-tag :type="image.status === 'published' ? 'success' : 'info'" size="small">
                  {{ image.status === 'published' ? '已发布' : '草稿' }}
                </el-tag>
                <span class="thumb-seq">#{{ image.seq }}</span>
              </div>
              <div class="thumb-actions">
                <a :href="image.url" target="_blank" rel="noreferrer">查看</a>
                <button type="button" class="thumb-remove" @click="remove(image)">删除</button>
              </div>
            </div>
            <label class="upload-tile">
              <input type="file" accept="image/jpeg,image/png,image/webp" @change="upload(slot.type, $event)" />
              <span>+ 上传</span>
            </label>
          </div>
        </div>
      </div>
    </section>

    <section class="mm-card summary-card">
      <h2 class="rights-title">图鉴就绪</h2>
      <p :class="ready ? 'ready' : 'not-ready'">{{ ready ? '已满足上架图鉴条件' : '尚未满足：需干茶/汤色/叶底各 1 张且另有包装或细节，且均为已发布图' }}</p>
      <el-button v-if="!ready && teaStatus === 'draft'" type="primary" @click="submitReview">提交审核</el-button>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElButton, ElInput, ElMessage, ElMessageBox, ElOption, ElSelect, ElTag } from 'element-plus'
import { ApiError } from '@/api/http'
import { moderationApi, type AdminMediaItem, type AdminTeaDetail } from '@/modules/moderation'

const route = useRoute()
const router = useRouter()
const teaId = Number(route.params.id)

const slots = [
  { type: 'dry', label: '干茶' },
  { type: 'soup', label: '汤色' },
  { type: 'leaf', label: '叶底' },
  { type: 'pack', label: '包装' },
  { type: 'detail', label: '细节' }
]

const images = ref<AdminMediaItem[]>([])
const detail = ref<AdminTeaDetail | null>(null)
const error = ref('')
const rights = ref({ sourceType: 'official', rightsHolder: '', licenseScope: '站内展示', licenseCertNo: '' })

const teaName = computed(() => detail.value?.name ?? '')
const teaStatus = computed(() => detail.value?.status ?? 'draft')
const ready = computed(() => detail.value?.galleryReady ?? false)

function imagesOf(type: string) {
  return images.value.filter((item) => item.type === type)
}

function countOf(type: string) {
  return imagesOf(type).length
}

async function load() {
  error.value = ''
  try {
    const [media, tea] = await Promise.all([
      moderationApi.media(teaId),
      moderationApi.teaDetail(teaId)
    ])
    images.value = media
    detail.value = tea
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : '图鉴加载失败'
  }
}

async function upload(type: string, event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) {
    return
  }
  const form = new FormData()
  form.append('teaId', String(teaId))
  form.append('type', type)
  form.append('file', file)
  if (rights.value.sourceType) form.append('sourceType', rights.value.sourceType)
  if (rights.value.rightsHolder) form.append('rightsHolder', rights.value.rightsHolder)
  if (rights.value.licenseScope) form.append('licenseScope', rights.value.licenseScope)
  if (rights.value.licenseCertNo) form.append('licenseCertNo', rights.value.licenseCertNo)
  try {
    await moderationApi.uploadMedia(form)
    ElMessage.success('上传成功')
    await load()
  } catch (e) {
    ElMessage.error(e instanceof ApiError ? e.message : '上传失败（仅支持 jpg/png/webp，≤5MB）')
  } finally {
    input.value = ''
  }
}

async function remove(image: AdminMediaItem) {
  const confirmed = await ElMessageBox.confirm(`确认删除图片 #${image.id}？`, '删除图片', { type: 'warning' })
    .then(() => true)
    .catch(() => false)
  if (!confirmed) {
    return
  }
  try {
    await moderationApi.deleteMedia(image.id)
    ElMessage.success('已删除')
    await load()
  } catch (e) {
    ElMessage.error(e instanceof ApiError ? e.message : '删除失败')
  }
}

async function submitReview() {
  try {
    await moderationApi.submitTea(teaId)
    ElMessage.success('已提交审核')
    await load()
  } catch (e) {
    ElMessage.error(e instanceof ApiError ? e.message : '提交失败')
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
}

.rights-card,
.slot-card,
.summary-card {
  padding: var(--space-4);
  margin-bottom: var(--space-4);
}

.rights-title {
  margin: 0 0 var(--space-2);
  font-size: var(--text-body-l);
}

.rights-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: var(--space-2);
}

.slots {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.slot-head {
  display: flex;
  gap: var(--space-2);
  align-items: baseline;
  margin-bottom: var(--space-2);
}

.slot-grid {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.thumb {
  width: 140px;
  border: 1px solid var(--line-200);
  border-radius: var(--radius-sm);
  overflow: hidden;
  background: var(--white);
}

.thumb img {
  width: 100%;
  height: 100px;
  object-fit: cover;
  display: block;
}

.thumb-meta {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-1);
  font-size: var(--text-body-xs);
}

.thumb-seq {
  color: var(--ink-500);
  margin-left: auto;
}

.thumb-actions {
  display: flex;
  justify-content: space-between;
  padding: 0 var(--space-1) var(--space-1);
  font-size: var(--text-body-xs);
}

.thumb-remove {
  border: none;
  background: none;
  color: var(--danger-500, #c0392b);
  cursor: pointer;
  padding: 0;
}

.upload-tile {
  display: flex;
  width: 140px;
  height: 140px;
  align-items: center;
  justify-content: center;
  border: 1px dashed var(--line-300);
  border-radius: var(--radius-sm);
  color: var(--ink-500);
  cursor: pointer;
  position: relative;
}

.upload-tile input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}

.ready {
  color: var(--success-600, #2e7d32);
}

.not-ready {
  color: var(--warning-600, #b26a00);
}
</style>
