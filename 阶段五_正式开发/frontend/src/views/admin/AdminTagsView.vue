<template>
  <div>
    <div class="admin-head">
      <div>
        <h1 class="admin-title">标签库</h1>
        <p class="mm-muted">标签受控入库，停用后不再出现在识茶与筛选结果。</p>
      </div>
      <div class="admin-head__actions">
        <el-select v-model="dimension" clearable placeholder="全部维度" style="width: 160px" @change="load">
          <el-option v-for="(label, value) in dimensionLabels" :key="value" :label="label" :value="value" />
        </el-select>
        <el-button type="primary" @click="openAdd">新增标签</el-button>
      </div>
    </div>

    <p v-if="error" class="mm-error">{{ error }}</p>

    <el-table v-loading="loading" :data="items" border stripe>
      <el-table-column prop="id" label="ID" width="80" />
      <el-table-column prop="dimension" label="维度" width="140">
        <template #default="{ row }">{{ dimensionLabels[row.dimension] ?? row.dimension }}</template>
      </el-table-column>
      <el-table-column prop="name" label="名称" min-width="180" />
      <el-table-column prop="status" label="状态" width="110">
        <template #default="{ row }">
          <el-tag :type="row.status === 'enabled' ? 'success' : 'info'" size="small">
            {{ row.status === 'enabled' ? '启用' : '停用' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="120" fixed="right">
        <template #default="{ row }">
          <el-button size="small" @click="toggle(row)">{{ row.status === 'enabled' ? '停用' : '启用' }}</el-button>
        </template>
      </el-table-column>
    </el-table>

    <p v-if="!items.length && !loading" class="mm-muted empty">暂无标签。</p>

    <el-dialog v-model="dialogVisible" title="新增标签" width="420px">
      <div class="form">
        <el-select v-model="form.dimension" style="width: 100%">
          <el-option v-for="(label, value) in dimensionLabels" :key="value" :label="label" :value="value" />
        </el-select>
        <el-input v-model="form.name" placeholder="标签名（≤32 字）" maxlength="32" />
        <p v-if="formError" class="mm-error">{{ formError }}</p>
      </div>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submit">确认新增</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { ElButton, ElDialog, ElInput, ElMessage, ElOption, ElSelect, ElTable, ElTableColumn, ElTag } from 'element-plus'
import { ApiError } from '@/api/http'
import { moderationApi, type TagItem } from '@/modules/moderation'

const dimensionLabels: Record<string, string> = {
  shape: '形态',
  color: '色泽',
  soup: '汤色',
  ferment: '发酵度',
  aroma: '香气'
}

const items = ref<TagItem[]>([])
const dimension = ref('')
const loading = ref(false)
const error = ref('')
const dialogVisible = ref(false)
const submitting = ref(false)
const formError = ref('')
const form = reactive({ dimension: 'aroma', name: '' })

async function load() {
  loading.value = true
  error.value = ''
  try {
    items.value = await moderationApi.tags({ dimension: dimension.value || undefined })
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : '标签加载失败'
  } finally {
    loading.value = false
  }
}

function openAdd() {
  form.dimension = dimension.value || 'aroma'
  form.name = ''
  formError.value = ''
  dialogVisible.value = true
}

async function submit() {
  formError.value = ''
  if (!form.name.trim()) {
    formError.value = '标签名必填'
    return
  }
  submitting.value = true
  try {
    await moderationApi.createTag({ dimension: form.dimension, name: form.name.trim() })
    ElMessage.success('已新增')
    dialogVisible.value = false
    await load()
  } catch (e) {
    formError.value = e instanceof ApiError ? e.message : '新增失败'
  } finally {
    submitting.value = false
  }
}

async function toggle(row: Record<string, unknown>) {
  const item = row as unknown as TagItem
  try {
    await moderationApi.updateTagStatus(item.id, item.status === 'enabled' ? 'disabled' : 'enabled')
    ElMessage.success('已更新')
    await load()
  } catch (e) {
    ElMessage.error(e instanceof ApiError ? e.message : '更新失败')
  }
}

load()
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

.empty {
  padding: var(--space-5) 0;
  text-align: center;
}

.form {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
</style>
