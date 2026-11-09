<template>
  <div>
    <div class="admin-head">
      <h1 class="admin-title">批量导入</h1>
    </div>

    <section class="mm-card gap-card">
      <h2 class="gap-title">三步导入</h2>
      <ol class="gap-list">
        <li>下载模板，按列填写茶品信息（单次 ≤500 行，UTF-8 CSV）。</li>
        <li>上传后系统逐行校验；非法行会列出错误原因，修正后重新上传。</li>
        <li>校验全部通过（状态 `ready`）后才可确认导入；导入仅生成草稿。</li>
      </ol>

      <div class="import-actions">
        <button class="mm-button mm-button--ghost" type="button" @click="downloadTemplate">下载模板</button>
        <input
          ref="fileInput"
          type="file"
          accept=".csv,text/csv"
          :disabled="uploading"
          @change="onUpload"
        />
      </div>
      <p v-if="uploading" class="mm-muted">正在上传并校验…</p>
      <p v-if="error" class="mm-error">{{ error }}</p>
    </section>

    <section v-if="task" class="mm-card gap-card">
      <h2 class="gap-title">任务 #{{ task.id }} · {{ statusLabel(task.status) }}</h2>
      <div class="task-grid">
        <span>文件：{{ task.fileName }}</span>
        <span>总行数：{{ task.totalRows }}</span>
        <span>可导入：{{ task.successRows }}</span>
        <span>错误行：{{ task.errorRows }}</span>
      </div>

      <div v-if="errors.length" class="errors-block">
        <h3 class="gap-title">错误行清单</h3>
        <el-table :data="errors" border size="small">
          <el-table-column prop="rowNo" label="行号" width="90" />
          <el-table-column prop="columnName" label="列" width="160" />
          <el-table-column prop="errorMsg" label="原因" min-width="240" />
        </el-table>
      </div>

      <div v-if="task.status === 'ready'" class="import-actions">
        <button class="mm-button" type="button" :disabled="confirming" @click="confirmImport">
          {{ confirming ? '正在导入…' : '确认导入' }}
        </button>
      </div>
      <p v-if="task.status === 'completed'" class="mm-muted">导入完成，草稿已生成，请在茶品列表中补齐图片与标签后提交审核。</p>
    </section>

    <section class="mm-card gap-card">
      <h2 class="gap-title">导入规则</h2>
      <ul class="gap-list">
        <li>重复茶名或茶码按“覆盖草稿”处理；已上架茶品不覆盖，需走修订。</li>
        <li>导入仅生成草稿，图片与五维标签仍需在后台补齐后才能提交审核。</li>
        <li>导入失败行单独列出原因，不阻塞其余行修正后重传。</li>
      </ul>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ElTable, ElTableColumn } from 'element-plus'
import { ApiError, TOKEN_KEY } from '@/api/http'
import {
  moderationApi,
  type ImportRowErrorItem,
  type ImportTaskItem
} from '@/modules/moderation'

const task = ref<ImportTaskItem | null>(null)
const errors = ref<ImportRowErrorItem[]>([])
const uploading = ref(false)
const confirming = ref(false)
const error = ref('')
const fileInput = ref<HTMLInputElement | null>(null)

const STATUS_LABELS: Record<string, string> = {
  validating: '校验中',
  validation_failed: '校验未通过',
  ready: '可导入',
  importing: '导入中',
  completed: '已完成',
  failed: '导入失败'
}

function statusLabel(status: string) {
  return STATUS_LABELS[status] ?? status
}

async function downloadTemplate() {
  error.value = ''
  try {
    const token = localStorage.getItem(TOKEN_KEY)
    const response = await fetch('/api/v1/admin/imports/template', {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    })
    if (!response.ok) {
      throw new Error('模板下载失败')
    }
    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'tea-import-template.csv'
    link.click()
    URL.revokeObjectURL(url)
  } catch (e) {
    error.value = e instanceof Error ? e.message : '模板下载失败'
  }
}

async function onUpload(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) {
    return
  }
  uploading.value = true
  confirming.value = false
  error.value = ''
  errors.value = []
  task.value = null
  try {
    const form = new FormData()
    form.append('file', file)
    task.value = await moderationApi.createImport(form)
    if (task.value.status === 'validation_failed') {
      errors.value = await moderationApi.importErrors(task.value.id)
    }
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : '上传失败，请重试'
  } finally {
    uploading.value = false
    input.value = ''
  }
}

async function confirmImport() {
  if (!task.value) {
    return
  }
  confirming.value = true
  error.value = ''
  try {
    task.value = await moderationApi.confirmImport(task.value.id)
    errors.value = []
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : '确认导入失败'
  } finally {
    confirming.value = false
  }
}
</script>

<style scoped>
.admin-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-4);
}

.admin-title {
  margin: 0;
  font-size: var(--text-title-2);
}

.gap-card {
  padding: var(--space-4);
  margin-bottom: var(--space-4);
}

.gap-title {
  margin: 0 0 var(--space-2);
  font-size: var(--text-title-3);
}

.gap-list {
  margin: 0;
  padding-left: var(--space-4);
  color: var(--ink-700);
  line-height: 1.8;
}

.import-actions {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin-top: var(--space-3);
  flex-wrap: wrap;
}

.task-grid {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-4);
  color: var(--ink-700);
}

.errors-block {
  margin-top: var(--space-4);
}
</style>
