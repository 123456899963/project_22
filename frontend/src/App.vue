<script setup lang="ts">
import { RouterView } from 'vue-router'
import AppToast from '@/components/AppToast.vue'
</script>

<template>
  <div id="app-root">
    <RouterView />
    <AppToast />
  </div>
</template>

<style scoped>
#app-root {
  min-height: 100svh;
}
</style>
