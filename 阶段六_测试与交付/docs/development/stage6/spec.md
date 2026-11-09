# 阶段六 · 测试、部署、验收与交付（Spec）

| 项 | 内容 |
|---|---|
| 版本 | V1.0 |
| 编写日期 | 2026-11-08 |
| 适用阶段 | 阶段六（阶段五已完成并停止） |
| 上游依据 | [TEST_PLAN](../../testing/TEST_PLAN.md) §2/§3/§5/§10/§11、[PRD](../../product/PRD.md)、[PAGE_SPECS](../../design/PAGE_SPECS.md)、[API_CONTRACT](../../api/API_CONTRACT.md)、[AGENTS.md](../../../AGENTS.md) |
| 下游 | 阶段七（不在本次范围） |

## 1 目标与边界

1. 阶段六只做三件事：**处置阶段五遗留偏差 → 建立可重复执行的测试与取证 → 完成部署静态检查、验收与交付记录**。
2. 不新增 PRD 未定义的功能、页面、角色；不更换技术栈；不进入阶段七。
3. 所有"通过"必须有真实命令输出或接口响应；未执行项必须标"未验证"并写原因（AGENTS §4、§11）。
4. 轮次：**R9 偏差处置 → R10 测试 → R11 部署/验收/交付**。

## 2 环境事实（已实测）

| 项 | 实况 | 对阶段六的影响 |
|---|---|---|
| MySQL | 5.7.19 本机运行，业务账号 `mingmai/mingmai_dev` 可用；root 仅用于一次性建测试库 | 集成测试需独立 `mingmai_test` 库 |
| Redis | 7.4.2 便携版运行于 127.0.0.1:6379，PING=PONG | 登录/白名单测试可跑 |
| 后端 | `.venv` 已装 fastapi/sqlalchemy/pymysql/pytest 8.3.4/httpx 0.28.1；uvicorn 可启动 | pytest 可直接执行 |
| 前端 | Node v26 / npm 11；`type-check`、`build` 已通过 | 可补 Vitest；Playwright 需安装 |
| Docker | **不可用** | Compose 只能静态检查，不得记为"部署验证通过" |
| 浏览器 E2E | 本机可运行 Chromium 的前提下尝试 Playwright；失败则如实标注 | 不影响其余结论 |

## 3 R9：阶段五遗留偏差处置（决策）

### 3.1 D1 T3 用户补图无上传接口 → 实现

- 新增 `POST /api/v1/me/uploads`（登录用户）。
- 位置：`backend/app/api/media.py` 增加路由；`backend/app/services/media_service.py` 增加 `upload_user_shot(...)`。
- 入参（multipart）：`teaId`、`type`（dry/soup/leaf/pack/detail）、`file`、`anonymous`（可选）。
- 行为：
  - 茶品必须 `published`，否则 `MM-CATALOG-001`。
  - 复用 `storage_service.store` 的扩展名/MIME/魔数/≤5MB 三重校验。
  - 落库 `media_image`：`source_type='user'`、`status='draft'`、`uploaded_by=用户ID`、`license_scope='用户投稿授权'`，`seq` 取该茶品全局最大序号 +1（规避 `uk_image_tea_seq`）。
  - 存储相对路径 `user/{userId}/{teaId}/{type}-{seq}.{ext}`。
  - 返回 `media_service.to_item` 结构（含 `id/url/thumbUrl/status`）。
- 约束：`submission_service._validate_images` 增加归属校验——T3 只能引用 `uploaded_by=当前用户` 的图片，防止引用他人图片。
- 前端：`frontend/src/views/fore/SubmissionFormView.vue` 的 T3 分支启用上传控件，调用 `/me/uploads`，用返回 `id` 组装 `imageIds`；上传失败展示 `message`。
- 契约同步：`docs/api/API_CONTRACT.md` 与 `docs/api/openapi.yaml` 登记该接口；不新增错误码。

### 3.2 D2 T3 授权未落库 → 实现

- 新增迁移 `database/migration/V2__submission_license.sql`：
  ```sql
  ALTER TABLE submission
    ADD COLUMN license_granted TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'T3 授权声明' AFTER anonymous,
    ADD COLUMN license_granted_at DATETIME NULL COMMENT '授权勾选时间' AFTER license_granted;
  ```
- `backend/app/models/submission.py` 增加同名字段。
- `submission_service.create`：`type=T3` 且 `licenseGranted=true` 时写 `license_granted=1`、`license_granted_at=now()`；未勾选仍拒绝。
- `moderation_service.review_submission` 审核通过 T3 时：为每条 `submission_image` 写入 `gallery_user_shot`（`status='candidate'`、`license_granted` 取投稿值、`anonymous` 取投稿值），`uk_shot_submission_image` 冲突时跳过。
- 文档同步：`docs/architecture/DATA_MODEL.md` 的 submission 表补两列；`database/init.sql` **不修改历史部分**（新库通过 V1 后执行 V2，或交付说明注明初始化后需跑迁移）。

### 3.3 D5 批量导入前端未接线 → 实现

- 后端已具备 `template/create/get/errors/confirm` 五个接口（`app/api/ops.py` + `ops_service.py`），无需新增接口。
- 重写 `frontend/src/views/admin/AdminImportView.vue` 为三步流程：
  1. 下载模板（`GET /admin/imports/template`，blob）。
  2. 上传 CSV（`POST /admin/imports`，multipart），展示 `status/totalRows/successRows/errorRows`；`validation_failed` 时拉 `GET /admin/imports/{id}/errors` 表格。
  3. `ready` 状态才显示"确认导入"（`POST /admin/imports/{id}/confirm`），完成后展示结果。
- 接口封装放在 `frontend/src/modules/moderation.ts`（后台运营接口现有归属文件），沿用 `http` 封装。

### 3.4 D8 站内消息 180 天清理缺失 → 实现

- `backend/app/services/message_service.py` 增加 `purge_expired(db, days=180) -> int`，删除 `message.created_at < now - 180d` 的行。
- `backend/app/main.py` 启动时创建 `asyncio` 后台循环任务：启动即执行一次，之后每 24 小时执行一次；异常只记日志、不阻断进程。
- 保留期固定 180 天（PRD/M09），不新增配置项。

### 3.5 D6 举报说明长度不一致 → 修正

- `moderation_service` 举报创建校验由 1000 字改为 **200 字**（与 PAGE_SPECS/前端一致），错误为空时仍拒绝。

### 3.6 其余偏差的处置结论（书面接受，不改代码）

| # | 结论 | 理由 |
|---|---|---|
| D3 | 接受 | T4 支持 5 个核心字段在线纠错；其余字段走人工编辑，PRD 未要求全字段自动应用 |
| D4 | 接受 | 修订快照仅标量变更前后值，满足审核留痕最低要求；全量快照列为二期 |
| D7 | 接受 | 审计导出 CSV 满足"可导出"验收；xlsx 非硬性要求 |
| D9 | 接受 | PRD/PAGE_SPECS 无"用户申诉"前台页面，A14 为后台复核；不新增页面 |
| D10 | 接受 | 处罚过滤在内存分页，V1 数据量下可接受；登记为已知限制 |
| D11 | 接受 | 节假日口径需运营确认，V1 固定 24h/48h 已写入文档 |
| D12 | 已完成 | `categoryId` 已同步前端与 openapi |
| D13 | 已完成 | 工作台 4 卡 + "近 7 日上架"副文案已按 A02 落地 |

## 4 R10：测试建立与执行

### 4.1 测试库

- 一次性准备 `mingmai_test`：由 root 建库并授权 `mingmai`，再以 `mingmai` 连接执行 `database/init.sql`（把 `CREATE DATABASE/USE` 的库名替换为 `mingmai_test`）+ `database/migration/V2__submission_license.sql`。
- setup 命令写入 `docs/development/stage6/tasks.md` 与交付说明；**root 口令不写入仓库**，执行时用本机环境变量。

### 4.2 后端 pytest（`backend/tests/`）

| 文件 | 覆盖 | 关键断言 |
|---|---|---|
| `conftest.py` | 环境隔离、TestClient、种子夹具 | `MM_DB_NAME=mingmai_test`、`MM_STORAGE_DIR=./data/test-uploads`、`MM_REDIS_URL=.../15` 在导入 app 前设置 |
| `factories.py` | 建用户/茶品/图片/分类的最小夹具 | 直接走 ORM，测试后按创建顺序清理 |
| `test_core.py` | 分页、错误码、时间格式 | `normalize(0,-1)→(1,1)`；`normalize(9,999)→(9,50)`；ISO 含 `+08:00`；错误码状态映射 |
| `test_api_platform.py` | `/health`、Envelope、401/403 | 200 且含 `code/message/data`；响应头有 `X-Request-Id`；无令牌访问 `/me/favorites`→401 `MM-AUTH-001`；普通用户访问 `/admin/admins`→403 |
| `test_catalog.py` | 8 维筛选取值口径 | 同维多选取并集、跨维取交集、未录年份不受年份筛选影响、下架详情对游客 404 |
| `test_submission.py` | T1/T3/T4 状态机 | T1 正文 <300 拒绝；T3 未勾选授权拒绝；T4 理由 <20 拒；当日第 4 条 403 `MM-SUB-001`；二次驳回后 `locked` 且不可重提 |
| `test_governance.py` | 审核、举报、审计 | 图片 <4 提交审核拒绝；`draft→pending→published`；重复审核 409；举报 24h 重复 409 `MM-GOV-001`；审计与业务同事务存在记录 |

- 执行：`cd backend && .venv/Scripts/python -m pytest -q`。
- 若测试库不可用：用例 `pytest.skip` 并输出原因，不伪造通过。

### 4.3 前端 Vitest

- `frontend/package.json` 增加 `test:unit` 脚本与 devDependencies：`vitest`、`@vue/test-utils`、`jsdom`。
- 用例 1：`frontend/src/modules/__tests__/catalog.spec.ts`，覆盖列表参数构造（同维多选、空值剔除、page/size 边界）。
- 用例 2：`frontend/src/router/__tests__/guard.spec.ts`，覆盖未登录访问 `/admin` 跳转登录、普通用户访问后台被拒。
- 执行：`cd frontend && npm run test:unit`。

### 4.4 Playwright E2E（尽力执行）

- 安装 `@playwright/test` 与 Chromium；若安装失败则**标注未执行**并记录原因，不降低其他结论。
- 用例 `frontend/e2e/smoke.spec.ts`：登录（dev openid）→ 首页 → 茶类列表 → 详情 → 收藏。
- 执行：`npm run test:e2e`（前置：后端 8080、Redis、前端 5173 均在运行）。

### 4.5 测试数据

- 46 款茶品/184 图等完整数据集由 `backend/tests/` 夹具按需创建（每个用例自建最小集合），不写入 `init.sql`；完整 46 款数据集脚本列为交付后可选专项（不在本轮硬门槛）。

## 5 R11：部署静态检查、验收与交付

1. `python -m compileall app`、`pytest`、`npm run type-check`、`npm run build`、`npm run test:unit` 全部真实执行并记录输出。
2. 迁移与初始化幂等：在 `mingmai_test` 上重复执行 `init.sql`（`IF NOT EXISTS`）应无错；`V2` 只执行一次。
3. 上线前 5 项（TEST_PLAN §11.3）逐项结论：
   - 迁移可执行 ✅；
   - 生产配置无明文密钥：检查 `deploy/.env.example` 与 `frontend/dist` 无 openid/secret；
   - 上传目录权限与演示图不进包：`vite build` 产物不含 `docs/content/demo-images`；
   - 备份脚本静态检查（Docker/MySQL 实跑不可用则标注）；
   - 回滚方案写入交付说明。
4. Docker/Compose：`docker` 不可用 → 仅静态检查 `deploy/docker-compose.yml`、`nginx.conf`、`Dockerfile`，结论标"未运行验证"。
5. 文档与代码同批：
   - `docs/api/API_CONTRACT.md` + `openapi.yaml`：登记 `/me/uploads`；
   - `docs/architecture/DATA_MODEL.md`：submission 两列；
   - `docs/development/PROGRESS.md`：新增"阶段六"章节（逐项证据、未验证项、偏差处置结论）；
   - `harness/build-log.md`：追加阶段六记录。
6. 交付说明（`docs/development/DELIVERY.md` 或 PROGRESS 内专节）：启动命令、环境变量、迁移顺序、已知限制、验收结论。

## 6 完成定义（DoD）

1. R9 四项偏差（D1/D2/D5/D8）代码 + 文档落地；D6 修正；其余偏差有书面结论。
2. R10 后端 pytest 真实执行，结果如实记录；前端 Vitest 执行；E2E 有结论（通过或未执行原因）。
3. R11 五类命令全部执行；部署静态检查有结论；PROGRESS 与 build-log 完成阶段六复盘。
4. 全部产出经逐条对照 TEST_PLAN/PRD/PAGE_SPECS 复盘，一致项与修正项分开列明。
5. 停在阶段六，不进入阶段七。

## 7 验收与风险

- 验收口径：命令输出、接口样例、文件差异；任何未执行项不得写成通过。
- 主要风险：测试库授权失败 → 集成用例降级为单元/Web 层 Mock，并标注；Playwright 安装失败 → 标注；Docker 不可用 → 静态检查。
