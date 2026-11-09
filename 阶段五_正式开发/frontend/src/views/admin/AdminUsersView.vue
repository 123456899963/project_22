<template>
  <div>
    <div class="admin-head">
      <div>
        <h1 class="admin-title">用户管理</h1>
        <p class="mm-muted">禁言限制互动写操作；封禁同时吊销登录令牌。</p>
      </div>
      <div class="admin-head__actions">
        <el-input v-model="keyword" placeholder="用户 ID 或昵称" clearable style="width: 200px" @keyup.enter="reload" />
        <el-select v-model="sanctionStatus" clearable placeholder="处罚状态" style="width: 150px" @change="reload">
          <el-option label="禁言中" value="mute" />
          <el-option label="已封禁" value="ban" />
        </el-select>
        <el-button type="primary" @click="reload">查询</el-button>
      </div>
    </div>

    <p v-if="error" class="mm-error">{{ error }}</p>

    <el-table v-loading="loading" :data="items" border stripe>
      <el-table-column prop="id" label="ID" width="80" />
      <el-table-column prop="nickname" label="昵称" min-width="160" />
      <el-table-column prop="status" label="账号状态" width="120" />
      <el-table-column label="处罚" width="120">
        <template #default="{ row }">
          <el-tag v-if="row.sanctionStatus === 'ban'" type="danger" size="small">封禁</el-tag>
          <el-tag v-else-if="row.sanctionStatus === 'mute'" type="warning" size="small">禁言</el-tag>
          <span v-else class="mm-muted">—</span>
        </template>
      </el-table-column>
      <el-table-column prop="registeredAt" label="注册时间" width="180">
        <template #default="{ row }">{{ formatDateTime(row.registeredAt) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="160" fixed="right">
        <template #default="{ row }">
          <el-button size="small" @click="openSanctions(row)">处罚记录</el-button>
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

    <el-dialog v-model="dialogVisible" :title="selected ? `用户 #${selected.id} · ${selected.nickname}` : '处罚记录'" width="640px">
      <el-table v-loading="sanctionLoading" :data="sanctions" border size="small">
        <el-table-column prop="type" label="类型" width="80">
          <template #default="{ row }">{{ row.type === 'ban' ? '封禁' : '禁言' }}</template>
        </el-table-column>
        <el-table-column prop="reason" label="理由" min-width="160" show-overflow-tooltip />
        <el-table-column prop="startAt" label="开始" width="170">
          <template #default="{ row }">{{ formatDateTime(row.startAt) }}</template>
        </el-table-column>
        <el-table-column prop="endAt" label="结束" width="170">
          <template #default="{ row }">{{ row.endAt ? formatDateTime(row.endAt) : '长期' }}</template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="90" />
        <el-table-column label="操作" width="90">
          <template #default="{ row }">
            <el-button v-if="row.status === 'active'" size="small" type="danger" @click="revoke(row)">解除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="sanction-form">
        <h3 class="sanction-form__title">新增处罚</h3>
        <div class="sanction-form__row">
          <el-select v-model="form.type" style="width: 120px">
            <el-option label="禁言" value="mute" />
            <el-option label="封禁" value="ban" />
          </el-select>
          <el-date-picker
            v-model="form.endAt"
            type="datetime"
            placeholder="结束时间（可空=长期）"
            value-format="YYYY-MM-DDTHH:mm:ss"
            :disabled="form.type === 'ban'"
          />
        </div>
        <el-input v-model="form.reason" type="textarea" :rows="3" maxlength="300" show-word-limit placeholder="处罚理由（必填，≤300 字）" />
        <p v-if="formError" class="mm-error">{{ formError }}</p>
      </div>

      <template #footer>
        <el-button @click="dialogVisible = false">关闭</el-button>
        <el-button type="danger" :loading="submitting" @click="createSanction">提交处罚</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import {
  ElButton,
  ElDatePicker,
  ElDialog,
  ElInput,
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
import { moderationApi, type AdminUserItem, type SanctionItem } from '@/modules/moderation'
import { formatDateTime } from '@/utils/datetime'

const items = ref<AdminUserItem[]>([])
const keyword = ref('')
const sanctionStatus = ref('')
const page = ref(1)
const size = ref(12)
const total = ref(0)
const loading = ref(false)
const error = ref('')

const dialogVisible = ref(false)
const selected = ref<AdminUserItem | null>(null)
const sanctions = ref<SanctionItem[]>([])
const sanctionLoading = ref(false)
const submitting = ref(false)
const formError = ref('')
const form = reactive<{ type: 'mute' | 'ban'; reason: string; endAt: string }>({
  type: 'mute',
  reason: '',
  endAt: ''
})

async function load() {
  loading.value = true
  error.value = ''
  try {
    const data = await moderationApi.users({
      keyword: keyword.value || undefined,
      sanctionStatus: sanctionStatus.value || undefined,
      page: page.value,
      size: size.value
    })
    items.value = data.items
    total.value = data.total
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : '用户列表加载失败'
  } finally {
    loading.value = false
  }
}

function reload() {
  page.value = 1
  void load()
}

async function openSanctions(row: Record<string, unknown>) {
  const user = row as unknown as AdminUserItem
  selected.value = user
  dialogVisible.value = true
  form.type = 'mute'
  form.reason = ''
  form.endAt = ''
  formError.value = ''
  sanctionLoading.value = true
  try {
    sanctions.value = await moderationApi.sanctions(user.id)
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : '处罚记录加载失败'
  } finally {
    sanctionLoading.value = false
  }
}

async function createSanction() {
  if (!selected.value) {
    return
  }
  formError.value = ''
  if (!form.reason.trim()) {
    formError.value = '处罚理由必填'
    return
  }
  submitting.value = true
  try {
    await moderationApi.createSanction(selected.value.id, {
      type: form.type,
      reason: form.reason.trim(),
      endAt: form.type === 'mute' ? form.endAt || undefined : undefined
    })
    ElMessage.success('处罚已生效')
    form.reason = ''
    sanctions.value = await moderationApi.sanctions(selected.value.id)
    await load()
  } catch (e) {
    formError.value = e instanceof ApiError ? e.message : '处罚提交失败'
  } finally {
    submitting.value = false
  }
}

async function revoke(row: Record<string, unknown>) {
  const sanction = row as unknown as SanctionItem
  if (!selected.value) {
    return
  }
  try {
    const input = await ElMessageBox.prompt('请填写解除原因（可空）', '解除处罚', {
      inputPlaceholder: '管理员解除处罚'
    })
    await moderationApi.revokeSanction(selected.value.id, sanction.id, input.value)
    ElMessage.success('已解除')
    sanctions.value = await moderationApi.sanctions(selected.value.id)
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
  flex-wrap: wrap;
}

.pager {
  display: flex;
  justify-content: flex-end;
  padding-top: var(--space-4);
}

.sanction-form {
  margin-top: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.sanction-form__title {
  margin: 0;
  font-size: var(--text-body-m);
}

.sanction-form__row {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
}
</style>
