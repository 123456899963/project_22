# AGENTS.md · 茗脉仓库级 AI 与开发约束

> 本文件是本仓库**唯一**的 AI 协作与工程约束入口。任何人（含 AI 编码助手）在本仓库写代码、改文档、执行命令前，必须先读本文件与 §1 的必读文档。
> 文档版本 V1.0 ｜ 编写日期 2026-11-07 ｜ 适用阶段：阶段四 第 1 轮起，直至项目结束。

---

## 1 项目与必读顺序

茗脉是六大茶类知识库与图鉴平台：23 个亚类、46 款茶品、38 个页面（前台 P01–P20、后台 A01–A18），Web 优先 + 移动自适应，V1 单机部署、100 并发。

开工前按顺序阅读，**上游优先**；发生冲突时按 §1.1 裁决：

| 顺序 | 文档 | 作用 |
|---|---|---|
| 1 | [docs/product/PRD.md](docs/product/PRD.md) | 业务规则、状态机、V1 边界（最高业务权威） |
| 2 | [docs/design/PAGE_SPECS.md](docs/design/PAGE_SPECS.md) + [DESIGN_SYSTEM.md](docs/design/DESIGN_SYSTEM.md) | 38 页职责、路由、设计 token |
| 3 | [docs/architecture/TECH_STACK.md](docs/architecture/TECH_STACK.md) | 技术栈与版本（最高技术权威） |
| 4 | [docs/architecture/ARCHITECTURE.md](docs/architecture/ARCHITECTURE.md) | 分层、横切能力、故障降级、ADR |
| 5 | [docs/architecture/MODULE_DESIGN.md](docs/architecture/MODULE_DESIGN.md) | 11 模块、状态机、权限矩阵 |
| 6 | [docs/architecture/DATA_MODEL.md](docs/architecture/DATA_MODEL.md) + [database/init.sql](database/init.sql) | 38 表、字段口径 |
| 7 | [docs/api/API_CONTRACT.md](docs/api/API_CONTRACT.md) + [openapi.yaml](docs/api/openapi.yaml) | 接口与错误码 |
| 8 | [docs/architecture/SECURITY.md](docs/architecture/SECURITY.md) + [TEST_PLAN.md](docs/testing/TEST_PLAN.md) | 安全红线、测试用例 |
| 9 | [docs/development/DEVELOPMENT_GUIDE.md](docs/development/DEVELOPMENT_GUIDE.md) | SDD 十步流程与编码细则 |
| 10 | [harness/AI_DECISION_RULES.md](harness/AI_DECISION_RULES.md) | 何时提问、何时执行、何时停止 |

### 1.1 冲突裁决

1. 业务规则冲突：以 PRD 条款文字为准；PAGE_SPECS 与 PRD 不一致时，先记录差异再按 PRD 实现。
2. 技术栈冲突：以 TECH_STACK 为准。后端语言为 **Python + FastAPI**，MySQL 为 **5.7**，不得再按 Java/MySQL 8.0 的历史表述实现。
3. 接口字段冲突：以 API_CONTRACT + openapi.yaml 为准；两者不一致视为缺陷，先修文档再写代码。
4. 表结构冲突：以 DATA_MODEL + init.sql 为准；改动必须新增 `database/migration/V{n}__{desc}.sql`，不直接改 init.sql 的历史部分。

---

## 2 技术栈锁定（不得擅自更换）

| 层 | 选型 | 版本 |
|---|---|---|
| 后端 | Python + FastAPI + SQLAlchemy | 3.11+ / 0.115.x / 2.0.x |
| 数据库 | MySQL | **5.7.x**（utf8mb4 / utf8mb4_unicode_ci） |
| 驱动 | PyMySQL | 1.1.x |
| 缓存/会话 | Redis | 7.x |
| Schema 变更 | 手写 SQL 迁移 | `database/migration/V{n}__*.sql` |
| 前端 | Vue + Vite + TypeScript | 3.4.x / 5.x / 5.4.x |
| 路由/状态 | Vue Router / Pinia | 4.x / 2.x |
| 请求 | Axios | 1.x |
| 后台 UI | Element Plus（**仅** /admin） | 2.x |
| 运行 | Node.js / Nginx / Docker Compose | 20 LTS / 1.24+ / 24+ |

禁止：引入消息队列、Elasticsearch、独立文件服务、商用 CDN、微服务拆分、前台第三方 UI 库、小程序框架进 V1 主包。

> MySQL 5.7 不执行 `CHECK` 约束，枚举合法值必须在应用层（Service / Pydantic DTO）校验，不得依赖数据库兜底。

---

## 3 目录结构约定

```
backend/   app/{main.py,core,models,services,api}
           core = 配置/响应/错误码/鉴权/审计/存储/分页；services 承载业务规则与事务；api 只做路由与 DTO
           requirements.txt、tests/
frontend/  src/{views/fore,views/admin,components,modules,stores,router,styles}
database/  init.sql（首次建库）+ migration/V{n}__*.sql（版本演进）
deploy/    docker-compose.yml、nginx.conf、backup.sh、.env.example
docs/      product / design / architecture / api / testing / development / content
harness/   AI_DECISION_RULES.md、TASK_TEMPLATE.md、HARNESS_CHECK.md、build-log.md
prototype/ 阶段二原型（只读参考，不参与构建，不部署）
legacy-java/ Java 期源码归档（只读对照，不参与构建，可删除）
```

规则：新增服务必须能映射到 MODULE_DESIGN 的 M01–M11；不得创建"无主"目录。演示图 `docs/content/demo-images/` 与 `prototype/assets/` 构建时显式排除。

---

## 4 命令基线

```bash
# 后端（Python 3.11+）
cd backend && python -m venv .venv && .venv/Scripts/pip install -r requirements.txt
cd backend && .venv/Scripts/python -m uvicorn app.main:app --port 8080

# 前端
cd frontend && npm ci && npm run type-check && npm run build

# 本地依赖
docker compose -f deploy/docker-compose.yml up -d mysql redis
```

- 命令失败必须修到通过再提交；**未实际执行的命令不得在文档/汇报中记为通过**。
- 本机无 MySQL 服务时，DDL 只能做静态校验，必须在交付说明中标注"未连库验证"。

---

## 5 后端分层与依赖规则（违反即评审拦截）

```
中间件（traceId→JWT→账号状态→角色）
 → api 路由层（Pydantic DTO 校验）
 → services（业务规则、状态机、事务、审计埋点；复杂查询走 text() SQL）
 → models（SQLAlchemy 单表映射）
```

1. api 路由只依赖本模块 service，禁止直连 ORM 查询、禁止跨模块写表。
2. 跨模块只调用对方 service 公开函数（如 `catalog_service.get_tea_or_404`），禁止直接读改对方表。
3. 状态迁移只在归属模块内发生；审核模块只"请求迁移"，不直接写状态列。
4. DTO 与模型分离；出参不暴露 openid 全量、内部字段、堆栈。
5. 事务只加在 service 写方法（`db.commit()`）；只读查询不提交。
6. `app/core` 不得反向依赖 `app/services` / `app/api`；跨模块回调用 `register_*_provider` 注册。

---

## 6 命名与编码

| 对象 | 规范 |
|---|---|
| 模块 | `app/api/{module}.py` 路由、`app/services/{module}_service.py` 业务、`app/models/{module}.py` 模型 |
| 类 | 帕斯卡命名；Pydantic 请求模型后缀 `Request`，响应直接用 dict 组装 |
| 函数 | 动词开头：`create_*`、`review_*`、`list_*`、`count_*` |
| 数据库 | 表/列小写下划线；外键 `xxx_id`；索引 `idx_表_列`；唯一 `uk_表_列` |
| 常量/枚举 | 枚举值与 DATA_MODEL §2 完全一致，禁止自造同义词 |
| 前端 | 组件 `XxxView.vue` / `XxxPanel.vue`；store `useXxxStore`；API 文件按模块 |

- 后端 `python -m compileall` + 启动冒烟；前端 ESLint + Prettier + `vue-tsc`（严格模式，禁 `any` 逃逸）。
- 注释只解释"为什么"，不复述代码；禁止 TODO 无主、禁止注释掉的死代码入库。

---

## 7 API 约定（摘自 API_CONTRACT，写码前必核对）

- 前缀 `/api/v1`；成功 `{code:"OK",message,data,traceId}`；失败 `{code,message,details?,traceId}`。
- 错误码 `MM-{域}-{三位}`，域 ∈ AUTH/CATALOG/MEDIA/SUB/GOV/SYS；**新增错误码必须先登记到 API_CONTRACT §1.2 再接代码**。
- 分页请求 `page`(≥1) / `size`(1–50，默认 12)；响应 `{items,page,size,total,hasMore}`。
- 时间 ISO 8601 带 `+08:00`；日期 `YYYY-MM-DD`；图片 URL 一律 `/uploads/...` 站内路径。
- 写接口支持 `Idempotency-Key`（收藏、举报、点赞、审核动作）。
- 任意响应头回传 `X-Request-Id`；错误体含 `traceId`。

---

## 8 数据与迁移

- `database/init.sql` 只用于首次建库与本地初始化；任何变更走 `database/migration/V{n}__{desc}.sql`。
- 迁移只前滚、不修改已发布脚本；破坏性变更必须给出回滚说明与备份步骤。
- 枚举新增值需迁移脚本；JSON 仅用于快照、审计前后态、补偿载荷。
- 软删除统一 `deleted_at`；查询默认过滤。
- 关键唯一约束不得用应用层"先查后写"替代：待审茶品 `pending_guard`、纠错 `tea_id:field_key`、举报 `(举报人,对象类型,对象ID)`。
- MySQL 5.7 约束：禁用窗口函数、CTE、`utf8mb4_0900_*` 排序规则；枚举校验放应用层。

---

## 9 安全与合规红线

1. 敏感配置（微信 AppSecret、数据库口令、初始超管 openid）只走环境变量，禁止入库、禁进前端包、禁落日志。
2. 权限在服务端判定；前端守卫只是体验层。管理端接口一律 `admin|super`，标注"仅超管"的必须二次校验。
3. 上传三重校验（扩展名 + MIME + 文件头），单图 ≤5MB，仅 jpg/png/webp；缺授权凭证只能存草稿。
4. 审计（审核、上下架、白名单、处罚、投诉、申诉、导入、配置）与业务同事务写入，180 天保留。
5. 合规文案只写中性饮用描述，不写功效/禁忌/医疗；详情页保留免责声明。
6. 禁止为通过测试删用例、绕过权限、放宽校验、伪造数据。

---

## 10 提交与协作

- 分支：`main` 保护；`feat/{模块}`、`fix/{问题号}`；一次提交只做一件事。
- 提交信息：`type(scope): 为什么`，例 `feat(catalog): 支持年份倒序筛选，修复未录年份不参与筛选的歧义`。
- 提交前自检：后端启动冒烟（`uvicorn app.main:app` + `/health`）、前端 `npm run type-check && npm run build` 通过，或明确标注未执行原因。
- 文档与代码同批提交：改了接口 → 改 API_CONTRACT + openapi；改了表 → 加迁移 + 改 DATA_MODEL；改了规则 → 改 PRD 并记 build-log。

---

## 11 明确禁止

- 不擅自新增 PRD 未定义的功能、页面、字段、角色。
- 不擅自更换技术栈、目录结构、响应格式、错误码体系。
- 不为"好看"大规模重构；不做与当前任务无关的清理。
- 不虚构测试结果、截图、接口返回、编译状态。
- 不把演示图、原型资源纳入生产构建或部署。
- 不在未确认的情况下修改已确认的业务规则或表结构（见 [harness/AI_DECISION_RULES.md](harness/AI_DECISION_RULES.md) 风险分级）。
