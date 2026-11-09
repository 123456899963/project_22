<template>
  <div class="mm-container login-page">
    <div class="login-card mm-card">
      <h1 class="login-title">{{ isAdminLogin ? '后台登录' : '登录茗脉' }}</h1>
      <p class="mm-muted login-subtitle">
        {{ isAdminLogin ? '仅白名单管理员可进入后台。' : '使用微信扫码登录，收藏、投稿与短评需要登录。' }}
      </p>

      <section class="login-section">
        <h2 class="login-section__title">微信扫码</h2>
        <div class="qr-box">
          <p v-if="qrContent" class="qr-content">{{ qrContent }}</p>
          <p v-else class="mm-muted">点击生成登录二维码</p>
          <p class="mm-muted">状态：{{ qrStatusLabel }}</p>
        </div>
        <button class="mm-button mm-button--ghost" type="button" @click="loadQr">刷新二维码</button>
      </section>

      <section class="login-section">
        <h2 class="login-section__title">开发/测试登录</h2>
        <p class="mm-muted">仅本地联调使用；生产环境由后端关闭该入口。</p>
        <form class="dev-form" @submit.prevent="submitDev">
          <label class="field">
            <span>openid</span>
            <input v-model="openid" class="mm-input" placeholder="请输入开发环境 openid" required />
          </label>
          <label class="field">
            <span>昵称</span>
            <input v-model="nickname" class="mm-input" placeholder="茶友" maxlength="20" required />
          </label>
          <button class="mm-button" type="submit" :disabled="auth.loading">{{ auth.loading ? '登录中…' : '登录' }}</button>
          <p v-if="error" class="mm-error">{{ error }}</p>
        </form>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ApiError, http } from '@/api/http'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const openid = ref('')
const nickname = ref('茶友')
const error = ref('')
const qrContent = ref('')
const qrStatus = ref('pending')
const ticket = ref('')
let timer: number | undefined

const isAdminLogin = computed(() => Boolean(route.meta.admin))

const qrStatusLabel = computed(() => {
  const labels: Record<string, string> = {
    pending: '等待扫码',
    scanned: '已扫码，请在微信中确认',
    confirmed: '已确认，正在登录',
    expired: '已过期，请刷新'
  }
  return labels[qrStatus.value] ?? qrStatus.value
})

async function loadQr() {
  error.value = ''
  try {
    const data = await http.post<{ ticket: string; qrContent: string; expiresIn: number }>('/auth/qrcode')
    ticket.value = data.ticket
    qrContent.value = data.qrContent
    qrStatus.value = 'pending'
    startPolling()
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : '二维码生成失败'
  }
}

function startPolling() {
  stopPolling()
  timer = window.setInterval(async () => {
    if (!ticket.value) {
      return
    }
    try {
      const data = await http.get<{ status: string }>(`/auth/qrcode/${ticket.value}`)
      qrStatus.value = data.status
      if (data.status === 'expired') {
        stopPolling()
      }
    } catch {
      stopPolling()
    }
  }, 2000)
}

function stopPolling() {
  if (timer !== undefined) {
    window.clearInterval(timer)
    timer = undefined
  }
}

async function submitDev() {
  error.value = ''
  try {
    await auth.loginDev(openid.value.trim(), nickname.value.trim())
    const redirect = String(route.query.redirect ?? (isAdminLogin.value ? '/admin' : '/me'))
    router.push(redirect)
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : '登录失败'
  }
}

onMounted(() => {
  void loadQr()
})

onUnmounted(() => {
  stopPolling()
})
</script>

<style scoped>
.login-page {
  display: flex;
  justify-content: center;
  padding: var(--space-7) var(--space-4);
}

.login-card {
  width: min(520px, 100%);
  padding: var(--space-6);
}

.login-title {
  font-size: var(--text-h1);
  margin-bottom: var(--space-1);
}

.login-subtitle {
  margin: 0 0 var(--space-5);
}

.login-section {
  padding-top: var(--space-4);
  border-top: 1px solid var(--line-200);
}

.login-section + .login-section {
  margin-top: var(--space-4);
}

.login-section__title {
  font-size: var(--text-h3);
  margin-bottom: var(--space-2);
}

.qr-box {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  padding: var(--space-3);
  margin-bottom: var(--space-3);
  border-radius: var(--radius-sm);
  background: var(--surface-100);
  min-height: 96px;
  justify-content: center;
}

.qr-content {
  margin: 0;
  font-family: var(--font-mono);
  font-size: var(--text-caption);
  word-break: break-all;
}

.dev-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  margin-top: var(--space-3);
}

.field {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  font-size: var(--text-label, 14px);
  color: var(--ink-700);
}
</style>
