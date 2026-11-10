<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getAdminUsers, updateAdminUserRole, type AdminUserItem } from '@/api/admin'

const loading = ref(false)
const list = ref<AdminUserItem[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)

const filter = reactive({
  role: '',
  keyword: '',
})

async function load() {
  loading.value = true
  try {
    const res = await getAdminUsers({
      role: filter.role || undefined,
      keyword: filter.keyword || undefined,
      page: page.value,
      page_size: pageSize.value,
    })
    list.value = res.data.items
    total.value = res.data.total
  } finally {
    loading.value = false
  }
}

function applyFilter() { page.value = 1; load() }

async function changeRole(user: AdminUserItem, targetRole: string) {
  try {
    await ElMessageBox.confirm(
      `将用户「${user.username}」角色变更为「${targetRole === 'admin' ? '管理员' : '普通用户'}」？`,
      '确认操作',
      { confirmButtonText: '确认', cancelButtonText: '取消', type: 'warning' },
    )
    await updateAdminUserRole(user.id, targetRole)
    ElMessage.success('角色已更新')
    load()
  } catch {
    /* 用户取消或接口报错 */
  }
}

onMounted(load)
</script>

<template>
  <div v-loading="loading">
    <div class="page-head">
      <h2 class="text-h2">用户管理</h2>
    </div>

    <section class="panel">
      <div class="filter-row">
        <el-select
          v-model="filter.role"
          placeholder="全部角色"
          clearable
          style="width: 140px"
        >
          <el-option label="普通用户" value="user" />
          <el-option label="管理员" value="admin" />
        </el-select>
        <el-input v-model="filter.keyword" placeholder="搜索用户名" clearable style="width: 200px" />
        <el-button type="primary" @click="applyFilter">查询</el-button>
      </div>
    </section>

    <section class="panel">
      <el-table :data="list" stripe size="small" empty-text="暂无用户">
        <el-table-column prop="id" label="ID" width="70" />
        <el-table-column prop="username" label="用户名" min-width="160" />
        <el-table-column label="角色" width="100">
          <template #default="{ row }">
            <el-tag :type="row.role === 'admin' ? 'warning' : 'info'" size="small">
              {{ row.role === 'admin' ? '管理员' : '普通用户' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="注册时间" width="170" />
        <el-table-column label="操作" width="180">
          <template #default="{ row }">
            <el-button
              v-if="row.role !== 'admin'"
              link type="warning"
              @click="changeRole(row, 'admin')"
            >升为管理员</el-button>
            <el-button
              v-else
              link type="info"
              @click="changeRole(row, 'user')"
            >降为普通用户</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div class="pagination-wrap">
        <el-pagination
          background
          layout="prev, pager, next, total"
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
.panel { margin-bottom: 20px; padding: 20px 24px; border: 1px solid var(--color-border); border-radius: var(--radius-md); background: var(--color-bg-surface); }
.filter-row { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; }
.pagination-wrap { margin-top: 16px; display: flex; justify-content: flex-end; }
</style>
