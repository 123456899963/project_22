<script setup lang="ts">
// 全站页脚（静态内容）—— 手卷「茶席落款」
</script>

<template>
  <footer class="app-footer">
    <div class="app-footer__inner">
      <div class="app-footer__sign">
        <span class="app-footer__seal seal" aria-hidden="true">茶</span>
        <div class="app-footer__words">
          <h4 class="app-footer__brand">茶 · 图鉴</h4>
          <p class="app-footer__desc">六大茶类 · 结构化知识库 · 让每一款茶都有据可循</p>
        </div>
      </div>
      <p class="app-footer__verse vertical-text" aria-hidden="true">一盏知山水 · 一叶见春秋</p>
    </div>
    <div class="app-footer__base">
      <span>© 2026 茶·图鉴</span>
      <span class="app-footer__dot" aria-hidden="true"></span>
      <span>数据仅供参考</span>
    </div>
  </footer>
</template>

<style scoped>
.app-footer {
  position: relative;
  padding: 0 0 28px;
  background: var(--color-paper-deep);
  border-top: 1px solid var(--color-border-dark);
}

.app-footer::before {
  content: '';
  position: absolute;
  top: 4px;
  left: 0;
  right: 0;
  height: 1px;
  background: rgba(31, 27, 22, 0.08);
}

.app-footer__inner {
  max-width: 1200px;
  margin: 0 auto;
  padding: 44px 32px 28px;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 32px;
}

.app-footer__sign {
  display: flex;
  align-items: center;
  gap: 16px;
}

.app-footer__seal {
  width: 42px;
  height: 42px;
  font-size: 20px;
  background: var(--color-cinnabar);
  border-color: var(--color-cinnabar);
  color: var(--color-paper);
}

.app-footer__brand {
  font-family: var(--font-display);
  font-size: var(--text-h3);
  color: var(--color-ink);
  font-weight: 400;
  letter-spacing: 0.12em;
  margin: 0 0 6px;
}

.app-footer__desc {
  font-size: var(--text-small);
  color: var(--color-ink-faint);
  margin: 0;
}

.app-footer__verse {
  font-family: var(--font-kai);
  font-size: var(--text-small);
  letter-spacing: 0.26em;
  color: var(--color-ink-faint);
  margin: 0;
}

.app-footer__base {
  max-width: 1200px;
  margin: 0 auto;
  padding: 16px 32px 0;
  display: flex;
  align-items: center;
  gap: 10px;
  border-top: 1px solid rgba(31, 27, 22, 0.1);
  font-size: var(--text-caption);
  color: var(--color-ink-faint);
}

.app-footer__dot {
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: var(--color-cinnabar);
  opacity: 0.6;
}

@media (max-width: 640px) {
  .app-footer__inner {
    padding: 32px 16px 20px;
  }

  .app-footer__verse {
    display: none;
  }

  .app-footer__base {
    padding: 14px 16px 0;
  }
}
</style>
