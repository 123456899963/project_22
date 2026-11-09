<template>
  <div class="mm-container mm-page settings">
    <h1 class="mm-title">账号设置</h1>

    <section class="mm-card settings-block">
      <h2 class="settings-title">资料</h2>
      <div class="settings-row">
        <span class="settings-avatar">{{ initial }}</span>
        <div class="settings-fields">
          <label class="settings-label" for="nickname">昵称（2～20 字）</label>
          <input id="nickname" v-model.trim="nickname" class="settings-input" maxlength="20" />
          <label class="settings-label" for="avatar">头像地址（可选）</label>
          <input id="avatar" v-model.trim="avatarUrl" class="settings-input" placeholder="/uploads/..." maxlength="500" />
        </div>
      </div>
      <p v-if="saveError" class="mm-error">{{ saveError }}</p>
      <button class="mm-button" type="button" :disabled="saving" @click="save">
        {{ saving ? '保存中…' : '保存' }}
      </button>
    </section>

    <section class="mm-card settings-block">
      <h2 class="settings-title">账号状态</h2>
      <p class="settings-status">当前：{{ statusLabel }}</p>
      <p class="mm-muted">{{ statusHint }}</p>
      <template v-if="status === 'deleting'">
        <p class="mm-muted">注销冷静期内账号仅可浏览，撤销后恢复全部功能。</p>
        <button class="mm-button mm-button--ghost" type="button" :disabled="deleting" @click="cancelDeletion">
          撤销注销
        </button>
      </template>
      <template v-else>
        <p class="mm-muted">注销后账号进入 7 天冷静期，期间可撤销；到期后资料与互动数据将按隐私政策删除。</p>
        <button class="danger-link" type="button" :disabled="deleting" @click="requestDeletion">申请注销账号</button>
      </template>
      <p v-if="deletionError" class="mm-error">{{ deletionError }}</p>
    </section>

    <section class="mm-card settings-block">
      <h2 class="settings-title">协议</h2>
      <router-link to="/about" class="settings-link">查看隐私政策、用户协议与免责声明</router-link>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ApiError } from '@/api/http'
import { accountApi } from '@/modules/account'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()

const nickname = ref('')
const avatarUrl = ref('')
const saving = ref(false)
const saveError = ref('')
const deleting = ref(false)
const deletionError = ref('')

const initial = computed(() => (auth.user?.nickname ?? '茶').slice(0, 1))
const status = computed(() => auth.user?.status ?? 'active')
const statusLabels: Record<string, string> = {
  active: '正常',
  deleting: '注销冷静期',
  deleted: '已注销',
  muted: '禁言中',
  banned: '已封禁'
}
const statusLabel = computed(() => statusLabels[status.value] ?? status.value)
const statusHint = computed(() => {
  if (status.value === 'muted') {
    return '禁言期间可浏览茶品与查看消息，但不可发表评论、投稿、举报。'
  }
  if (status.value === 'banned') {
    return '封禁期间无法登录互动功能，如有异议可通过申诉流程处理。'
  }
  return '正常状态可使用收藏、评论、投稿与举报等功能。'
})

async function save() {
  saveError.value = ''
  if (nickname.value.length < 2 || nickname.value.length > 20) {
    saveError.value = '昵称长度需为 2～20 字'
    return
  }
  saving.value = true
  try {
    await accountApi.updateProfile({
      nickname: nickname.value,
      avatarUrl: avatarUrl.value || undefined
    })
    await auth.fetchProfile()
  } catch (e) {
    saveError.value = e instanceof ApiError ? e.message : '保存失败'
  } finally {
    saving.value = false
  }
}

async function requestDeletion() {
  deletionError.value = ''
  const confirmed = window.confirm('确认申请注销账号？注销后进入 7 天冷静期，期间可撤销。')
  if (!confirmed) {
    return
  }
  deleting.value = true
  try {
    await accountApi.requestDeletion()
    await auth.fetchProfile()
  } catch (e) {
    deletionError.value = e instanceof ApiError ? e.message : '申请失败'
  } finally {
    deleting.value = false
  }
}

async function cancelDeletion() {
  deletionError.value = ''
  deleting.value = true
  try {
    await accountApi.cancelDeletion()
    await auth.fetchProfile()
  } catch (e) {
    deletionError.value = e instanceof ApiError ? e.message : '撤销失败'
  } finally {
    deleting.value = false
  }
}

onMounted(async () => {
  if (!auth.user) {
    await auth.fetchProfile().catch(() => undefined)
  }
  nickname.value = auth.user?.nickname ?? ''
  avatarUrl.value = auth.user?.avatarUrl ?? ''
})
</script>

<style scoped>
.settings {
  max-width: 720px;
}

.settings-block {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-4);
  margin-bottom: var(--space-4);
}

.settings-title {
  font-size: var(--text-body-l);
  margin: 0;
}

.settings-row {
  display: flex;
  gap: var(--space-4);
  align-items: flex-start;
}

.settings-avatar {
  display: grid;
  width: 64px;
  height: 64px;
  flex: none;
  place-items: center;
  border-radius: 50%;
  background: var(--tea-900);
  color: var(--white);
  font-family: var(--font-serif);
  font-size: var(--text-h2);
}

.settings-fields {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.settings-label {
  font-size: var(--text-body-s);
  color: var(--ink-600);
}

.settings-input {
  padding: var(--space-2);
  border: 1px solid var(--line-200);
  border-radius: var(--radius-sm);
  font: inherit;
}

.settings-status {
  margin: 0;
  font-weight: 600;
}

.settings-link {
  color: var(--tea-800);
}

.danger-link {
  align-self: flex-start;
  border: none;
  background: none;
  padding: 0;
  color: var(--danger-500, #c0392b);
  cursor: pointer;
  text-decoration: underline;
}
</style>
