import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import { useUserStore } from './stores/user'
import './style.css'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)

// 后台按需加载 Element Plus：前台保持自研组件 + 设计 Token（AGENTS.md §4）
let adminUiInstalled = false
router.beforeEach(async (to) => {
  if (adminUiInstalled || !to.path.startsWith('/admin')) {
    return true
  }
  adminUiInstalled = true
  const [{ default: ElementPlus }] = await Promise.all([
    import('element-plus'),
    import('element-plus/dist/index.css'),
  ])
  app.use(ElementPlus)
  return true
})

// 启动时恢复登录态（校验 HttpOnly Cookie 是否仍然有效）
const userStore = useUserStore()
userStore.hydrate().finally(() => {
  app.mount('#app')
})
