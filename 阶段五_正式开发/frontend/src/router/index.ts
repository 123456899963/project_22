import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { resolveNavigation } from '@/router/guard'
import ForeLayout from '@/layouts/ForeLayout.vue'
import PlaceholderView from '@/views/PlaceholderView.vue'
import HomeView from '@/views/fore/HomeView.vue'
import TeaListView from '@/views/fore/TeaListView.vue'
import TeaDetailView from '@/views/fore/TeaDetailView.vue'
import SearchView from '@/views/fore/SearchView.vue'
import LoginView from '@/views/fore/LoginView.vue'
import ProfileView from '@/views/fore/ProfileView.vue'
import FavoritesView from '@/views/fore/FavoritesView.vue'
import IdentifyView from '@/views/fore/IdentifyView.vue'
import GalleryView from '@/views/fore/GalleryView.vue'
import SubmissionsView from '@/views/fore/SubmissionsView.vue'
import CompareView from '@/views/fore/CompareView.vue'
import HistoryView from '@/views/fore/HistoryView.vue'
import SubmissionFormView from '@/views/fore/SubmissionFormView.vue'
import SubmissionPreviewView from '@/views/fore/SubmissionPreviewView.vue'
import MessagesView from '@/views/fore/MessagesView.vue'
import SettingsView from '@/views/fore/SettingsView.vue'
import AboutView from '@/views/fore/AboutView.vue'
import ReportView from '@/views/fore/ReportView.vue'

const placeholder = (title: string) => () => Promise.resolve(PlaceholderView)

const foreRoutes: RouteRecordRaw[] = [
  { path: '', name: 'home', component: HomeView, meta: { title: '首页' } },
  { path: 'teas/:category', name: 'tea-list', component: TeaListView, meta: { title: '茶类列表' } },
  { path: 'tea/:teaId', name: 'tea-detail', component: TeaDetailView, meta: { title: '茶品详情' } },
  { path: 'search', name: 'search', component: SearchView, meta: { title: '搜索结果' } },
  { path: 'identify', name: 'identify', component: IdentifyView, meta: { title: '识茶自查' } },
  { path: 'identify/result', name: 'identify-result', component: IdentifyView, meta: { title: '自查结果' } },
  { path: 'gallery', name: 'gallery', component: GalleryView, meta: { title: '图鉴浏览' } },
  { path: 'compare', name: 'compare', component: CompareView, meta: { title: '茶品对比', requiresAuth: true } },
  { path: 'me/favorites', name: 'favorites', component: FavoritesView, meta: { title: '我的收藏', requiresAuth: true } },
  { path: 'me/history', name: 'history', component: HistoryView, meta: { title: '浏览历史', requiresAuth: true } },
  { path: 'me/submissions', name: 'submissions', component: SubmissionsView, meta: { title: '投稿中心', requiresAuth: true } },
  { path: 'me/submissions/new/review', name: 'submission-review', component: SubmissionFormView, meta: { title: '写品鉴长文', requiresAuth: true } },
  { path: 'me/submissions/new/correction', name: 'submission-correction', component: SubmissionFormView, meta: { title: '补图与纠错', requiresAuth: true } },
  { path: 'me/submissions/:id/preview', name: 'submission-preview', component: SubmissionPreviewView, meta: { title: '投稿预览', requiresAuth: true } },
  { path: 'me/messages', name: 'messages', component: MessagesView, meta: { title: '消息中心', requiresAuth: true } },
  { path: 'me/settings', name: 'settings', component: SettingsView, meta: { title: '账号设置', requiresAuth: true } },
  { path: 'me', name: 'profile', component: ProfileView, meta: { title: '个人中心', requiresAuth: true } },
  { path: 'login', name: 'login', component: LoginView, meta: { title: '登录' } },
  { path: 'report', name: 'report', component: ReportView, meta: { title: '举报', requiresAuth: true } },
  { path: 'about', name: 'about', component: AboutView, meta: { title: '关于与协议' } }
]

const adminRoutes: RouteRecordRaw[] = [
  { path: '', name: 'admin-dashboard', component: () => import('@/views/admin/AdminDashboardView.vue'), meta: { title: '工作台', requiresAdmin: true } },
  { path: 'teas', name: 'admin-teas', component: () => import('@/views/admin/AdminTeasView.vue'), meta: { title: '茶品列表', requiresAdmin: true } },
  { path: 'teas/new', name: 'admin-tea-new', component: () => import('@/views/admin/AdminTeaFormView.vue'), meta: { title: '新建茶品', requiresAdmin: true } },
  { path: 'teas/:id', name: 'admin-tea-edit', component: () => import('@/views/admin/AdminTeaFormView.vue'), meta: { title: '茶品编辑', requiresAdmin: true } },
  { path: 'teas/:id/images', name: 'admin-tea-images', component: () => import('@/views/admin/AdminTeaImagesView.vue'), meta: { title: '图鉴与图片', requiresAdmin: true } },
  { path: 'submissions', name: 'admin-submissions', component: () => import('@/views/admin/AdminSubmissionsView.vue'), meta: { title: '投稿审核', requiresAdmin: true } },
  { path: 'submissions/:id', name: 'admin-submission-detail', component: () => import('@/views/admin/AdminSubmissionDetailView.vue'), meta: { title: '投稿审核详情', requiresAdmin: true } },
  { path: 'comments', name: 'admin-comments', component: () => import('@/views/admin/AdminCommentsView.vue'), meta: { title: '评论审核', requiresAdmin: true } },
  { path: 'tags', name: 'admin-tags', component: () => import('@/views/admin/AdminTagsView.vue'), meta: { title: '标签库', requiresAdmin: true } },
  { path: 'categories', name: 'admin-categories', component: () => import('@/views/admin/AdminCategoriesView.vue'), meta: { title: '分类与亚类', requiresAdmin: true } },
  { path: 'import', name: 'admin-import', component: () => import('@/views/admin/AdminImportView.vue'), meta: { title: '批量导入', requiresAdmin: true } },
  { path: 'reports', name: 'admin-reports', component: () => import('@/views/admin/AdminReportsView.vue'), meta: { title: '举报与投诉', requiresAdmin: true } },
  { path: 'reports/:id', name: 'admin-report-detail', component: () => import('@/views/admin/AdminReportDetailView.vue'), meta: { title: '投诉处理', requiresAdmin: true } },
  { path: 'users', name: 'admin-users', component: () => import('@/views/admin/AdminUsersView.vue'), meta: { title: '用户管理', requiresAdmin: true } },
  { path: 'admins', name: 'admin-admins', component: () => import('@/views/admin/AdminAdminsView.vue'), meta: { title: '管理员白名单', requiresAdmin: true, requiresSuper: true } },
  { path: 'audit-logs', name: 'admin-audit-logs', component: () => import('@/views/admin/AdminAuditView.vue'), meta: { title: '审计日志', requiresAdmin: true } },
  { path: 'settings', name: 'admin-settings', component: () => import('@/views/admin/AdminSettingsView.vue'), meta: { title: '系统配置', requiresAdmin: true, requiresSuper: true } }
]

const routes: RouteRecordRaw[] = [
  { path: '/', component: ForeLayout, children: foreRoutes },
  { path: '/admin/login', name: 'admin-login', component: LoginView, meta: { title: '后台登录', admin: true } },
  { path: '/admin', component: () => import('@/layouts/AdminLayout.vue'), children: adminRoutes },
  { path: '/:pathMatch(.*)*', name: 'not-found', component: placeholder('页面不存在'), meta: { title: '页面不存在' } }
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 })
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()
  await auth.ensureLoaded()

  return resolveNavigation(
    {
      fullPath: to.fullPath,
      requiresAuth: Boolean(to.meta.requiresAuth),
      requiresAdmin: Boolean(to.meta.requiresAdmin),
      requiresSuper: Boolean(to.meta.requiresSuper)
    },
    { isLoggedIn: auth.isLoggedIn, isAdmin: auth.isAdmin, isSuper: auth.isSuper }
  )
})

export default router
