<template>
  <div>
    <div class="admin-head">
      <div>
        <h1 class="admin-title">系统配置</h1>
        <p class="mm-muted">仅超级管理员可修改；每次修改写入配置日志与审计。</p>
      </div>
      <div class="admin-head__actions">
        <el-button @click="load">刷新</el-button>
        <el-button v-if="auth.isSuper" type="primary" :loading="saving" :disabled="!dirty" @click="save">保存修改</el-button>
      </div>
    </div>

    <p v-if="!auth.isSuper" class="mm-muted">当前账号为只读，修改需超级管理员权限。</p>
    <p v-if="error" class="mm-error">{{ error }}</p>

    <el-table v-loading="loading" :data="items" border stripe>
      <el-table-column prop="key" label="配置项" width="240" />
      <el-table-column prop="valueType" label="类型" width="90" />
      <el-table-column label="值" min-width="220">
        <template #default="{ row }">
          <el-input
            v-model="row.value"
            :disabled="!auth.isSuper || !row.editable"
            size="small"
            @input="markDirty(row.key, row.value)"
          />
        </template>
      </el-table-column>
      <el-table-column label="可改" width="80">
        <template #default="{ row }">
          <el-tag :type="row.editable ? 'success' : 'info'" size="small">{{ row.editable ? '可改' : '只读' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="description" label="说明" min-width="220" show-overflow-tooltip />
    </el-table>

    <p v-if="!items.length && !loading" class="mm-muted">暂无配置项。</p>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ElButton, ElInput, ElMessage, ElTable, ElTableColumn, ElTag } from 'element-plus'
import { ApiError } from '@/api/http'
import { moderationApi, type SettingsItem } from '@/modules/moderation'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const items = ref<SettingsItem[]>([])
const dirty = ref(false)
const loading = ref(false)
const saving = ref(false)
const error = ref('')
const changed = ref<Map<string, string>>(new Map())

async function load() {
  loading.value = true
  error.value = ''
  try {
    items.value = await moderationApi.settings()
    changed.value = new Map()
    dirty.value = false
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : '配置加载失败'
  } finally {
    loading.value = false
  }
}

function markDirty(key: string, value: string) {
  changed.value.set(key, value)
  dirty.value = true
}

async function save() {
  saving.value = true
  error.value = ''
  try {
    await moderationApi.updateSettings(Array.from(changed.value, ([key, value]) => ({ key, value })))
    ElMessage.success('配置已保存')
    await load()
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : '保存失败'
  } finally {
    saving.value = false
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
</style>
