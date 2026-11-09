<template>
  <div>
    <div class="admin-head">
      <div>
        <h1 class="admin-title">茶品管理</h1>
        <p class="mm-muted">含草稿、待审核、已上架、已下架全部状态。</p>
      </div>
      <div class="admin-head__actions">
        <el-select v-model="status" placeholder="全部状态" clearable style="width: 160px" @change="load">
          <el-option label="草稿" value="draft" />
          <el-option label="待审核" value="pending" />
          <el-option label="已上架" value="published" />
          <el-option label="已下架" value="offline" />
        </el-select>
        <el-button type="primary" @click="router.push('/admin/teas/new')">新建茶品</el-button>
        <el-button @click="load">刷新</el-button>
      </div>
    </div>

    <p v-if="error" class="mm-error">{{ error }}</p>

    <el-table v-loading="loading" :data="items" border stripe>
      <el-table-column prop="name" label="茶品" min-width="160" />
      <el-table-column prop="categoryName" label="茶类" width="100" />
      <el-table-column prop="subcategoryName" label="亚类" width="110" />
      <el-table-column label="状态" width="110">
        <template #default="{ row }">
          <el-tag :type="statusTag(row.status)" size="small">{{ statusLabel(row.status) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="图数" width="100">
        <template #default="{ row }">
          {{ row.imageCount }}
          <el-tag v-if="!row.galleryReady" type="warning" size="small">未就绪</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="lastUpdateAt" label="最近更新" width="180">
        <template #default="{ row }">{{ formatDateTime(row.lastUpdateAt) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="280" fixed="right">
        <template #default="{ row }">
          <el-button size="small" @click="router.push(`/admin/teas/${row.id}`)">编辑</el-button>
          <el-button size="small" @click="router.push(`/admin/teas/${row.id}/images`)">图鉴</el-button>
          <el-button v-if="row.status === 'pending'" size="small" type="success" @click="review(row, 'approve')">通过</el-button>
          <el-button v-if="row.status === 'pending'" size="small" type="danger" @click="review(row, 'reject')">驳回</el-button>
          <el-button v-if="row.status === 'published'" size="small" @click="offline(row)">下架</el-button>
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
import { useRouter } from 'vue-router'
import { ElButton, ElMessage, ElMessageBox, ElOption, ElPagination, ElSelect, ElTable, ElTableColumn, ElTag } from 'element-plus'
import { ApiError } from '@/api/http'
import { moderationApi, type AdminTeaItem } from '@/modules/moderation'
import { formatDateTime } from '@/utils/datetime'

const router = useRouter()
const items = ref<AdminTeaItem[]>([])
const status = ref('')
const page = ref(1)
const size = ref(12)
const total = ref(0)
const loading = ref(false)
const error = ref('')

const statusLabels: Record<string, string> = {
  draft: '草稿',
  pending: '待审核',
  published: '已上架',
  offline: '已下架'
}

function statusLabel(value: string) {
  return statusLabels[value] ?? value
}

function statusTag(value: string): 'success' | 'warning' | 'info' | 'danger' {
  if (value === 'published') return 'success'
  if (value === 'pending') return 'warning'
  if (value === 'offline') return 'danger'
  return 'info'
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const data = await moderationApi.teas({
      status: status.value || undefined,
      page: page.value,
      size: size.value
    })
    items.value = data.items
    total.value = data.total
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : '茶品列表加载失败'
  } finally {
    loading.value = false
  }
}

async function review(row: Record<string, unknown>, decision: 'approve' | 'reject') {
  const item = row as unknown as AdminTeaItem
  try {
    let reason = ''
    if (decision === 'reject') {
      const input = await ElMessageBox.prompt('请填写驳回理由（不少于 10 字）', '驳回茶品', {
        inputValidator: (value: string) => value.trim().length >= 10 || '理由至少 10 字'
      })
      reason = input.value
    }
    await moderationApi.reviewTea(item.id, decision, reason)
    ElMessage.success(decision === 'approve' ? '已通过' : '已驳回')
    await load()
  } catch (e) {
    if (e instanceof ApiError) {
      ElMessage.error(e.message)
    }
  }
}

async function offline(row: Record<string, unknown>) {
  const item = row as unknown as AdminTeaItem
  try {
    const input = await ElMessageBox.prompt('请填写下架原因', '下架茶品', {
      inputValidator: (value: string) => value.trim().length > 0 || '原因不能为空'
    })
    await moderationApi.offlineTea(item.id, input.value)
    ElMessage.success('已下架')
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

.pager {
  display: flex;
  justify-content: flex-end;
  padding-top: var(--space-4);
}
</style>
