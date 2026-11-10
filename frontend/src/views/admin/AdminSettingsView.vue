<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { getAdminSettings, updateAdminSettings, type AdminSettingsItem } from '@/api/admin'

const loading = ref(false)
const saving = ref(false)
const items = ref<AdminSettingsItem[]>([])

const groups = computed(() => {
  const groups: { readonly: AdminSettingsItem[]; writable: AdminSettingsItem[] } = {
    readonly: [], writable: [],
  }
  let current: 'readonly' | 'writable' = 'readonly'
  for (const it of items.value) {
    if (it.key === '__readonly__') { current = 'readonly'; continue }
    if (it.key === '__writable__') { current = 'writable'; continue }
    groups[current].push(it)
  }
  return groups
})

async function load() {
  loading.value = true
  try {
    const res = await getAdminSettings()
    items.value = res.data.items
  } finally {
    loading.value = false
  }
}

async function save() {
  // 只提交可写项
  const payload = items.value.filter(
    (it) => !it.key.startsWith('__') && it.key !== 'tea_profile' && it.key !== 'session_expire_days',
  )
  if (payload.length === 0) return
  saving.value = true
  try {
    await updateAdminSettings(payload)
    ElMessage.success('配置已更新（进程重启后 .env 值会覆盖）')
  } finally {
    saving.value = false
  }
}

function editValue(key: string, value: string) {
  const target = items.value.find((it) => it.key === key)
  if (target) target.value = value
}

onMounted(load)
</script>

<template>
  <div v-loading="loading">
    <div class="page-head">
      <h2 class="text-h2">系统设置</h2>
      <el-button type="primary" :loading="saving" @click="save">保存修改</el-button>
    </div>

    <section class="panel">
      <h3 class="panel-title">运行环境（只读）</h3>
      <div class="settings-list">
        <div v-for="it in groups.readonly" :key="it.key" class="settings-row">
          <span class="settings-key">{{ it.key }}</span>
          <span class="settings-val text-muted">{{ it.value }}</span>
        </div>
      </div>
    </section>

    <section class="panel">
      <h3 class="panel-title">运行时可改（进程重启后恢复 .env 值）</h3>
      <div class="settings-list">
        <div v-for="it in groups.writable" :key="it.key" class="settings-row">
          <span class="settings-key">{{ it.key }}</span>
          <el-input
            :model-value="it.value"
            @update:model-value="(v) => editValue(it.key, v)"
            style="max-width: 200px"
          />
        </div>
      </div>
      <p class="text-small text-muted hint">
        注：TEA_SECRET_KEY / 数据库连接等敏感配置需在 <code>backend/.env</code> 修改后重启进程。
      </p>
    </section>
  </div>
</template>

<style scoped>
.page-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
.page-head h2 { margin: 0; }
.panel { margin-bottom: 20px; padding: 20px 24px; border: 1px solid var(--color-border); border-radius: var(--radius-md); background: var(--color-bg-surface); }
.panel-title { margin: 0 0 16px; font-size: var(--text-h3); }
.settings-list { display: flex; flex-direction: column; gap: 12px; }
.settings-row { display: flex; align-items: center; gap: 16px; }
.settings-key { width: 200px; font-family: var(--font-mono); font-size: var(--text-small); color: var(--color-text-secondary); }
.settings-val { font-family: var(--font-mono); }
.hint { margin: 12px 0 0; }
code { padding: 1px 6px; background: var(--color-bg-muted); border-radius: 4px; font-family: var(--font-mono); }
</style>
