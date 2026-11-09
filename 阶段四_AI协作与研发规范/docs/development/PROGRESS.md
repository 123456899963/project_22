# PROGRESS · 阶段五进度核验

> 依据：`docs/development/PLANS.md` 阶段五七轮任务、`AGENTS.md` §10、`harness/AI_DECISION_RULES.md` 证据口径。
> 核验日期：2026-11-07 ｜ 状态口径：**P0 已验证** / **P1 已实现但未运行验证** / **P2 明确偏差或占位**。

## 1 环境与验证边界

| 项 | 实况 | 影响 |
|---|---|---|
| JDK / Maven | 本机不存在 | 后端 **未编译、未运行**，全部为静态检查结论（P1） |
| MySQL | 客户端 5.7，未连 8.0 实例 | `database/init.sql` 与 Flyway 脚本 **未实跑** |
| Node / npm | 可用 | 前端 `type-check`、`build` 已实际执行通过（P0） |
| 前端构建 | `vue-tsc --noEmit` 通过；`vite build` 通过，1794 模块，7.91s | 证据见 §3 |

## 2 七轮任务核验

### R1 任务拆解（P0）

- 产出 `docs/development/PLANS.md`：阶段五 7 轮、每轮输入/产出/验收口径与依赖顺序。
- 核验：轮次与 PRD 模块 M01–M11、PAGE_SPECS 38 页可映射，无"无主"任务。

### R2 基础工程（P1）

- 后端：`backend/pom.xml`（Spring Boot 3.2.5 / MyBatis-Plus 3.5.5 / Flyway 10.4.1 / JJWT）、`application-{dev,test,prod}.yml`、`db/migration/V1__init.sql`、统一 `ApiResponse` / `BizException` / `ErrorCode` / `RequestContext`、`GlobalExceptionHandler`、`TraceIdFilter`、CORS 与静态 `/uploads`。
- 前端：Vite + Vue 3.4 + TS 5.4、`src/api/http.ts`（统一响应解包、错误抛出、令牌注入）、`ForeLayout` / `AdminLayout`、设计 token 样式。
- 未验证：后端启动、Flyway 迁移、健康检查（`/actuator/health`）实际返回。

### R3 登录与账号（P1）

- 后端：微信回调 + dev 登录、JWT access 2h / refresh 7d、`TokenStore` Redis 白名单、`AuthInterceptor`（角色 + 账号状态）、`AccountService`（资料/概览/注销冷静期/白名单）、`AdminWhitelistController`。
- 前端：`LoginView`、`ProfileView`、`SettingsView`（资料、注销撤销）、`auth` store。
- 核验点：注销冷静期放行 `DELETE /me/deletion` 与 `/auth/logout`；禁言仅拦截写操作。

### R4 茶品目录与检索（P1）

- 后端：分类树、茶品列表/详情、年份与标签筛选、搜索、识茶、图鉴、收藏计数、浏览历史、同茶自查。
- 前端：首页、茶类列表、搜索、详情、识茶输入/结果、图鉴、对比、历史。
- 契约：分页 `page/size(1–50)/total/hasMore`、错误码 `CATALOG_*`。

### R5 互动与投稿（P1）

- 后端：收藏、点赞、评论（待审/发布）、浏览历史、对比数据、投稿 T1/T3/T4 全流程（草稿→提交→驳回→重提→锁定）、`SubmissionStatsService`。
- 前端：`SubmissionFormView`、`SubmissionPreviewView`、`SubmissionsView`、`CompareView`、`HistoryView`、`MessagesView`。
- 关键规则：日限额 3、重提 ≤2、T4 同茶同字段唯一、标题 ≤60、正文 ≥300、T3 1–5 图、T4 理由 20–200。

### R6 管理后台与治理（P1，前端 P0）

- 后端：投稿/评论审核、举报与证据、处置与处罚、申诉复核（超管）、用户列表、站内消息、审计查询/导出、配置中心、工作台聚合。
- 前端：A01–A18 全部落地（登录复用 `LoginView`），路由全部替换为真实组件，后台改为按需加载。
- 安全检查：`/admin/admins`、`/admin/settings`、申诉复核仅 `super`；审计导出仅 `super`；设置读写均限超管（按 API_CONTRACT 权限矩阵修正）。
- 未验证：所有接口的实际请求/响应、审核状态机落库、Redis 白名单失效行为。

### R7 核验与复盘（P0）

- 本文档 + `build-log.md` 更新 + 阶段五复盘（见 §5）。
- 明确停止：不进入阶段六（测试与交付）。

## 3 可复现证据

| 证据 | 命令 | 结果 |
|---|---|---|
| 前端类型 | `cd frontend && npm run type-check` | 通过（`vue-tsc --noEmit` 无输出，工作台字段改造后复跑） |
| 前端构建 | `cd frontend && npm run build` | 通过；`dist/index-*.js` 246.21 kB（gzip 90.79 kB），Element Plus 单独 364.56 kB CSS 仅随 `AdminLayout` 懒加载 |
| 后端静态完整性 | 缺失的 `ReportEvidence` / `ReportEvidenceMapper` / `AppealMapper` / `SanctionMapper` / `MessageController` 已补齐 | 静态引用闭合；**未编译** |
| 路由覆盖 | `frontend/src/router/index.ts` | A01–A18、P01–P20 均为真实组件，仅 404 使用占位 |

代码规模快照（供后续核对）：后端 160 个 Java 文件（20 Controller / 29 Service / 38 Mapper）；前台视图 18 个、后台视图 16 个。

## 4 已知偏差（P2，必须在阶段六前处置或书面接受）

| # | 偏差 | 现状 | 建议 |
|---|---|---|---|
| D1 | T3 用户补图无上传接口 | 前台创建/提交禁用，仅后台图鉴可传 | 阶段六补 `/me/uploads` 或复用 `/admin/media` 的受限分支 |
| D2 | T3 授权勾选未落库 | 仅创建时校验 `licenseGranted`，无字段可审计 | 迁移新增 `license_granted_at` / `license_scope` |
| D3 | T4 仅部分字段可自动应用 | 支持 name/origin/quality/productionYear/alias，其余返回"暂不支持在线纠错" | 扩展字段映射或改为人工编辑指引 |
| D4 | 修订快照为最小 JSON | `snapshotOf` 只写变更前后标量 | 按 DATA_MODEL 补全量快照 |
| D5 | 批量导入未实现 | 无 POI 依赖，`AdminImportView` 为说明页 | 引入 POI 后补三步导入 |
| D6 | 举报说明长度上限不一致 | PAGE_SPECS 200 字，后端 1000 字；前端限 200 | 统一为 200 并补校验 |
| D7 | 审计导出格式 | 契约只写 `export=true`，实现为 CSV | 若验收要求 xlsx，补 POI 导出 |
| D8 | 站内消息 180 天清理任务缺失 | 仅查询/已读，无定时清理 | 补 `@Scheduled` 清理任务 |
| D9 | 用户端申诉入口缺失 | 后端有申诉创建/复核，前台无页面 | 视 PRD 是否需要用户入口 |
| D10 | 处罚列表按状态过滤在分页后 | 过滤后 `total` 不精确 | 下沉为 SQL 条件 |
| D11 | 投稿/评论超时未排除节假日 | 固定 24h；举报 SLA 固定 48h | 与运营确认口径 |
| D12 | `AdminSubcategoryView` 增补 `categoryId` | 为新建茶品提供分类外键 | 已同步前端与 openapi 说明（若未登记，阶段六补） |
| D13 | 工作台统计卡口径 | PAGE_SPECS A02 为 4 卡（待审核条目/待审核投稿/待处理投诉/超时项）；API_CONTRACT 另含"近 7 日上架数" | 接口返回 5 字段，页面保留 4 卡并把"近 7 日上架"放在标题副文案，避免与 A02 版式冲突 |

## 5 阶段五复盘结论

1. **与文档一致性**：R1–R7 的页面、模块、状态机、错误码、权限矩阵均按 PAGE_SPECS / PRD / MODULE_DESIGN 落地。逐项比对后未发现"另起体系"的实现；发现并修正的偏差为：后台设置权限越权、茶品列表"审修订"误走茶品审核、`AdminSubcategoryView` 缺分类外键、`offline/online` 路径与后端不一致、`/me/overview` 字段名不一致、Element Plus 组件未注册样式、工作台 KPI 字段与 A02 不一致。
2. **验证诚实性**：前端两项命令真实通过；后端仅静态检查，未伪造编译/接口结果。
3. **结论**：阶段五按计划完成，允许进入阶段六，但 D1/D2/D5/D8 需在阶段六首轮补齐或书面接受。

> 阶段五到此停止。阶段六（测试、部署、验收与交付）未开始。
