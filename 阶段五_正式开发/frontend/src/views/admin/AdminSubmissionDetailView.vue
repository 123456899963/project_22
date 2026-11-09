<template>
  <div>
    <div class="admin-head">
      <div>
        <h1 class="admin-title">投稿审核详情</h1>
        <p class="mm-muted">投稿 #{{ id }}</p>
      </div>
      <div class="admin-head__actions">
        <el-button @click="goBack">返回列表</el-button>
      </div>
    </div>

    <p v-if="error" class="mm-error">{{ error }}</p>

    <template v-if="detail">
      <el-descriptions :column="2" border>
        <el-descriptions-item label="类型">{{ typeLabels[detail.type] ?? detail.type }}</el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="statusTag(detail.status)" size="small">{{ statusLabels[detail.status] ?? detail.status }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="茶品">
          <router-link v-if="detail.teaId" :to="`/admin/teas/${detail.teaId}`">{{ detail.teaName }}</router-link>
          <span v-else>—</span>
        </el-descriptions-item>
        <el-descriptions-item label="作者">
          {{ detail.anonymous ? '匿名茶友' : (detail.nickname || `用户 #${detail.userId}`) }}
        </el-descriptions-item>
        <el-descriptions-item label="重提次数">{{ detail.retryCount }}</el-descriptions-item>
        <el-descriptions-item label="提交时间">{{ formatDateTime(detail.createdAt) }}</el-descriptions-item>
        <el-descriptions-item label="标题" :span="2">{{ detail.title || '—' }}</el-descriptions-item>
        <el-descriptions-item v-if="detail.rejectReason" label="上次驳回理由" :span="2">
          {{ detail.rejectReason }}
        </el-descriptions-item>
      </el-descriptions>

      <section v-if="detail.body" class="panel">
        <h2 class="panel-title">正文</h2>
        <p class="body-text">{{ detail.body }}</p>
      </section>

      <section v-if="detail.correctionFieldKey" class="panel">
        <h2 class="panel-title">字段纠错</h2>
        <el-descriptions :column="1" border>
          <el-descriptions-item label="字段">{{ detail.correctionFieldKey }}</el-descriptions-item>
          <el-descriptions-item label="建议值">{{ detail.newValue }}</el-descriptions-item>
          <el-descriptions-item label="理由">{{ detail.reason }}</el-descriptions-item>
        </el-descriptions>
      </section>

      <section v-if="detail.images.length" class="panel">
        <h2 class="panel-title">补图（{{ detail.images.length }} 张）</h2>
        <div class="image-grid">
          <a v-for="image in detail.images" :key="image.id" :href="image.url" target="_blank" rel="noreferrer">
            <img :src="image.thumbUrl || image.url" :alt="`投稿图片 ${image.id}`" />
          </a>
        </div>
      </section>

      <div v-if="detail.status === 'pending'" class="actions">
        <el-button type="success" :loading="acting" @click="review('approve')">通过</el-button>
        <el-button type="danger" :loading="acting" @click="review('reject')">驳回</el-button>
      </div>
      <p v-else class="mm-muted">该投稿已处理，仅可查看。</p>
    </template>
    <p v-else-if="loading" class="mm-muted">加载中…</p>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElButton, ElDescriptions, ElDescriptionsItem, ElMessage, ElMessageBox, ElTag } from 'element-plus'
import { ApiError } from '@/api/http'
import { moderationApi, type AdminSubmissionDetail } from '@/modules/moderation'
import { formatDateTime } from '@/utils/datetime'

const route = useRoute()
const router = useRouter()
const id = Number(route.params.id)

const detail = ref<AdminSubmissionDetail | null>(null)
const loading = ref(false)
const acting = ref(false)
const error = ref('')

const typeLabels: Record<string, string> = {
  T1: '品鉴长文',
  T3: '补图',
  T4: '纠错'
}

const statusLabels: Record<string, string> = {
  draft: '草稿',
  pending: '待审核',
  approved: '已通过',
  rejected: '已驳回',
  locked: '已锁定',
  revised: '已修订'
}

function statusTag(status: string): 'success' | 'warning' | 'info' | 'danger' {
  if (status === 'approved' || status === 'revised') return 'success'
  if (status === 'pending') return 'warning'
  if (status === 'rejected' || status === 'locked') return 'danger'
  return 'info'
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    detail.value = await moderationApi.submissionDetail(id)
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : '投稿加载失败'
  } finally {
    loading.value = false
  }
}

async function review(decision: 'approve' | 'reject') {
  if (!detail.value) {
    return
  }
  try {
    let reason = ''
    if (decision === 'reject') {
      const input = await ElMessageBox.prompt('请填写驳回理由（不少于 10 字）', '驳回投稿', {
        inputValidator: (value: string) => value.trim().length >= 10 || '理由至少 10 字'
      })
      reason = input.value
    }
    acting.value = true
    await moderationApi.reviewSubmission(detail.value.id, decision, reason || undefined)
    ElMessage.success(decision === 'approve' ? '已通过' : '已驳回')
    await load()
  } catch (e) {
    if (e instanceof ApiError) {
      ElMessage.error(e.message)
    }
  } finally {
    acting.value = false
  }
}

function goBack() {
  router.push('/admin/submissions')
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

.panel {
  margin-top: var(--space-4);
  padding: var(--space-4);
  background: var(--white);
  border: 1px solid var(--line-200);
  border-radius: var(--radius-md);
}

.panel-title {
  margin: 0 0 var(--space-2);
  font-size: var(--text-body-l);
}

.body-text {
  white-space: pre-wrap;
  line-height: 1.8;
  color: var(--ink-700);
}

.image-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: var(--space-2);
}

.image-grid img {
  width: 100%;
  height: 120px;
  object-fit: cover;
  border-radius: var(--radius-sm);
}

.actions {
  display: flex;
  gap: var(--space-2);
  margin-top: var(--space-4);
}
</style>
