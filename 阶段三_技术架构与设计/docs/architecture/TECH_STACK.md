# 茗脉 · 技术栈与工程基线（TECH_STACK）

| 项 | 内容 |
|---|---|
| 文档版本 | V1.0 |
| 编写日期 | 2026-11-06 |
| 适用阶段 | 阶段三 技术架构与工程 · 第 1 轮 |
| 上游依据 | [PRD](../product/PRD.md) V1.2、[PAGE_SPECS](../design/PAGE_SPECS.md) V1.4、[DESIGN_SYSTEM](../design/DESIGN_SYSTEM.md)、[M1_CONTENT_PLAN](../product/M1_CONTENT_PLAN.md) |
| 下游交付 | 第 2 轮 ARCHITECTURE.md / MODULE_DESIGN.md、第 3 轮数据库、第 4 轮 API 契约、第 5 轮安全与测试 |
| 决策状态 | 三项关键选型已于 2026-11-06 确认 |

---

## 1 目标与边界

本文件只回答"用什么技术、什么版本、怎么跑起来"，不展开模块划分与接口细节（留给第 2～4 轮）。

范围边界：

- V1 为 Web 优先 + 移动浏览器自适应，小程序入口后续独立设计 UI，共用同一后端接口。
- 同时在线按 100 并发设计，内容规模为 23 亚类 / 46 款茶品，图片单张 ≤5MB、仅 jpg/png/webp。
- V1 不使用商用 CDN；不做价格、商品、支付、社交关注、自动识图。
- 图片必须可追溯来源与授权，演示图（`docs/content/demo-images/`）不得进入生产存储。

---

## 2 技术栈总览

| 层次 | 选型 | 版本基线 | 说明 |
|---|---|---|---|
| 后端语言 | Java | 17（LTS） | 与阶段三教学基线一致 |
| 后端框架 | Spring Boot | 3.2.x | Web、校验、定时任务、Actuator |
| 持久层 | MyBatis-Plus | 3.5.x | 单表 CRUD + 分页插件；复杂查询写 XML |
| 数据库 | MySQL | 8.0.x | InnoDB、utf8mb4、事务 |
| 缓存 / 会话 | Redis | 7.x | 会话与刷新令牌、热点缓存、限流计数 |
| 迁移管理 | Flyway | 10.x | 版本化 SQL，禁止手改线上表结构 |
| 前端框架 | Vue | 3.4.x | Composition API + `<script setup>` |
| 前端构建 | Vite | 5.x | 开发代理 `/api` 到后端 |
| 前端语言 | TypeScript | 5.4.x | 严格模式 |
| 路由 / 状态 | Vue Router 4 / Pinia 2 | — | 38 页路由与登录态、筛选态 |
| 请求层 | Axios | 1.x | 统一拦截、错误码映射、重试仅限幂等 GET |
| 后台组件 | Element Plus | 2.x | 仅管理端使用，前台沿用设计系统自研样式 |
| 运行环境 | Node.js | 20 LTS | 仅用于前端构建与本地工具链 |
| Web 服务器 | Nginx | 1.24+ | 静态资源、反向代理、gzip/brotli |
| 容器化 | Docker + Compose | 24+ | 本地与 V1 单机部署一致 |
| 测试 | JUnit 5 / Mockito / Testcontainers / Vitest / Playwright | — | 单测、集成、组件、端到端 |
| 日志 | SLF4J + Logback | — | JSON 行日志，按天滚动保留 180 天 |

---

## 3 关键选型与备选

### 3.1 后端：Java 17 + Spring Boot 3 + MyBatis-Plus（已确认）

| 方案 | 优点 | 代价 | 结论 |
|---|---|---|---|
| Java 17 + Spring Boot 3 + MyBatis-Plus | 生态成熟；审核留痕、白名单、定时任务、批量导入均有成熟做法；团队与教学基线一致 | JVM 内存占用较高；启动比脚本语言慢 | **采用** |
| Node.js + NestJS + TypeORM | 前后端同语言，迭代快 | 企业级审计、事务与批处理需自行补齐规范 | 不采用 |
| Python + FastAPI + SQLAlchemy | 开发快、OpenAPI 自动生成 | 与阶段五教学口径（Java）易冲突，需额外维护两套认知 | 不采用 |

落地约定：

- 分层为 `controller → service → mapper`，禁止 controller 直连 mapper。
- DTO 与实体分离；入参用 Bean Validation，出参不直接暴露实体。
- 事务只加在 service 的写方法上；批量导入单批 ≤500 行，失败行回滚并输出错误清单。
- MyBatis-Plus 仅用于单表 CRUD；涉及审核日志、统计、联表的复杂 SQL 走 XML 并附索引说明。

### 3.2 前端：Vue 3 + Vite + TypeScript（已确认）

| 方案 | 优点 | 代价 | 结论 |
|---|---|---|---|
| Vue 3 + Vite + TS | 与 38 页原型的信息架构易对齐；组件化后可复用筛选项、图鉴、卡片 | 需把原生原型迁移为组件与路由 | **采用** |
| 延续原生 HTML/CSS/JS | 原型可直接用，零迁移 | 跨页登录态、权限守卫、筛选联动会重复实现 | 不采用 |
| React + Next.js | SSR/SEO 友好 | 与现有原型差异最大，迁移成本最高 | 不采用 |

落地约定：

- 前台与后台同一 SPA，路由前缀区分 `/` 与 `/admin`，各自独立路由守卫与布局。
- 设计 token 从 `DESIGN_SYSTEM.md` 落到 `src/styles/tokens.css`，组件不得写死色值。
- 图片统一走 `components/TeaImage.vue`，内置 4:3 裁切、懒加载、失败占位与来源标注位。
- 仅管理端引入 Element Plus；前台不引第三方 UI 库，避免与茶色谱样式冲突。
- 首屏路由按需加载；列表页图片 `loading="lazy"`，详情首图 `fetchpriority="high"`。

### 3.3 数据层：MySQL 8 + Redis（已确认）

| 方案 | 优点 | 代价 | 结论 |
|---|---|---|---|
| MySQL 8 + Redis 7 | 事务与生态成熟；Redis 承担会话、热缓存、限流 | 需维护两类存储的一致性边界 | **采用** |
| 仅 MySQL 8 | 链路最简单 | 会话与限流落在应用层，横向扩容后失效 | 不采用 |
| PostgreSQL 16 + Redis | JSON、全文检索更强 | 团队熟悉度与运维成本更高 | 不采用 |

落地约定：

- MySQL：`utf8mb4` / `utf8mb4_0900_ai_ci`，时区统一 `Asia/Shanghai`，时间字段用 `DATETIME`。
- Redis 仅存可重建数据：会话/刷新令牌、热点茶品与筛选项缓存、限流计数、任务锁。业务主数据只落 MySQL。
- 缓存键统一 `mm:{env}:{domain}:{id}`；热点缓存 TTL 10 分钟，写操作后按茶品 ID 失效。
- 迁移用 Flyway；`database/init.sql` 只作首次建库与本地初始化，版本迭代一律新增迁移脚本。

---

## 4 图片与文件存储

| 项 | 方案 |
|---|---|
| 存储位置 | V1 本地磁盘 `/data/mm/uploads`，Nginx 以 `/uploads/` 直出，不启用商用 CDN |
| 目录规则 | `tea/{teaId}/{type}-{seq}.{ext}`，`type ∈ dry/soup/leaf/pack` |
| 上传校验 | 扩展名 + MIME + 文件头三重校验；单图 ≤5MB；仅 jpg/png/webp |
| 处理 | 上传即生成缩略图（640×480）与展示图（1600×1200），保留原图；统一 4:3 裁切 |
| 抽象 | 后端 `StorageService` 接口，V1 实现 `LocalStorage`，后续可替换对象存储而不改业务 |
| 合规 | 入库必录来源类型、权利人、授权范围、期限、凭证编号；缺凭证只允许草稿 |

演示图目录 `docs/content/demo-images/` 不属于上传目录，构建与部署脚本必须显式排除。

---

## 5 鉴权与会话

- 登录方式：微信授权（Web 扫码 / 小程序授权）→ 后端 `code2Session` 换 openid → 建号或复用 → 签发令牌。
- 令牌：JWT access token 有效期 2 小时；refresh token 7 天，存 Redis 并支持多设备；注销即拉黑。
- 角色：游客 / 注册用户 / 管理员 / 超管；管理员由 openid 白名单判定，不设独立密码。
- 权限校验在服务端拦截器统一执行，前端路由守卫仅做体验层拦截，不作为安全边界。
- 敏感配置（微信 AppSecret、数据库口令、初始超管 openid）只走环境变量，禁止入库、禁止进前端包。

---

## 6 部署拓扑与环境

V1 单机 Docker Compose，四类进程：

```
Nginx（443，TLS）
 ├─ /             → 前端静态 dist（SPA fallback）
 ├─ /uploads/     → 本地图片目录（只读）
 └─ /api/         → Spring Boot :8080
Spring Boot ── MySQL 8（内网 3306）
           └─ Redis 7（内网 6379）
```

- 环境：`dev`（本地 Compose）、`test`（验收）、`prod`（单机）；配置按 `application-{env}.yml` + 环境变量覆盖。
- 发布：前端 `vite build` 产物由 Nginx 托管；后端打 fat jar；数据库变更随发布执行 Flyway。
- 备份：每日 `mysqldump` + 上传目录增量，保留 7 份；恢复演练每季度一次。
- 监控：`/actuator/health` 供存活探测；日志按天滚动保留 180 天，审计表单独保留 180 天。

---

## 7 非功能落点

| PRD 指标 | 技术落点 |
|---|---|
| 首屏 ≤2 秒 | 路由按需加载；首屏接口合并为 1 次；图片缩略图 + 懒加载；Nginx gzip/brotli |
| 100 并发 | HikariCP 连接池 20；Redis 缓存筛选项与热门茶品；接口 P95 ≤300ms |
| 可用性 ≥95% | 单机 + 健康检查 + 自动重启；静态资源与接口分离，后端故障时前台仍可展示缓存页 |
| 弱网可读 | 文字走 HTTP 缓存（ETag）；缩略图本地缓存；离线提示不阻塞浏览 |
| 单图 ≤5MB | 上传前置校验 + 服务端二次校验，超限直接拒绝并保留已填内容 |
| 审计 180 天 | 操作日志表按月分区或归档任务，到期清理 |
| 备份 7 份 | 每日定时任务 + 保留策略，失败告警写入站内系统通知 |

---

## 8 工程约定

- 分支：`main` 保护；功能分支 `feat/{模块}`，修复 `fix/{问题号}`。
- 提交：一次提交只做一件事；提交信息写明"为什么"，关联任务号。
- 代码检查：后端 Checkstyle + SpotBugs；前端 ESLint + Prettier + `vue-tsc`。
- 测试门槛：核心 service 单测覆盖分支；接口集成测试用 Testcontainers 起真实 MySQL/Redis；关键链路（登录、收藏、投稿、审核、上下架）配 Playwright 用例。
- 禁止：为通过测试删用例、绕过权限、为文档一致改业务规则、未确认即改表结构。

---

## 9 待确认项（进入第 2 轮前）

| # | 事项 | 影响 | 建议 |
|---|---|---|---|
| 1 | 生产部署形态：单机 Compose 还是云主机 + 独立数据库 | 影响备份与扩容方案 | 建议 V1 单机 Compose，M3 后再评估 |
| 2 | 微信开放平台资质与回调域名 | 阻塞扫码登录联调 | 先用测试号，上线前补资质 |
| 3 | 小程序技术形态：原生 or Taro | 影响二期前端复用度 | 建议原生，接口层复用 |
| 4 | 图片存储是否在 M2 前切换对象存储 | 影响 `StorageService` 实现 | 建议 V1 本地磁盘，保留接口 |

---

## 10 本轮验收

1. 技术栈表覆盖语言、框架、数据库、缓存、前端、构建、部署、测试、日志九类，且版本可落地。
2. 三项关键选型均记录备选方案与否决理由，并与 2026-11-06 确认结果一致。
3. 图片存储、鉴权、备份、审计均有明确落点，未突破 PRD 的 V1 边界。
4. 待确认项不超过 4 条，且每条给出建议，不替业务方做最终决定。
