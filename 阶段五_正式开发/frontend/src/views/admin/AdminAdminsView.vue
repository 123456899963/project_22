<template>
  <div>
    <div class="admin-head">
      <div>
        <h1 class="admin-title">管理员白名单</h1>
        <p class="mm-muted">仅超级管理员可维护；至少保留 1 名超管。</p>
      </div>
      <div class="admin-head__actions">
        <el-button type="primary" @click="openAdd">新增管理员</el-button>
      </div>
    </div>

    <p v-if="error" class="mm-error">{{ error }}</p>

    <el-table v-loading="loading" :data="items" border stripe>
      <el-table-column prop="id" label="ID" width="80" />
      <el-table-column prop="openidMasked" label="openid（脱敏）" min-width="200" />
      <el-table-column prop="role" label="角色" width="110">
        <template #default="{ row }">
          <el-tag :type="row.role === 'super' ? 'danger' : 'warning'" size="small">{{ row.role }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="note" label="备注" min-width="200" show-overflow-tooltip />
      <el-table-column prop="createdAt" label="加入时间" width="180">
        <template #default="{ row }">{{ formatDateTime(row.createdAt) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="100" fixed="right">
        <template #default="{ row }">
          <el-button size="small" type="danger" @click="remove(row)">移除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="dialogVisible" title="新增管理员" width="480px">
      <div class="form">
        <el-input v-model="form.openid" placeholder="微信 openid（1～64 字）" />
        <el-select v-model="form.role" style="width: 100%">
          <el-option label="管理员 admin" value="admin" />
          <el-option label="超级管理员 super" value="super" />
        </el-select>
        <el-input v-model="form.note" placeholder="备注（可选，≤200 字）" maxlength="200" />
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
import { onMounted, reactive, ref } from 'vue'
import { ElButton, ElDialog, ElInput, ElMessage, ElMessageBox, ElOption, ElSelect, ElTable, ElTableColumn, ElTag } from 'element-plus'
import { ApiError } from '@/api/http'
import { accountApi, type WhitelistItem } from '@/modules/account'
import { formatDateTime } from '@/utils/datetime'

const items = ref<WhitelistItem[]>([])
const loading = ref(false)
const error = ref('')
const dialogVisible = ref(false)
const submitting = ref(false)
const formError = ref('')
const form = reactive({ openid: '', role: 'admin', note: '' })

async function load() {
  loading.value = true
  error.value = ''
  try {
    items.value = await accountApi.admins()
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : '白名单加载失败'
  } finally {
    loading.value = false
  }
}

function openAdd() {
  form.openid = ''
  form.role = 'admin'
  form.note = ''
  formError.value = ''
  dialogVisible.value = true
}

async function submit() {
  formError.value = ''
  if (!form.openid.trim()) {
    formError.value = 'openid 必填'
    return
  }
  submitting.value = true
  try {
    await accountApi.addAdmin({
      openid: form.openid.trim(),
      role: form.role,
      note: form.note.trim() || undefined
    })
    ElMessage.success('已新增')
    dialogVisible.value = false
    await load()
  } catch (e) {
    formError.value = e instanceof ApiError ? e.message : '新增失败'
  } finally {
    submitting.value = false
  }
}

async function remove(row: Record<string, unknown>) {
  const item = row as unknown as WhitelistItem
  const confirmed = await ElMessageBox.confirm(`确认移除管理员 #${item.id}？`, '移除白名单', { type: 'warning' })
    .then(() => true)
    .catch(() => false)
  if (!confirmed) {
    return
  }
  try {
    await accountApi.removeAdmin(item.id)
    ElMessage.success('已移除')
    await load()
  } catch (e) {
    ElMessage.error(e instanceof ApiError ? e.message : '移除失败')
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

.form {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
</style>
