<template>
  <div>
    <div class="admin-head">
      <div>
        <h1 class="admin-title">评论审核</h1>
        <p class="mm-muted">默认展示待审评论；已发布评论可在前台详情页查看。</p>
      </div>
      <div class="admin-head__actions">
        <el-select v-model="status" clearable placeholder="全部状态" style="width: 160px" @change="reload">
          <el-option label="待审核" value="pending" />
          <el-option label="已发布" value="published" />
          <el-option label="已驳回" value="rejected" />
          <el-option label="已删除" value="deleted" />
        </el-select>
        <el-button type="primary" @click="load">刷新</el-button>
      </div>
    </div>

    <p v-if="error" class="mm-error">{{ error }}</p>

    <el-table v-loading="loading" :data="items" border stripe @row-click="openDrawer">
      <el-table-column prop="id" label="ID" width="80" />
      <el-table-column prop="teaName" label="茶品" min-width="140" />
      <el-table-column prop="content" label="内容" min-width="240" show-overflow-tooltip />
      <el-table-column prop="nickname" label="作者" width="140" />
      <el-table-column label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="statusTag(row.status)" size="small">{{ statusLabels[row.status] ?? row.status }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="createdAt" label="提交时间" width="180">
        <template #default="{ row }">{{ formatDateTime(row.createdAt) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="180" fixed="right">
        <template #default="{ row }">
          <el-button v-if="row.status === 'pending'" size="small" type="success" @click.stop="review(row, 'approve')">通过</el-button>
          <el-button v-if="row.status === 'pending'" size="small" type="danger" @click.stop="review(row, 'reject')">驳回</el-button>
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

    <el-drawer v-model="drawerVisible" :title="selected ? `评论 #${selected.id}` : '评论详情'" size="420px">
      <template v-if="selected">
        <p class="drawer-row"><strong>茶品：</strong>{{ selected.teaName }}</p>
        <p class="drawer-row"><strong>作者：</strong>{{ selected.nickname }}</p>
        <p class="drawer-row"><strong>时间：</strong>{{ formatDateTime(selected.createdAt) }}</p>
        <p class="drawer-row"><strong>状态：</strong>{{ statusLabels[selected.status] ?? selected.status }}</p>
        <p v-if="selected.rejectReason" class="drawer-row"><strong>驳回理由：</strong>{{ selected.rejectReason }}</p>
        <p class="drawer-content">{{ selected.content }}</p>
        <div v-if="selected.status === 'pending'" class="drawer-actions">
          <el-button type="success" @click="review(selected, 'approve')">通过</el-button>
          <el-button type="danger" @click="review(selected, 'reject')">驳回</el-button>
        </div>
      </template>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import {
  ElButton,
  ElDrawer,
  ElMessage,
  ElMessageBox,
  ElOption,
  ElPagination,
  ElSelect,
  ElTable,
  ElTableColumn,
  ElTag
} from 'element-plus'
import { ApiError } from '@/api/http'
import { moderationApi, type AdminCommentItem } from '@/modules/moderation'
import { formatDateTime } from '@/utils/datetime'

const items = ref<AdminCommentItem[]>([])
const status = ref('pending')
const page = ref(1)
const size = ref(12)
const total = ref(0)
const loading = ref(false)
const error = ref('')
const drawerVisible = ref(false)
const selected = ref<AdminCommentItem | null>(null)

const statusLabels: Record<string, string> = {
  pending: '待审核',
  published: '已发布',
  rejected: '已驳回',
  deleted: '已删除'
}

function statusTag(status: string): 'success' | 'warning' | 'info' | 'danger' {
  if (status === 'published') return 'success'
  if (status === 'pending') return 'warning'
  if (status === 'rejected' || status === 'deleted') return 'danger'
  return 'info'
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const data = await moderationApi.comments({
      status: status.value || undefined,
      page: page.value,
      size: size.value
    })
    items.value = data.items
    total.value = data.total
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : '评论列表加载失败'
  } finally {
    loading.value = false
  }
}

function reload() {
  page.value = 1
  void load()
}

function openDrawer(row: Record<string, unknown>) {
  selected.value = row as unknown as AdminCommentItem
  drawerVisible.value = true
}

async function review(row: Record<string, unknown>, decision: 'approve' | 'reject') {
  const item = row as unknown as AdminCommentItem
  try {
    let reason = ''
    if (decision === 'reject') {
      const input = await ElMessageBox.prompt('请填写驳回理由', '驳回评论', {
        inputValidator: (value: string) => value.trim().length > 0 || '驳回理由必填'
      })
      reason = input.value
    }
    await moderationApi.reviewComment(item.id, decision, reason || undefined)
    ElMessage.success(decision === 'approve' ? '已通过' : '已驳回')
    drawerVisible.value = false
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

.drawer-row {
  margin: 0 0 var(--space-1);
  font-size: var(--text-body-s);
}

.drawer-content {
  margin-top: var(--space-3);
  padding: var(--space-3);
  background: var(--surface-050);
  border-radius: var(--radius-sm);
  white-space: pre-wrap;
  line-height: 1.8;
}

.drawer-actions {
  display: flex;
  gap: var(--space-2);
  margin-top: var(--space-4);
}
</style>
