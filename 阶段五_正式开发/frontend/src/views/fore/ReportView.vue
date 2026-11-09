<template>
  <div class="mm-container mm-page report">
    <h1 class="mm-title">举报</h1>
    <p class="mm-muted">举报将在 48 小时内首次响应；同一对象仅可举报一次。</p>

    <section class="mm-card report-card">
      <h2 class="report-title">举报对象</h2>
      <p class="report-object">
        {{ objectLabel }}
        <span v-if="teaName" class="mm-muted"> · {{ teaName }}</span>
      </p>

      <label class="report-label">举报类型</label>
      <div class="report-types">
        <button
          v-for="option in reportTypes"
          :key="option"
          type="button"
          class="report-type"
          :class="{ active: reportType === option }"
          @click="reportType = option"
        >
          {{ option }}
        </button>
      </div>

      <label class="report-label" for="description">说明（必填，≤200 字）</label>
      <textarea
        id="description"
        v-model.trim="description"
        class="report-textarea"
        rows="5"
        maxlength="200"
        placeholder="请描述侵权或违规情况，便于我们核实"
      />
      <p class="mm-muted counter">{{ description.length }} / 200</p>

      <label class="report-check">
        <input v-model="truthful" type="checkbox" />
        我确认以上信息真实，理解恶意举报将被限制互动功能
      </label>

      <p v-if="error" class="mm-error">{{ error }}</p>
      <p v-if="success" class="report-success">已提交，48 小时内响应。</p>

      <div class="report-actions">
        <button class="mm-button" type="button" :disabled="submitting" @click="submit">
          {{ submitting ? '提交中…' : '提交举报' }}
        </button>
        <router-link to="/about" class="mm-muted">举报前请阅读用户协议</router-link>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ApiError, http } from '@/api/http'

const reportTypes = ['侵权', '不实', '违规', '其他']
const objectLabels: Record<string, string> = {
  image: '茶品图片',
  comment: '评论',
  user_shot: '用户实拍图'
}

const route = useRoute()
const router = useRouter()

const objectType = (route.query.objectType as string) || 'comment'
const objectId = Number(route.query.objectId ?? 0)
const teaId = route.query.teaId ? Number(route.query.teaId) : undefined
const teaName = (route.query.teaName as string) || ''

const reportType = ref('')
const description = ref('')
const truthful = ref(false)
const submitting = ref(false)
const error = ref('')
const success = ref(false)

const objectLabel = computed(() => {
  const label = objectLabels[objectType] ?? '内容'
  return `${label}${objectId ? ` #${objectId}` : '（对象缺失）'}`
})

async function submit() {
  error.value = ''
  success.value = false
  if (!objectId) {
    error.value = '举报对象缺失，请从详情页重新进入'
    return
  }
  if (!reportType.value) {
    error.value = '请选择举报类型'
    return
  }
  if (!description.value) {
    error.value = '请填写举报说明'
    return
  }
  if (!truthful.value) {
    error.value = '请确认信息真实'
    return
  }
  if (!window.confirm('确认提交举报？提交后不可重复举报同一对象。')) {
    return
  }
  submitting.value = true
  try {
    await http.post<number>('/reports', {
      objectType,
      objectId,
      teaId,
      reportType: reportType.value,
      description: description.value
    })
    success.value = true
    setTimeout(() => router.back(), 1200)
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : '提交失败，请稍后重试'
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.report {
  max-width: 640px;
}

.report-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-4);
}

.report-title {
  margin: 0;
  font-size: var(--text-body-l);
}

.report-object {
  margin: 0;
  font-weight: 600;
}

.report-label {
  margin-top: var(--space-2);
  font-size: var(--text-body-s);
  color: var(--ink-600);
}

.report-types {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.report-type {
  padding: var(--space-1) var(--space-3);
  border: 1px solid var(--line-200);
  border-radius: var(--radius-pill);
  background: var(--white);
  cursor: pointer;
  color: var(--ink-700);
}

.report-type.active {
  border-color: var(--tea-700);
  background: var(--tea-050);
  color: var(--tea-900);
}

.report-textarea {
  padding: var(--space-2);
  border: 1px solid var(--line-200);
  border-radius: var(--radius-sm);
  font: inherit;
  resize: vertical;
}

.counter {
  margin: 0;
  text-align: right;
  font-size: var(--text-body-xs);
}

.report-check {
  display: flex;
  gap: var(--space-2);
  align-items: flex-start;
  font-size: var(--text-body-s);
  color: var(--ink-600);
}

.report-success {
  color: var(--success-600, #2e7d32);
  margin: 0;
}

.report-actions {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-wrap: wrap;
}
</style>
