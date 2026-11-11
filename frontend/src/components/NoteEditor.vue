<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { saveTastingNote } from '@/api/lists'
import { useToastStore } from '@/stores/toast'

const visible = defineModel<boolean>({ required: true })

const props = defineProps<{
  listId: number
  teaId: number
  teaName: string
  initialNote: string | null
}>()

const emit = defineEmits<{ saved: [note: string | null] }>()

const toast = useToastStore()
const draft = ref('')
const saving = ref(false)
/** 保存成功后的原地轻提示文案（阶段二：替代纯 Toast） */
const savedHint = ref('')
let closeTimer: number | undefined

onBeforeUnmount(() => window.clearTimeout(closeTimer))

const count = computed(() => draft.value.length)

watch(visible, (open) => {
  if (open) {
    draft.value = props.initialNote ?? ''
    savedHint.value = ''
  }
})

watch(
  () => props.initialNote,
  (value) => {
    if (visible.value) draft.value = value ?? ''
  },
)

function close() {
  if (saving.value) return
  window.clearTimeout(closeTimer)
  visible.value = false
}

async function save() {
  if (saving.value) return
  const content = draft.value.trim() || null
  if (content && content.length > 20000) {
    toast.error('笔记不能超过 20,000 字')
    return
  }
  saving.value = true
  try {
    const res = await saveTastingNote(props.listId, props.teaId, content)
    emit('saved', res.data.tasting_note)
    // 原地显示「已保存 · 时间」，短暂停留后自动关闭
    const time = new Date().toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
    })
    savedHint.value = `已保存 · ${time}`
    window.clearTimeout(closeTimer)
    closeTimer = window.setTimeout(() => {
      savedHint.value = ''
      visible.value = false
    }, 900)
  } catch {
    // 统一错误提示由请求拦截器处理
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div v-if="visible" class="modal" role="dialog" aria-modal="true" @click.self="close">
    <div class="modal__panel">
      <header class="modal__header">
        <div>
          <h2 class="modal__title">品鉴笔记</h2>
          <p class="modal__subtitle">{{ teaName }} · 仅自己可见</p>
        </div>
        <button type="button" class="modal__close" aria-label="关闭" @click="close">×</button>
      </header>

      <textarea
        v-model="draft"
        class="note-input"
        maxlength="20000"
        rows="8"
        placeholder="记录这一泡的香气、滋味与感受…"
        autofocus
      ></textarea>

      <div class="note-meta">
        <span>私密笔记，不会出现在分享页</span>
        <span>{{ count.toLocaleString('zh-CN') }} / 20,000</span>
      </div>

      <!-- 保存反馈（阶段二）：原地展开，不打断输入位置 -->
      <p v-if="savedHint" class="note-saved" role="status">✓ {{ savedHint }}</p>

      <footer class="modal__footer">
        <button type="button" class="btn btn--ghost" :disabled="saving" @click="close">取消</button>
        <button type="button" class="btn btn--secondary" :disabled="saving" @click="draft = ''">
          清空输入
        </button>
        <button type="button" class="btn btn--primary" :disabled="saving" @click="save">
          {{ saving ? '保存中…' : '保存笔记' }}
        </button>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.modal {
  position: fixed;
  inset: 0;
  z-index: 80;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(44, 36, 24, 0.45);
}

.modal__panel {
  width: min(560px, 100%);
  background: var(--color-bg-surface);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-modal);
  padding: 24px;
}

.modal__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}

.modal__title {
  font-family: var(--font-display);
  font-size: var(--text-h2);
  color: var(--color-text-primary);
  margin: 0 0 4px;
}

.modal__subtitle {
  font-size: var(--text-small);
  color: var(--color-text-muted);
  margin: 0;
}

.modal__close {
  width: 32px;
  height: 32px;
  border: none;
  border-radius: var(--radius-full);
  background: transparent;
  color: var(--color-text-muted);
  font-size: 24px;
  line-height: 1;
  cursor: pointer;
}

.modal__close:hover {
  background: var(--color-bg-muted);
}

.note-input {
  width: 100%;
  padding: 14px 16px;
  border: 1px solid var(--color-border-dark);
  border-radius: var(--radius-md);
  background: var(--color-bg-page);
  color: var(--color-text-primary);
  font-family: inherit;
  font-size: var(--text-body);
  line-height: 1.7;
  resize: vertical;
}

.note-input:focus {
  outline: none;
  border-color: var(--color-primary);
}

.note-meta {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-top: 8px;
  font-size: var(--text-caption);
  color: var(--color-text-muted);
}

.modal__footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 20px;
}

/* 保存反馈动画（阶段二） */
.note-saved {
  margin: 12px 0 0;
  font-size: var(--text-small);
  color: var(--color-primary);
  animation: note-saved-in 0.24s ease-out;
}

@keyframes note-saved-in {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .note-saved {
    animation: none;
  }
}

/* 按钮样式统一在全局 style.css（.btn / 各变体） */
</style>
