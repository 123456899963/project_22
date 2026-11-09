<template>
  <div class="mm-container mm-page">
    <div v-if="loading" class="mm-muted">正在加载茶品详情…</div>
    <div v-else-if="error" class="detail-error">
      <p class="mm-error">{{ error }}</p>
      <router-link to="/search" class="mm-button mm-button--ghost">去搜索其他茶品</router-link>
    </div>

    <template v-else-if="tea">
      <div class="detail-head">
        <div>
          <p class="mm-muted">{{ tea.category.name }} · {{ tea.subcategory.name }}</p>
          <h1 class="detail-title">{{ tea.name }}</h1>
          <p v-if="tea.aliases.length" class="mm-muted">别名：{{ tea.aliases.join('、') }}</p>
        </div>
        <div class="detail-actions">
          <button class="mm-button" type="button" @click="addFavorite">加入收藏</button>
          <button class="mm-button mm-button--ghost" type="button" @click="addCompare">加入对比</button>
        </div>
      </div>
      <p v-if="actionMessage" class="action-message">{{ actionMessage }}</p>

      <section class="image-strip">
        <TeaImage
          v-for="image in tea.images"
          :key="image.id"
          :src="image.thumbUrl ?? image.url"
          :alt="`${tea.name} ${image.type}`"
          :label="imageLabel(image.type)"
        />
      </section>

      <section class="detail-grid">
        <article class="mm-card detail-block">
          <h2 class="detail-block__title">基本信息</h2>
          <dl class="detail-list">
            <div><dt>等级</dt><dd>{{ tea.grades.length ? tea.grades.join('、') : '未分档' }}</dd></div>
            <div v-if="tea.productionYear">
              <dt>生产年份</dt>
              <dd>{{ tea.productionYear }}<template v-if="tea.yearBand">（{{ tea.yearBand }}）</template></dd>
            </div>
            <div><dt>主要产区</dt><dd>{{ tea.origin.primary.join('、') || '暂无' }}</dd></div>
            <div v-if="tea.origin.secondary.length"><dt>其他产区</dt><dd>{{ tea.origin.secondary.join('、') }}</dd></div>
            <div v-if="tea.harvestPeriods.length"><dt>采摘期</dt><dd>{{ tea.harvestPeriods.join('、') }}</dd></div>
            <div><dt>标准号</dt><dd class="mono">{{ tea.standards.join('、') || '暂无' }}</dd></div>
          </dl>
        </article>

        <article class="mm-card detail-block">
          <h2 class="detail-block__title">品质特征</h2>
          <div class="tag-row">
            <span v-for="tag in tea.quality.tags" :key="tag" class="tag">{{ tag }}</span>
            <span v-if="!tea.quality.tags.length" class="mm-muted">标签待补</span>
          </div>
          <p v-if="tea.quality.description" class="quality-desc">{{ tea.quality.description }}</p>
        </article>

        <article class="mm-card detail-block">
          <h2 class="detail-block__title">冲泡参考</h2>
          <dl class="detail-list">
            <div v-for="[key, value] in brewingRows" :key="key">
              <dt>{{ brewingLabel(key) }}</dt>
              <dd>{{ value }}</dd>
            </div>
            <div v-if="!brewingRows.length" class="mm-muted">冲泡参数待补</div>
          </dl>
        </article>
      </section>

      <section class="comments">
        <h2 class="comments__title">茶友短评</h2>
        <form v-if="auth.isLoggedIn" class="comment-form" @submit.prevent="submitComment">
          <textarea v-model="commentText" class="mm-input comment-form__input" maxlength="200" placeholder="写下 1–200 字的品饮感受"></textarea>
          <div class="comment-form__footer">
            <span class="mm-muted">{{ commentText.length }}/200 · 先审后发</span>
            <button class="mm-button" type="submit" :disabled="submitting || !commentText.trim()">提交</button>
          </div>
          <p v-if="commentError" class="mm-error">{{ commentError }}</p>
        </form>
        <p v-else class="mm-muted">
          <router-link :to="`/login?redirect=/tea/${tea.id}`">登录</router-link> 后可发布短评。
        </p>

        <div v-if="comments.length" class="comment-list">
          <article v-for="comment in comments" :key="comment.id" class="comment-item">
            <div class="comment-item__head">
              <span class="comment-item__author">{{ comment.author.nickname }}</span>
              <span class="mm-muted">{{ formatDateTime(comment.createdAt) }}</span>
            </div>
            <p class="comment-item__content">{{ comment.content }}</p>
            <div class="comment-item__actions">
              <button class="link-button" type="button" @click="toggleLike(comment)">
                {{ comment.liked ? '已赞' : '点赞' }} {{ comment.likeCount }}
              </button>
              <button v-if="canDelete(comment)" class="link-button" type="button" @click="removeComment(comment)">删除</button>
            </div>
          </article>
        </div>
        <EmptyState v-else title="还没有短评" description="成为第一个分享品饮感受的人。" />
      </section>

      <p class="disclaimer">{{ tea.disclaimer || '本页内容仅供学习参考，不构成医疗、功效或购买建议。' }}</p>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import EmptyState from '@/components/EmptyState.vue'
import TeaImage from '@/components/TeaImage.vue'
import { ApiError } from '@/api/http'
import { catalogApi, type TeaDetail } from '@/modules/catalog'
import { engagementApi, type CommentItem } from '@/modules/engagement'
import { useAuthStore } from '@/stores/auth'
import { formatDateTime } from '@/utils/datetime'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const tea = ref<TeaDetail | null>(null)
const comments = ref<CommentItem[]>([])
const loading = ref(false)
const error = ref('')
const actionMessage = ref('')
const commentText = ref('')
const commentError = ref('')
const submitting = ref(false)

const typeLabels: Record<string, string> = {
  dry: '干茶',
  soup: '汤色',
  leaf: '叶底',
  pack: '包装',
  detail: '细节'
}

const brewingLabels: Record<string, string> = {
  waterTemp: '水温',
  teaAmount: '投茶量',
  waterAmount: '水量',
  vessel: '器皿',
  firstSteep: '出汤时间',
  steepTimes: '冲泡次数'
}

// 后端只输出非空冲泡字段；这里再过滤一次空串，避免出现空行
const brewingRows = computed(() =>
  Object.entries(tea.value?.brewing ?? {}).filter(([, value]) => String(value ?? '').trim() !== '')
)

function imageLabel(type: string) {
  return typeLabels[type] ?? type
}

function brewingLabel(key: string) {
  return brewingLabels[key] ?? key
}

function requireLogin(): boolean {
  if (!auth.isLoggedIn) {
    router.push({ path: '/login', query: { redirect: route.fullPath } })
    return false
  }
  return true
}

async function addFavorite() {
  if (!requireLogin() || !tea.value) {
    return
  }
  try {
    await engagementApi.addFavorite(tea.value.id)
    actionMessage.value = '已加入收藏'
  } catch (e) {
    actionMessage.value = e instanceof ApiError ? e.message : '收藏失败'
  }
}

async function addCompare() {
  if (!requireLogin() || !tea.value) {
    return
  }
  try {
    await engagementApi.addCompare(tea.value.id)
    actionMessage.value = '已加入对比篮'
  } catch (e) {
    actionMessage.value = e instanceof ApiError ? e.message : '加入对比失败'
  }
}

function canDelete(comment: CommentItem) {
  return auth.user?.nickname === comment.author.nickname
}

async function toggleLike(comment: CommentItem) {
  if (!requireLogin()) {
    return
  }
  try {
    if (comment.liked) {
      await engagementApi.unlikeComment(comment.id)
      comment.liked = false
      comment.likeCount -= 1
    } else {
      await engagementApi.likeComment(comment.id)
      comment.liked = true
      comment.likeCount += 1
    }
  } catch (e) {
    actionMessage.value = e instanceof ApiError ? e.message : '操作失败'
  }
}

async function removeComment(comment: CommentItem) {
  try {
    await engagementApi.deleteComment(comment.id)
    comments.value = comments.value.filter((item) => item.id !== comment.id)
  } catch (e) {
    actionMessage.value = e instanceof ApiError ? e.message : '删除失败'
  }
}

async function submitComment() {
  if (!tea.value) {
    return
  }
  commentError.value = ''
  submitting.value = true
  try {
    await engagementApi.addComment(tea.value.id, commentText.value.trim())
    commentText.value = ''
    actionMessage.value = '短评已提交，审核通过后展示'
  } catch (e) {
    commentError.value = e instanceof ApiError ? e.message : '提交失败'
  } finally {
    submitting.value = false
  }
}

async function load() {
  loading.value = true
  error.value = ''
  actionMessage.value = ''
  const teaId = String(route.params.teaId ?? '')
  try {
    tea.value = await catalogApi.tea(teaId)
    const page = await engagementApi.comments(Number(teaId), 1, 12)
    comments.value = page.items
    if (auth.isLoggedIn) {
      void engagementApi.recordHistory(Number(teaId)).catch(() => undefined)
    }
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : '茶品详情加载失败'
  } finally {
    loading.value = false
  }
}

watch(() => route.params.teaId, load)
onMounted(load)
</script>

<style scoped>
.detail-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4);
  flex-wrap: wrap;
}

.detail-title {
  font-size: var(--text-h1);
  margin: var(--space-1) 0;
}

.detail-actions {
  display: flex;
  gap: var(--space-2);
}

.action-message {
  margin: var(--space-3) 0 0;
  color: var(--success);
  font-size: var(--text-body-s);
}

.image-strip {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: var(--space-3);
  margin: var(--space-5) 0;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: var(--space-4);
}

.detail-block {
  padding: var(--space-4);
}

.detail-block__title {
  font-size: var(--text-h3);
  margin-bottom: var(--space-3);
}

.detail-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin: 0;
}

.detail-list div {
  display: flex;
  justify-content: space-between;
  gap: var(--space-3);
  font-size: var(--text-body-s);
}

.detail-list dt {
  color: var(--ink-500);
}

.detail-list dd {
  margin: 0;
  color: var(--ink-900);
  text-align: right;
}

.mono {
  font-family: var(--font-mono);
}

.tag-row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.tag {
  padding: 2px var(--space-3);
  border-radius: var(--radius-pill);
  background: var(--surface-100);
  color: var(--ink-700);
  font-size: var(--text-caption);
}

.quality-desc {
  margin: var(--space-3) 0 0;
  color: var(--ink-700);
}

.comments {
  margin-top: var(--space-6);
}

.comments__title {
  font-size: var(--text-h2);
  margin-bottom: var(--space-3);
}

.comment-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin-bottom: var(--space-4);
}

.comment-form__input {
  min-height: 88px;
  padding: var(--space-3);
  resize: vertical;
}

.comment-form__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.comment-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.comment-item {
  padding: var(--space-3);
  border: 1px solid var(--line-200);
  border-radius: var(--radius-md);
  background: var(--white);
}

.comment-item__head {
  display: flex;
  justify-content: space-between;
  gap: var(--space-2);
  margin-bottom: var(--space-1);
}

.comment-item__author {
  font-size: var(--text-body-s);
  color: var(--tea-900);
}

.comment-item__content {
  margin: 0 0 var(--space-2);
}

.comment-item__actions {
  display: flex;
  gap: var(--space-4);
}

.link-button {
  border: none;
  background: none;
  padding: 0;
  color: var(--ink-500);
  font-size: var(--text-caption);
}

.link-button:hover {
  color: var(--tea-900);
}

.disclaimer {
  margin-top: var(--space-6);
  padding: var(--space-3);
  border-radius: var(--radius-sm);
  background: var(--surface-100);
  color: var(--ink-500);
  font-size: var(--text-caption);
}

.detail-error {
  display: flex;
  align-items: center;
  gap: var(--space-4);
}
</style>
