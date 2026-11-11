<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import AuthCard from '@/components/auth/AuthCard.vue'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const form = reactive({
  username: '',
  password: '',
})

const errors = reactive<{ username?: string; password?: string; form?: string }>({})
const submitting = ref(false)

function validate(): boolean {
  errors.username = undefined
  errors.password = undefined
  errors.form = undefined

  if (!form.username.trim()) {
    errors.username = '请输入用户名'
  }
  if (!form.password) {
    errors.password = '请输入密码'
  }
  return !errors.username && !errors.password
}

async function onSubmit() {
  if (!validate()) return
  submitting.value = true
  try {
    await userStore.login({ username: form.username.trim(), password: form.password })
    // 登录成功后跳回来源页或首页
    const redirect = (route.query.redirect as string) || '/'
    router.push(redirect)
  } catch {
    // 401 用户名或密码错误（后端统一提示，不区分）
    errors.form = '用户名或密码错误'
  } finally {
    submitting.value = false
  }
}

function goRegister() {
  router.push({
    path: '/register',
    query: route.query.redirect ? { redirect: route.query.redirect as string } : {},
  })
}

function onPasswordInput() {
  errors.password = undefined
  errors.form = undefined
}
</script>

<template>
  <AuthCard title="登录" desc="欢迎回来，请登录您的账号">
    <form class="auth-form" @submit.prevent="onSubmit" novalidate>
      <div class="form-group">
        <label class="form-label" for="login-username">用户名</label>
        <input
          id="login-username"
          v-model.trim="form.username"
          type="text"
          class="form-input"
          :class="{ 'form-input--error': errors.username }"
          placeholder="请输入用户名"
          autocomplete="username"
          @input="errors.username = undefined"
        />
        <div v-if="errors.username" class="form-hint form-hint--error">{{ errors.username }}</div>
      </div>

      <div class="form-group">
        <label class="form-label" for="login-password">密码</label>
        <input
          id="login-password"
          v-model="form.password"
          type="password"
          class="form-input"
          :class="{ 'form-input--error': errors.password }"
          placeholder="请输入密码"
          autocomplete="current-password"
          @input="onPasswordInput"
        />
        <div v-if="errors.password" class="form-hint form-hint--error">{{ errors.password }}</div>
      </div>

      <div v-if="errors.form" class="form-error-bar">{{ errors.form }}</div>

      <button type="submit" class="btn btn--primary btn--block" :disabled="submitting">
        {{ submitting ? '登录中…' : '登录' }}
      </button>
    </form>

    <template #foot>
      还没有账号？
      <a class="auth-card__link" @click="goRegister">立即注册</a>
    </template>
  </AuthCard>
</template>
