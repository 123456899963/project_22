# 茗脉 · 开发指南（DEVELOPMENT_GUIDE）

| 项 | 内容 |
|---|---|
| 文档版本 | V1.0 |
| 编写日期 | 2026-11-07 |
| 适用阶段 | 阶段四 AI 项目规范 · 第 2 轮 |
| 上游依据 | [AGENTS.md](../../AGENTS.md)、[TECH_STACK](../architecture/TECH_STACK.md)、[ARCHITECTURE](../architecture/ARCHITECTURE.md)、[API_CONTRACT](../api/API_CONTRACT.md)、[SECURITY](../architecture/SECURITY.md) |
| 下游交付 | 阶段五全部编码；[harness/TASK_TEMPLATE.md](../../harness/TASK_TEMPLATE.md)、[harness/AI_DECISION_RULES.md](../../harness/AI_DECISION_RULES.md) |
| 定位 | 把"规格 → 代码 → 验证 → 记录"固化为可重复的十步流程，并给出每层的编码细则 |

---

## 1 SDD 十步流程

> 每个任务（一个接口组、一个页面、一次修复）都按十步走。步骤可合并执行，但**不得跳过 1、3、5、8、9**。

| 步 | 名称 | 产出 | 完成判据 |
|---|---|---|---|
| 1 | 读规格 | 引用的 PRD 条款、PAGE 编号、API 路径、表名 | 能说清"这条规则来自哪一行" |
| 2 | 澄清 | 歧义清单 + 方案选项 | 高风险项已获确认（见 AI_DECISION_RULES §2） |
| 3 | 任务卡 | 一段式任务卡（用 TASK_TEMPLATE） | 输入/输出/边界/验收四项齐全 |
| 4 | 设计 | 接口签名、表操作、状态迁移、错误码、幂等点 | 错误码已存在于 API_CONTRACT §1.2 |
| 5 | 先写测试 | 单测或接口测试骨架 | 测试先红（或在无法运行时写明"未执行"） |
| 6 | 实现最小闭环 | 可工作的最小代码 | 只做任务卡范围内的事 |
| 7 | 自检 | 分层/权限/事务/分页/错误码/日志 六项清单 | 六项逐条打勾 |
| 8 | 验证 | 真实命令输出或真实接口响应 | 未执行必须写"未验证"，不得记为通过 |
| 9 | 记录 | build-log 条目（+ 必要时 ADR） | 记录决策与偏差，不只记"完成了" |
| 10 | 交付与复盘 | 变更清单 + 遗留项 | 遗留项有明确归属，不口头承诺 |

### 1.1 十步与阶段五的对应

| 阶段五轮次 | 主要任务 | 关键验证 |
|---|---|---|
| R2 基础工程 | 骨架、统一响应、异常、鉴权拦截、迁移、健康检查 | 启动成功 + `/actuator/health` + 一条空接口 200 |
| R3 登录与账号 | 二维码/回调/刷新/登出、资料、注销、白名单 | 令牌链路 + 账号状态门禁 |
| R4 目录与检索 | 分类、茶品列表/详情、首页、搜索、自查 | 8 维筛选 + 未分年份排除 + 自查空结果建议 |
| R5 互动与投稿 | 收藏/历史/对比/评论/点赞、投稿全流程 | 上限、去重、先审后发、重提 2 次锁定 |
| R6 后台与治理 | 茶品管理、审核、举报申诉、用户处罚、审计、导入、配置 | 状态机 + 审计同事务 + 不可处置自己 |
| R7 核验 | 逐项证据核对 | 产出 `docs/development/PROGRESS.md` |

---

## 2 后端编码细则

### 2.1 包与类模板

```
com.mingmai.catalog
├─ controller/TeaController.java          # 只做参数校验、调用 service、返回 Envelope
├─ service/TeaQueryService.java           # 接口
├─ service/impl/TeaQueryServiceImpl.java  # 事务边界、缓存、组装
├─ domain/TeaPublishPolicy.java           # 不变量：≥4 图、五维标签、待审唯一
├─ mapper/TeaMapper.java                  # MyBatis-Plus BaseMapper
├─ dto/TeaListQuery.java / TeaDetailResponse.java
└─ entity/Tea.java
```

### 2.2 统一响应与异常

- `ApiResponse<T>` 固定字段 `code` / `message` / `data` / `traceId`。
- 业务异常统一抛 `BizException(ErrorCode)`；由 `GlobalExceptionHandler` 转 HTTP 状态与错误体。
- 参数校验失败 → `MM-SYS-001` 400，`details` 列出 `field` + `reason`。
- 未捕获异常 → `MM-SYS-003` 500，日志带 traceId，响应**不含堆栈**。
- 禁止在 Controller 里 `try/catch` 吞异常；禁止返回裸 `Map`。

### 2.3 鉴权与账号状态

- `JwtAuthInterceptor` 解析 `Authorization: Bearer`，把 `LoginUser` 放入 `RequestContext`。
- 角色判定顺序：openid 白名单（Redis 60s）→ admin/super；否则登录用户；无令牌为游客。
- `@RequireRole({ADMIN, SUPER})` 注解拦截管理端；"仅超管"接口在 service 内再校验一次。
- 账号状态门禁：`deleting` 拦截评论/投稿/纠错/新增收藏；`muted` 拦截评论/投稿；`banned` 拦截全部写操作与登录。
- 数据归属校验放在 service：如 `/me/submissions/{id}` 必须比对 `userId`，不符返回 `MM-AUTH-003`。

### 2.4 事务、幂等与并发

- 事务只加在 `Application Service` 写方法；`@Transactional(rollbackFor = Exception.class)`。
- 审计写入与业务同事务；跨模块副作用用 `AFTER_COMMIT` 事件 + 补偿表（ADR-07）。
- 乐观锁：茶品/投稿带 `version`，更新条件含 `version`，影响行数 0 → `MM-CATALOG-002`。
- 唯一约束兜底：捕获 `DuplicateKeyException` 并映射到对应 409 错误码，不靠"先查后写"。
- 幂等：收藏/举报/点赞靠唯一键；审核动作要求状态仍为 `pending`，否则 409。

### 2.5 MyBatis 使用规则

| 场景 | 做法 |
|---|---|
| 单表 CRUD | `BaseMapper` + `LambdaQueryWrapper` |
| 多条件筛选（8 维） | XML 动态 SQL，`<if>` 逐维拼接；同维多值 `IN`，跨维 `AND` |
| 复杂联表/统计 | XML + 明确索引；禁止 `SELECT *` |
| 分页 | MyBatis-Plus 分页插件；`size` 上限 50 |
| 生成列/唯一索引 | 由迁移维护，实体不映射生成的约束字段 |

### 2.6 枚举与字典

- 枚举值必须与 [DATA_MODEL](../architecture/DATA_MODEL.md) §2 完全一致；Java 枚举用 `@EnumValue` 存字符串。
- 禁止在代码中出现未登记的状态字符串字面量；状态判断集中到 `domain` 内的 `*State` 类。

### 2.7 日志与 traceId

- 入口 Filter 读取 `X-Request-Id`，无则生成 8 位；写 MDC，响应头回传。
- 日志字段：时间、级别、traceId、userId（脱敏）、路径、耗时、错误码。
- 禁止打印 openid 全量、令牌、AppSecret、密码类字段。
- 慢请求 >500ms 打 WARN 单独行。

### 2.8 缓存

- 键 `mm:{env}:{domain}:{id}`；读穿 + 写失效；TTL 见 ARCHITECTURE §7.4。
- 缓存不可用时直读 MySQL，不得因缓存异常导致接口 5xx。
- 批量失效按域前缀删除；禁止"先删缓存后写库"。

---

## 3 前端编码细则

### 3.1 目录与职责

```
src/views/fore/     P01–P20 页面
src/views/admin/    A01–A18 页面
src/components/     TeaCard、TeaImage、StatusBadge、FilterChipsBar、EmptyState
src/modules/        按域封装 API 与 TS 类型（catalog / engagement / submission / moderation）
src/stores/         useAuthStore / useCatalogFilterStore / useCompareStore / useUnreadStore
src/router/         前台守卫（登录）、后台守卫（admin）、401 回跳
src/styles/tokens.css 源自 DESIGN_SYSTEM，组件禁写死色值
```

### 3.2 约定

- 组合式 API + `<script setup lang="ts">`；`vue-tsc` 严格模式，禁止 `any` 逃逸。
- 请求层统一 Axios 实例：注入 `Authorization`、`X-Request-Id`；响应统一解包 `data`，非 `OK` 抛业务错误并映射文案。
- 401 → 清登录态 + 跳登录并记录 `redirect`；403 → 提示无权限，不跳后台。
- 图片一律 `<TeaImage>`：4:3、懒加载、失败占位、来源标注位。
- 筛选态写入 URL query，可用 URL 复现；对比篮以服务端为准，Pinia 仅缓存。
- 前台不引第三方 UI 库；后台仅 Element Plus。
- 任何页面不得写死数量/文案/状态：来自接口或常量表。

### 3.3 状态与空态

- 列表空态、筛选无结果、加载失败三种状态必须区分；V1 按 PAGE_SPECS 既定决策，不额外实现骨架屏以外的加载动画。
- 错误提示必须给出可执行动作（重试/清空筛选/返回），禁止只显示"出错了"。

---

## 4 测试细则

| 层 | 工具 | 门槛 |
|---|---|---|
| 后端单测 | JUnit 5 + Mockito | 状态机、上限校验、权限判定、错误码映射必须有分支用例 |
| 后端集成 | Testcontainers（MySQL 8 + Redis 7） | 登录、审核、收藏上限、投稿限额、并发纠错 |
| 前端组件 | Vitest | TeaImage、FilterChipsBar、StatusBadge |
| 端到端 | Playwright | 登录、收藏、投稿、审核、上下架五条主链路 |

- 测试命名：`should_{expected}_when_{condition}`。
- 禁止为通过测试修改断言或删用例；先判断是代码错还是规格错，规格错先改文档。
- 本机无法运行测试时，交付说明标注"未执行"，并列出待执行命令。

---

## 5 自检清单（每轮提交前逐条打勾）

| # | 检查项 | 判据 |
|---|---|---|
| 1 | 分层 | Controller 无 Mapper 注入；跨模块只调 service |
| 2 | 权限 | 管理端接口有角色注解；归属校验在 service |
| 3 | 事务 | 写方法有事务；读方法无事务；审计同事务 |
| 4 | 分页 | 使用统一分页结构，`size` 上限 50 |
| 5 | 错误码 | 全部已登记；HTTP 语义与字典一致 |
| 6 | 日志 | traceId 贯通；无敏感字段 |
| 7 | 状态机 | 迁移点唯一；非法迁移返回 409 |
| 8 | 幂等 | 收藏/举报/点赞/审核有唯一键或状态校验 |
| 9 | 迁移 | 改表有 Flyway 脚本，未改历史脚本 |
| 10 | 文档同步 | API_CONTRACT / DATA_MODEL / build-log 已更新 |

---

## 6 评审关注点（Code Review）

1. 是否出现"文档没写、代码新增"的功能或字段。
2. 是否存在 Controller 直连 Mapper、跨模块改表。
3. 状态迁移是否绕过归属模块（尤其审核直接写 `status`）。
4. 上限/配额是否只在前端校验（必须服务端兜底）。
5. 错误码是否新增未登记、HTTP 状态是否错配。
6. 是否存在 `SELECT *`、缺索引的联表、N+1 查询。
7. 前端是否写死色值/数量/状态文案。
8. 是否有未使用的兼容层、注释掉的死代码、无主 TODO。

---

## 7 本轮验收

1. 十步流程每一步都有产出与完成判据，且与阶段五 7 轮一一对应。
2. 后端 8 类细则（响应、异常、鉴权、事务、MyBatis、枚举、日志、缓存）均可直接落地。
3. 前端 3 类细则（目录、请求、状态空态）覆盖 38 页共性。
4. 自检清单 10 项与评审 8 项可直接用于每轮提交前检查。
