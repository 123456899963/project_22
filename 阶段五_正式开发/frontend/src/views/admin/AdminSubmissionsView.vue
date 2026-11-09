<template>
  <div>
    <div class="admin-head">
      <div>
        <h1 class="admin-title">投稿审核</h1>
        <p class="mm-muted">T1 品鉴长文、T3 补图、T4 纠错统一队列；超时只标记不自动通过。</p>
      </div>
      <div class="admin-head__actions">
        <el-select v-model="status" placeholder="全部状态" clearable style="width: 150px" @change="load">
          <el-option label="待审核" value="pending" />
          <el-option label="已通过" value="approved" />
          <el-option label="已驳回" value="rejected" />
          <el-option label="已锁定" value="locked" />
        </el-select>
        <el-button type="primary" @click="load">刷新</el-button>
      </div>
    </div>

    <p v-if="error" class="mm-error">{{ error }}</p>

    <el-table v-loading="loading" :data="items" border stripe>
      <el-table-column prop="id" label="ID" width="70" />
      <el-table-column label="类型" width="110">
        <template #default="{ row }">{{ typeLabel(row.type) }}</template>
      </el-table-column>
      <el-table-column prop="teaName" label="茶品" min-width="140" />
      <el-table-column prop="authorNickname" label="作者" width="110" />
      <el-table-column label="状态" width="110">
        <template #default="{ row }">
          <el-tag :type="statusTag(row.status)" size="small">{{ statusLabel(row.status) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="超时" width="90">
        <template #default="{ row }">
          <el-tag v-if="row.overdue" type="warning" size="small">超时</el-tag>
          <span v-else class="mm-muted">—</span>
        </template>
      </el-table-column>
      <el-table-column prop="updatedAt" label="更新时间" width="180">
        <template #default="{ row }">{{ formatDateTime(row.updatedAt) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="220" fixed="right">
        <template #default="{ row }">
          <el-button v-if="row.status === 'pending'" size="small" type="success" @click="review(row, 'approve')">通过</el-button>
          <el-button v-if="row.status === 'pending'" size="small" type="danger" @click="review(row, 'reject')">驳回</el-button>
          <router-link :to="`/admin/submissions/${row.id}`" class="detail-link">详情</router-link>
        </template>
      </el-table-column>
    </el-table>

    <div class="pager">
      <el-pagination
        v-model:current-page="page"
        :page-size="size"
        :total="total"
        layout="prev, pager, next, total"
        @current-change="load"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ElButton, ElMessage, ElMessageBox, ElOption, ElPagination, ElSelect, ElTable, ElTableColumn, ElTag } from 'element-plus'
import { ApiError } from '@/api/http'
import { moderationApi, type AdminSubmissionItem } from '@/modules/moderation'
import { formatDateTime } from '@/utils/datetime'

const items = ref<AdminSubmissionItem[]>([])
const status = ref('pending')
const page = ref(1)
const size = ref(12)
const total = ref(0)
const loading = ref(false)
const error = ref('')

const typeLabels: Record<string, string> = { T1: '品鉴长文', T3: '补图', T4: '纠错' }
const statusLabels: Record<string, string> = {
  draft: '草稿',
  pending: '待审核',
  approved: '已通过',
  rejected: '已驳回',
  locked: '已锁定',
  revised: '已修订'
}

function typeLabel(value: string) {
  return typeLabels[value] ?? value
}

function statusLabel(value: string) {
  return statusLabels[value] ?? value
}

function statusTag(value: string): 'success' | 'warning' | 'danger' | 'info' {
  if (value === 'approved') return 'success'
  if (value === 'pending') return 'warning'
  if (value === 'rejected' || value === 'locked') return 'danger'
  return 'info'
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const data = await moderationApi.submissions({
      status: status.value || undefined,
      page: page.value,
      size: size.value
    })
    items.value = data.items
    total.value = data.total
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : '投稿列表加载失败'
  } finally {
    loading.value = false
  }
}

async function review(row: Record<string, unknown>, decision: 'approve' | 'reject') {
  const item = row as unknown as AdminSubmissionItem
  try {
    let reason = ''
    if (decision === 'reject') {
      const input = await ElMessageBox.prompt('请填写驳回理由', '驳回投稿', {
        inputValidator: (value: string) => value.trim().length > 0 || '理由不能为空'
      })
      reason = input.value
    }
    await moderationApi.reviewSubmission(item.id, decision, reason)
    ElMessage.success(decision === 'approve' ? '已通过' : '已驳回')
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

.admin-head__actions {
  display: flex;
  gap: var(--space-2);
}

.detail-link {
  color: var(--tea-900);
  font-size: var(--text-caption);
}

.pager {
  display: flex;
  justify-content: flex-end;
  padding-top: var(--space-4);
}
</style>
