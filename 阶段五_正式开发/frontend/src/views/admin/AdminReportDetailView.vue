<template>
  <div>
    <div class="admin-head">
      <div>
        <h1 class="admin-title">投诉处理</h1>
        <p class="mm-muted">举报 #{{ id }} · 48 小时首次响应</p>
      </div>
      <el-button @click="router.push('/admin/reports')">返回列表</el-button>
    </div>

    <p v-if="error" class="mm-error">{{ error }}</p>

    <template v-if="detail">
      <el-descriptions :column="2" border>
        <el-descriptions-item label="对象类型">{{ objectLabels[detail.item.objectType] }}</el-descriptions-item>
        <el-descriptions-item label="对象 ID">#{{ detail.item.objectId }}</el-descriptions-item>
        <el-descriptions-item label="茶品">{{ detail.item.teaName || '—' }}</el-descriptions-item>
        <el-descriptions-item label="举报人">{{ detail.item.reporterNickname }}</el-descriptions-item>
        <el-descriptions-item label="举报类型">{{ detail.item.reportType }}</el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="statusTag(detail.item.status)" size="small">{{ statusLabels[detail.item.status] }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="提交时间">{{ formatDateTime(detail.item.createdAt) }}</el-descriptions-item>
        <el-descriptions-item label="SLA 截止">
          <span :class="{ overdue: detail.item.overdue }">{{ formatDateTime(detail.item.slaDeadline) }}</span>
        </el-descriptions-item>
        <el-descriptions-item label="说明" :span="2">{{ detail.item.description }}</el-descriptions-item>
        <el-descriptions-item v-if="detail.resultNote" label="处理结论" :span="2">
          {{ detail.resultNote }}
        </el-descriptions-item>
      </el-descriptions>

      <section v-if="detail.evidence.length" class="panel">
        <h2 class="panel-title">证据（{{ detail.evidence.length }} 张）</h2>
        <div class="image-grid">
          <a v-for="item in detail.evidence" :key="item.id" :href="item.url" target="_blank" rel="noreferrer">
            <img :src="item.url" :alt="`证据 ${item.seq}`" />
          </a>
        </div>
      </section>

      <section v-if="isOpen" class="panel">
        <h2 class="panel-title">处理</h2>
        <div class="handle-row">
          <el-radio-group v-model="decision">
            <el-radio label="valid">确认违规</el-radio>
            <el-radio label="invalid">不成立</el-radio>
          </el-radio-group>
          <el-select v-if="decision === 'valid'" v-model="action" clearable placeholder="附带处罚（可选）" style="width: 160px">
            <el-option label="禁言" value="mute" />
            <el-option label="封禁" value="ban" />
          </el-select>
        </div>
        <el-input v-model="resultNote" type="textarea" :rows="3" maxlength="300" show-word-limit placeholder="处理说明（必填，≤300 字）" />
        <p v-if="formError" class="mm-error">{{ formError }}</p>
        <el-button type="primary" :loading="acting" style="margin-top: 12px" @click="handle">提交处理</el-button>
      </section>

      <section v-if="detail.appeals.length" class="panel">
        <h2 class="panel-title">申诉记录</h2>
        <el-table :data="detail.appeals" border size="small">
          <el-table-column prop="appellantNickname" label="申诉人" width="140" />
          <el-table-column prop="reason" label="理由" min-width="200" show-overflow-tooltip />
          <el-table-column prop="status" label="状态" width="110">
            <template #default="{ row }">{{ appealLabels[row.status] ?? row.status }}</template>
          </el-table-column>
          <el-table-column prop="createdAt" label="提交时间" width="180">
            <template #default="{ row }">{{ formatDateTime(row.createdAt) }}</template>
          </el-table-column>
          <el-table-column label="操作" width="160">
            <template #default="{ row }">
              <el-button v-if="row.status === 'pending' && auth.isSuper" size="small" @click="reviewAppeal(row)">复核</el-button>
              <span v-else-if="row.status === 'pending'" class="mm-muted">待超管复核</span>
            </template>
          </el-table-column>
        </el-table>
      </section>
    </template>
    <p v-else-if="loading" class="mm-muted">加载中…</p>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  ElButton,
  ElDescriptions,
  ElDescriptionsItem,
  ElInput,
  ElMessage,
  ElMessageBox,
  ElOption,
  ElRadio,
  ElRadioGroup,
  ElSelect,
  ElTable,
  ElTableColumn,
  ElTag
} from 'element-plus'
import { ApiError } from '@/api/http'
import { moderationApi, type AppealItem, type ReportDetail } from '@/modules/moderation'
import { useAuthStore } from '@/stores/auth'
import { formatDateTime } from '@/utils/datetime'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const id = Number(route.params.id)

const detail = ref<ReportDetail | null>(null)
const loading = ref(false)
const acting = ref(false)
const error = ref('')
const formError = ref('')
const decision = ref<'valid' | 'invalid'>('valid')
const action = ref('')
const resultNote = ref('')

const objectLabels: Record<string, string> = {
  image: '茶品图片',
  comment: '评论',
  user_shot: '用户实拍图'
}
const statusLabels: Record<string, string> = {
  pending: '待处理',
  processing: '处理中',
  resolved_valid: '已确认违规',
  resolved_invalid: '不成立'
}
const appealLabels: Record<string, string> = {
  pending: '待复核',
  upheld: '维持',
  overturned: '申诉成立'
}

const isOpen = computed(() => {
  const status = detail.value?.item.status
  return status === 'pending' || status === 'processing'
})

function statusTag(status: string): 'success' | 'warning' | 'info' | 'danger' {
  if (status === 'resolved_valid') return 'danger'
  if (status === 'resolved_invalid') return 'info'
  if (status === 'pending') return 'warning'
  return 'info'
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    detail.value = await moderationApi.reportDetail(id)
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : '举报详情加载失败'
  } finally {
    loading.value = false
  }
}

async function handle() {
  formError.value = ''
  if (!resultNote.value.trim()) {
    formError.value = '处理说明必填'
    return
  }
  acting.value = true
  try {
    await moderationApi.handleReport(id, {
      decision: decision.value,
      action: decision.value === 'valid' && action.value ? action.value : undefined,
      resultNote: resultNote.value.trim()
    })
    ElMessage.success('已处理')
    await load()
  } catch (e) {
    formError.value = e instanceof ApiError ? e.message : '处理失败'
  } finally {
    acting.value = false
  }
}

async function reviewAppeal(row: Record<string, unknown>) {
  const appeal = row as unknown as AppealItem
  try {
    const input = await ElMessageBox.prompt('请填写复核说明（≤300 字）', '申诉复核', {
      inputValidator: (value: string) => value.trim().length > 0 || '复核说明必填'
    })
    const choice: 'uphold' | 'overturn' | null = await ElMessageBox.confirm(
      '选择「申诉成立」将恢复内容或解除处罚。确认申诉成立？',
      '复核结论',
      {
        confirmButtonText: '申诉成立',
        cancelButtonText: '维持原处理',
        distinguishCancelAndClose: true,
        type: 'warning'
      }
    )
      .then(() => 'overturn' as const)
      .catch((reason: string) => (reason === 'cancel' ? ('uphold' as const) : null))
    if (!choice) {
      return
    }
    await moderationApi.reviewAppeal(appeal.id, choice, input.value.trim())
    ElMessage.success('复核完成')
    await load()
  } catch (e) {
    if (e instanceof ApiError) {
      ElMessage.error(e.message)
    }
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

.panel {
  margin-top: var(--space-4);
  padding: var(--space-4);
  background: var(--white);
  border: 1px solid var(--line-200);
  border-radius: var(--radius-md);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.panel-title {
  margin: 0;
  font-size: var(--text-body-l);
}

.handle-row {
  display: flex;
  gap: var(--space-3);
  flex-wrap: wrap;
  align-items: center;
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

.overdue {
  color: var(--danger-500, #c0392b);
  font-weight: 600;
}
</style>
