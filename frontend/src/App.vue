<script setup lang="ts">
import { computed } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import AppToast from '@/components/AppToast.vue'
import AppTabBar from '@/components/AppTabBar.vue'
import { useSwipeBack } from '@/composables/useSwipeBack'

const route = useRoute()

// 后台与登录/注册页不显示移动端底部导航
const showTabBar = computed(() => {
  const path = route.path
  if (path.startsWith('/admin')) return false
  return route.name !== 'login' && route.name !== 'register'
})

useSwipeBack()
</script>

<template>
  <div id="app-root" :class="{ 'app-root--with-tabbar': showTabBar }">
    <RouterView />
    <AppTabBar v-if="showTabBar" />
    <AppToast />
  </div>
</template>

<style scoped>
#app-root {
  min-height: 100svh;
}
</style>
