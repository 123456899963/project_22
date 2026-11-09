<template>
  <div>
    <div class="admin-head">
      <div>
        <h1 class="admin-title">审计日志</h1>
        <p class="mm-muted">审核、上下架、白名单、处罚、投诉、申诉、配置变更全程留痕，保留 180 天。</p>
      </div>
      <div class="admin-head__actions">
        <el-input v-model="operator" placeholder="操作人 ID" clearable style="width: 120px" />
        <el-input v-model="action" placeholder="动作，如 review" clearable style="width: 160px" />
        <el-button type="primary" @click="reload">查询</el-button>
        <el-button :disabled="!auth.isSuper" @click="exportCsv">导出 CSV</el-button>
      </div>
    </div>

    <p v-if="!auth.isSuper" class="mm-muted">导出仅超级管理员可用。</p>
    <p v-if="error" class="mm-error">{{ error }}</p>

    <el-table v-loading="loading" :data="items" border stripe>
      <el-table-column prop="id" label="ID" width="80" />
      <el-table-column prop="operatorId" label="操作人" width="90" />
      <el-table-column prop="operatorRole" label="角色" width="90" />
      <el-table-column prop="action" label="动作" width="150" />
      <el-table-column prop="objectType" label="对象类型" width="130" />
      <el-table-column prop="objectId" label="对象 ID" width="90" />
      <el-table-column prop="reason" label="原因" min-width="180" show-overflow-tooltip />
      <el-table-column prop="ip" label="IP" width="130" />
      <el-table-column prop="requestId" label="请求 ID" width="170" show-overflow-tooltip />
      <el-table-column prop="createdAt" label="时间" width="180">
        <template #default="{ row }">{{ formatDateTime(row.createdAt) }}</template>
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
import { ElButton, ElInput, ElMessage, ElPagination, ElTable, ElTableColumn } from 'element-plus'
import { TOKEN_KEY, ApiError } from '@/api/http'
import { moderationApi, type AuditLogItem } from '@/modules/moderation'
import { formatDateTime } from '@/utils/datetime'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const items = ref<AuditLogItem[]>([])
const operator = ref('')
const action = ref('')
const page = ref(1)
const size = ref(12)
const total = ref(0)
const loading = ref(false)
const error = ref('')

async function load() {
  loading.value = true
  error.value = ''
  try {
    const data = await moderationApi.auditLogs({
      operator: operator.value ? Number(operator.value) : undefined,
      action: action.value || undefined,
      page: page.value,
      size: size.value
    })
    items.value = data.items
    total.value = data.total
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : '审计日志加载失败'
  } finally {
    loading.value = false
  }
}

function reload() {
  page.value = 1
  void load()
}

async function exportCsv() {
  const params = new URLSearchParams({
    export: 'true',
    operator: operator.value,
    action: action.value
  })
  try {
    const response = await fetch(`/api/v1/admin/audit-logs?${params.toString()}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem(TOKEN_KEY) ?? ''}` }
    })
    if (!response.ok) {
      throw new Error(`导出失败（HTTP ${response.status}）`)
    }
    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'audit-logs.csv'
    link.click()
    URL.revokeObjectURL(url)
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '导出失败')
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

.pager {
  display: flex;
  justify-content: flex-end;
  padding-top: var(--space-4);
}
</style>
