# 茗脉 · 构建日志（build-log）

| 项 | 内容 |
|---|---|
| 文档版本 | V1.0 |
| 编写日期 | 2026-11-07 |
| 维护规则 | 每轮追加一条；只记决策、偏差、验证证据与遗留，不写流水账 |
| 关联 | [ADR](../docs/development/ADR.md)、[PLANS](../docs/development/PLANS.md)、[PROGRESS](../docs/development/PROGRESS.md) |

---

## 2026-11-05 · 阶段一 需求分析与 PRD

- **完成**：需求访谈确认 23 亚类 / 46 款、六大茶类结构、图鉴 4～5 张规则、识茶 B2 方案、账户与互动范围、治理与合规边界。
- **关键决策**：V1 移除购买跳转；白茶按 4 花色、云南普洱归黑茶；等级三档且非必填；识茶不做自动识图。
- **产出**：`docs/product/PRD.md`（20 章）。
- **偏差**：无。
- **遗留**：部分规则编号在 §6.5 与 §8.2 存在重号（R-14～R-17），已在 ARCHITECTURE §12 登记，引用以条款文字为准。

## 2026-11-06 · 阶段二 UI/UX 与原型

- **完成**：方向 B「茶色谱图鉴」；`DESIGN_SYSTEM.md`、`PAGE_SPECS.md`（38 页）；HTML 原型扩展至完整 38 页；全量浏览器实测与 49 项交互验收。
- **关键决策**：Web 优先、小程序后续独立 UI 共用后端；前台不引第三方 UI 库；举报/点赞需登录；详情页单页长滚动 + 吸顶锚点。
- **产出**：`docs/design/DESIGN_SYSTEM.md`、`docs/design/PAGE_SPECS.md`（V1.4）、`prototype/`。
- **偏差**：按既定决策不实现骨架屏以外的加载/失败态；已记录在 PAGE_SPECS。
- **遗留**：真实图片素材、授权凭证、年份批次证据仍待补（内容建设阻塞项）。

## 2026-11-06 · 阶段三 R1 技术栈

- **完成**：`TECH_STACK.md`；Java 17 / Spring Boot 3.2 / MyBatis-Plus 3.5、Vue 3.4 / Vite 5 / TS、MySQL 8 / Redis 7、Flyway、Nginx、Compose。
- **偏差**：否决 Node/NestJS 与 Python/FastAPI 两个备选，理由已记录。
- **遗留**：微信资质与回调域名、生产部署形态等待确认 4 项。

## 2026-11-07 · 阶段三 R2 架构与模块

- **完成**：`ARCHITECTURE.md`（C4 三层、6 条时序、8 项横切、9 条 ADR、故障降级）与 `MODULE_DESIGN.md`（11 模块、38 页映射、8 组状态机、权限矩阵）。
- **关键修正**：对比篮改为服务端持久化（ADR-10）；审核动作与状态迁移分离（ADR-11）。
- **偏差**：PAGE_SPECS §3.3 残留 Flask/Python 表述，未改上游，按 ADR-12 以 TECH_STACK 为准。
- **遗留**：2 项待确认（导入是否"全部校验通过才允许"、年份区间口径）。

## 2026-11-07 · 阶段三 R3 数据库

- **完成**：`ER.md`、`DATA_MODEL.md`、`database/init.sql`。
- **验证**：`init.sql` 静态统计 38 张表、44 个外键、22 个唯一约束；种子数据含 6 茶类 / 23 亚类。
- **偏差**：本机 MySQL 客户端为 5.7.19，无法执行 MySQL 8 DDL，**未做真实建库验证**。
- **遗留**：生成列 `pending_guard` 需在 MySQL 8 环境复验。

## 2026-11-07 · 阶段三 R4 API 契约

- **完成**：`API_CONTRACT.md`、`openapi.yaml`。
- **验证**：契约路径与 openapi operation 一一对应（73 路径 / 91 操作）。
- **偏差**：无。
- **遗留**：新增错误码必须先登记再接代码（已写入 AGENTS.md §7）。

## 2026-11-07 · 阶段三 R5 安全与测试

- **完成**：`SECURITY.md`、`TEST_PLAN.md`。
- **验证**：安全条目覆盖鉴权、越权、上传、注入、日志脱敏、审计；测试用例覆盖五条主链路与六类异常（E11～E16）。
- **偏差**：无。
- **遗留**：Testcontainers 与 Playwright 用例需在阶段六实际执行。

## 2026-11-07 · 阶段三 R6 一致性检查

- **验证**：38 表、73 路径 / 91 操作、11 模块、38 页、6 组状态机交叉核对一致；API_CONTRACT 补齐 26 个错误码；SECURITY/TEST_PLAN 引用均存在。
- **修复**：错误码清单与 openapi 对齐；`init.sql` 统计口径统一。
- **偏差**：上游 Flask 冲突保留并登记。
- **结论**：阶段三通过，可进入阶段四。

## 2026-11-07 · 阶段四 R1–R5 AI 规范与 Harness

- **完成**：`AGENTS.md`、`docs/development/DEVELOPMENT_GUIDE.md`、`harness/AI_DECISION_RULES.md`、`harness/TASK_TEMPLATE.md`、`docs/development/ADR.md`、本文件。
- **关键决策**：SDD 十步流程固定为"读规格→澄清→任务卡→设计→先测→实现→自检→验证→记录→复盘"；风险三级授权；证据驱动的进度口径。
- **偏差**：无。
- **遗留**：Harness 自检（R6）待执行。

## 2026-11-07 · 阶段五 R1–R7 正式开发

- **完成**：R1 任务拆解（PLANS.md）；R2 基础工程；R3 登录与账号；R4 目录与检索；R5 互动与投稿；R6 管理后台与治理；R7 进度核验（PROGRESS.md）。
- **前端验证（实际执行）**：`npm run type-check` 通过；`npm run build` 通过（1794 模块，7.91s，主包 246.21 kB / gzip 90.79 kB）。工作台字段改造后两项命令均复跑通过。
- **后端验证**：本机无 JDK/Maven，**未编译、未运行**；补齐 `ReportEvidence`、`ReportEvidenceMapper`、`AppealMapper`、`SanctionMapper`、`MessageController` 后静态引用闭合。
- **本轮修复**：后台设置读写统一限超管（对齐 API_CONTRACT 权限矩阵）；后台茶品列表移除误用的"审修订"动作；`AdminSubcategoryView` 补 `categoryId`；`/admin/teas/{id}` 的 `offline/online` 改为 `unpublish/publish`；`/me/overview` 字段对齐；工作台 KPI 改为 `pendingTeas/pendingSubmissions/pendingReports/overdue/publishedLast7Days` 并同步前端类型与 A02 卡片；Element Plus 样式随后台布局按需加载，后台路由改为懒加载。
- **偏差**：见 `docs/development/PROGRESS.md` §4（D1–D13）。
- **结论**：阶段五完成并停止，不进入阶段六。

---

## 附：发现但未修清单

| # | 事项 | 原因 | 处理计划 |
|---|---|---|---|
| 1 | PAGE_SPECS §3.3 Flask/Python 表述 | 不改上游历史文档，避免文档连锁改动 | 下次 PAGE_SPECS 修订时消除 |
| 2 | PRD 规则编号 R-14～R-17 重号 | 同上 | 以条款文字为准；阶段六统一勘误 |
| 3 | 本机无 JDK/Maven | 环境限制 | 阶段五后端仅静态检查，交付说明标注"未编译验证" |
| 4 | 本机 MySQL 客户端 5.7 | 环境限制 | MySQL 8 DDL 未实跑；阶段六在容器环境复验 |


---

## R21 图片与内容上线（2026-11-09）

- **图片生成**：HTTP 接口 `text_to_image` 只回占位图，改用内置图片生成工具（约 21s/张）。46 款 × 4 张（dry/soup/leaf/pack，seq 1-4）共 184 张：
  - 39 款（144 张）为按五维标签（外形/色泽/汤色/发酵/香气）构造提示词的 AI 生成图，统一「白瓷审评盘/杯 + 暖色亚麻背景」风格，1920x1920；
  - 7 款（28 张）复用仓库 `docs/content/demo-images/` 素材（福鼎白牡丹、君山银针、大红袍、铁观音、祁红、千两、熟普），带右下角「内部样稿」水印，属已知待替换项；
  - 全部经 `StorageService` 规则派生 `thumb-*`（640x480）与 `display-*`（1600x1200）；MD5 校验 184 张零重复。
- **数据补齐**：`tea_region` 为 46 款 published 茶品补主产地（取自 `origin_summary`）；legacy `龙井`(id=1)、`铁观音`(id=2) 与新增内容重复且无图，已按内容去重下架（offline，附审计理由）。
- **状态**：`tea` 表 published=46、offline=2、`gallery_ready`=46、五维标签齐；图鉴页显示「共 184 张」。
- **前端实测（Playwright，实际执行）**：1440x900 访问首页 / `/teas/green` / `/tea/32` / `/gallery`，卡片图均 `naturalWidth>0`、0 占位块、0 控制台错误、0 ≥400 响应；另开 390x844 移动上下文正常。截图见 `.screenshots/content-*.png`。
- **未完成项**：7 款 demo 图带「内部样稿」水印，待后续按生成图风格重出并替换。
