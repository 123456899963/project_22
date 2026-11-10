import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { useUserStore } from '@/stores/user'

// 前台页面（直接 import，首屏加载）
import HomeView from '@/views/HomeView.vue'
import TeaListView from '@/views/TeaListView.vue'
import TeaDetailView from '@/views/TeaDetailView.vue'
import CompareView from '@/views/CompareView.vue'
import MyListView from '@/views/MyListView.vue'
import ContributeView from '@/views/ContributeView.vue'
import MyContributionsView from '@/views/MyContributionsView.vue'
import ProfileView from '@/views/ProfileView.vue'
import ShareView from '@/views/ShareView.vue'
import LoginView from '@/views/LoginView.vue'
import RegisterView from '@/views/RegisterView.vue'
import NotFound from '@/views/NotFound.vue'

const routes: RouteRecordRaw[] = [
  // —— 前台 ——
  { path: '/', name: 'home', component: HomeView, meta: { title: '茶·图鉴' } },
  { path: '/teas', name: 'tea-list', component: TeaListView, meta: { title: '茶品列表' } },
  { path: '/teas/:id', name: 'tea-detail', component: TeaDetailView, meta: { title: '茶品详情' } },
  { path: '/compare', name: 'compare', component: CompareView, meta: { title: '六大茶类对比' } },
  {
    path: '/my',
    name: 'my-list',
    component: MyListView,
    meta: { title: '我的收藏', requiresAuth: true },
  },
  {
    path: '/profile',
    name: 'profile',
    component: ProfileView,
    meta: { title: '个人中心', requiresAuth: true },
  },
  {
    path: '/contribute',
    name: 'contribute',
    component: ContributeView,
    meta: { title: '投稿', requiresAuth: true },
  },
  {
    path: '/my/contributions',
    name: 'my-contributions',
    component: MyContributionsView,
    meta: { title: '我的提交', requiresAuth: true },
  },
  { path: '/c/:shareId', name: 'share', component: ShareView, meta: { title: '分享清单' } },

  // —— 内容板块（批次五 R1–R5）——
  {
    path: '/contents/:code',
    name: 'content-list',
    component: () => import('@/views/ContentListView.vue'),
    meta: { title: '茶文化' },
  },
  {
    path: '/contents/:code/:id',
    name: 'content-detail',
    component: () => import('@/views/ContentDetailView.vue'),
    meta: { title: '内容详情' },
  },

  // —— 认证 ——
  { path: '/login', name: 'login', component: LoginView, meta: { title: '登录' } },
  { path: '/register', name: 'register', component: RegisterView, meta: { title: '注册' } },

  // —— 管理员后台（动态 import，按需加载）——
  {
    path: '/admin/login',
    name: 'admin-login',
    component: () => import('@/views/admin/AdminLogin.vue'),
    meta: { title: '管理员登录' },
  },
  {
    path: '/admin',
    component: () => import('@/views/admin/AdminLayout.vue'),
    meta: { requiresAdmin: true },
    children: [
      {
        path: '',
        name: 'admin-dashboard',
        component: () => import('@/views/admin/AdminDashboard.vue'),
        meta: { title: '数据概览' },
      },
      {
        path: 'teas',
        name: 'admin-teas',
        component: () => import('@/views/admin/AdminTeas.vue'),
        meta: { title: '茶品管理' },
      },
      {
        path: 'teas/new',
        name: 'admin-tea-new',
        component: () => import('@/views/admin/AdminTeaEdit.vue'),
        meta: { title: '新增茶品' },
      },
      {
        path: 'teas/:id/edit',
        name: 'admin-tea-edit',
        component: () => import('@/views/admin/AdminTeaEdit.vue'),
        meta: { title: '编辑茶品' },
      },
      {
        path: 'contributions',
        name: 'admin-contributions',
        component: () => import('@/views/admin/AdminContributions.vue'),
        meta: { title: '投稿审核' },
      },
      // —— 批次五 R1–R5 内容管理 ——
      {
        path: 'contents',
        name: 'admin-contents',
        component: () => import('@/views/admin/AdminContents.vue'),
        meta: { title: '内容管理' },
      },
      {
        path: 'contents/new',
        name: 'admin-content-new',
        component: () => import('@/views/admin/AdminContentEdit.vue'),
        meta: { title: '新增内容' },
      },
      {
        path: 'contents/:id/edit',
        name: 'admin-content-edit',
        component: () => import('@/views/admin/AdminContentEdit.vue'),
        meta: { title: '编辑内容' },
      },
      // —— 扩展后台模块 ——
      {
        path: 'audit',
        name: 'admin-audit',
        component: () => import('@/views/admin/AdminAuditView.vue'),
        meta: { title: '审计日志' },
      },
      {
        path: 'users',
        name: 'admin-users',
        component: () => import('@/views/admin/AdminUsersView.vue'),
        meta: { title: '用户管理' },
      },
      {
        path: 'media',
        name: 'admin-media',
        component: () => import('@/views/admin/AdminMediaView.vue'),
        meta: { title: '图片库' },
      },
      {
        path: 'settings',
        name: 'admin-settings',
        component: () => import('@/views/admin/AdminSettingsView.vue'),
        meta: { title: '系统设置' },
      },
    ],
  },

  // —— 404 ——
  { path: '/:pathMatch(.*)*', name: 'not-found', component: NotFound },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(_to, _from, savedPosition) {
    return savedPosition || { top: 0 }
  },
})

// —— 全局路由守卫 ——
// 前端守卫仅做体验跳转，不构成安全边界（SECURITY S-14）；
// 真正的权限控制由后端 get_current_user / get_admin_user 兜底。
router.beforeEach((to) => {
  const userStore = useUserStore()

  if (to.meta.requiresAuth && !userStore.isLoggedIn) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }
  if (to.meta.requiresAdmin && !userStore.isAdmin) {
    return { name: 'admin-login' }
  }

  // 更新页面标题
  if (to.meta.title) {
    document.title = `${to.meta.title} | 茶·图鉴`
  }
})

export default router
