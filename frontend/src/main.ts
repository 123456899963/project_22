import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import { useUserStore } from './stores/user'
import './style.css'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)

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

// 启动时先恢复登录态（校验 HttpOnly Cookie），再安装路由并挂载。
// 顺序很重要：路由守卫在 app.use(router) 时立即执行首次导航，
// 若此时登录态还没恢复，已登录用户刷新 /my 等受保护页面会被误判为游客踢到登录页。
const userStore = useUserStore()
userStore.hydrate().finally(() => {
  app.use(router)
  app.mount('#app')
})
