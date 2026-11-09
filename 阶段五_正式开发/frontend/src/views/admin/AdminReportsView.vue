<template>
  <div>
    <div class="admin-head">
      <div>
        <h1 class="admin-title">举报与投诉</h1>
        <p class="mm-muted">48 小时内首次响应；处理需全字段留痕。</p>
      </div>
      <div class="admin-head__actions">
        <el-select v-model="status" placeholder="全部状态" clearable style="width: 150px" @change="load">
          <el-option label="待响应" value="pending" />
          <el-option label="处理中" value="processing" />
          <el-option label="成立" value="resolved_valid" />
          <el-option label="不成立" value="resolved_invalid" />
        </el-select>
        <el-button type="primary" @click="load">刷新</el-button>
      </div>
    </div>

    <p v-if="error" class="mm-error">{{ error }}</p>

    <el-table v-loading="loading" :data="items" border stripe>
      <el-table-column prop="id" label="ID" width="70" />
      <el-table-column label="对象" width="120">
        <template #default="{ row }">{{ objectLabel(row.objectType) }}</template>
      </el-table-column>
      <el-table-column prop="teaName" label="茶品" min-width="130" />
      <el-table-column prop="reportType" label="类型" width="120" />
      <el-table-column prop="description" label="描述" min-width="200" show-overflow-tooltip />
      <el-table-column prop="reporterNickname" label="举报人" width="110" />
      <el-table-column label="状态" width="110">
        <template #default="{ row }">
          <el-tag :type="statusTag(row.status)" size="small">{{ statusLabel(row.status) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="createdAt" label="提交时间" width="180">
        <template #default="{ row }">{{ formatDateTime(row.createdAt) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="220" fixed="right">
        <template #default="{ row }">
          <el-button
            v-if="row.status === 'pending' || row.status === 'processing'"
            size="small"
            type="success"
            @click="handle(row, 'valid')"
          >成立</el-button>
          <el-button
            v-if="row.status === 'pending' || row.status === 'processing'"
            size="small"
            @click="handle(row, 'invalid')"
          >不成立</el-button>
          <router-link :to="`/admin/reports/${row.id}`" class="detail-link">详情</router-link>
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
import { moderationApi, type ReportItem } from '@/modules/moderation'
import { formatDateTime } from '@/utils/datetime'

const items = ref<ReportItem[]>([])
const status = ref('')
const page = ref(1)
const size = ref(12)
const total = ref(0)
const loading = ref(false)
const error = ref('')

const objectLabels: Record<string, string> = { image: '图片', comment: '评论', user_shot: '用户实拍' }
const statusLabels: Record<string, string> = {
  pending: '待响应',
  processing: '处理中',
  resolved_valid: '成立',
  resolved_invalid: '不成立'
}

function objectLabel(value: string) {
  return objectLabels[value] ?? value
}

function statusLabel(value: string) {
  return statusLabels[value] ?? value
}

function statusTag(value: string): 'warning' | 'success' | 'info' | 'danger' {
  if (value === 'resolved_valid') return 'success'
  if (value === 'resolved_invalid') return 'info'
  if (value === 'processing') return 'warning'
  return 'danger'
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const data = await moderationApi.reports({
      status: status.value || undefined,
      page: page.value,
      size: size.value
    })
    items.value = data.items
    total.value = data.total
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : '举报列表加载失败'
  } finally {
    loading.value = false
  }
}

async function handle(row: Record<string, unknown>, decision: 'valid' | 'invalid') {
  const item = row as unknown as ReportItem
  try {
    const input = await ElMessageBox.prompt('请填写处理说明（全字段留痕）', decision === 'valid' ? '举报成立' : '举报不成立', {
      inputValidator: (value: string) => value.trim().length >= 5 || '处理说明至少 5 字'
    })
    await moderationApi.handleReport(item.id, { decision, resultNote: input.value })
    ElMessage.success('已处理')
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
