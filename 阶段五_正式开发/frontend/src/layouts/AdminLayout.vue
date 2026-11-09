<template>
  <div class="admin-shell">
    <aside class="admin-side">
      <router-link to="/admin" class="admin-brand">茗脉 · 管理</router-link>
      <nav class="admin-nav">
        <router-link v-for="item in navItems" :key="item.path" :to="item.path" class="admin-nav__link">
          {{ item.label }}
        </router-link>
      </nav>
    </aside>
    <section class="admin-body">
      <header class="admin-topbar">
        <span class="mm-muted">{{ auth.user?.nickname }} · {{ auth.user?.role }}</span>
        <div class="admin-topbar__actions">
          <router-link to="/" class="mm-button mm-button--ghost">返回前台</router-link>
          <button class="mm-button mm-button--ghost" type="button" @click="handleLogout">退出</button>
        </div>
      </header>
      <main class="admin-main">
        <el-config-provider :locale="zhCn">
          <router-view />
        </el-config-provider>
      </main>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { ElConfigProvider } from 'element-plus'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()

const navItems = computed(() =>
  [
    { path: '/admin', label: '工作台' },
    { path: '/admin/teas', label: '茶品管理' },
    { path: '/admin/submissions', label: '投稿审核' },
    { path: '/admin/comments', label: '评论审核' },
    { path: '/admin/tags', label: '标签库' },
    { path: '/admin/categories', label: '分类与亚类' },
    { path: '/admin/import', label: '批量导入' },
    { path: '/admin/reports', label: '举报与投诉' },
    { path: '/admin/users', label: '用户管理' },
    { path: '/admin/audit-logs', label: '审计日志' }
  ].concat(
    auth.isSuper
      ? [
          { path: '/admin/admins', label: '管理员白名单' },
          { path: '/admin/settings', label: '系统配置' }
        ]
      : []
  )
)

async function handleLogout() {
  await auth.logout()
  router.push('/admin/login')
}
</script>

<style src="element-plus/dist/index.css"></style>

<style scoped>
.admin-shell {
  display: flex;
  min-height: 100vh;
  background: var(--surface-050);
}

.admin-side {
  width: 220px;
  flex: none;
  padding: var(--space-4);
  background: var(--tea-900);
  color: var(--white);
}

.admin-brand {
  display: block;
  font-family: var(--font-serif);
  font-size: var(--text-body-l);
  margin-bottom: var(--space-5);
}

.admin-nav {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.admin-nav__link {
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-sm);
  color: rgba(255, 255, 255, 0.78);
  font-size: var(--text-body-s);
}

.admin-nav__link:hover,
.admin-nav__link.router-link-active {
  background: rgba(255, 255, 255, 0.12);
  color: var(--white);
}

.admin-body {
  flex: 1;
  min-width: 0;
}

.admin-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  padding: var(--space-3) var(--space-5);
  background: var(--white);
  border-bottom: 1px solid var(--line-200);
}

.admin-topbar__actions {
  display: flex;
  gap: var(--space-2);
}

.admin-main {
  padding: var(--space-5);
}

@media (max-width: 860px) {
  .admin-shell {
    flex-direction: column;
  }

  .admin-side {
    width: 100%;
  }

  .admin-nav {
    flex-direction: row;
    flex-wrap: wrap;
  }
}
</style>
