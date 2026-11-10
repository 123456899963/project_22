<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { getAdminMedia, type AdminMediaItem } from '@/api/admin'

const loading = ref(false)
const list = ref<AdminMediaItem[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(50)

async function load() {
  loading.value = true
  try {
    const res = await getAdminMedia({ page: page.value, page_size: pageSize.value })
    list.value = res.data.items
    total.value = res.data.total
  } finally {
    loading.value = false
  }
}

function openUrl(url: string) {
  if (url.startsWith('http')) window.open(url, '_blank')
  else window.open(url, '_blank')
}

onMounted(load)
</script>

<template>
  <div v-loading="loading">
    <div class="page-head">
      <h2 class="text-h2">图片库</h2>
      <span class="text-small text-muted">共 {{ total }} 张图片</span>
    </div>

    <section class="panel">
      <div v-if="list.length === 0 && !loading" class="empty-tip">暂无图片</div>
      <div v-else class="media-grid">
        <div
          v-for="item in list"
          :key="item.id"
          class="media-card"
        >
          <img
            :src="item.image_url"
            :alt="`tea_${item.tea_id}_${item.id}`"
            loading="lazy"
            @click="openUrl(item.image_url)"
          />
          <div class="media-info">
            <span class="media-meta">tea#{{ item.tea_id }}</span>
            <span class="media-meta">id#{{ item.id }}</span>
          </div>
        </div>
      </div>
      <div class="pagination-wrap" v-if="total > pageSize">
        <el-pagination
          background
          layout="prev, pager, next"
          :total="total" :current-page="page" :page-size="pageSize"
          @current-change="(p: number) => { page = p; load() }"
        />
      </div>
    </section>
  </div>
</template>

<style scoped>
.page-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
.page-head h2 { margin: 0; }
.panel { padding: 20px 24px; border: 1px solid var(--color-border); border-radius: var(--radius-md); background: var(--color-bg-surface); }
.media-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 16px;
}
.media-card {
  border: 1px solid var(--color-border); border-radius: var(--radius-md); overflow: hidden;
  background: var(--color-bg-muted);
  cursor: pointer; transition: box-shadow .15s;
}
.media-card:hover { box-shadow: 0 4px 12px rgba(0,0,0,.08); }
.media-card img { width: 100%; height: 120px; object-fit: cover; display: block; }
.media-info {
  padding: 8px 10px; font-size: var(--text-small); color: var(--color-text-secondary);
  display: flex; justify-content: space-between;
}
.empty-tip { text-align: center; color: var(--color-text-secondary); padding: 40px 0; }
.pagination-wrap { margin-top: 16px; display: flex; justify-content: center; }
</style>
