<template>
  <section class="messages">
    <header class="messages-head">
      <div>
        <h1 class="mm-title">消息中心</h1>
        <p class="mm-muted">审核结果、纠错结果、投诉结果与系统通知；消息保留 180 天，过期自动清理。</p>
      </div>
      <button class="mm-button mm-button--ghost" type="button" :disabled="unread === 0" @click="readAll">
        全部已读
      </button>
    </header>

    <div class="messages-tabs">
      <button
        v-for="tab in tabs"
        :key="tab.value"
        type="button"
        class="messages-tab"
        :class="{ active: type === tab.value }"
        @click="switchTab(tab.value)"
      >
        {{ tab.label }}
      </button>
      <label class="messages-unread">
        <input v-model="unreadOnly" type="checkbox" @change="reload" />
        仅看未读
      </label>
    </div>

    <p v-if="error" class="mm-error">{{ error }}</p>

    <ul v-if="items.length" class="message-list">
      <li v-for="item in items" :key="item.id" class="message-item" :class="{ unread: !item.read }">
        <span class="message-type">{{ typeLabel(item.type) }}</span>
        <div class="message-main" @click="open(item)">
          <div class="message-title-row">
            <strong>{{ item.title }}</strong>
            <span v-if="!item.read" class="dot" aria-label="未读" />
            <time class="mm-muted">{{ formatDateTime(item.createdAt) }}</time>
          </div>
          <p class="message-summary">{{ item.summary || '—' }}</p>
          <p v-if="expandedId === item.id" class="message-detail">
            关联对象：{{ item.targetType || '无' }}{{ item.targetId ? ` #${item.targetId}` : '' }}
          </p>
        </div>
      </li>
    </ul>
    <p v-else class="mm-muted empty">{{ loading ? '加载中…' : '暂无消息' }}</p>

    <div v-if="total > size" class="pager">
      <button class="mm-button mm-button--ghost" type="button" :disabled="page <= 1" @click="changePage(-1)">
        上一页
      </button>
      <span class="mm-muted">第 {{ page }} 页 / 共 {{ total }} 条</span>
      <button class="mm-button mm-button--ghost" type="button" :disabled="!hasMore" @click="changePage(1)">
        下一页
      </button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ApiError } from '@/api/http'
import { accountApi, type MessageItem } from '@/modules/account'
import { formatDateTime } from '@/utils/datetime'

const tabs: Array<{ label: string; value: string }> = [
  { label: '全部', value: '' },
  { label: '审核', value: 'review' },
  { label: '纠错', value: 'correction' },
  { label: '投诉', value: 'report' },
  { label: '系统', value: 'system' }
]

const items = ref<MessageItem[]>([])
const type = ref('')
const unreadOnly = ref(false)
const unread = ref(0)
const page = ref(1)
const size = 12
const total = ref(0)
const hasMore = ref(false)
const loading = ref(false)
const error = ref('')
const expandedId = ref<number | null>(null)

const typeLabels: Record<string, string> = {
  review: '审核',
  correction: '纠错',
  report: '投诉',
  system: '系统'
}

const typeLabel = (value: string) => typeLabels[value] ?? value

async function load() {
  loading.value = true
  error.value = ''
  try {
    const data = await accountApi.messages({
      type: type.value || undefined,
      unreadOnly: unreadOnly.value || undefined,
      page: page.value,
      size
    })
    items.value = data.items
    total.value = data.total
    hasMore.value = data.hasMore
    unread.value = data.unread
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : '消息加载失败'
  } finally {
    loading.value = false
  }
}

function reload() {
  page.value = 1
  void load()
}

function switchTab(value: string) {
  type.value = value
  reload()
}

function changePage(delta: number) {
  page.value = Math.max(1, page.value + delta)
  void load()
}

async function readAll() {
  try {
    await accountApi.markAllRead()
    await load()
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : '操作失败'
  }
}

async function open(item: MessageItem) {
  expandedId.value = expandedId.value === item.id ? null : item.id
  if (item.read) {
    return
  }
  try {
    await accountApi.markRead(item.id)
    item.read = true
    unread.value = Math.max(0, unread.value - 1)
  } catch {
    // 已读失败不阻塞查看详情
  }
}

onMounted(load)
</script>

<style scoped>
.messages {
  max-width: 860px;
  margin: 0 auto;
  padding: var(--space-5) var(--space-4);
}

.messages-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--space-4);
  flex-wrap: wrap;
}

.messages-tabs {
  display: flex;
  gap: var(--space-2);
  align-items: center;
  flex-wrap: wrap;
  margin: var(--space-4) 0;
}

.messages-tab {
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-pill);
  border: 1px solid var(--line-200);
  background: var(--white);
  cursor: pointer;
  color: var(--ink-700);
}

.messages-tab.active {
  border-color: var(--tea-700);
  color: var(--tea-800);
}

.messages-unread {
  margin-left: auto;
  font-size: var(--text-body-s);
  color: var(--ink-600);
}

.message-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.message-item {
  display: flex;
  gap: var(--space-3);
  padding: var(--space-3);
  border: 1px solid var(--line-200);
  border-radius: var(--radius-md);
  background: var(--white);
}

.message-item.unread {
  border-left: 3px solid var(--tea-700);
}

.message-type {
  flex: none;
  align-self: flex-start;
  font-size: var(--text-body-xs);
  color: var(--tea-800);
  background: var(--tea-050);
  border-radius: var(--radius-sm);
  padding: 2px var(--space-2);
}

.message-main {
  flex: 1;
  min-width: 0;
  cursor: pointer;
}

.message-title-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.message-title-row time {
  margin-left: auto;
  font-size: var(--text-body-xs);
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--danger-500, #c0392b);
}

.message-summary {
  margin: var(--space-1) 0 0;
  color: var(--ink-600);
  font-size: var(--text-body-s);
}

.message-detail {
  margin: var(--space-2) 0 0;
  font-size: var(--text-body-s);
  color: var(--ink-700);
}

.empty {
  padding: var(--space-6) 0;
  text-align: center;
}

.pager {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  margin-top: var(--space-4);
}
</style>
