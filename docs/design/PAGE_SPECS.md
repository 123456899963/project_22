# 茶·图鉴 —— 页面功能规格文档（PAGE_SPECS）

> **版本**：v2.0（MVP 全量完成，含管理员后台）
> **日期**：2026-11-05
> **适用范围**：学生端（游客 + 注册用户）全部 MVP 页面 + 管理员后台 A1-A5
> **与 PRD 对应**：v1.1 定稿 M1-M7 模块
> **与设计规范对应**：docs/design/DESIGN_SYSTEM.md（方案一：清新水墨）
> **v2.0 变更**：完成全部第二批功能（详情页/收藏清单/分享清单/管理员后台）+ 修复 5 个问题（S1-S3 严重 + M1-M3 中等）

---

## 一、页面清单总览

### 1.1 学生端（游客 + 注册用户）

| # | 页面 | 路由 | 登录要求 | 文件 |
|---|---|---|---|---|
| P1 | 首页 | `原型/index.html` | ❌ | index.html + home.js + common.js |
| P2 | 茶品列表页 | `原型/teas/index.html` | ❌ | teas/index.html + teas/index.js + common.js |
| P3 | 茶品详情页 | `原型/teas/detail.html?id={teaId}` | ❌ | teas/detail.html + detail.js + common.js |
| P4 | 收藏清单页 | `原型/my/index.html` | ✅ 必须登录 | my/index.html + my.js + common.js |
| P5 | 分享清单公开页 | `原型/c/{shareId}/index.html` | ❌（游客可读） | c/{shareId}/index.html + share.js |
| P6 | 登录/注册模态框 | （弹窗形式，无独立路由） | N/A | common.js |

### 1.2 管理员后台（独立模块）

| # | 页面 | 路由 | 登录要求 | 文件 |
|---|---|---|---|---|
| A1 | 管理员登录 | `原型/admin/login.html` | N/A | admin/login.html + admin.js |
| A2 | 数据概览仪表盘 | `原型/admin/index.html` | ✅ 管理员 | admin/index.html + admin.js |
| A3 | 茶品管理列表 | `原型/admin/teas/index.html` | ✅ 管理员 | admin/teas/index.html + admin.js |
| A4 | 新增茶品表单 | `原型/admin/teas/new.html` | ✅ 管理员 | admin/teas/new.html + admin.js |
| A5 | 编辑茶品表单 | `原型/admin/teas/edit.html?id={teaId}` | ✅ 管理员 | admin/teas/edit.html + admin.js |

---

## 二、跨页面导航关系图（完整 MVP）

```
                    ┌──────────────┐
                    │  登录/注册   │
                    │  模态框 P6   │
                    └──────▲───────┘
                           │ 触发（未登录点 ❤️/✏️/↗️/我的清单）
           ┌───────────────┼────────────────┐
           │               │                │
     ┌─────┴─────┐   ┌────┴─────┐   ┌──────┴───────┐
     │ 首页 P1   │──▶│ 列表页 P2 │──▶│ 详情页 P3   │
     │ index.html│   │ teas/     │   │ teas/detail  │
     └─────┬─────┘   │ index.html│   └──────┬───────┘
           │         └──────────┘            │
           │                                │ 点 category-tag
           │                                ▼
           │                         ┌──────────────┐
           │                         │ 列表页 P2    │
           │                         │ (带筛选参数) │
           │                         └──────────────┘
           │
           │ (已登录用户)
           ▼
     ┌─────────────┐        生成分享链接       ┌─────────────┐
     │ 收藏清单 P4 │ ──────────────────────▶ │ 分享清单 P5 │
     │ my/         │                          │ c/xxx/      │
     │ index.html  │                          │ index.html  │
     └─────────────┘                          └─────────────┘

     管理员路径（独立入口）
     ┌──────────────┐
     │ 管理员登录 A1│
     │ admin/login  │
     └──────┬───────┘
            ▼
     ┌──────────────┐     侧边栏    ┌──────────────┐
     │ 仪表盘 A2    │────────────▶│ 茶品管理 A3 │
     │ admin/index  │              │ admin/teas   │
     └──────────────┘              └──────┬───────┘
                                           │
                              ┌────────────┼─────────────┐
                              ▼            ▼              ▼
                        ┌──────────┐ ┌──────────┐ ┌──────────┐
                        │ 新增 A4  │ │ 编辑 A5  │ │ 上下架   │
                        │ new.html │ │ edit.html│ │  (toggle)│
                        └──────────┘ └──────────┘ └──────────┘
```

### 路径自动适配规则（所有页面的导航栏）

common.js 的 `getPagePrefix()` 自动检测当前页面层级：

| 页面位置 | URL pathname 包含 | P 值 | 首页 href | 列表页 href |
|---|---|---|---|---|
| `原型/index.html` | 不含子目录 | `''` | `index.html` | `teas/index.html` |
| `原型/teas/index.html` | 含 `/teas/` | `'../'` | `../index.html` | `../teas/index.html` |
| `原型/my/index.html` | 含 `/my/` | `'../'` | `../index.html` | `../teas/index.html` |
| `原型/admin/index.html` | 含 `/admin/` | `'../'` | `../index.html` | `../teas/index.html` |

---

## 三、P1 首页完整规格

**文件**：`原型/index.html` + `原型/js/home.js` + `原型/js/common.js`

### 3.1 区块列表

| 区块 | 内容 | 数据来源 | 交互 |
|---|---|---|---|
| **导航栏** | Logo（茶叶 SVG + "茶·图鉴"）、首页/六大茶类链接、搜索入口、登录/用户信息 | common.js renderNav() | 首页透明态 → 滚动 320px 后纯白态；点 Logo 或首页回首页；点六大茶类跳列表页；点登录弹模态框 |
| **Hero** | Badge + 主标题 + 副标题 + 搜索框 | 静态文案 + 占位输入框 | 搜索框回车跳列表页带 `q=`；输入 150ms debounce 显示下拉建议（最多 6 条，匹配 name 或 origin） |
| **六大茶类入口** | 6 张 category-card（emoji + 名称 + 已收录数量 + hover 彩条） | TEA_MOCK.getCategoriesWithCount() | 点跳列表页 `?category={key}` |
| **热门推荐** | 横向卡片轨道（8 张 card-hot：图片 + 名称 + 产地 + tag + ❤️ 收藏按钮 + 收藏数） | TEA_MOCK.getHotTeas(8) | 左右箭头按钮；鼠标拖拽；点卡片跳详情页；点 ❤️ toggle 收藏（未登录弹模态框） |
| **随机发现** | card-random（大图 + 名称 + tag + 收藏数 + 🌡℃/🫖g/⏱s + ❤️）+ 换一批按钮 | TEA_MOCK.getRandomTea(currentId) 排除上一条 | 换一批有 400ms 旋转动画；点卡片跳详情页；点 ❤️ toggle 收藏 |
| **页脚** | 品牌名 + 描述 + 版权 | 静态 | — |

### 3.2 状态表

| 状态 | 触发条件 | 表现 |
|---|---|---|
| 未登录 | localStorage 无 user | 导航栏"登录"按钮；点 ❤️ 弹模态框 |
| 已登录 | localStorage 有 user | 导航栏"我的清单 Ghost + 用户名·退出"；点 ❤️ 直接 toggle |
| 透明态 | 滚动 Y < 320px | 背景 transparent |
| 纯白态 | 滚动 Y ≥ 320px | 背景 #FFFFFF + 1px 底部边框 |
| 搜索建议无匹配 | 关键词无 name/origin 匹配 | "没有找到相关茶品"灰色提示 |

---

## 四、P2 茶品列表页完整规格

**文件**：`原型/teas/index.html` + `原型/teas/index.js` + `原型/js/common.js`

### 4.1 区块列表

| 区块 | 内容 | 数据来源 | 交互 |
|---|---|---|---|
| **导航栏** | 纯白态（nav--solid） | common.js | 点 Logo/首页回首页；点六大茶类跳列表页（自己） |
| **面包屑** | 首页 › {全部 / 茶类名 / 搜索："xxx"} | JS state 动态 | 点"首页"回首页 |
| **筛选面板** | 三大分组（六大茶类 / 产地 / 采摘季节），每组 6~15 个 chip | CATEGORIES / getOriginsWithCount() / SEASONS | 点 chip toggle 选中；六大茶类 chip 各有专属色；AND 三维度组合 |
| **已选条件区** | pill 列表（每个可 × 移除）+ 清除全部按钮 | state 动态 | 点 × 单独移除并刷新；点清除重置全部 |
| **排序栏** | 结果数 + 排序下拉（最新上架 / 收藏最多） | 实时计算 | 切换排序即时刷新 |
| **骨架屏** | 6 个 skeleton-card（图片 + 标题 + 次文字占位 + shimmer） | CSS | 首次加载 400ms 后替换为真实数据 |
| **卡片网格** | 3列桌面/2列平板/1列移动 card-tea：图片 16:10 + 名称 + 六大茶类 tag + 产地 + ⚠️收藏 icon + 采摘季节 | getFilteredAndSortedTeas() | 点收藏 icon toggle（整卡重渲染 + Toast）；点卡片 body 跳详情页 |
| **分页** | 上一页/下一页 + 页码 + 省略号 | 9 条/页 | 翻页即时刷新 + URL page 参数同步 |
| **空状态** | 🫖 图标 + 标题 + 描述 + 清除按钮 + 3 款热门推荐卡 | getHotTeas(3) | 点清除重置；点热门推荐卡**直接跳该茶详情页** |

### 4.2 URL 参数（双向同步：解析 + history.replaceState）

| 参数 | 来源 | 解析 | 示例 |
|---|---|---|---|
| `category` | 首页入口 / 详情页 tag 点击 / 筛选 chip | state.categories = [key] | `?category=green` |
| `origin` | （未来：详情页产地 tag） | state.origins = [name] | `?origin=浙江` |
| `season` | （未来：详情页季节 tag） | state.seasons = [name] | `?season=明前` |
| `q` | Hero 搜索框 / 搜索建议 | state.keyword = 关键词 | `?q=西湖龙井` |
| `sort` | 排序下拉 | state.sort = newest/favorite | `?sort=favorite` |
| `page` | 分页 | state.page = 1..max | `?page=2` |

### 4.3 收藏 icon 交互

| 操作 | 行为 | UI 反馈 |
|---|---|---|
| 点 icon（空心 → 实心） | toggleFavorite(id) → localStorage push | ❤️ 实心 + Toast "已收藏「xxx」❤️" + 整卡重渲染 |
| 点 icon（实心 → 空心） | toggleFavorite(id) → localStorage splice | ❤️ 空心 + Toast "已取消收藏「xxx」" + 整卡重渲染 |
| 点卡片 body | 跳详情页 | `detail.html?id={teaId}` |

### 4.4 六大茶类标签色

| 茶类 | chip 未选中 | chip 选中 | card-tea tag |
|---|---|---|---|
| 绿茶 green | outline #5CB85C + #5CB85C | solid #5CB85C + 白字 | #5CB85C + 白字 |
| 白茶 white | outline #D4D0C8 + #2C2C2C | solid #D4D0C8 + #2C2C2C（特殊反转） | #D4D0C8 + #2C2C2C（反转） |
| 黄茶 yellow | outline #E6C25B + #4A3728 | solid #E6C25B + 白字 | #E6C25B + 白字 |
| 红茶 red | outline #C0392B + #C0392B | solid #C0392B + 白字 | #C0392B + 白字 |
| 乌龙茶 oolong | outline #D35400 + #D35400 | solid #D35400 + 白字 | #D35400 + 白字 |
| 黑茶 dark | outline #4A3728 + #4A3728 | solid #4A3728 + 白字 | #4A3728 + 白字 |

### 4.5 状态

| 状态 | 触发条件 | 表现 |
|---|---|---|
| 骨架屏 | 0~400ms | shimmer 6 张 |
| 有结果 | list.length > 0 | 真实卡片网格 |
| 空结果 | list.length === 0 | 🫖 + 清除按钮 + 3 款热门推荐（点跳详情页） |
| 分页中 | 多页 | 页码 + 省略号 |

---

## 五、P3 茶品详情页完整规格

**文件**：`原型/teas/detail.html` + `原型/js/detail.js` + `原型/js/common.js`

### 5.1 区块列表

| 区块 | 内容 | 数据来源 | 交互 |
|---|---|---|---|
| **导航栏** | 纯白态 | common.js | — |
| **骨架屏** | 大图占位 + 标题占位 + 文本占位 + shimmer | CSS | 首次加载 350ms 后替换 |
| **头部** | 主图（大图）+ 图片上叠加的茶类标签（**可点击**）+ 名称 + 产地 + 季节 | TEAS[id] | 点茶类标签跳列表页带 `?category={tea.category}`；主图 onerror 显示灰底 |
| **行动按钮栏** | ❤️ 收藏 / ✏️ 写笔记 / ↗️ 分享 | localStorage + 模态框 | 收藏 toggle + Toast；笔记弹模态框（localStorage tea_notes）；分享弹模态框（生成 shareId + localStorage 写入 + 正确路径 `/c/{shareId}/index.html`） |
| **冲泡参考卡** | 🌡 水温 / 🫖 投茶量 / ⏱ 浸泡时间 | tea.waterTemp / tea.teaAmount / tea.brewTime | — |
| **四大感官卡** | 外形 / 汤色 / 香气 / 滋味 | tea.shape / tea.soup / tea.aroma / tea.taste | 每块左侧 emoji + 文字描述 |
| **小贴士卡** | 4 块可独立显隐：历史文化 / 适合人群 / 常见误区 / 官方备注 | tea.tips.history / suitable / misconception / officialNote | **空内容整块隐藏**（display:none） |
| **同类推荐区** | 最多 4 张 card-hot（同 category，排除自身） | getRelatedTeas(tea, 4) | 点卡跳其他详情页 |
| **页脚** | 同首页 | 静态 | — |

### 5.2 URL 参数

| 参数 | 说明 | 示例 |
|---|---|---|
| `id` | 茶品唯一 ID | `detail.html?id=1` |

**无效 id**：骨架屏显示 → 替换为"茶品不存在"友好提示 + 3 款热门推荐。

### 5.3 分享完整实现（本次 P0 修复）

```javascript
// 1. 生成或复用 shareId（用户首次分享时生成）
let shareId = localStorage.getItem('tea_share_id');
if (!shareId) {
  shareId = `share_${Math.random().toString(36).slice(2, 8)}`;
  localStorage.setItem('tea_share_id', shareId);
}

// 2. 把当前用户收藏清单写入 storage
const favIds = getFavorites();
localStorage.setItem(`tea_share_${shareId}`, JSON.stringify(favIds));

// 3. 生成正确 URL（路径指向 c/{shareId}/index.html）
input.value = `${origin}/c/${shareId}/index.html`;
```

### 5.4 笔记 localStorage 结构

```javascript
// tea_notes: { [teaId]: { content: string, updatedAt: timestamp } }
localStorage.setItem('tea_notes', JSON.stringify({
  "1": { content: "豆香明显，推荐 85℃ 水", updatedAt: 1730736000 }
}));
```

### 5.5 登录守卫（S3 修复）

common.js 的 openLoginModal 在登录成功和注册成功后都会 `document.dispatchEvent(new CustomEvent('tea:login'))`。所有需要登录的页面（P3 分享/收藏按钮、P4 收藏清单）都监听此事件来刷新 UI 状态。

### 5.6 收藏清单选择面板（S9 多清单交互，Vue 实现新增）

**组件**：`frontend/src/components/FavoriteButton.vue`（仅 primary variant，用于茶品详情页）

详情页主收藏按钮右侧附加「选择清单」箭头按钮，与主按钮拼为胶囊组合：

- 主按钮行为不变：未收藏 → 加入默认清单；已收藏 → 从全部清单移除
- 箭头按钮（仅登录态渲染）：展开清单选择面板，逐清单勾选/取消收录；勾选态由收藏状态响应 `list_ids` 驱动（`aria-checked` 同步）
- 面板行为：懒加载 `GET /lists`；点击清单行幂等切换（已含则移出、未含则加入）；计数按「用户 × 茶品」去重口径联动（加入首个清单 +1、移出最后一个清单 -1）
- 关闭方式：Esc（焦点回箭头）、点击面板外区域、路由跳转
- 无障碍：`aria-haspopup` + `aria-expanded` + `role="menu"` / `role="menuitemcheckbox"`；触屏可用（不依赖 hover）
- 视觉：全部引用 `:root` 设计变量，无硬编码 HEX

---

## 六、P4 收藏清单页完整规格

**文件**：`原型/my/index.html` + `原型/my/my.js` + `原型/js/common.js`

### 6.1 区块列表

| 区块 | 内容 | 数据来源 | 交互 |
|---|---|---|---|
| **登录守卫** | 未登录时显示：登录提示 + 登录按钮 | common.js requireLogin() | 点登录弹模态框；登录成功后自动 dispatch tea:login 事件刷新页面 |
| **统计面板** | 3 张 stat-card：收藏数 / 笔记数 / 品茶天数 | localStorage 实时聚合 | — |
| **清单列表** | 每张 card-tea 简化版：缩略图 + 名称 + 产地 + ❌ 移除 + ✏️ 笔记入口 + 日期标签 | localStorage tea_favorites + tea_notes | 点缩略图/名称跳详情页；点 ✏️ 弹笔记模态框（增/删/改）；点 ❌ 从清单移除 + Toast |
| **分享按钮** | 右上角 ↗️ 生成分享链接按钮 | localStorage | 点弹分享模态框，生成 shareId + 正确路径 |
| **空状态** | 未收藏任何茶时：🫖 图标 + 引导文案 + "去发现好茶"按钮 | — | 点按钮跳首页 |

### 6.2 品茶天数模拟

my.js 首次加载时用 `localStorage.tea_days_track` 记录当前日期；每次进入（有收藏）时对比，累计天数。这是前端 mock 的合理近似，接后端后替换为真实数据。

---

## 七、P5 分享清单公开页完整规格

**文件**：`原型/c/{shareId}/index.html` + `原型/js/share.js`

### 7.1 区块列表

| 区块 | 内容 | 数据来源 | 交互 |
|---|---|---|---|
| **只读标签** | 页面顶部固定 "只读分享" badge | 静态 | — |
| **清单标题** | "TA 的品茶清单" | 静态 | — |
| **清单列表** | 只读 card-tea（缩略图 + 名称 + 产地 + 日期标签），**无移除按钮、无笔记入口** | localStorage tea_share_{shareId} | 点卡片跳详情页 |
| **一键收藏全部** | 已登录用户可见的绿色大按钮 | common.js getCurrentUser() | 点 → 把清单内所有茶 push 到当前用户 tea_favorites → Toast "已收藏全部 N 款" |
| **清单不存在** | localStorage 找不到对应 shareId 时显示：🫖 + 提示文案 + 返回首页 | — | 点返回首页 |

### 7.2 URL 路径

```
原型/c/share_ab12cd/index.html
     ↑ 固定路径     ↑ 动态 shareId    ↑ 固定文件名
```

share.js 从 `window.location.pathname.split('/')[3]` 提取 shareId。

---

## 八、P6 登录/注册模态框完整规格

**文件**：`原型/js/common.js`（openLoginModal + HTML 模板 + 事件绑定）

### 8.1 Tab 切换

| Tab | 标题 | 表单字段 |
|---|---|---|
| login | 登录 | 用户名 + 密码 + 记住我 checkbox |
| register | 注册 | 用户名（≥3 ≤20）+ 密码（≥6）+ 确认密码 |

### 8.2 表单校验

| 字段 | 规则 | 错误提示 |
|---|---|---|
| 用户名（登录） | ≥ 3 字符 | "用户名或密码错误" |
| 用户名（注册） | 3-20 字符 | "用户名需 3-20 字符" |
| 密码（注册） | ≥ 6 位 | "密码至少 6 位" |
| 两次密码一致 | 必须相同 | "两次密码不一致" |

### 8.3 关闭方式

| 方式 | 实现 |
|---|---|
| 点 backdrop（灰色遮罩） | backdrop click → closeLoginModal |
| 点 close 按钮（右上角 ×） | closeBtn click → closeLoginModal |
| 按 ESC 键 | document keydown → closeLoginModal |
| **关键**：点模态框内部 | modalEl click → `e.stopPropagation()`，**不关闭** |

### 8.4 登录成功后的行为

1. localStorage 写入 user 对象 `{ username, loginTime }`
2. `showToast("欢迎回来，xxx", "success")`
3. closeLoginModal()
4. updateNavAuthState() — 导航栏切换为用户态
5. `document.dispatchEvent(new CustomEvent('tea:login'))` — 触发所有依赖登录状态的页面刷新（my.js、detail.js 等）

---

## 九、管理员后台 A1-A5 完整规格

所有管理员后台页面的导航栏都是**侧边栏 + 顶栏**布局（区别于学生端）。登录状态存在 `localStorage.admin_user = 'admin'`。

### 9.1 A1 管理员登录

| 项 | 内容 |
|---|---|
| 路由 | `原型/admin/login.html` |
| 演示账号 | 用户名 `admin` / 密码 `admin123` |
| 验证失败 | Toast "用户名或密码错误" |
| 登录成功 | localStorage 写 admin_user → 跳 A2 仪表盘 |
| 守卫机制 | admin.js 的 requireAuth() 检查 admin_user，未登录自动跳回 A1 |

### 9.2 A2 仪表盘

| 项 | 内容 |
|---|---|
| 路由 | `原型/admin/index.html` |
| 区块 | 3 张统计卡（茶品总数 / 已上架 / 已下架）+ 六大茶类分布柱状图 + 最近 5 款（最新添加/编辑） |
| 数据源 | admin.js 的 getAdminTeas()（合并 mock TEAS + localStorage admin_teas_edited 里的 CRUD 操作） |

### 9.3 A3 茶品管理列表

| 项 | 内容 |
|---|---|
| 路由 | `原型/admin/teas/index.html` |
| 区块 | 筛选（茶类 / 上架状态）+ 表格（名称+茶类+产地+上架状态+操作）+ 右上角 "新增茶品" 按钮 |
| 操作列 | 上架/下架 toggle switch + "编辑" 按钮 |
| CRUD 持久化 | 所有操作存到 localStorage admin_teas_edited（内存合并逻辑：admin.js 的 getAdminTeas() 把原始 TEAS + edited 里的新增/修改 合并展示） |

### 9.4 A4 新增茶品表单

| 项 | 内容 |
|---|---|
| 路由 | `原型/admin/teas/new.html` |
| 表单分块 | ① 基础信息（名称 + 茶类 + 产地 + 季节）② 冲泡参考（水温/投茶量/时间）③ 四大感官（外形/汤色/香气/滋味）④ 小贴士 4 块 + 主图 URL |
| 必填校验 | 名称 ≥1 字 / 茶类必选 / 产地必选（其他字段可留空） |
| 保存后 | 写入 localStorage admin_teas_edited（new 数组 push）→ Toast → 跳 A3 |

### 9.5 A5 编辑茶品表单

| 项 | 内容 |
|---|---|
| 路由 | `原型/admin/teas/edit.html?id={teaId}` |
| 与 A4 区别 | 所有表单预填当前茶品数据；顶部有上架/下架 toggle switch；"保存"按钮覆盖 id 对应的记录（updated 数组） |

---

## 十、跨页面 localStorage 键名约定

| 键 | 类型 | 读写者 | 说明 |
|---|---|---|---|
| `tea_user` | JSON 对象 | common.js | `{ username, loginTime }` |
| `tea_favorites` | number[] | common.js / teas/index.js / my.js | 收藏的茶品 ID 数组 |
| `tea_notes` | JSON 对象 | detail.js / my.js | `{ [teaId]: { content, updatedAt } }` |
| `tea_share_id` | string | detail.js / my.js | 当前用户的 shareId |
| `tea_share_{shareId}` | JSON 数组 | detail.js / my.js / share.js | 该 shareId 对应的收藏清单（teaId 数组） |
| `tea_days_track` | string | my.js | 当前日期 YYYY-MM-DD，用于模拟品茶天数 |
| `admin_user` | string | admin.js | 值固定为 `'admin'` |
| `admin_teas_edited` | JSON 对象 | admin.js | `{ new: [], updated: {}, toggled: [] }` — 管理员 CRUD 操作记录 |

---

## 十一、v2.0 修复记录（本次）

| 优先级 | 问题 | 文件 | 修复 |
|---|---|---|---|
| **P0** 🔴 严重 | 详情页分享 URL 错误（`.html` vs `/index.html`）+ 没写 localStorage | detail.js | 分享逻辑完全对齐 my.js：生成 shareId → localStorage.setItem 清单内容 → 正确路径 `/c/{shareId}/index.html` |
| **P1** 🔴 严重 | 登录后收藏清单页不会自动刷新（my.js 监听 tea:login 但 common.js 没 dispatch） | common.js | openLoginModal 里登录/注册成功后加 `document.dispatchEvent(new CustomEvent('tea:login'))` |
| **P2** 🟠 中 | 详情页 category-tag 是纯视觉元素，不能点击回筛选 | detail.html + detail.js | category-tag 加 `cursor:pointer` + title + click listener 跳列表页带 `?category={tea.category}` |
| **P3** 🟡 中 | 空状态推荐卡点了清筛选再设 state，应该直接跳该茶详情页 | teas/index.js | renderEmptySuggest 改成 `window.location.href = detail.html?id=xxx` |
| **P4** 🟡 中 | 列表页收藏 toggle 用了 3 次 innerHTML 重写 + 废弃 favSvgActive/Inactive 函数 | teas/index.js | 简化为 toggle 后直接 renderCards() 整卡重渲染，删除废弃函数 |

---

## 十二、已知限制（接受的技术边界）

| # | 限制 | 原因 | 后续 |
|---|---|---|---|
| 1 | 图片依赖 Unsplash CDN，离线无图 | 纯原型不打包图片 | 生产环境替换为本地资源 |
| 2 | 登录/注册直接通过，不校验用户名唯一性 | MVP 演示模式 | 接后端后替换 |
| 3 | 收藏数是静态 mock，toggleFavorite 只操作 ID 不改变 count | 无真实后端 | 接后端后联动 |
| 4 | 分享链接用 localStorage，**跨浏览器/跨设备/换电脑/清缓存后失效** | 纯前端原型天生限制 | 接后端（服务端存储清单）后解决 |
| 5 | 没有骨架屏以外的异步错误状态（如 API 超时） | 纯前端无真实请求 | 接后端后加 error boundary |
| 6 | 管理员 CRUD 也是 localStorage，**清缓存后重置** | 纯前端原型天生限制 | 接后端后持久化 |
| 7 | 管理员角色单一（只有 admin），无权限分级 | MVP 简化 | 第二阶段扩展 |

---

## 十三、Vue 前台视觉改版记录（2026-11-11「一席六笺 · 茶山长卷」）

> 范围：**仅前台 P1 首页 / P2 列表 / P3 详情** 的布局、样式与装饰性交互；不改路由、API 调用、筛选/分页/收藏/分享等业务逻辑；`原型/` 静态原型保持不动，作为历史基准。
> 视觉目标：用「手卷五章 + 茶席器物」替代通用电商卡片风格，纸张暖米白、墨色文字、朱砂点缀，标题用楷体，图标一律线描。

### 13.1 设计 Token 与基础样式（`frontend/src/style.css`）

| 类别 | 变量 / 规则 | 值 / 说明 |
|---|---|---|
| 纸张 | `--color-paper` / `--color-paper-deep` / `--color-paper-edge` | `#f6f1e7` / `#efe7d8` / `#e2d6c1` |
| 墨色 | `--color-ink` / `--color-ink-soft` / `--color-ink-faint` | `#1f1b16` / `#4a4238` / `#8a8072` |
| 朱砂 | `--color-cinnabar` / `--color-cinnabar-soft` | `#b03a2e` / `rgba(176,58,46,.08)`，用于印章、短标、选中强调 |
| 汤色 | `--soup-green/white/yellow/red/oolong/dark` | 六类茶专属汤色，用于列表/卡片细条与分类笺 |
| 圆角 | `--radius-xs/sm/md` = 2px；`--radius-lg/xl` = 3px | 去圆角化，接近纸张切边 |
| 字体 | `--font-display` / `--font-kai` | 首选自托管 `LXGW WenKai`（`/fonts/lxgw-wenkai-subset.woff2`，`font-display: swap`），回退 Kaiti SC / STKaiti / KaiTi / Noto Serif SC |
| 纸纹 | `body` 背景叠加 SVG data-URI 噪点 | 纯 CSS，无额外请求 |
| 工具类 | `.paper-texture` / `.ink-rule` / `.vertical-text` / `.seal` / `.scroll-kicker` | 纸面、墨线、竖排（`writing-mode: vertical-rl` + `nowrap`）、朱砂印、卷首小标 |

- 组件内只引用变量，HEX 仍仅允许出现在 `style.css`。
- 不新增任何运行时依赖；字体为静态资源，构建时可缺失（自动回退系统楷体）。
- 与 `DESIGN_SYSTEM.md` 原表相比：页面底色由 `#FAF8F5` 调整为 `#f6f1e7`，圆角由 8–16px 收紧到 2–3px。这是本次已确认的「手卷」视觉方向，Token 名称与语义保持不变；`DESIGN_SYSTEM.md` 的组件示例仍以原值为准，实际以 `style.css` 为准。

### 13.2 公共组件

| 组件 | 变化 |
|---|---|
| `AppHeader.vue` | 品牌改为朱砂「茶」印 + `茶 · 图鉴`；导航用 `--font-kai`；下拉箭头改 CSS 三角；搜索框/登录按钮去圆角；`router-link-active` 用朱砂下划线 |
| `AppFooter.vue` | 「茶席落款」：纸深底 + 双层墨线，左朱砂印 + 品牌文案，右竖排「一盏知山水 · 一叶见春秋」 |
| `TeaWareIcon.vue`（新增） | 24×24 线描茶器 13 种：`gaiwan/cup/teapot/jar/aroma/cake/leaf/kettle/spoon/clock/steam/drop/scroll`；`aria-hidden`，替代前台 emoji |
| `teaWare.ts`（新增） | 共享 `TeaWareName` 类型（SFC `<script setup>` 不能导出类型） |
| `TeaCard.vue` | 「茶样盒」：4:3 满宽主图 + `NO.001` 编号 + 4px 汤色条 + 产地小印 + 右上方形收藏按钮；容器 2px 圆角 |
| `CategoryTag.vue` | 未改（仍为六类专属色） |

### 13.3 P1 首页：手卷五章

`HomeView.vue` 只做组装，右侧 `ChapterRail` 固定显示（≥1280px）；章节锚点为 `#chapter-1` … `#chapter-5`，滚动高亮用 `IntersectionObserver`（`rootMargin: -40% 0px -50% 0px`），点击平滑滚动。

| 章 | 组件 | 结构与交互 |
|---|---|---|
| 卷一 寻茶 | `HeroSearch.vue` | 7/5 非对称双栏：左列竖排品牌 + `scroll-kicker` + 大标题「一盏中国茶 / 半卷山水味」+ 搜索条（label 竖排「茶笺」、按钮「寻茶」、建议下拉逻辑不变）；右列图片盘（`HeroBackground` 轮播）+ 竖排《茶经》句 + 图鉴印；底部「汤色带」六个茶类链接 → `?category=` |
| 卷二 六笺 | `CategoryGrid.vue` | 12 栏网格，前两类各占 4×2（大笺），其余各 2×1；每笺竖排茶名 + 汤色条 + 线描茶器 + 收录数量；点击跳列表 |
| 卷三 茶架 | `HotTeas.vue` | 横向滚动轨道 + 木架横板；左右箭头滚动；卡片复用 `TeaCard`；「查看全部」→ `/teas` |
| 卷四 茶签 | `RandomTea.vue` | CSS 签筒（筒身 + 5 支签 + 筒口）；「抽一支」触发 `shuffle`（400ms 旋转由父级 `spinning` 控制）；签文卡用线描茶器展示水温/投茶量/时间 |
| 卷五 茶话 | `TipsSection.vue` | 三列便签墙，便签带旋转与胶带；点击便签跳对应茶详情 |
| 落款 | `HomeView` | 墨线 + 朱砂「茶」印 + 「一席六笺 · 未完待续」 |

响应式：`ChapterRail` 仅在 ≥1280px 显示；≤820px Hero 改单列；≤640px 六笺取消错落、改为 2×3 等分，汤色带横向滚动，便签墙单列。

### 13.4 P2 列表页：茶品总目

- 题头 `.list-head`：`scroll-kicker`「茶品总目」+ 标题（面包屑同源）+ 一句说明。
- 两栏 `.list-layout`：左栏 **264px** `.list-aside`（sticky `top:84px`，`max-height: calc(100vh - 104px)` 内部滚动），右栏结果区。
- `FilterBar.vue` 改为纵向「茶柜」：`筛` 印 + 「茶柜 / 按需取茶，逐层收窄」；每组抽屉带朱砂拉手；茶类 chip 带汤色点与分类色描边；价格下拉与组合方式分段按钮保留原事件。
- `FilterChips.vue`：纸深底方签，pill 方角描边，关闭按钮方形朱砂 hover。
- `TeaGrid.vue`：间距 20px，骨架屏 2px 圆角、图片 4:3。
- 空态：线描茶架 SVG（`empty-state__art`）替代 🫖，保留「清除筛选 + 3 款热门推荐」。
- 响应式：≤1024px 茶柜转横向 wrap 并取消 sticky；≤640px 恢复纵向单列。

### 13.5 P3 详情页：一席 · 四帖 · 茶则

| 区块 | 组件 | 结构与交互 |
|---|---|---|
| 一席（头部） | `DetailHero.vue` | `minmax(0,440px) 1fr` 双栏，左列 sticky（`top:88px`）：纸框主图 + 分类标签 + 朱砂茶名印（前 4 字 2×2）+ 图集缩略（「签1/签2」）；右列 meta + 茶名 + 产地印 + **茶则三则**（水温/投茶量/时间，线描图标 + 底纹刻度）+ 操作区（收藏/写笔记/分享/投稿，事件不变） |
| 区块外壳 | `DetailSection.vue` | 顶部墨线；标题前朱砂方点，楷体标题，右侧渐隐线 |
| 品鉴四帖 | `DetailSenses.vue` | 外形/汤色/香气/滋味四帖，左竖排标题 + 朱砂竖线 + 线描图标；4/2/1 列响应式，`min-height:186px` |
| 茶小知识 | `DetailTips.vue` | 两列便签，顶部 2px 茶褐边，线描图标；空内容整块隐藏（逻辑不变） |
| 其余区块 | `DetailVideo/Articles/Related` | 沿用原结构与数据，仅随全局 Token 去圆角、换墨色 |

响应式：≤1024px 头部改单列、主图取消 sticky；≤640px 操作区换行、四帖单列。

### 13.6 动效与可访问性

- 所有新增过渡/旋转/滚动动效均在 `@media (prefers-reduced-motion: reduce)` 下关闭或降级（含「抽签」旋转、Hero 轮播、便签 hover）。
- 装饰性图标、印章、纸纹、墨线均 `aria-hidden="true"`；不截获焦点、不改变 Tab 顺序。
- 竖排文字仅用于短标题/印章，正文保持横排；`.vertical-text` 强制 `nowrap` 防止单字断列。
- 正文与纸底对比度沿用 `--color-ink` / `--color-ink-soft`（≥ 7:1 / ≥ 4.5:1），朱砂仅做小面积强调。

### 13.7 未变更项（回归确认）

- 路由、导航守卫、搜索建议、筛选/排序/分页 URL 同步、收藏、笔记、分享、投稿、下拉刷新全部沿用原逻辑。
- 后端接口、请求参数、响应字段、错误码零改动；`原型/`、`DESIGN_SYSTEM.md` 既有 Token 语义未破坏（仅新增与细化）。
