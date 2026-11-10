<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { getAdminAuditLogs, exportAdminAuditLogs, type AuditLogItem } from '@/api/admin'

const loading = ref(false)
const exporting = ref(false)
const list = ref<AuditLogItem[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)

const filter = reactive({
  user_id: undefined as number | undefined,
  action: '',
  from: '',
  to: '',
})

async function load() {
  loading.value = true
  try {
    const res = await getAdminAuditLogs({
      user_id: filter.user_id,
      action: filter.action || undefined,
      from: filter.from || undefined,
      to: filter.to || undefined,
      page: page.value,
      page_size: pageSize.value,
    })
    list.value = res.data.items
    total.value = res.data.total
  } finally {
    loading.value = false
  }
}

function applyFilter() {
  page.value = 1
  load()
}

function resetFilter() {
  filter.user_id = undefined
  filter.action = ''
  filter.from = ''
  filter.to = ''
  page.value = 1
  load()
}

async function doExport() {
  exporting.value = true
  try {
    const blob = await exportAdminAuditLogs()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  } finally {
    exporting.value = false
  }
}

onMounted(load)
</script>

<template>
  <div v-loading="loading">
    <div class="page-head">
      <h2 class="text-h2">审计日志</h2>
      <el-button :loading="exporting" @click="doExport">导出 CSV（最多 2000 条）</el-button>
    </div>

    <section class="panel">
      <div class="filter-row">
        <el-input
          v-model="filter.user_id"
          type="number"
          placeholder="用户 ID"
          clearable
          style="width: 140px"
        />
        <el-input
          v-model="filter.action"
          placeholder="动作名（如 create_tea）"
          clearable
          style="width: 200px"
        />
        <el-date-picker
          v-model="filter.from"
          type="datetime"
          placeholder="起始时间"
          value-format="YYYY-MM-DDTHH:mm:ss"
          style="width: 200px"
        />
        <el-date-picker
          v-model="filter.to"
          type="datetime"
          placeholder="结束时间"
          value-format="YYYY-MM-DDTHH:mm:ss"
          style="width: 200px"
        />
        <el-button type="primary" @click="applyFilter">查询</el-button>
        <el-button @click="resetFilter">重置</el-button>
      </div>
    </section>

    <section class="panel">
      <el-table :data="list" stripe size="small" empty-text="暂无日志">
        <el-table-column prop="id" label="ID" width="70" />
        <el-table-column label="用户" width="140">
          <template #default="{ row }">
            {{ row.username ?? ('user#' + row.user_id) }}
          </template>
        </el-table-column>
        <el-table-column prop="action" label="动作" width="160" />
        <el-table-column label="目标" min-width="160">
          <template #default="{ row }">
            {{ row.target_type ?? '' }}{{ row.target_id != null ? '#' + row.target_id : '' }}
          </template>
        </el-table-column>
        <el-table-column prop="detail" label="详情" min-width="220" show-overflow-tooltip />
        <el-table-column prop="created_at" label="时间" width="170" />
      </el-table>
      <div class="pagination-wrap">
        <el-pagination
          background
          layout="prev, pager, next, total"
          :total="total"
          :current-page="page"
          :page-size="pageSize"
          @current-change="(p: number) => { page = p; load() }"
        />
      </div>
    </section>
  </div>
</template>

<style scoped>
.page-head {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 20px;
}
.page-head h2 { margin: 0; }
.panel {
  margin-bottom: 20px; padding: 20px 24px;
  border: 1px solid var(--color-border); border-radius: var(--radius-md);
  background: var(--color-bg-surface);
}
.filter-row {
  display: flex; flex-wrap: wrap; gap: 12px; align-items: center;
}
.pagination-wrap {
  margin-top: 16px; display: flex; justify-content: flex-end;
}
</style>
