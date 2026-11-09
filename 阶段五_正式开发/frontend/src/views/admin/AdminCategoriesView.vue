<template>
  <div>
    <div class="admin-head">
      <div>
        <h1 class="admin-title">茶类与亚类</h1>
        <p class="mm-muted">23 个亚类固定；内容建设中的亚类前台展示“内容建设中”。</p>
      </div>
      <el-button @click="load">刷新</el-button>
    </div>

    <p v-if="error" class="mm-error">{{ error }}</p>

    <el-table v-loading="loading" :data="rows" border stripe>
      <el-table-column prop="categoryName" label="茶类" width="120" />
      <el-table-column prop="code" label="亚类编码" width="140" />
      <el-table-column prop="name" label="亚类" min-width="140" />
      <el-table-column prop="teaCount" label="茶品数" width="100" />
      <el-table-column prop="sortOrder" label="排序" width="90" />
      <el-table-column label="内容状态" width="140">
        <template #default="{ row }">
          <el-tag :type="row.contentStatus === 'normal' ? 'success' : 'warning'" size="small">
            {{ row.contentStatus === 'normal' ? '正常' : '建设中' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="160" fixed="right">
        <template #default="{ row }">
          <el-button size="small" @click="toggle(row)">
            {{ row.contentStatus === 'normal' ? '标记建设中' : '标记正常' }}
          </el-button>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElButton, ElMessage, ElMessageBox, ElTable, ElTableColumn, ElTag } from 'element-plus'
import { ApiError } from '@/api/http'
import { moderationApi, type AdminCategoryItem } from '@/modules/moderation'

interface Row {
  id: number
  code: string
  name: string
  categoryName: string
  teaCount: number
  sortOrder: number
  contentStatus: 'normal' | 'constructing'
}

const categories = ref<AdminCategoryItem[]>([])
const loading = ref(false)
const error = ref('')

const rows = computed<Row[]>(() =>
  categories.value.flatMap((category) =>
    category.subcategories.map((sub) => ({
      id: sub.id,
      code: sub.code,
      name: sub.name,
      categoryName: category.name,
      teaCount: sub.teaCount,
      sortOrder: sub.sortOrder,
      contentStatus: sub.contentStatus
    }))
  )
)

async function load() {
  loading.value = true
  error.value = ''
  try {
    categories.value = await moderationApi.adminCategories()
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : '分类加载失败'
  } finally {
    loading.value = false
  }
}

async function toggle(row: Record<string, unknown>) {
  const target = row as unknown as Row
  const next = target.contentStatus === 'normal' ? 'constructing' : 'normal'
  const confirmed = await ElMessageBox.confirm(
    `确认将「${target.name}」标记为${next === 'normal' ? '正常' : '内容建设中'}？`,
    '切换内容状态',
    { type: 'warning' }
  )
    .then(() => true)
    .catch(() => false)
  if (!confirmed) {
    return
  }
  try {
    await moderationApi.patchSubcategory(target.id, next)
    ElMessage.success('已更新')
    await load()
  } catch (e) {
    ElMessage.error(e instanceof ApiError ? e.message : '更新失败')
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
</style>
