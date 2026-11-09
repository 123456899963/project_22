<template>
  <div class="mm-container mm-page about">
    <h1 class="mm-title">关于与协议</h1>
    <div class="about-layout">
      <nav class="about-nav mm-card">
        <button
          v-for="section in sections"
          :key="section.id"
          type="button"
          class="about-nav__item"
          :class="{ active: active === section.id }"
          @click="active = section.id"
        >
          {{ section.title }}
        </button>
      </nav>

      <article class="about-body mm-card">
        <h2>{{ current.title }}</h2>
        <p v-for="(paragraph, index) in current.paragraphs" :key="index">{{ paragraph }}</p>
      </article>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

interface Section {
  id: string
  title: string
  paragraphs: string[]
}

const sections: Section[] = [
  {
    id: 'about',
    title: '关于茗脉',
    paragraphs: [
      '茗脉是六大茶类的知识库与图鉴平台，按绿茶、白茶、黄茶、青茶、红茶、黑茶六大茶类整理亚类与茶品资料。',
      '平台内容由编辑与茶友共同维护：官方资料经审核后发布，用户投稿（品鉴长文、补图、纠错）经审核后决定是否采纳。',
      '平台只提供知识查阅与交流，不提供交易、医疗或保健建议。'
    ]
  },
  {
    id: 'privacy',
    title: '隐私政策',
    paragraphs: [
      '收集范围：登录标识（微信 openid，仅服务端保存）、昵称与头像、收藏与浏览历史、投稿与评论内容、举报与申诉记录、站内消息与必要的操作日志。',
      '使用目的：用于账号登录、内容展示、互动记录、审核治理与安全审计；不用于广告投放，不出售给第三方。',
      '保存期限：站内消息与操作审计保留 180 天；注销冷静期结束后按注销流程删除账号资料，法律法规要求留存的记录除外。'
    ]
  },
  {
    id: 'terms',
    title: '用户协议',
    paragraphs: [
      '用户需对发布的内容负责，不得发布侵权、虚假、违法违规或与茶无关的广告信息。',
      '投稿、评论与举报必须基于真实信息；恶意举报或刷量将被限制互动功能。',
      '平台可对违规内容下架、对账号禁言或封禁；被处理方可按流程申诉 1 次。'
    ]
  },
  {
    id: 'disclaimer',
    title: '免责声明',
    paragraphs: [
      '茶品资料、冲泡建议与品鉴描述均为中性饮用参考，不构成医疗、保健或功效承诺。',
      '茶叶品质受产地、年份、工艺与储存影响，平台资料可能存在滞后或误差，欢迎通过纠错流程反馈。',
      '因个人体质、饮用方式产生的任何后果，平台不承担责任。'
    ]
  }
]

const active = ref('about')
const current = computed(() => sections.find((item) => item.id === active.value) ?? sections[0])
</script>

<style scoped>
.about {
  max-width: 1040px;
}

.about-layout {
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr);
  gap: var(--space-4);
}

.about-nav {
  display: flex;
  flex-direction: column;
  padding: var(--space-2);
  align-self: start;
}

.about-nav__item {
  text-align: left;
  padding: var(--space-2) var(--space-3);
  border: none;
  background: none;
  border-radius: var(--radius-sm);
  color: var(--ink-600);
  cursor: pointer;
}

.about-nav__item.active {
  background: var(--tea-050);
  color: var(--tea-900);
  font-weight: 600;
}

.about-body {
  padding: var(--space-5);
  max-width: 720px;
}

.about-body p {
  line-height: 1.8;
  color: var(--ink-700);
}

@media (max-width: 860px) {
  .about-layout {
    grid-template-columns: 1fr;
  }

  .about-nav {
    flex-direction: row;
    flex-wrap: wrap;
  }
}
</style>
