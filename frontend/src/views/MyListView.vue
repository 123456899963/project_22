<script setup lang="ts">
/**
 * 我的清单页（阶段二重构）：数据逻辑在 useMyLists，页面只做区块组装；
 * 头部在 ListHero、侧栏在 ListSidebar、条目在 ListItemCard。
 */
import { RouterLink } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import AppFooter from '@/components/AppFooter.vue'
import AppBreadcrumb from '@/components/AppBreadcrumb.vue'
import StatePanel from '@/components/StatePanel.vue'
import NoteEditor from '@/components/NoteEditor.vue'
import SharePanel from '@/components/SharePanel.vue'
import ListHero from '@/components/mylist/ListHero.vue'
import ListSidebar from '@/components/mylist/ListSidebar.vue'
import ListItemCard from '@/components/mylist/ListItemCard.vue'
import { MAX_LISTS, useMyLists } from '@/composables/useMyLists'

const {
  state,
  lists,
  list,
  activeListId,
  stats,
  errorMessage,
  detailLoading,
  editingTitle,
  titleDraft,
  savingTitle,
  creating,
  newTitle,
  creatingPending,
  deleting,
  noteOpen,
  noteTarget,
  shareOpen,
  removingId,
  items,
  noteCount,
  unavailableCount,
  isDefaultList,
  canCreate,
  load,
  selectList,
  formatDate,
  startEditTitle,
  cancelEditTitle,
  saveTitle,
  submitCreate,
  removeCurrentList,
  openNote,
  onNoteSaved,
  removeItem,
  onShareUpdate,
} = useMyLists()
</script>

<template>
  <AppHeader />

  <main class="my-page">
    <div class="container">
      <AppBreadcrumb current="我的清单" />

      <!-- 头部骨架屏 -->
      <section v-if="state === 'loading'" class="list-hero-skeleton" aria-hidden="true">
        <div class="skeleton skeleton--title"></div>
        <div class="skeleton skeleton--line"></div>
      </section>

      <ListHero
        v-else-if="state === 'ready' && list"
        :list="list"
        :stats="stats"
        :is-default-list="isDefaultList"
        :editing-title="editingTitle"
        v-model:title-draft="titleDraft"
        :saving-title="savingTitle"
        :note-count="noteCount"
        :unavailable-count="unavailableCount"
        :deleting="deleting"
        @start-edit="startEditTitle"
        @cancel-edit="cancelEditTitle"
        @save="saveTitle"
        @share="shareOpen = true"
        @delete="removeCurrentList"
      />

      <!-- 错误 -->
      <StatePanel
        v-else-if="state === 'error'"
        icon="🫖"
        title="清单加载失败"
        :desc="errorMessage || '请稍后重试'"
      >
        <button type="button" class="btn btn--primary" @click="load">重新加载</button>
      </StatePanel>

      <!-- 侧栏 + 条目区 -->
      <div v-if="state === 'ready'" class="list-layout">
        <ListSidebar
          :lists="lists"
          :active-list-id="activeListId"
          :max-lists="MAX_LISTS"
          :creating="creating"
          v-model:new-title="newTitle"
          :creating-pending="creatingPending"
          :can-create="canCreate"
          @select="selectList"
          @create="submitCreate"
          @update:creating="creating = $event"
        />

        <section class="list-main" :aria-busy="detailLoading">
          <!-- 空状态 -->
          <StatePanel
            v-if="!items.length"
            icon="🍃"
            title="清单还是空的"
            desc="去茶品列表逛逛，收藏喜欢的茶，开启你的品鉴记录。"
          >
            <RouterLink class="btn btn--primary" to="/teas">浏览茶品列表</RouterLink>
          </StatePanel>

          <!-- 条目 -->
          <ul v-else class="list-items">
            <ListItemCard
              v-for="item in items"
              :key="item.tea_id"
              :item="item"
              :favorited-at-text="formatDate(item.favorited_at)"
              :removing="removingId === item.tea_id"
              @note="openNote(item)"
              @remove="removeItem(item)"
            />
          </ul>
        </section>
      </div>
    </div>
  </main>

  <AppFooter />

  <NoteEditor
    v-model="noteOpen"
    :list-id="activeListId ?? 0"
    :tea-id="noteTarget?.tea_id ?? 0"
    :tea-name="noteTarget?.name ?? ''"
    :initial-note="noteTarget?.tasting_note ?? null"
    @saved="onNoteSaved"
  />

  <SharePanel
    v-model="shareOpen"
    :share="list?.share ?? null"
    :list-id="activeListId"
    :title="list?.title ?? '我的茶单'"
    :tea-names="items.map((item) => item.name)"
    :tea-count="list?.tea_count ?? 0"
    :created-at="list ? formatDate(list.created_at) : ''"
    @update:share="onShareUpdate"
  />
</template>

<style scoped>
.my-page {
  padding-top: 64px;
  padding-bottom: 48px;
  min-height: 100svh;
}

.container {
  max-width: 1080px;
  margin: 0 auto;
  padding: 0 32px;
}

@media (max-width: 640px) {
  .container {
    padding: 0 16px;
  }
}

/* 面包屑、头部、侧栏、条目与状态面板样式均在各子组件内 */

/* 头部骨架屏 */
.list-hero-skeleton {
  min-height: 140px;
  padding: 24px 28px;
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  margin-bottom: 24px;
}

/* 侧栏 + 条目区布局 */
.list-layout {
  display: grid;
  grid-template-columns: 240px 1fr;
  gap: 20px;
  align-items: start;
}

.list-main {
  min-width: 0;
}

.list-items {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* 骨架屏 */
.skeleton {
  background: var(--color-bg-muted);
  border-radius: var(--radius-sm);
  position: relative;
  overflow: hidden;
}

.skeleton::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(
    90deg,
    var(--color-bg-muted) 0%,
    var(--color-border) 50%,
    var(--color-bg-muted) 100%
  );
  animation: shimmer 1.5s infinite;
}

@keyframes shimmer {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(100%);
  }
}

.skeleton--title {
  height: 36px;
  width: 40%;
  margin-bottom: 12px;
}

.skeleton--line {
  height: 20px;
  width: 60%;
}
</style>
