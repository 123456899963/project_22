<script setup lang="ts">
/**
 * 管理员审核后台（S12）：提交队列 + 详情预览 + 通过 / 拒绝（预设理由）。
 * 两个对话框拆在 views/admin/components 下，页面只保留列表与操作编排。
 */
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { approveContribution, getAdminContributions } from '@/api/admin'
import type {
  ContributionItem,
  ContributionListData,
  ContributionStatus,
  ContributionType,
} from '@/types'
import ContributionDetailDialog from './components/ContributionDetailDialog.vue'
import RejectReasonDialog from './components/RejectReasonDialog.vue'

const state = ref<'loading' | 'ready' | 'error'>('loading')
const data = ref<ContributionListData>({ items: [], total: 0, page: 1, page_size: 10 })
const filters = reactive<{ status: ContributionStatus; type: ContributionType | '' }>({
  status: 'pending',
  type: '',
})
const page = ref(1)
const pageSize = ref(10)
const acting = ref(false)

const detailVisible = ref(false)
const activeItem = ref<ContributionItem | null>(null)

const rejectVisible = ref(false)
const rejectTarget = ref<ContributionItem | null>(null)

function formatDate(value: string | null): string {
  if (!value) return '—'
  return new Date(value).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })
}

function rowSummary(item: ContributionItem): string {
  if (item.type === 'new_tea') {
    const name = item.payload?.name
    return typeof name === 'string' ? name : '未命名茶品'
  }
  const title = item.payload?.title
  return (typeof title === 'string' && title.trim()) || item.target_tea_name || '科普投稿'
}

async function load() {
  state.value = 'loading'
  try {
    const res = await getAdminContributions({
      status: filters.status,
      type: filters.type || undefined,
      page: page.value,
      page_size: pageSize.value,
    })
    data.value = res.data
    state.value = 'ready'
  } catch {
    state.value = 'error'
  }
}

function resetAndLoad() {
  page.value = 1
  void load()
}

function openDetail(row: ContributionItem) {
  activeItem.value = row
  detailVisible.value = true
}

async function approve(row: ContributionItem) {
  try {
    await ElMessageBox.confirm(`确认通过「${rowSummary(row)}」？`, '审核通过', {
      confirmButtonText: '通过',
      cancelButtonText: '取消',
      type: 'success',
    })
  } catch {
    // 用户取消，直接返回（避免未处理的 Promise 拒绝）
    return
  }

  acting.value = true
  try {
    await approveContribution(row.id)
    ElMessage.success('已通过审核')
    void load()
  } finally {
    acting.value = false
  }
}

function approveActive() {
  if (activeItem.value) void approve(activeItem.value)
}

function rejectActive() {
  if (!activeItem.value) return
  rejectTarget.value = activeItem.value
  rejectVisible.value = true
}

function openReject(row: ContributionItem) {
  rejectTarget.value = row
  rejectVisible.value = true
}

onMounted(load)
</script>

<template>
  <section class="contrib-admin">
    <header class="contrib-admin__head">
      <div>
        <h1 class="contrib-admin__title">投稿审核</h1>
        <p class="text-small text-muted">
          用户提交的新茶与科普先经系统校验，再由管理员人工审核。
        </p>
      </div>
      <div class="contrib-admin__filters">
        <el-select v-model="filters.status" size="small" @change="resetAndLoad">
          <el-option label="待审核" value="pending" />
          <el-option label="已通过" value="approved" />
          <el-option label="已拒绝" value="rejected" />
        </el-select>
        <el-select v-model="filters.type" size="small" clearable placeholder="全部类型" @change="resetAndLoad">
          <el-option label="补充新茶" value="new_tea" />
          <el-option label="科普投稿" value="article" />
        </el-select>
      </div>
    </header>

    <el-table v-loading="state === 'loading'" :data="data.items" border stripe>
      <el-table-column prop="id" label="ID" width="80" />
      <el-table-column label="类型" width="110">
        <template #default="{ row }">
          {{ row.type === 'new_tea' ? '补充新茶' : '科普投稿' }}
        </template>
      </el-table-column>
      <el-table-column prop="username" label="提交人" width="140" />
      <el-table-column label="摘要" min-width="200">
        <template #default="{ row }">
          {{ rowSummary(row) }}
        </template>
      </el-table-column>
      <el-table-column label="状态" width="100">
        <template #default="{ row }">
          <el-tag
            size="small"
            :type="row.status === 'pending' ? 'warning' : row.status === 'approved' ? 'success' : 'danger'"
          >
            {{ row.status === 'pending' ? '待审核' : row.status === 'approved' ? '已通过' : '已拒绝' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="提交时间" width="180">
        <template #default="{ row }">{{ formatDate(row.created_at) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="260" fixed="right">
        <template #default="{ row }">
          <el-button size="small" @click="openDetail(row)">详情</el-button>
          <template v-if="row.status === 'pending'">
            <el-button size="small" type="success" :disabled="acting" @click="approve(row)">
              通过
            </el-button>
            <el-button size="small" type="danger" :disabled="acting" @click="openReject(row)">
              拒绝
            </el-button>
          </template>
        </template>
      </el-table-column>
      <template #empty>
        <div class="contrib-admin__empty">
          {{ state === 'error' ? '加载失败，请刷新重试' : '当前筛选下暂无提交' }}
        </div>
      </template>
    </el-table>

    <div class="contrib-admin__pager">
      <el-pagination
        v-model:current-page="page"
        v-model:page-size="pageSize"
        :total="data.total"
        :page-sizes="[10, 20, 50]"
        layout="total, sizes, prev, pager, next"
        @current-change="load"
        @size-change="resetAndLoad"
      />
    </div>

    <!-- 详情预览 / 拒绝理由 -->
    <ContributionDetailDialog
      v-model="detailVisible"
      :item="activeItem"
      :acting="acting"
      @approve="approveActive"
      @reject="rejectActive"
    />
    <RejectReasonDialog
      v-model="rejectVisible"
      :item="rejectTarget"
      @submitted="load"
    />
  </section>
</template>

<style scoped>
.contrib-admin {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.contrib-admin__head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
}
.contrib-admin__title {
  font-size: var(--text-h2);
  color: var(--color-primary-dark);
}
.contrib-admin__filters {
  display: flex;
  gap: 12px;
}
.contrib-admin__pager {
  display: flex;
  justify-content: flex-end;
}
.contrib-admin__empty {
  padding: 24px;
  color: var(--color-text-muted);
}

/* 对话框样式分别在 components/ContributionDetailDialog 与 RejectReasonDialog 内 */
</style>
