<template>
  <div class="fore-shell">
    <header class="fore-header">
      <div class="mm-container fore-header__inner">
        <router-link to="/" class="fore-brand">
          <span class="fore-brand__mark">茗</span>
          <span class="fore-brand__name">茗脉</span>
        </router-link>
        <nav class="fore-nav">
          <router-link to="/" class="fore-nav__link">首页</router-link>
          <router-link to="/gallery" class="fore-nav__link">图鉴</router-link>
          <router-link to="/identify" class="fore-nav__link">识茶</router-link>
          <router-link to="/about" class="fore-nav__link">关于</router-link>
        </nav>
        <div class="fore-account">
          <template v-if="auth.isLoggedIn">
            <router-link to="/me/messages" class="fore-account__link">消息</router-link>
            <router-link to="/me" class="fore-account__user">{{ auth.user?.nickname ?? '我' }}</router-link>
          </template>
          <router-link v-else to="/login" class="mm-button mm-button--ghost">登录</router-link>
        </div>
      </div>
    </header>

    <main class="fore-main">
      <router-view />
    </main>

    <footer class="fore-footer">
      <div class="mm-container fore-footer__inner">
        <span>茗脉 · 六大茶类知识库与图鉴</span>
        <span class="mm-muted">内容仅供学习参考，不构成医疗或功效建议</span>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
</script>

<style scoped>
.fore-shell {
  display: flex;
  min-height: 100vh;
  flex-direction: column;
}

.fore-header {
  position: sticky;
  top: 0;
  z-index: 20;
  background: rgba(250, 247, 240, 0.94);
  border-bottom: 1px solid var(--line-200);
  backdrop-filter: blur(8px);
}

.fore-header__inner {
  display: flex;
  align-items: center;
  gap: var(--space-6);
  min-height: 64px;
}

.fore-brand {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
}

.fore-brand__mark {
  display: grid;
  width: 32px;
  height: 32px;
  place-items: center;
  border-radius: var(--radius-sm);
  background: var(--tea-900);
  color: var(--white);
  font-family: var(--font-serif);
}

.fore-brand__name {
  font-family: var(--font-serif);
  font-size: var(--text-h3);
  letter-spacing: 0.08em;
}

.fore-nav {
  display: flex;
  gap: var(--space-4);
  flex: 1;
}

.fore-nav__link {
  color: var(--ink-700);
  font-size: var(--text-body-s);
  padding: var(--space-1) 0;
  border-bottom: 2px solid transparent;
}

.fore-nav__link:hover,
.fore-nav__link.router-link-active {
  color: var(--tea-900);
  border-bottom-color: var(--tea-900);
}

.fore-account {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  font-size: var(--text-body-s);
}

.fore-account__link {
  color: var(--ink-500);
}

.fore-account__user {
  color: var(--tea-900);
  font-weight: 500;
}

.fore-main {
  flex: 1;
}

.fore-footer {
  border-top: 1px solid var(--line-200);
  padding: var(--space-5) 0;
  color: var(--ink-500);
  font-size: var(--text-caption);
}

.fore-footer__inner {
  display: flex;
  justify-content: space-between;
  gap: var(--space-4);
  flex-wrap: wrap;
}

@media (max-width: 720px) {
  .fore-header__inner {
    gap: var(--space-3);
  }

  .fore-nav {
    gap: var(--space-3);
  }

  .fore-nav__link:nth-child(2) {
    display: none;
  }
}
</style>
