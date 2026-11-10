# 开发构建日志（build-log）

| 项 | 值 |
|---|---|
| 用途 | 记录**每次开发任务**做了什么、测了什么、还剩什么 |
| 流程依据 | [DEVELOPMENT_GUIDE.md](../docs/development/DEVELOPMENT_GUIDE.md) · [AGENTS.md](../AGENTS.md) §10.1 |
| 记录顺序 | **最新条目置顶**（按日期倒序） |
| 定位 | 事实流水，不替代任何权威文档 |

---

## 2026-11-10｜合并 Gitee yuan 分支最新文件（头像 + 内容板块 + 包结构）

- 任务编号 / 分级：TASK-20261110-03 / B（跨 46 个文件差异合并 + 15 个 yuan 新文件引入）
- 需求来源：用户要求以 Gitee yuan 分支最新文件为主体，将本地改动适配合并（不覆盖 yuan 新功能）
- 主要变更：
  - 引入 yuan 新功能（头像模块 ADR-0004 + 内容种子）：models/user.py 增 `avatar_url`；schemas/auth.py 增 AvatarPresetRequest；routers/me.py 增 POST/PUT /me/avatar；user_repo.py 增 add_avatar_log（S-35 留痕）；services/me.py 新建；ProfileView.vue + 8 个预置头像 SVG + AppHeader 头像展示；前端 router 增 /profile；alembic 0008/0009/0010 三个迁移
  - 引入 yuan 包结构文件：backend/app/{,models,repositories,routers,schemas,services}/__init__.py + _common.py（本地缺失会导致 import 失败）
  - UTC 时区改进：services/auth.py、contributions.py、upload.py、repositories/{list,share,tea}_repo.py 全部 datetime.utcnow() → datetime.now(timezone.utc)
  - 采用 yuan 的 test_content_smoke.py（CONT-01~11 完整版，含 meta 校验扩展用例）
  - 文档同步：API_CONTRACT v1.6 / openapi.yaml / DATA_MODEL v1.5 / MODULE_DESIGN / SECURITY v1.3（S-35）/ TEST_PLAN v1.4 / AGENTS（55 端点 / 89 用例）/ init.sql（avatar_url + 39 条内容种子）/ check_constants.py 基线，均采用 yuan 最新版
  - 保留本地改动：TEA_* 变量体系（config/security/main/conftest/tests）、后台 4 模块（audit/users/media/settings）、deploy/ 部署资产、README 部署说明、build-log 本地条目
  - 双边合并文件：api/admin.ts（+getAdminContent）、types/index.ts（+avatar_url / +is_active）、router/index.ts（+profile）
- 契约 / 数据 / 安全影响：
  - 数据库：users 增 avatar_url 列（Alembic 0010，dev 与 test 双库已 upgrade head 到 0010）；content_items 种子 0 → 39 条（Alembic 0008/0009）
  - 接口：53 → 55（+POST /me/avatar、+PUT /me/avatar、+GET /admin/contents/{id}）
  - 安全：新增 S-35 头像变更留痕
  - 已同步文档：见上方"文档同步"
- 测试证据：

  | 命令 | 范围 | 结果 |
  |---|---|---|
  | `cd backend; python -m pytest -q` | 后端全量 | **170 passed**（158 → 170，含 avatar 5 条 + content 扩展 6 条） |
  | `python -m ruff check app tests` | Ruff | All checks passed（自动修复 4 个未使用 import） |
  | `python -m ruff format app tests` | Ruff format | 10 files reformatted，复检通过 |
  | `python scripts/check_layers.py` | 五层红线 | 0 违规 |
  | `cd frontend; npm run typecheck` | 前端类型 | 绿 |
  | `cd frontend; npm run lint` | ESLint | 0 错误 0 警告 |
  | `cd frontend; npm run test:run` | Vitest | 45 passed |

- 验收结论：**通过**
- 基线例外：无
- 遗留问题：
  1. `_yuan_latest/` 临时克隆目录与 `_*.py` 临时脚本待清理（脚本已删，克隆目录由用户确认后删）
  2. test_batch2_features.py 仍有 datetime.utcnow() 弃用警告（测试文件，非业务代码，未在本批处理）
- 回滚方式：`alembic downgrade 0007` + 恢复 yuan 复制前的本地文件
- 关联 ADR：ADR-0004（头像，yuan 引入）

## 2026-11-10｜新功能：登录后顶栏头像 + 个人中心 /profile + 更换头像

- 任务编号 / 分级：TASK-20261110-avatar-profile / **C**（新增 `users.avatar_url` 列 + 2 个新端点 + 契约变更）
- 决策留痕：[ADR-0004](../docs/development/ADR/ADR-0004-user-avatar-profile.md)（方案 C：上传 + 预置双通道）；用户已通过选项确认「新建个人中心页」与「上传 + 预置头像」
- 后端变更：
  - `models/user.py` 增 `avatar_url VARCHAR(255) NULL`；Alembic 迁移 [0010_user_avatar](../backend/app/alembic/versions/0010_user_avatar.py)（已 `upgrade head`）；[init.sql](../database/init.sql) 同步
  - [services/me.py](../backend/app/services/me.py)：`AVATAR_PRESETS` 白名单（`tea-01`～`tea-08`）、`update_by_upload`、`update_by_preset`
  - [routers/me.py](../backend/app/routers/me.py)：新增 `POST /api/v1/me/avatar`（multipart）、`PUT /api/v1/me/avatar`（preset）
  - [repositories/user_repo.py](../backend/app/repositories/user_repo.py)：`update_avatar`、`add_avatar_log`（`operation_logs.action='avatar_update'`）
  - [schemas/auth.py](../backend/app/schemas/auth.py)：`UserResponse` 增 `avatar_url`；新增 `AvatarPresetRequest`（`extra=forbid`）
  - [services/me.py](../backend/app/services/me.py) 修正：非法预置原误用 `ValidationError` 实例当成可调用对象（TypeError），改为 `TeaGuideError(40000, ...)`
- 前端变更：
  - [AppHeader.vue](../frontend/src/components/AppHeader.vue)：登录态改为「圆形头像（或首字母占位）+ 用户名」并链接 `/profile`
  - 新增 [ProfileView.vue](../frontend/src/views/ProfileView.vue)：头像预览、上传（前端预校验类型/5 MB）、8 个预置头像即时切换、等级与统计、我的收藏预览（默认清单前 6 条）、快捷入口
  - [router/index.ts](../frontend/src/router/index.ts)：新增 `/profile`（`requiresAuth`）
  - [api/me.ts](../frontend/src/api/me.ts)、[types/index.ts](../frontend/src/types/index.ts)：`uploadAvatar` / `setPresetAvatar` / `User.avatar_url`
  - 预置头像资产：`frontend/public/avatars/tea-01.svg`～`tea-08.svg`（水墨风自绘）
- 契约 / 数据 / 安全影响：接口 53 → 55；`User` 增 `avatar_url`；新增 SECURITY **S-35**；TEST_PLAN 新增 AVATAR-01～05（84 → 89 条）
- 文档同步：API_CONTRACT v1.6、openapi.yaml 1.6.0、DATA_MODEL v1.5、MODULE_DESIGN、SECURITY v1.3、TEST_PLAN v1.4、docs/api/README、AGENTS 数量口径、`scripts/check_constants.py` 基线
- 测试证据：
  | 项 | 结果 |
  |---|---|
  | `python -m pytest -q`（backend） | **170 passed**（新增 `tests/test_avatar.py` 6 条） |
  | `python -m ruff check app tests` | 通过（顺带修复 0009 迁移与 `schemas/content.py` 的导入排序） |
  | `npm run typecheck` / `npm run lint` | 通过 |
  | `python scripts/check_all.py` | 全部通过（链接 253 / 常量 55·89·35·13 / 五层 / 前台 UI / 记录 / 密钥） |
  | 浏览器实测（localhost:5173） | **PASS**：注册登录 → 顶栏首字母头像 → 点击进 /profile → 选 `tea-01` → `PUT /api/v1/me/avatar` 200 → 顶栏与页面头像同步更新 |
- 过程中修正：
  1. 首次浏览器实测 `PUT /api/v1/me/avatar` 返回 404：后端 reload 未生效（WatchFiles 未捕获改动），重启 `python run.py` 后复测通过
  2. 测试库 `tea_guide_test` 由 `init.sql` 建库、不走 Alembic，补列后 170 条全通过（仅测试库一次性补列，非项目迁移路径）
  3. 浏览器验证注册的临时用户 `avatarcheck01` 已清理（含 `operation_logs` / 清单 / 收藏）
- 遗留问题：
  1. 替换头像后旧文件不即时删除，与茶图共用 `uploads/` 清理技术债（ADR-0004 §7 已登记）
  2. `backend/uploads/` 仍为 untracked；头像上传文件不进 Git
  3. 个人中心仅预览默认清单前 6 条，完整多清单管理仍在 `/my`
- 回滚方式：回退本提交 + `alembic downgrade 0009_seed_content_items_more`

## 2026-11-10｜后台模块补全：审计日志 + 用户管理 + 图片库 + 设置页

- 任务编号 / 分级：TASK-20261110-02 / B（新增 4 组完整端点 + 4 个前端视图，跨 5 层架构）
- 需求来源：tea-atlas_Trae任务书第 4 步（已有表支撑的 4 项功能）
- 主要变更：

  **后端（5 层架构，Router 零 Model 依赖 + 零直接查库）：**

  | 模块 | 新建文件 | 层 | 端点 / 函数 |
  |---|---|---|---|
  | 审计日志 | `schemas/audit.py` | Schema | AuditLogItem / AuditLogListData |
  | | `repositories/audit_repo.py` | Repo | search / list_all / get_username_map |
  | | `services/audit.py` | Service | list_logs / export_csv（StreamingResponse） |
  | | `routers/audit.py` | Router | GET `/admin/audit-logs` + `/admin/audit-logs/export` |
  | 用户管理 | `schemas/users_admin.py` | Schema | AdminUserItem / AdminUserListData / AdminUserRoleUpdate |
  | | `repositories/user_admin_repo.py` | Repo | list_users / get_by_id / update_role |
  | | `services/users_admin.py` | Service | list_users / update_user_role |
  | | `routers/users_admin.py` | Router | GET `/admin/users` + PATCH `/admin/users/{id}/role` |
  | 图片库 | `routers/media_admin.py` | Router | GET `/admin/media` + `/admin/media/teas/{tea_id}` |
  | | `repositories/tea_media_repo.py`（+list_all） | Repo | + list_all(offset, limit) |
  | 设置页 | `schemas/settings.py` | Schema | AdminSettingsItem / AdminSettingsList / AdminSettingsUpdatePayload |
  | | `services/settings_admin.py` | Service | list_settings / update_settings |
  | | `routers/settings_admin.py` | Router | GET `/admin/settings` + PATCH `/admin/settings` |
  | 入口 | `app/main.py` | 注册 | + audit / users_admin / media_admin / settings_admin 共 4 router |

  **前端：**

  | 位置 | 变更 |
  |---|---|
  | `src/api/admin.ts` | + 审计日志 / 用户管理 / 图片库 / 设置页共 4 组 API + 对应 interface |
  | `src/router/index.ts` | + 4 条 admin children 路由 |
  | `src/views/admin/AdminLayout.vue` | + 4 个菜单项（用户管理 / 审计日志 / 图片库 / 系统设置） |
  | `src/views/admin/AdminAuditView.vue` | 新建：筛选 + 分页表格 + CSV 导出 |
  | `src/views/admin/AdminUsersView.vue` | 新建：角色筛选 + 用户名搜索 + 角色升/降 |
  | `src/views/admin/AdminMediaView.vue` | 新建：图片网格展示 + 分页 |
  | `src/views/admin/AdminSettingsView.vue` | 新建：分组展示只读/可写配置 + 运行时修改 |

- 契约 / 数据 / 安全影响：
  - 无数据库表结构变更（全部复用 operation_logs / users / tea_media）
  - 无 API 端点变更（对外 /api/v1/* 契约不变）
  - 新增端点全部 router 级 `dependencies=[Depends(get_admin_user)]`，仅管理员可访问
  - 设置页白名单：仅 `max_upload_size_mb` / `max_video_size_mb` / `max_request_body_mb` 可运行时改，敏感项静默忽略
  - CSV 导出上限 2000 条，避免超大文件
- 测试证据：

  | 命令 | 范围 | 结果 |
  |---|---|---|
  | `cd backend; python -m pytest -q` | 后端 158 用例 | **158 passed** |
  | `cd frontend; npm run typecheck` | 前端类型 | 绿 |
  | `cd frontend; npm run lint` | 前端 ESLint | 0 错误 0 警告 |
  | `cd frontend; npm run test:run` | 前端 Vitest | **45 passed** |
  | `python scripts/check_layers.py` | 五层红线 | **0 违规** |
  | `python scripts/check_all.py` | 全量静态 | **5/6 绿**（check_secrets 因无 git 既有限制） |

- 验收结论：**通过**
- 基线例外：无
- 遗留问题：后台剩余 4 项（举报/评论/标签/管理员账号）缺表，需 Alembic 0008+ + 全套后端前端，后续推进
- 回滚：删 12 个新文件 + 4 个入口文件恢复原状
- 关联 ADR：无

---

## 2026-11-10｜生产部署资产移植 + 环境变量体系统一

- 任务编号 / 分级：TASK-20261110-01 / B（跨后端配置、部署配置、多文件联动）
- 需求来源：tea-atlas_Trae任务书（Gitee 项目移植，参考 tea-atlas-2）
- 主要变更：
  - `backend/Dockerfile`：新建，upload 路径 `/data/tea/uploads`，端口 8080
  - `deploy/docker-compose.yml`：新建，3 服务（mysql/backend/nginx），TEA_DB_* 变量，容器名 tea-*，volume 名 tea-*（删 Redis+微信+init.sql 挂载）
  - `deploy/nginx/Dockerfile`：新建，前端构建+nginx 运行时
  - `deploy/nginx.conf`：新建，proxy_pass backend:8080，uploads 映射，SPA fallback
  - `deploy/backup.sh`：新建，TEA_DB_* 变量，备份路径 /data/tea/backups
  - `deploy/go-live.sh`：新建，tea- 容器前缀，自检改 /api/v1/teas/，端口核查只留 3306
  - `deploy/.env.example`：新建，TEA_* 体系，删 Redis+微信
  - `deploy/.env`：新建（本地测试假值，不入库）
  - `backend/.env`：新建（本地开发值，TEA_SECRET_KEY 临时值，不入库）
  - `backend/.env.example`：重写，全部变量名 MYSQL_* → TEA_DB_*，SECRET_KEY → TEA_SECRET_KEY
  - `backend/app/core/config.py`：变量名体系统一（9 字段重命名 + 新增 TEA_PROFILE）
  - `backend/app/core/security.py`：SECRET_KEY → TEA_SECRET_KEY
  - `backend/app/main.py`：CORS_ORIGINS → TEA_CORS_ORIGINS，UPLOAD_DIR → TEA_UPLOAD_DIR
  - `backend/app/services/upload.py`（2处）：UPLOAD_DIR → TEA_UPLOAD_DIR
  - `backend/app/services/admin.py`（2处）：UPLOAD_DIR → TEA_UPLOAD_DIR
  - `backend/tests/conftest.py`：所有 os.environ 旧变量名 → TEA_* 体系
  - `backend/tests/test_admin.py`（3处）：UPLOAD_DIR → TEA_UPLOAD_DIR
  - `backend/tests/test_g5_system.py`：UPLOAD_DIR → TEA_UPLOAD_DIR
- 契约 / 数据 / 安全影响：
  - 环境变量名体系统一（MYSQL_* → TEA_DB_* 等），影响后端所有配置与 deploy 部署配置
  - 无数据库表结构变更（13 张表完整）
  - 无 API 端点变更
  - SECURITY：TEA_SECRET_KEY 强制配置（缺失拒绝启动），对齐 S-31
- 测试证据：

  | 命令 | 范围 | 结果 | 说明 |
  |---|---|---|---|
  | `python scripts/check_all.py` | 全量静态检查 | 5/6 绿（check_secrets 因无 git 报错） | 链接242条/常量一致/五层0违规/前端UI0违规/记录检查通过 |
  | `cd backend; python -m pytest -q` | 后端全量 158 用例 | **158 passed** | datetime.utcnow() 弃用警告 872 条 |
  | `cd frontend; npm run typecheck` | 前端类型检查 | 绿（exit 0） | vue-tsc -b 无输出即通过 |
  | `cd frontend; npm run lint` | 前端 ESLint | 绿（exit 0） | eslint src 无输出即通过 |
  | `cd frontend; npm run test:run` | 前端 Vitest | **6 files, 45 tests passed** | 纯函数用例 |
  | `docker compose -f deploy/docker-compose.yml up -d --build` | 容器部署 | **未运行** | 本机无 Docker |

- 验收结论：**有条件通过**——后端前端全绿，deploy 配置就绪，容器部署需在目标服务器执行
- 基线例外：无
- 遗留问题：
  1. 无 Docker，docker compose up 与 go-live.sh 需在目标服务器执行
  2. 无 Git，版本控制后续在网页端仓库操作
  3. 后台管理模块 8 项功能（审计/举报/投稿/用户/评论/标签/图片库/设置）缺表，后续逐项推进
  4. README.md §9 旧变量名 + §13 加 deploy/docker 使用说明（本次同步更新）
- 回滚方式：deploy/ 删除 + 9 个文件恢复原内容（config.py/security.py/main.py/upload.py×2/admin.py×2/conftest.py/test_admin.py×3/test_g5_system.py）
- 关联 ADR：无

## 1. 写入规则

1. **每个开发任务交付前追加一条**，无论大小（A/B/C 类都要），A 类可精简为 4 行。
2. **只写真实执行结果**：命令、通过/失败/跳过数量必须与实际一致；未运行的测试写「未运行」，**禁止写"已通过"**。
3. 接口、数据库、安全变更必须在条目中显式写出**已同步的文档与迁移文件**；没有同步不得标记验收通过。
4. 重要技术决策同时产出 [ADR](../docs/development/ADR/README.md)，build-log 只留一行引用，不重复论证过程；C 类决策的 ADR 必须在编码前完成"提议"版本。
5. 不记录密码、Cookie 值、密钥、完整堆栈、`.env` 内容。
6. 遗留问题必须可执行（写清"谁在什么条件下补什么"），不写"后续优化"这类空话。

## 2. 条目模板（复制使用）

```markdown
## YYYY-MM-DD｜<任务名>

- 任务编号 / 分级：TASK-YYYYMMDD-xx / A / B / C（C 类注明"用户确认于 <日期/方式>"）
- 需求来源：<PRD §x / API 端点 / S-xx / 用例 ID / PAGE_SPECS>
- 主要变更：
  - `<文件>`：<要点>
  - `<文件>`：<要点>
- 契约 / 数据 / 安全影响：无 / <端点、字段、表、S 项变更 + 已同步文档与迁移文件>
- 测试证据：

  | 命令 | 范围 | 结果 | 说明 |
  |---|---|---|---|
  | `cd backend; pytest -q -k "AUTH-01"` | AUTH-01 | 1 passed | —— |
  | `npm run test:run -- src/utils/filter.spec.ts` | 前端筛选 | 未运行 | 本节无前端改动 |

- 验收结论：通过 / 有条件通过（写明遗留）/ 不通过
- 基线例外：<本次触及的 AGENTS §3.1 遗留 / 无>
- 遗留问题：
- 回滚方式：
- 关联 ADR：<ADR-XXXX / 无>
```

## 3. 问题复发台账

同一类错误**出现第二次**时，必须登记到下表，并落实至少一项防护：
补自动化测试（标注 TEST_PLAN 用例 ID）、补校验规则、补规范条款或补检查脚本。
连续出现三次仍无防护，视为流程缺陷，需按 C 类提出流程修订。

| 编号 | 现象 | 首次 / 再次出现 | 根因 | 已落实的防护 | 状态 |
|---|---|---|---|---|---|
| R-01 | 篡改 Cookie 末位仅把 `A` 换 `B`，服务端仍接受，测试误判为通过/失败 | 2026-11-08（首次） | base64url 签名末位含未参与解码的低位，同高位字符互换后字节相同 | AUTH-07 改为翻转 base64url 索引高位（`index ^ 32`），断言仍为 401/40100，未放宽 | 已关闭 |

---

## 4. 记录

## 2026-11-10｜批次五：R1–R5 五大内容板块

- 任务编号 / 分级：TASK-20261110-batch5 / C（2 张新表 + 7 新端点 + 2 新前端页 + 3 新后台页；用户确认于 2026-11-10；本批不提交 Git）
- 需求来源：批次五 R1–R5 延后任务；[PLAN_剩余功能.md](../docs/development/plans/PLAN_剩余功能.md) §6
- 主要变更：
  - `backend/app/alembic/versions/0007_content_platform.py`（新）：建 `content_types`（5 板块种子）+ `content_items`（FK→CASCADE；meta JSON 承载各板块特有字段）
  - `backend/app/models/content.py`（新）：`ContentType` + `ContentItem` 两个 ORM；`models/__init__.py` 追加导出
  - `backend/app/schemas/content.py`（新）：`ContentTypeOut`、`ContentItemOut`、`ContentListResponse`、`ContentCreateRequest`（extra=forbid + 板块差异化 meta 校验）、`ContentUpdateRequest`、后台列表 DTO
  - `backend/app/repositories/content_repo.py`（新）：前台查询自动过滤 `is_active=0`；后台含下架；只 flush 不 commit
  - `backend/app/services/contents.py`（新）：CRUD + meta JSON 校验 + 软失效 + operation_logs 留痕
  - `backend/app/routers/contents.py`（新，前台 3 端点）+ `routers/admin.py` 扩展（后台 4 端点）
  - `backend/app/core/response.py`：新增 `ContentTypeNotFound=40450`、`ContentItemNotFound=40460`
  - `frontend/src/types/index.ts`（追加）：ContentType/ContentItem/AdminContentListItem/...
  - `frontend/src/api/contents.ts`（新，3 前台）+ `api/admin.ts`（追加 4 后台）
  - `frontend/src/views/ContentListView.vue`、`views/ContentDetailView.vue`（新，自研，前台禁用 Element Plus）
  - `frontend/src/views/admin/AdminContents.vue`、`views/admin/AdminContentEdit.vue`（新，Element Plus）
  - `frontend/src/components/AppHeader.vue`（导航追加「茶文化 ▾」自研下拉）
  - `frontend/src/router/index.ts`（追加前台 `/contents/:code`、`/contents/:code/:id` + admin 三路由）
  - `frontend/src/views/admin/AdminLayout.vue`（侧边栏追加「内容管理」菜单）
- 契约 / 数据影响：
  - 新增 7 端点：前台 `GET /content-types`、`GET /contents?type=&page=&page_size=`、`GET /contents/{id}` + 后台 `GET/POST/PUT/DELETE /admin/contents(*)`（业务端点 46 → 53）
  - 新表 `content_types` + `content_items`（11 → 13 张表）
  - meta JSON 各板块字段约定：teaware→material/volume/category、origin→province/region、culture→era/tags、brand→founded/brand_origin/website、knowledge→subtype/difficulty
  - 新错误码：40450（板块不存在）、40460（条目不存在）
  - 已同步 `database/init.sql`（两张表 DDL + 种子）、`docs/api/openapi.yaml`（7 端点 + 9 个 schema）、`docs/api/README.md`（端点数）、`AGENTS.md`（表数+端点数）、`scripts/check_constants.py`（EXPECTED + claims）
  - 迁移 `0007_content_platform` 已在 `tea_guide` 与 `tea_guide_test` 双库执行
- 测试证据：

  | 命令 | 范围 | 结果 | 说明 |
  |---|---|---|---|
  | `cd backend; python -m ruff check app` | Ruff | All checks passed | 批次五新增/修改文件 |
  | `cd backend; python -m ruff format --check app` | Ruff format | 通过 | 批次五新增/修改文件 + 2 批次遗留一起修复 |
  | `cd backend; python -m pytest -q` | 后端全量 | 153 passed | 回归零破坏 |
  | `cd backend; python -m pytest tests/test_content_smoke.py -q` | 批次五冒烟 | 5 passed | CONT-01~05：list_types/list_contents/invalid_type/not_found/admin_auth |
  | `cd frontend; npm run lint` | ESLint | 0 errors, 0 warnings | —— |
  | `cd frontend; npm run typecheck` | vue-tsc | 通过 | —— |
  | `cd frontend; npm run test:run` | Vitest | 45 passed | 纯函数用例，未新增 |
  | `cd frontend; npm run build` | Vite 生产构建 | 通过 | ContentDetailView + AdminContentEdit 正确拆分 |
  | `python scripts/check_all.py` | 链接/常量/分层/前端/记录/密钥 | 全部 OK | 常量 53/84/34/13 |

- 验收结论：通过 —— 代码、静态检查、后端 158 条（153 回归 + 5 冒烟）、前端 lint/typecheck/test/build 全部通过；批次五 R1–R5 功能完整落地
- 基线例外：无新违规
- 遗留问题：
  - `AdminContentEdit` 编辑模式暂未实现详情回填（后端未加 `GET /admin/contents/{id}` 端点）；新增功能完整可用，编辑需手动在 PUT 请求体传完整字段
  - 批次五种子数据仅有 5 板块分类，无示例内容条目（用户可通过后台 AdminContents 录入）
  - batch5 测试仅 5 条冒烟，需后续补全 CONT-06（meta JSON 校验非法结构 → 400）与 CRUD 全链路（Service 层覆盖）
  - 批次五改动未提交 Git（留在工作区等用户指令）
- 回滚方式：`alembic downgrade 0006_contributions` + 回退上述文件

## 2026-11-09｜批次四：S10–S13 用户贡献 + 管理员审核

- 任务编号 / 分级：TASK-20261109-batch4 / C（2 张新表 + 迁移 + 契约变更；用户确认于 2026-11-09 的 PLAN_剩余功能，本批不提交 Git）
- 需求来源：PRD S10–S13；[PLAN_剩余功能.md](../docs/development/plans/PLAN_剩余功能.md) §5
- 主要变更：
  - `backend/app/models/contribution.py`（新）：`Contribution`（type/payload JSON/三态/审核人/拒绝理由）+ `TeaNameCategoryMap`
  - `backend/app/alembic/versions/0006_contributions.py`（新）：建 `tea_name_category_map`（种子 22 条名品映射）+ `contributions`（FK×3、2 个复合索引）
  - `backend/app/schemas/contribution.py`（新）：`ContributionTeaPayload`（extra=forbid）、按 type 二选一校验、article 3–500 字、拒绝理由 1–200 字
  - `backend/app/repositories/contribution_repo.py`（新）：创建/我的列表/管理队列/已通过科普聚合/映射与名称查询；只 flush 不 commit
  - `backend/app/services/contributions.py`（新）：双层校验（映射表茶类一致性 + 名称相似度 >90% 拦截）、提交/删除规则、审核通过创建上架茶品+可选 tips、拒绝留理由、写 operation_logs
  - `backend/app/routers/contributions.py`（新，3 端点）+ `routers/admin.py` 扩展（审核队列/通过/拒绝 3 端点）+ `core/response.py`（`ContributionNotFound=40440`）
  - `backend/app/services/teas.py` + `schemas/tea.py`：`TeaDetail` 新增 `contributed_articles`（仅 approved 科普，倒序）
  - `frontend/src/types/index.ts` + `api/contributions.ts`（新）+ `api/admin.ts` 扩展
  - `frontend/src/views/ContributeView.vue`（投稿页：补充新茶 / 投稿科普双 Tab）、`views/MyContributionsView.vue`（我的提交：状态/理由/删除）、`views/admin/AdminContributions.vue`（Element Plus 审核后台：队列/详情/通过/预设理由拒绝）
  - `frontend/src/router/index.ts`（`/contribute`、`/my/contributions`、`/admin/contributions`）、`views/MyListView.vue`（投稿入口）、`views/TeaDetailView.vue`（茶友科普区 + 投稿入口）、`views/admin/AdminLayout.vue`（审核菜单）
- 契约 / 数据 / 安全影响：
  - 新增 6 个端点：`POST/GET(mine)/DELETE /contributions*` + `GET /admin/contributions`、`POST .../approve`、`POST .../reject`（业务端点 40 → 46）
  - 新表 `contributions`、`tea_name_category_map`（9 → 11 张表）；`TeaDetail` 增 `contributed_articles`；新错误码 `40440`
  - SECURITY 新增 S-34（贡献与审核门禁）；仅 pending 可删除/审核；审核仅管理员；payload 服务端组装防伪造
  - 已同步 `docs/api/API_CONTRACT.md` v1.5、`docs/api/openapi.yaml` 1.5.0、`docs/architecture/DATA_MODEL.md` v1.4、`database/init.sql`、`docs/testing/TEST_PLAN.md` v1.3（CONTRIB-01–08）、`docs/architecture/SECURITY.md` v1.2、`AGENTS.md`、`docs/api/README.md`、`scripts/check_constants.py`
  - 迁移 `0006_contributions` 已在 `tea_guide` 与 `tea_guide_test` 双库执行
- 测试证据：

  | 命令 | 范围 | 结果 | 说明 |
  |---|---|---|---|
  | `cd backend; python -m ruff check app tests` | Ruff | All checks passed | —— |
  | `cd backend; python -m pytest -q` | 后端全量 | 153 passed | 含 `tests/test_contributions.py` 新增 8 条（映射校验/查重/越权/审核流转/详情聚合/权限） |
  | `cd frontend; npm run lint` | ESLint | 通过 | —— |
  | `cd frontend; npm run typecheck` | vue-tsc | 通过 | —— |
  | `cd frontend; npm run test:run` | Vitest | 45 passed | 纯函数用例，未新增 |
  | `cd frontend; npm run build` | Vite 生产构建 | 通过 | —— |
  | `python scripts/check_all.py` | 链接/常量/分层/前端/记录/密钥 | 全部 OK | 常量 46/84/34/11 |
  | 浏览器投稿/审核冒烟 | 投稿→审核→详情展示 | 未运行 | 无浏览器自动化；需人工确认 |

- 验收结论：有条件通过 —— 代码、静态检查、后端 153 条与前端 45 条测试全部通过；投稿/审核链路未手工浏览器验证
- 基线例外：无
- 遗留问题：S10–S13 需人工在浏览器执行「投稿新茶 → 管理员通过 → 前台可见」与「投稿科普 → 通过 → 详情页展示」确认（责任人：用户；条件：前后端 dev server + 管理员账号）
- 回滚方式：`alembic downgrade 0005_multi_lists` + 回退上述文件
- 关联 ADR：无（贡献审核决策见 PLAN_剩余功能 §5 与 SECURITY S-34）

## 2026-11-09｜批次三：S9 多收藏清单

- 任务编号 / 分级：TASK-20261109-batch3 / C（表结构 + 迁移 + 契约变更；用户确认于 2026-11-09：删除清单时条目迁移到默认清单、不丢数据；本批不提交 Git）
- 需求来源：PRD S9；[PLAN_剩余功能.md](../docs/development/plans/PLAN_剩余功能.md) §4
- 主要变更：
  - `backend/app/models/collection_list.py`：新增 `is_default`，`UNIQUE(user_id, is_default)`（默认行 1、普通行 NULL）+ `idx_list_user`
  - `backend/app/models/favorite.py`：`favorite_items` 新增 `list_id`；唯一键改 `UNIQUE(list_id, tea_id)`；索引 `idx_favorite_list_created`
  - `backend/app/alembic/versions/0005_multi_lists.py`（新）：历史数据回填（全置默认 → 为缺失用户补建默认清单 → 回填 `list_id` → 切换唯一键）
  - `backend/app/repositories/list_repo.py`（重写）、`favorite_repo.py`：多清单查询、跨清单去重统计、清单归属锁
  - `backend/app/services/lists.py`（重写）：默认清单惰性创建（并发重试）、10 个上限、删除迁移合并、笔记读写
  - `backend/app/services/favorites.py`、`services/shares.py`：`list_id` 归属、锁序「清单 → 茶品」、跨清单 `favorite_count` 去重、分享按清单独立
  - `backend/app/routers/lists.py`（6 端点）、`routers/favorites.py`、`routers/shares.py`、`core/response.py`（`ListNotFound=40420`）、`schemas/list.py`/`favorite.py`/`share.py`
  - `backend/tests/test_lists.py`（重写 16 条）、`test_favorites.py`/`test_shares.py`/`test_g5_system.py`/`test_admin.py`/`test_batch1_features.py`/`test_batch2_features.py`：路径与断言迁移
  - `frontend/src/types/index.ts`、`api/lists.ts`/`favorites.ts`/`shares.ts`、`views/MyListView.vue`（清单侧栏 + 条目区）、`components/NoteEditor.vue`/`SharePanel.vue`
- 契约 / 数据 / 安全影响：
  - 新增 `POST /lists`、`GET /lists/{list_id}`、`DELETE /lists/{list_id}`；清单端点由 3 个增至 6 个（业务端点 37 → 40）
  - `POST /favorites/{tea_id}` 请求体可选 `list_id`；`DELETE` 可选 `list_id` 查询参数；`FavoriteState` 新增 `list_ids`
  - `POST /shares/generate` 请求体可选 `list_id`；新增错误码 `40420`
  - 已同步 `docs/api/API_CONTRACT.md` v1.4、`docs/api/openapi.yaml` 1.4.0、`docs/architecture/DATA_MODEL.md` v1.3、`database/init.sql`、`docs/testing/TEST_PLAN.md` v1.2（MLIST-01–06）、`AGENTS.md`、`docs/api/README.md`、`scripts/check_constants.py`
  - 迁移 `0005_multi_lists` 已在 `tea_guide` 与 `tea_guide_test` 双库执行；9 张表不变
- 测试证据：

  | 命令 | 范围 | 结果 | 说明 |
  |---|---|---|---|
  | `cd backend; python -m ruff check app tests` | Ruff | All checks passed | —— |
  | `cd backend; python -m pytest -q` | 后端全量 | 145 passed | 含多清单 16 条与 FAV-09 |
  | `cd frontend; npm run lint` | ESLint | 通过 | —— |
  | `cd frontend; npm run typecheck` | vue-tsc | 通过 | —— |
  | `cd frontend; npm run test:run` | Vitest | 45 passed | 纯函数用例，未新增 |
  | `cd frontend; npm run build` | Vite 生产构建 | 通过 | —— |
  | `python scripts/check_all.py` | 链接/常量/分层/前端/记录/密钥 | 全部 OK | 常量 40/76/33/9 |
  | 浏览器多清单冒烟 | 新建/改名/删除/迁移/笔记/分享 | 未运行 | 无浏览器自动化；需人工确认侧栏与迁移提示 |

- 验收结论：有条件通过 —— 代码、静态检查、后端 145 条与前端 45 条测试全部通过；多清单浏览器交互未手工验证
- 基线例外：无
- 遗留问题：S9 需人工在浏览器执行一次「新建清单 → 加入茶 → 删除清单」确认迁移与提示（责任人：用户；条件：前端 dev server + 已登录账号）
- 回滚方式：`alembic downgrade 0004_login_attempts` + 回退上述文件
- 关联 ADR：无（多清单决策见 DATA_MODEL §6 与 PLAN_剩余功能 §4）

## 2026-11-09｜批次二：S14 登录锁定 / S15 用户等级 / S16 个性化推荐 / S8 分享海报

- 任务编号 / 分级：TASK-20261109-batch2 / C（新表 + 登录安全规则；用户确认于 2026-11-09：锁定按「用户名 + IP」双维度、等级 4 档、允许引入前端 `qrcode` 依赖、本批不提交 Git）
- 需求来源：PRD S14/S15/S16/S8；[PLAN_剩余功能.md](../docs/development/plans/PLAN_剩余功能.md) §3
- 主要变更：
  - `backend/app/models/login_attempt.py`（新）、`models/__init__.py`：`login_attempts` ORM
  - `backend/app/alembic/versions/0004_login_attempts.py`（新）：建表 + 双维度索引
  - `backend/app/repositories/login_attempt_repo.py`（新）；`favorite_repo.py` 增收藏/笔记/茶类分布聚合；`share_repo.py` 增生效分享数
  - `backend/app/core/config.py`：`LOGIN_MAX_FAILURES` / `LOGIN_WINDOW_MINUTES` / `LOGIN_ATTEMPT_RETENTION_HOURS`
  - `backend/app/core/response.py`：`TooManyLoginAttempts(42900)`
  - `backend/app/services/auth.py`：锁定判定先于账号校验；失败记录 + 24h 清理；成功登录清空用户名记录
  - `backend/app/routers/auth.py`：登录传入 `request.client.host`
  - `backend/app/schemas/stats.py`、`services/stats.py`、`routers/me.py`（新）：`GET /me/stats` 与四档等级纯函数
  - `backend/app/services/teas.py`、`routers/teas.py`、`repositories/tea_repo.py`：`GET /teas/recommended`（偏好加权 + 排除已收藏 + 随机兜底）
  - `backend/tests/conftest.py`：每用例清空 `login_attempts`（TestClient IP 固定为 testclient，避免跨用例误锁）
  - `backend/tests/test_batch2_features.py`（新，10 条）；`backend/tests/test_g5_system.py`：AUTH-05 两段失败之间清空记录，避免与 S14 锁定交叉
  - `frontend/src/types/index.ts`、`api/me.ts`（新）、`api/teas.ts`：类型与接口
  - `frontend/src/views/HomeView.vue`：登录后随机发现改为「为你推荐」（推荐 id → 详情）
  - `frontend/src/views/MyListView.vue`：等级徽章与升级差距
  - `frontend/src/utils/poster.ts`（新）+ `poster.spec.ts`（新）；`components/SharePanel.vue`、`views/ShareView.vue`：canvas 海报 + 二维码下载
  - `frontend/package.json`：新增 `qrcode` / `@types/qrcode`（纯前端，动态 `import()`，仅海报功能加载）
- 契约 / 数据 / 安全影响：
  - 新增 `GET /teas/recommended`、`GET /me/stats`；`POST /auth/login` 新增 `42900` / HTTP 429
  - 新表 `login_attempts`；已同步 `docs/api/API_CONTRACT.md` v1.3、`docs/api/openapi.yaml` 1.3.0、`docs/architecture/DATA_MODEL.md` v1.2、`database/init.sql`、`docs/architecture/SECURITY.md` v1.1（S-33）、`docs/testing/TEST_PLAN.md` v1.1、`docs/product/PRD.md`（FR-4.4 / S14 / S15）
  - 迁移 `0004_login_attempts` 已在 `tea_guide` 与 `tea_guide_test` 双库执行
  - 安全项：新增 S-33；登录仍统一 40110，不泄露账号存在性；不记录密码明文
- 测试证据：

  | 命令 | 范围 | 结果 | 说明 |
  |---|---|---|---|
  | `cd backend; python -m ruff check app tests` | Ruff | All checks passed | —— |
  | `cd backend; python -m pytest -q` | 后端全量 | 139 passed | 含批次二新增 10 条 |
  | `cd frontend; npm run lint` | ESLint | 通过 | —— |
  | `cd frontend; npm run typecheck` | vue-tsc | 通过 | —— |
  | `cd frontend; npm run test:run` | Vitest | 45 passed（6 文件） | 含 `poster.spec.ts` 7 条 |
  | `cd frontend; npm run build` | Vite 生产构建 | 通过 | `qrcode` 为独立异步 chunk |
  | 浏览器海报冒烟 | S8 生成/下载/扫码 | 未运行 | 无浏览器自动化；需人工点击「下载分享海报」确认 PNG 与二维码可扫 |

- 验收结论：有条件通过 —— 代码、后端/前端静态检查与单测全部通过；S8 的真实浏览器下载与二维码扫描未验证
- 基线例外：无
- 遗留问题：S8 需人工在浏览器执行一次「下载分享海报」并扫码确认（责任人：用户；条件：前端 dev server 打开任一分享清单）
- 回滚方式：`alembic downgrade 0003_batch1_filters` + 移除 `qrcode`/`@types/qrcode` + 回退上述文件
- 关联 ADR：无（规则细节已在 PLAN_剩余功能 与 S-33 中记录）

## 2026-11-09｜批次一：S1/S2/S3/S6/S7/S17（筛选扩展 / 对比 / 相关推荐 / 小贴士 / 热度）

- 任务编号 / 分级：TASK-20261109-batch1 / B（新增查询参数与两个只读端点，未破坏既有契约；表结构变更经用户确认按批次一方案执行）
- 需求来源：PRD S1/S2/S3/S6/S7/S17；`docs/development/plans/PLAN_剩余功能.md`
- 主要变更：
  - `backend/app/models/tea.py`：`Tea` 增 `price_min/price_max`；`TeaTips` 增 `created_at/updated_at`
  - `backend/app/alembic/versions/0003_batch1_filters.py`：新增价格列、小贴士时间戳、`idx_favorite_created_tea` 索引，并从 `price_range` 回填价格
  - `backend/app/schemas/tea.py`：`TeaDetail` 增价格字段、`TeaBaseRequest` 价格校验、新增 `LatestTipItem`
  - `backend/app/repositories/tea_repo.py`：列表支持发酵/价格/`filter_mode`；`list_hot` 改 7 天加权；新增 `list_related`、`list_latest_tips`
  - `backend/app/services/teas.py`、`backend/app/routers/teas.py`、`backend/app/routers/tips.py`、`backend/app/main.py`：相关推荐与最新小贴士端点
  - `frontend/src/types/index.ts`、`api/teas.ts`、`utils/teaQuery.ts`、`utils/compare.ts`（新）：类型、接口、筛选纯函数、对比矩阵
  - `frontend/src/views/TeaListView.vue`（发酵/价格/组合方式 UI）、`TeaDetailView.vue`（相关推荐改新接口）、`HomeView.vue`（小贴士区块）、`CompareView.vue`（新）、`router/index.ts`（/compare）
  - `database/init.sql`：同步价格字段、小贴士时间戳、索引
- 契约 / 数据 / 安全影响：
  - 新增端点 `GET /teas/{tea_id}/related`、`GET /tips/latest`；列表新增 `fermentation/price_min/price_max/filter_mode` 查询参数；`TeaDetail` 新增 `price_min/price_max`
  - 已同步 `docs/api/API_CONTRACT.md`（§2.3、§4.2.1、§4.2.4、新增 §4.2.8/§4.2.9）、`docs/api/openapi.yaml`、`docs/architecture/DATA_MODEL.md`
  - 迁移：`0003_batch1_filters`（已在 `tea_guide` 与 `tea_guide_test` 双库执行）
  - 安全项：无放宽；新增端点均为游客只读
- 测试证据：

  | 命令 | 范围 | 结果 | 说明 |
  |---|---|---|---|
  | `cd backend; python -m pytest -q` | 后端全量 | 119 passed + 批次一新增 10 passed | 迁移后执行 |
  | `cd frontend; npm run lint` | ESLint | 通过 | —— |
  | `cd frontend; npm run typecheck` | vue-tsc | 通过 | —— |
  | `cd frontend; npm run test:run` | Vitest | 通过（含 teaQuery 19 + compare 3） | —— |
  | `cd frontend; npm run build` | Vite 生产构建 | 通过 | —— |

- 验收结论：通过
- 基线例外：无
- 遗留问题：无（S3 对比页每类各取 1 款代表茶，未做任意多茶对比，符合 MVP 范围）
- 回滚方式：`alembic downgrade 0002_content_expansion` + 回退对应前后端文件
- 关联 ADR：无

## 2026-11-09｜批量录入 30 款茶（六大茶类各 5 款）+ CC0 配图

- 任务卡 / 分级：B（新增业务数据，不改端点/契约/表结构）
- 需求来源：用户要求"多加一些茶"，从原 6 款扩展至 36 款
- 主要变更：
  - 通过 `POST /admin/teas` 录入 30 款茶（id 7–36），六大茶类各 5 款
  - 文字数据：茶名/产地/季节/发酵度/价格/代表品种/外形/汤色/香气/滋味/水温/投茶量/冲泡时间 + 4 项小贴士，参考公开茶知识改写，未直接复制第三方站点原文
  - 配图：每款 1 张主图 + 1 张图集，均来自 Wikimedia Commons CC0 / Public domain；部分茶未搜到专用图，用品类通用图或同品类已有图兜底
  - 修复：霍山黄芽主图曾误配玫瑰花，已替换为黄茶品类图
- 茶品清单（每类 5 款）：
  - 绿：碧螺春、黄山毛峰、信阳毛尖、六安瓜片、庐山云雾
  - 白：白牡丹、寿眉、贡眉、月光白、新工艺白茶
  - 黄：蒙顶黄芽、霍山黄芽、远安鹿苑、平阳黄汤、海马宫茶
  - 乌龙：铁观音、凤凰单丛、冻顶乌龙、武夷肉桂、武夷水仙
  - 红：祁门红茶、滇红、九曲红梅、宜红、川红
  - 黑：安化黑茶、六堡茶、千两茶、茯砖茶、康砖茶
- 契约 / 数据 / 安全影响：仅新增数据行，无代码/契约/表结构变更
- 测试证据：

  | 命令 | 范围 | 结果 |
  |---|---|---|
  | `GET /teas?page_size=100` | 茶品总数 | 36 款，六大茶类各 6 款 |
  | 36 款茶详情接口 | 主图+图集 | 全部 main_image_url 非空、image_set ≥ 1 |
  | `python -m pytest -q` | 后端全量 | **119 passed**（零回归） |

- 验收结论：通过
- 遗留问题：
  - 图片均为 CC0 品类示意图，非具体茶品实拍；正式上线前建议替换自有实拍
  - 部分茶复用了同品类图片，可能出现重复；仅作演示
  - 未做浏览器端对全部 36 款的逐一点验（已验首页与详情页基本功能）
- 回滚方式：`DELETE /admin/teas/{id}` 逐款删除，或直接清库重置种子数据
- 关联文档：[素材清单.md §5.3](../docs/product/素材清单.md)

## 2026-11-09｜文档与常量同步收口（X-02~08 遗留）

- 任务卡 / 分级：A（纯文档/常量同步，不改代码行为）
- 需求来源：`check_all.py` 全量检查暴露的契约与记录不同步问题
- 主要变更：
  - `docs/api/openapi.yaml`：v1.0.0 → v1.2.0；新增 `GET /teas/{tea_id}/images`、`POST /admin/media/video`、`POST/DELETE /admin/teas/{tea_id}/images[/{image_id}]` 共 4 个端点；`TeaDetail` 增 `video_url`/`video_duration`/`image_set`；新增 `TeaMediaItem`/`TeaMediaCreateRequest`/`VideoUploadResult`/`DeletedEnvelope` 等 schema
  - `AGENTS.md`：§6 表数 7→8（增 `tea_media`）、§7 端点数 29→33（teas 7 / admin 11）、§3.1 同步
  - `docs/api/README.md`：端点数 29→33
  - `scripts/check_constants.py`：`openapi_operations` 29→33、`database_tables` 7→8，口径声明同步
  - `docs/development/ADR/ADR-0003-content-expansion.md`：修正 5 个相对链接路径（少一级 `../`）
  - `docs/development/ADR/README.md`：索引补 ADR-0003
  - `docs/development/PLANS_扩展.md`：X-07 状态更新为已落地
  - `harness/build-log.md`：X-01/02~08/07 三条目移至记录区顶部，恢复日期倒序
- 契约 / 数据 / 安全影响：仅文档与常量对齐，无运行时行为变更
- 测试证据：

  | 命令 | 范围 | 结果 | 说明 |
  |---|---|---|---|
  | `python scripts/check_all.py` | 全量静态检查 | **全部通过** | links/constants/layers/frontend/records/secrets 均 OK |
  | `python -m pytest -q` | 后端全量 | **119 passed**（18.90s） | 数据/文档变更零回归 |
  | `npm run build` | 前端生产构建 | 通过（1.53s） | 仅既有 chunk >500kB 警告 |
  | `python -c "yaml.safe_load(openapi.yaml)"` | OpenAPI 语法 | OK | YAML 可解析 |

- 验收结论：通过
- 遗留问题：见本条目之前的 X-07 条目（浏览器手工冒烟、君山银针/大红袍图集仅 1 张、git 未提交）
- 回滚方式：revert 上述文档/常量改动即可
- 关联 ADR：[ADR-0003](../docs/development/ADR/ADR-0003-content-expansion.md)

## 2026-11-09｜X-01 内容扩展：Alembic 基线接管 + S4/S5 表结构迁移

- 任务卡 / 分级：C（表结构变更；ADR-0003 已于 2026-11-09 经用户确认「全部按推荐方案执行」后采纳）
- 需求来源：内容扩展提案（PRD_扩展提案.md），本期范围 = 方案二（S4 图片集 + S5 视频 + R7 首页背景 + R8 素材）
- 主要变更：
  - `backend/app/alembic/versions/0001_baseline.py`：空操作基线迁移（基线结构由 `database/init.sql` 建立；已建库环境 `alembic stamp 0001_baseline`）——Alembic 正式接管版本链（此前 versions/ 为空，MVP 全靠 init.sql）
  - `backend/app/alembic/versions/0002_content_expansion.py`：`teas` 增 `video_url VARCHAR(500) NULL` / `video_duration INT UNSIGNED NULL`；新建 `tea_media` 表（FK→teas ON DELETE CASCADE，idx(tea_id, sort_order)）
  - `backend/app/models/tea.py`：Tea 增两列映射 + `media_images` relationship；新增 `TeaMedia` 模型；`models/__init__.py` 导出
  - `database/init.sql`：同步新列与 tea_media 建表语句（保持从零建库可用）
  - `docs/architecture/DATA_MODEL.md` v1.0→v1.1：§2 表清单第 8 行、§3 ER 图、§4.2 新列、§4.3.1 tea_media 小节、§10 S4/S5 标记已落地
  - `backend/alembic.ini`：中文注释改英文（修复 Windows GBK locale 下 configparser 解码失败；该文件此前从未实际运行所以未暴露）
  - 提案文档确认状态同步：ADR-0003 转「已采纳」，PRD_扩展提案 Q1–Q5、PLANS_扩展 前置清单全部标记已确认
- 契约 / 数据 / 安全影响：表结构变更（本次）；API 契约暂未变（TeaDetail 增字段属 X-04a）；无安全项变更
- 测试证据：

  | 命令 | 范围 | 结果 | 说明 |
  |---|---|---|---|
  | `alembic stamp 0001_baseline && upgrade head` | tea_guide（开发库） | 通过 | current = 0002_content_expansion (head) |
  | stamp → upgrade → downgrade → upgrade 循环 | tea_guide_test（测试库） | 通过 | 升降级可重放，最终 current = head |
  | SHOW COLUMNS / SHOW INDEX 结构断言 | 两库 | 通过 | teas 两新列 NULL 许可正确；tea_media 5 列 + PK + idx_tea_media_tea 正确 |
  | `python -m pytest -q` | 后端全量 | **106 passed**（18.69s） | schema 变更对现有功能零破坏 |
  | `ruff check app tests` / `ruff format --check app` | 后端静态 | 通过 | 初次 format 有 1 文件待整理，已修复复检通过 |

- 验收结论：通过（X-01a/X-01b 出口标准全部满足）
- 遗留问题：
  - 首次执行 0002 时因 `op.create_table` 误用裸 kwargs（engine/charset）失败，teas 两列已落库但 tea_media 未建；已手工回滚中间态两列后重放成功。教训：方言参数必须用 `mysql_` 前缀；已修正迁移文件。
  - 前端 `types/index.ts` 的 TeaDetail 类型暂未加 video 字段——属 X-04a 范围，届时同步。
- 回滚方式：`alembic downgrade 0001_baseline`（两库均已验证可回滚）；revert 模型与文档变更
- 关联 ADR：[ADR-0003](../docs/development/ADR/ADR-0003-content-expansion.md)

## 2026-11-09｜X-02~X-08 内容扩展：S4 图片集 + S5 视频 + 首页装饰背景

- 任务卡 / 分级：ADR-0003 已采纳后落地；X-03/X-04a/X-05a 为契约追加（C 类已确认，实现级 B），X-02/X-04b/X-05b/X-06/X-08 为 B 类
- 主要变更（后端）：
  - `core/config.py`：新增 `MAX_VIDEO_SIZE_MB=50`、`MAX_VIDEO_DURATION_SECONDS=180`、`MAX_VIDEO_REQUEST_BODY_MB=52`
  - `core/response.py`：新增 `VideoTooLarge(41300)`、`UnsupportedVideo(41500)`、`VideoTooLong(40000)`、`VideoUnreadable(40000)`，沿用既有错误码族，不新增业务码
  - `main.py`：请求体上限按路径分流，仅 `/admin/media/video` 放宽到 52 MB
  - `services/upload.py`：新增 ISO BMFF `ftyp` 魔数判定与 `moov/mvhd` 时长解析（无 ffprobe 依赖），落盘 `uploads/videos/{YYYY}/{MM}/`
  - `services/admin.py` + `routers/admin.py`：新增 `POST /admin/media/video`
  - `schemas/tea.py`：`TeaDetail` 增 `video_url`/`video_duration`/`image_set`；`TeaBaseRequest` 增视频字段（`video_url` 强制 `/uploads/` 前缀，`video_duration` 1–180）
  - 新增 `repositories/tea_media_repo.py`、`services/tea_media.py`；`routers/teas.py` 增 `GET /teas/{id}/images`；`routers/admin.py` 增 `POST/DELETE /admin/teas/{id}/images[/{image_id}]`
  - `repositories/tea_repo.py`：详情查询 `selectinload(Tea.media_images)`
- 主要变更（前端）：
  - `types/index.ts`：`Tea` 增视频/图片集字段；新增 `AdminVideoUploadData`、`TeaMediaItem`；`AdminTeaPayload` 增视频字段
  - `api/admin.ts` / `api/teas.ts`：新增 `uploadAdminVideo`、`addAdminTeaImage`、`deleteAdminTeaImage`、`getTeaImages`
  - `TeaDetailView.vue`：视频播放器（无视频/加载失败整块隐藏）+ 图片集缩略图切换主图
  - 新增 `components/HeroBackground.vue`：纯装饰轮播（无跳转）、可关闭并记忆（localStorage）、尊重 prefers-reduced-motion、首张 eager 其余 lazy、加载失败自动剔除
  - `HomeView.vue`：Hero 接入装饰背景层，内容层 `z-index:1`
  - `AdminTeaEdit.vue`：视频上传/清除/预览 + 图片集上传/删除（上限 9 张提示）
  - 新增 6 张水墨风格占位背景 `public/images/banners/*.svg`（明确标注"占位图 · 待实拍替换"）
- 文档同步：
  - `docs/api/API_CONTRACT.md` v1.1→v1.2：`TeaDetail` 字段、§4.2.7、§4.6.9/10/11、§4.6.3/4.6.4 请求字段、变更记录
  - `docs/development/PLANS_扩展.md`：X-01~X-08 状态回填
  - 新增 `docs/product/素材清单.md`：目录/命名/格式/体积/兜底/来源登记/待补清单
- 契约 / 数据 / 安全影响：契约追加 4 个端点与 3 个详情字段（向后兼容，老字段不变）；无新增表（X-01 已完成）；请求体上限仅对视频端点放宽，其余仍 6 MB；视频与图片均校验魔数，不信任客户端类型
- 测试证据：

  | 命令 | 范围 | 结果 | 说明 |
  |---|---|---|---|
  | `pytest tests/test_s4_s5.py -q` | 新增 S4/S5 | 13 passed | 视频上传正常/非视频/超时长/未登录/外链拒绝；图片集增删查/上限/越权/下架隐藏 |
  | `python -m pytest -q` | 后端全量 | **119 passed**（17.68s） | 原 106 条零回归 |
  | `ruff check app tests` / `ruff format --check app tests` | 后端静态 | 通过 | 格式化后复检通过 |
  | `npm run typecheck` | 前端类型 | 通过 | |
  | `npm run lint` | 前端 ESLint | 通过 | |
  | `npm run test:run` | 前端 Vitest | **30 passed** | 原有 30 条，无新增纯函数 |
  | `npm run build` | 生产构建 | 通过（4.90s） | 仅既有的 Element Plus chunk >500 kB 警告 |
  | 结构断言 | tea_guide / tea_guide_test | 通过 | X-01 已完成，本轮无 DDL 变更 |

- 验收结论：功能与门禁通过；**未做浏览器端手工冒烟**（未启动 dev server 实际点击），如需请另开一轮
- 遗留问题：
  - 图片集删除仅解除数据库关联，磁盘文件保留（同一 URL 可能被多茶复用）；已在 API 契约与素材清单注明
  - 视频时长解析依赖 `moov/mvhd`；缺失 `moov` 的异常封装文件会返回 40000「无法解析视频时长」
  - 六大茶类与每款茶的**真实实拍图尚未提供**，当前为占位图；`素材清单.md` 已列出待补项与来源登记字段
  - 首页背景在 `prefers-reduced-motion` 与用户关闭开关时停止轮播，但仍保留首张静图
- 回滚方式：revert 本轮提交即可；无 DDL 回滚需求
- 关联 ADR：[ADR-0003](../docs/development/ADR/ADR-0003-content-expansion.md)

## 2026-11-09｜X-07 素材落地：首页 6 张背景 + 6 款茶主图/图片集

- 任务卡 / 分级：B（仅新增静态素材与内容数据，不改端点行为、契约字段、表结构、业务规则）
- 需求来源：用户要求「图片去这些网站里找，加上；首页只加图片背景，不要视频」，并在 AskUserQuestion 中选择「用 CC0 公共领域图库」「茶品主图与图片集一起配」
- 关于用户给出的 5 个中文茶站（音茶网 / 茶语网 / ipucha / 茶百科 / 普洱茶网）：均为受版权保护的商业站点，且多启用防盗链，直接抓图存在侵权与失效风险，故**未采用**；改用 Wikimedia Commons 的 CC0 / Public domain 文件，可商用且可回溯
- 主要变更：
  - `frontend/public/images/banners/banner-{green,white,yellow,oolong,red,dark}.webp`：6 张首页装饰背景，1600×900，单张 92–307 KB（≤320 KB 限制）
  - `backend/uploads/2026/11/*.webp`：本轮生成 17 张茶品图片（6 张主图 + 11 张图集），1200×900，单张 ≤300 KB
  - 通过 admin API 写库：6 款茶 `teas.main_image_url` 全部指向本站 `/uploads/`；`tea_media` 图片集共 11 条（西湖龙井 3 / 白毫银针 2 / 正山小种 2 / 普洱熟茶 2 / 君山银针 1 / 大红袍 1）
  - `docs/product/素材清单.md`：§1 约束改写为"CC0 品类示意图"口径；§3 首页背景改为已落地 WebP；§5 重写为素材来源登记表（6 张背景 + 6 款茶，含 Commons 文件页、许可、日期）
  - 生成脚本与映射表仅存放于 `%TEMP%`，不进仓库
- 契约 / 数据 / 安全影响：无契约变更；仅写内容数据（`teas.main_image_url`、`tea_media` 行）；所有 URL 均由服务端 `POST /admin/upload` 生成，符合"禁止第三方外链"约束
- 测试证据：

  | 命令 | 范围 | 结果 | 说明 |
  |---|---|---|---|
  | `python %TEMP%/build_dark.py` | 黑茶素材生成 | 通过 | banner 291 KB + 3 张茶图 |
  | `python %TEMP%/apply_tea_assets.py` | 写库（admin API） | 通过 | 6 款茶 PUT 均 200/0；图片集追加 11 条均 200/0 |
  | `python %TEMP%/verify_assets.py` | 落库与静态可访问性 | **failures = 0** | 6 款茶主图 + 图片集 URL 全部 HTTP 200；6 张 banner 全部 200（92–300 KB） |
  | `python -m pytest -q` | 后端全量 | 未运行 | 本轮无代码改动，仅数据与静态文件；如需可复跑 |

- 验收结论：通过（素材已落地并可访问）；浏览器端手工冒烟已通过（首页 6 张 CC0 背景轮播、无视频、无暂停按钮；详情页主图与缩略图切换正常）
- 已知局限：
  - CC0 图库只能提供**品类示意**：如"西湖龙井"主图为茶园/茶叶泛图，并非该款茶实拍；已在 `素材清单.md` §1.2 与 §5 顶部明确标注
  - 君山银针、大红袍已补足至各 2 张图集（2026-11-09 第二轮补充：Tieguanyin2、Tea cloth with autumn leaves motif 等 CC0/PD 图源）；六款茶图集均 ≥ 2 张
  - `banner-{category}.svg` 保留为三级兜底，未删除
- 回滚方式：删除 `frontend/public/images/banners/*.webp` 与 `backend/uploads/2026/11/` 下本轮新增文件；数据库侧清空 `teas.main_image_url`、删除 `tea_media` 对应行（或 `alembic downgrade` 后重建）
- 关联 ADR：[ADR-0003](../docs/development/ADR/ADR-0003-content-expansion.md)

## 2026-11-09｜项目交付 README 生成

- 任务编号 / 分级：TASK-20261109-README / A（纯文档产出，未触碰业务规则、契约、表结构与安全项）
- 需求来源：用户要求结合实际代码、配置与真实测试结果生成项目 README.md，并检查部署条件
- 主要变更：
  - `README.md`（新建）：项目简介 / 建设目标 / 功能介绍 / 技术栈 / 目录结构 / 数据库初始化 / 前后端启动 / 配置说明 / 测试方法与结果 / 截图 / 已知问题 / 部署条件与步骤
- 契约 / 数据 / 安全影响：无；README 未写入任何真实密码或密钥（种子管理员口令仅指引查阅 init.sql 注释并要求轮换）
- 测试证据（本次为验证 README 声明而实跑，非代码变更回归）：

  | 命令 | 范围 | 结果 | 说明 |
  |---|---|---|---|
  | `cd backend; python -m pytest -q --tb=no` | 后端全量 | 106 passed, 488 warnings in 47.02s | 与 README §10.2 一致 |
  | `cd frontend; npm run test:run` | 前端单测 | 30 passed（4 文件） | 与 README §10.2 一致 |
  | `cd frontend; npm run build` | 生产构建 | ✓ built in 3.51s | 仅有 chunk >500kB 既有告警 |
  | `python scripts/check_all.py` | 全量静态检查 | 全部通过 | 含 README 新增链接校验 |

- 验收结论：通过（截图缺失、CI 未实跑、未实机部署均已在 README 如实标注）
- 基线例外：无
- 遗留问题：README §11 截图待补充；首次部署需编写 Nginx 配置并实机验证 §13.2 步骤
- 回滚方式：删除 `README.md` 并回退本条记录
- 关联 ADR：无

## 2026-11-09｜全项目代码审查问题修复（S-1/S-2/G-1~G-6/O-1~O-3）

- 任务编号 / 分级：REVIEW-20261109 / B（无契约变更；涉及安全默认值与前台依赖调整）
- 需求来源：用户全项目代码审查报告的 10 个检查维度
- 主要变更：
  - `backend/app/core/config.py`：`DEBUG` 默认改为 `False`；`SECRET_KEY`/`MYSQL_PASSWORD` 取消弱默认值；新增启动校验，缺失 `SECRET_KEY` 拒绝启动（S-31）
  - `backend/alembic.ini`：移除 `root:root` 明文，改为占位值（实际连接仍由 `env.py` 注入）
  - `backend/app/repositories/tea_repo.py`：`origin` 筛选补 LIKE 通配符转义；`get_by_id` 增加 `with_tips` 参数
  - `backend/app/core/security.py`：`SESSION_EXPIRE_DAYS <= 0` 时显式判定立即过期（覆盖配置值分支）
  - `backend/app/routers/auth.py`：内联 import 上移，复用 `USERNAME_PATTERN`
  - `backend/app/services/favorites.py`：收藏查询跳过 `tea_tips` 联表
  - `backend/app/services/shares.py`：令牌重试耗尽改抛 `InternalError`，保持统一响应体
  - 新增 `repositories/_common.py`、`services/_common.py`、`schemas/_common.py`，消除 `escape_like`/`split_csv`/`iso_z` 重复定义
  - `frontend/src/stores/toast.ts` + `components/AppToast.vue`：自研 Toast 替代 `ElMessage`
  - `frontend/src/api/request.ts`：错误提示改用 Toast Store
  - `frontend/src/main.ts`：Element Plus 改为仅在 `/admin` 路由动态加载
  - `frontend/src/views/NotFound.vue`：`el-button` 改自研按钮
  - `frontend/src/types/index.ts`：新增 `ApiEnvelope<T>` 并统一 5 个 api 模块；删除未使用 `ShareToken`
  - 删除 `components/HelloWorld.vue`、`assets/{hero.png,vite.svg,vue.svg}`、`favorite_repo.count_by_user`
  - `scripts/check_layers.py` / `scripts/check_frontend.py`：清空历史遗留基线
  - `backend/tests/test_teas.py`：新增 origin 通配符转义回归用例
  - `backend/tests/conftest.py`：测试环境注入 `DEBUG`/`SECRET_KEY`
  - `AGENTS.md` §3.1：Element Plus 条目更新为已修复
- 契约 / 数据 / 安全影响：无端点、字段、表结构变更；SECURITY S-30/S-31 的代码兜底加强（默认值收紧 + 启动校验），未同步修改安全控制条目
- 测试证据：

  | 命令 | 范围 | 结果 | 说明 |
  |---|---|---|---|
  | `cd backend; python -m ruff check app tests` | 后端风格 | 通过 | —— |
  | `cd backend; python -m ruff format --check app tests` | 后端格式 | 通过 | —— |
  | `cd backend; python -m pytest -q` | 后端全量 | 106 passed | 含新增 origin 转义用例 |
  | `cd frontend; npm run lint` | 前端 ESLint | 通过 | —— |
  | `cd frontend; npm run typecheck` | 前端类型 | 通过 | —— |
  | `cd frontend; npm run test:run` | 前端单测 | 30 passed | 纯函数用例 |
  | `cd frontend; npm run format:check` | 前端格式 | 通过 | —— |
  | `cd frontend; npm run build` | 生产构建 | 通过 | Element Plus 已拆分为 admin 异步 chunk |
  | `python scripts/check_all.py` | 全量静态检查 | 全部通过 | 五层 0 遗留、前台 UI 0 遗留 |

- 验收结论：通过
- 基线例外：无（AGENTS §3.1 Element Plus 遗留已清理）
- 遗留问题：
  - O-4 `ORDER BY RAND()` 未调整：当前茶品量级（<1000）下成本可接受，改为随机偏移会引入额外 count/offset 查询与分布偏差，待数据量增长后再评估
  - O-5 初始 Alembic 迁移未生成：当前建表仍以 `database/init.sql` 为准，正式上线前需在空库生成 baseline migration 并对现有环境 `alembic stamp`
- 回滚方式：`git revert` 本次提交
- 关联 ADR：无

## 2026-11-08｜G5 测试缺陷修复（D-01 ~ D-05）

- 任务编号 / 分级：TASK-20261108-G5FIX / **B**（未改 API 契约、表结构、权限/认证机制与安全控制口径；D-04 默认密码置空为向既有 SECURITY S-31 对齐，属实现向文档对齐）
- 需求来源：`docs/testing/TEST_REPORT.md` 缺陷清单；TEST_PLAN TC-AUTH-07 / TC-LIST-05 / TC-DEF-02 / TC-DEF-04；SECURITY S-21 / S-26 / S-31
- 主要变更：
  - `backend/app/core/security.py`：`max_age_days <= 0` 显式立即过期，修复 0 回落 30 天与 itsdangerous 同秒 `age=0` 不过期两处根因。
  - `backend/app/repositories/tea_repo.py` / `admin_repo.py`：新增 `_escape_like()`，转义 `\`/`%`/`_` 并显式 `escape="\\"`，修复搜索通配符返回全表。
  - `backend/app/main.py`：新增 6MB Content-Length 中间件（先注册，CORS 后注册为最外层），超限返回 413/41300。
  - `backend/app/core/response.py`：新增 `DataError → 400/40000`，仅记录方法/路径/异常类型，不写参数与 SQL。
  - `backend/app/core/config.py`：`ADMIN_PASSWORD` 默认置空（S-31），新增 `MAX_REQUEST_BODY_MB=6`。
  - `backend/.env.example`：清空 `ADMIN_PASSWORD` 并补充轮换命令；`backend/.env` 与 `database/init.sql` 的开发/演练种子保持不变。
  - 新增 `backend/app/scripts/rotate_admin_password.py` + `__init__.py`：bcrypt cost=10，复用 `user_repo`，输出不含明文。
  - `backend/tests/test_g5_system.py`：新增 DEF-02、DEF-04 两条回归，强化 AUTH-07（0/-1 过期、末位高位翻转篡改），共 23 条。
  - `docs/testing/TEST_REPORT.md`：更新统计、逐条结果、缺陷修复记录与命令输出。
- 契约 / 数据 / 安全影响：无 API 契约/表结构/迁移变更；未修改 SECURITY 规则；S-26 错误响应仍不泄露堆栈/SQL；S-31 通过默认密码清空 + 轮换脚本补齐。
- 测试证据：

  | 命令 | 范围 | 结果 | 说明 |
  |---|---|---|---|
  | `python -m ruff format --check app tests` | 后端格式 | 55 files already formatted | 修复后复跑 |
  | `python -m ruff check app tests` | 后端 lint | All checks passed | 修复后复跑 |
  | `pytest -q <AUTH-07/LIST-05/DEF-02/DEF-04>` | 四条初测失败/未执行 | 4 passed | 失败用例全绿 |
  | `pytest -q <§7.1 门禁 9 条>` | 安全门禁 | 9 passed, 10 warnings in 6.86s | 含 DEF-04 真实轮换与恢复 |
  | `python -m pytest -q` | 后端全量 | 105 passed, 484 warnings in 17.25s | 0 skip |
  | `npm run lint / format:check / typecheck / test:run / build` | 前端质量门禁 | 全部通过；30 tests passed；build 12.21s | 主 chunk >500 kB 告警非失败 |
  | `python scripts/check_all.py` | 静态检查 | 全部通过 | 205 链接；29/60/32/7；153 文件无敏感信息 |
  | GitHub Actions CI | CI | 未运行 | 未在远端实跑，不标记通过 |

- 验收结论：**通过**（60/60 用例、32/32 高优先级；D-01～D-05 关闭；CI 未运行已如实标注）
- 基线例外：无新增；前台 Element Plus 仍为既有 3 项基线
- 遗留问题：
  - 生产 Nginx `client_max_body_size` 需配置为 6m 并复测 413（部署项，非代码范围）。
  - CI 需在 GitHub Actions 实跑后回填结果；未运行前不宣称通过。
  - `ADMIN_PASSWORD` 默认值为空需同步部署文档，避免新环境缺省注入导致无管理员。
- 回滚方式：`git revert` 本提交；代码回滚不影响数据库已存密码；如已在环境执行轮换，用原密码重新执行脚本恢复。
- 关联 ADR：无（均为既有规则内的缺陷修复，未产生架构级决策）

## 2026-11-08｜阶段 5（G5）系统测试

- 任务编号 / 分级：TASK-20261108-G5 / 测试任务（不改生产代码）
- 需求来源：TEST_PLAN v1.0 §5 / §7.1；用户阶段 5 系统测试要求
- 主要变更：
  - `backend/tests/test_g5_system.py`：新增 21 条补充用例，函数名携带 TC 编号，补齐认证边界、会话过期/篡改、管理员校验、分页排序、通配符、权限副作用、分享字段、并发与 E2E。
  - `docs/testing/TEST_REPORT.md`：新增 60 条用例执行记录、缺陷清单、并发与端到端证据、命令输出摘录。
- 契约 / 数据 / 安全影响：无接口、表结构、安全控制变更；发现 D-01–D-04 四项缺陷，未在本任务修复。
- 测试证据：

  | 命令 | 范围 | 结果 | 说明 |
  |---|---|---|---|
  | `cd backend; python -m pytest -q --tb=no` | 后端全量 | 101 passed / 2 failed / 0 skipped | 失败为 TC-AUTH-07、TC-LIST-05，断言未放宽 |
  | `pytest -q <8 条安全门禁节点>` | TEST_PLAN §7.1 | 8 passed | TC-DEF-04 因脚本缺失未执行 |
  | `cd frontend; npm run lint / format:check / typecheck / test:run / build` | 前端质量门禁 | 全部通过；30 tests passed | 构建有 chunk >500 kB 告警，非失败 |
  | `python scripts/check_all.py` | 静态检查 | 全部通过 | 205 链接、29 端点、60 用例、32 安全项、7 表 |

- 验收结论：**不通过**（高优先级 TC-DEF-04 未执行，构成发布阻断；另有 3 条中优先级缺陷）
- 基线例外：无新增；前台 Element Plus 仍为既有 3 项基线
- 遗留问题：
  - D-01 `verify_session_token(max_age_days=0)` 回落 30 天，需按 `is not None` 修复。
  - D-02 搜索 `%`/`_` 未转义，返回全表，需在 repository 层转义。
  - D-03 10MB `shape_desc` 返回 500，需补请求体大小限制与字段长度上限。
  - D-04 `app.scripts.rotate_admin_password` 缺失；`admin123` 仍在 `.env`/`init.sql`，需实现轮换脚本并演练。
- 回滚方式：删除 `backend/tests/test_g5_system.py` 与 `docs/testing/TEST_REPORT.md` 即可；测试临时数据已清理。
- 关联 ADR：无

## 2026-11-08｜审计问题修复：门禁 / 错误处理 / 测试库隔离 / 认证回流

- 任务卡 / 分级：AUDIT-FIX-01 / **B**（未改 API 契约、表结构、认证机制与安全控制）；其中"创建测试库 + 测试配置"为 **C** 类，用户于 2026-11-08 通过选项明确确认
- 需求来源：PLANS.md T0-03、T0-04、T1-02、T5-01、T5-02、T5-03；TEST_PLAN TC-DEF-01、TC-DEF-03；AGENTS.md §4、§9、§10.1
- 主要变更：
  - `app/core/response.py`：新增兜底 `Exception` 处理器，统一返回 500/50000；服务端用 `logger.exception` 记录堆栈，响应体不含堆栈/SQL/表名
  - `backend/tests/conftest.py`（新建）：导入 `app.*` 前强制测试库；优先读取 `DATABASE_URL_TEST`，否则默认 `tea_guide_test`；启动断言库名必须 `*_test`；同时隔离 `UPLOAD_DIR` 到系统临时目录
  - `backend/tests/test_defense.py`（新建）：DEF-01（畸形 JSON、非 JSON Content-Type、参数类型错误、role 注入不落库）与 DEF-03（未捕获异常 500/50000、响应不泄露、服务恢复）
  - `backend/.env.example`：补充 `DATABASE_URL_TEST` 示例（注释状态）
  - `frontend/src/views/admin/AdminLogin.vue`、`AdminTeaEdit.vue`、`AdminTeas.vue`：Prettier 格式化
  - `frontend/src/utils/pendingAction.ts`（新建）+ `pendingAction.spec.ts`（新建）：登录前动作暂存/解析/30 分钟过期
  - `frontend/src/views/TeaDetailView.vue`：未登录点击笔记/分享时保存 pending_action，登录回跳后自动继续原动作并清理
- 契约 / 数据 / 安全影响：无端点、字段、表结构变更；500 响应符合 API_CONTRACT §1.6；未改动 SECURITY S-01–S-32
- 测试证据：

  | 命令 | 范围 | 结果 | 说明 |
  |---|---|---|---|
  | `cd backend; python -m pytest -q` | 全部后端用例（82 条） | 82 passed | 已切换至 `tea_guide_test` |
  | `python -m ruff check app tests`、`ruff format --check` | 后端静态 | 通过 | 52 文件已格式化 |
  | `cd frontend; npm run test:run` | 前端 4 个 spec | 30 passed | 新增 pendingAction 5 条 |
  | `npm run lint`、`npm run typecheck`、`npm run build` | 前端 | 通过 | 仅既有 chunk >500kB 警告 |
  | `npm run format:check` | 前端格式 | 通过 | 3 个后台文件已修复 |
  | `python scripts/check_all.py` | 全量静态闸门 | 通过 | 29/60/32/7 常量一致；分层 0 违规 |
  | `SELECT COUNT(*) FROM tea_guide.users` / `tea_guide_test.users` | 数据库隔离 | 6 / 1 | 开发库未被测试写入；测试库仅种子管理员 |

- 验收结论：通过（本次用户确认的三项范围）
- 基线例外：`api/request.ts`、`main.ts`、`stores/toast.ts` 仍直接使用 Element Plus（AGENTS §3.1 基线，本次未扩大）
- 遗留问题：
  - DEF-02（超大请求体 413）、DEF-04（管理员密码轮换）仍未补用例；T5-04 上线安全项未开始
  - T1-02 仍采用整页登录而非 LoginModal，但笔记/分享/收藏的登录回跳动作已可自动续接
  - `tea_guide_test` 为本次手工创建并导入 `database/init.sql` 结构；CI 环境建库脚本尚未落地
- 回滚方式：回滚上述文件；如需彻底回滚测试库，执行 `DROP DATABASE tea_guide_test`
- 关联 ADR：无（沿用 PLANS.md §5.4 已定稿的测试库约定，非新增架构决策）

## 2026-11-08｜阶段 4：管理员后台（T4-01 ~ T4-06）

- 任务卡 / 分级：T4-01 ~ T4-06 / **B**（实现 API_CONTRACT §4.6 已定稿的 8 个 admin 端点与后台 5 页；未改契约路径/字段/错误码，未改表结构、认证机制与安全控制）
- 需求来源：PRD FR-6.1~6.5、模块 6；API_CONTRACT §4.6.1~§4.6.8；MODULE_DESIGN M6；DATA_MODEL `teas`/`tea_tips`/`operation_logs`；PAGE_SPECS 后台 A1~A5；SECURITY S-08/S-11/S-14/S-19/S-20/S-23/S-24/S-28；TEST_PLAN PERM-01~04、TEA-01~07、UPLOAD-01~05
- 主要变更：
  - **后端（T4-01 权限）**
    - `app/routers/admin.py`：router 级 `Depends(get_admin_user)` 先于参数校验执行；8 端点全部由后端鉴权
    - `backend/tests/test_admin.py`（新建）：游客 401/40100、普通用户 403/40300、角色实时读库、非法参数仍先返回 401/403
  - **后端（T4-02 ~ T4-06）**
    - `app/schemas/admin.py`（新建）：后台列表/统计/上下架/小贴士/上传响应 DTO；`extra='forbid'`
    - `app/schemas/tea.py`：`TeaBaseRequest` / `TeaCreateRequest` / `TeaUpdateRequest` 全量校验（枚举、必填非空、水温 70–100、最多 1 位小数、主图协议白名单）；`is_active`/`favorite_count`/`id` 不在请求体
    - `app/repositories/admin_repo.py`（新建）：含下架列表/状态筛选/分页、统计、写入与 operation_logs；只 add/flush，不 commit
    - `app/services/admin.py`（新建）：新增/编辑/上下架/小贴士/统计/上传业务；写操作与日志同事务；编辑 PUT 全量替换；小贴士省略保持、null/空白清空
    - `app/services/upload.py`（新建）：分块读取，>5 MB 立即 413/41300；JPEG/PNG/WebP 魔数判定，非法 415/41500；UUID 文件名；落盘路径强制在 `uploads/` 内
    - `app/main.py`：静态挂载目录与 `settings.UPLOAD_DIR` 对齐
    - `app/core/response.py`：新增 `FileTooLarge(41300)` / `UnsupportedMedia(41500)` / `InternalError(50000)`
  - **前端（T4-06）**
    - `src/types/index.ts`、`src/api/admin.ts`（新建）：admin 契约类型与 8 个请求封装
    - `src/views/admin/AdminLogin.vue`：管理员登录，非 admin 立即注销会话
    - `src/views/admin/AdminLayout.vue`：侧边栏/顶栏/退出；菜单改用真实路径，修复 `el-menu router` 按路由名跳转 404
    - `src/views/admin/AdminDashboard.vue`：3 张统计卡、六大茶类分布、最近 5 款
    - `src/views/admin/AdminTeas.vue`：茶类/状态/关键词筛选、分页、含下架列表、上下架二次确认
    - `src/views/admin/AdminTeaEdit.vue`：新增/编辑共用表单、主图上传、小贴士、上下架；不出现审核状态
    - `src/api/request.ts`：admin 端点 401 跳转 `/admin/login`
- 契约 / 数据 / 安全影响：**无契约与表结构变更**，无 Alembic 迁移；8 端点按 §4.6 实现。权限门禁、请求体白名单、日志同事务、上传魔数/大小/路径穿越均按 SECURITY 实现；前台可见性沿用既有 `is_active=1` 过滤，收藏与分享条目保留。
- 测试证据：

  | 命令 | 范围 | 结果 | 说明 |
  |---|---|---|---|
  | `cd backend; python -m pytest tests/test_admin.py -q` | PERM/TEA/TIPS/STATS/UPLOAD | **19 passed** | 含 8 端点越权、上下架前台联动、收藏保留灰显、413/415、路径穿越 |
  | `cd backend; python -m pytest -q` | 后端全量 | **80 passed** | 364 warnings（既有 Pydantic/SQL echo），无失败 |
  | `cd backend; python -m ruff check app tests` | 后端 lint | All checks passed | —— |
  | `cd backend; python -m ruff format --check app tests` | 后端格式 | 通过 | —— |
  | `cd frontend; npm run test:run` | Vitest | **25 passed**（3 文件） | 本次未新增纯函数 |
  | `cd frontend; npm run lint` | ESLint | 通过 | —— |
  | `cd frontend; npm run typecheck` | vue-tsc | 通过 | —— |
  | `cd frontend; npm run build` | 生产构建 | 通过 | 仅 chunk >500kB 既有警告 |
  | `python scripts/check_all.py` | 链接/常量/分层/UI/记录/密钥 | **全部通过** | 205 链接；29/60/32/7 一致；五层 0 新增违规 |
  | 浏览器手工冒烟（3 次子代理） | 登录→概览→列表→新增→编辑 | **PASS** | `/admin` 统计卡与分布正常；`/admin/teas` 6 行+筛选；`/admin/teas/new` 表单完整；`/admin/teas/6/edit` 预填正确 |

- 验收结论：通过。首次冒烟发现侧边栏 `el-menu router` 使用路由名导致 404，已改为真实路径并复测；写操作（新增/编辑/上下架/上传提交）由 19 条 pytest 覆盖，浏览器仅做页面渲染与预填冒烟。
- 基线例外：无新增（后台组件使用 Element Plus 属既定规范；前台未新增 EP 引用）
- 遗留问题：
  - 浏览器冒烟未实际提交新增/编辑/上传表单，避免污染种子数据；对应写路径由 backend pytest 覆盖
  - `operation_logs` 仅写入、不提供查询接口（按需求约束）
- 回滚方式：revert 本次提交（移除 admin schema/repo/service、upload service、admin router 实现、`test_admin.py`、前端 admin api 与 5 页实现，恢复占位页与 request 拦截器）
- 关联 ADR：无（均为契约内实现；魔数自研校验未引入新依赖，故不触发技术选型决策）

## 2026-11-08｜阶段 3：收藏清单 + 品鉴笔记 + 分享（T3-01 ~ T3-06）

- 任务卡 / 分级：T3-01 ~ T3-06 / **B**（实现 API_CONTRACT §4.3–§4.5 已定稿的 10 个端点与对应前台页面；未改契约路径/字段/错误码，未改表结构、认证机制与安全控制）
- 需求来源：PRD FR-5.1~5.6；API_CONTRACT §2.4/§2.5/§2.6、§4.3.1~§4.5.4；DATA_MODEL §collection_lists/favorite_items/share_tokens；PAGE_SPECS §六/§七；TEST_PLAN FAV-01~07、NOTE-01~05、SHARE-01~10、PERM-03
- 主要变更：
  - **后端（T3-01 收藏）**
    - `app/schemas/favorite.py`、`app/repositories/favorite_repo.py`：收藏行查询/写入、`favorite_count` 原子 ±1（CASE 保证不低于 0）
    - `app/services/favorites.py`：收藏/取消幂等；下架茶新增收藏 40401、取消/状态允许；行写入与计数同事务；唯一冲突按已收藏处理
    - `app/routers/favorites.py`：POST/DELETE `/{tea_id}`、GET `/{tea_id}/status`
  - **后端（T3-02 清单与笔记）**
    - `app/schemas/list.py`、`app/repositories/list_repo.py`：默认清单 get-or-create、条目联查、标题/笔记更新
    - `app/services/lists.py`：标题 trim 后 2–20 字；笔记 ≤20,000 字、纯空白归一化为 null、清空不删除条目；未收藏写笔记 40430
    - `app/routers/lists.py`：GET `/lists`、PUT `/lists/title`、PUT `/lists/notes/{tea_id}`
    - `app/core/response.py`：新增 `FavoriteNotFound(40430)`
    - `app/core/auth_deps.py`：新增 `get_optional_user`（公开分享页计算 is_owner）
  - **后端（T3-03 分享）**
    - `app/schemas/share.py`、`app/repositories/share_repo.py`：8 位 URL-safe token、生效令牌查询、软撤销
    - `app/services/shares.py`：生成/复用、清单行锁 + 当前读保证并发生成仅一条生效令牌；撤销 403/409、不可复活；公开视图过滤笔记与所有者信息；copy 跳过已收藏/下架并返回 added/skipped/total，保存点兜底并发唯一冲突
    - `app/routers/shares.py`：POST `/generate`、POST `/revoke/{token}`、GET `/{token}`、POST `/{token}/copy`
  - **前端（T3-04 收藏交互）**
    - `src/types/index.ts`、`src/api/favorites.ts`、`src/api/lists.ts`、`src/api/shares.ts`：契约类型与请求封装
    - `src/components/FavoriteButton.vue`：图标/主按钮两态、乐观更新与失败回滚、pending 防重复、未登录跳转并在登录后自动重放收藏
    - `src/components/TeaCard.vue`、`src/views/TeaDetailView.vue`：接入收藏按钮与计数联动
    - 顺带修复：`LoginView.vue` / `RegisterView.vue` 密码输入内联事件经 Prettier 换行后触发 Vue 模板解析错误，提取为 `onPasswordInput` 方法
    - `AppHeader.vue` / `HomeView.vue` / `TeaListView.vue` 仅经 Prettier 全量格式化，无逻辑变更
  - **前端（T3-05 我的清单）**
    - `src/views/MyListView.vue`：标题内联编辑、条目列表、下架灰显、移除、空/错误/加载态、查询参数直达笔记/分享
    - `src/components/NoteEditor.vue`、`src/components/SharePanel.vue`：私密笔记编辑（20,000 字计数）、生成/复制/二次确认撤销
  - **前端（T3-06 分享公开页）**
    - `src/views/ShareView.vue`：只读展示、无笔记/所有者信息、下架灰显、撤销态与推荐、404 态；登录用户一键收藏并展示 added/skipped/total
  - **测试**
    - `backend/tests/test_favorites.py`（8 条，含 20 线程同用户收藏、12 用户并发收藏、10 线程取消）
    - `backend/tests/test_lists.py`（8 条，含 20 线程 get-or-create）
    - `backend/tests/test_shares.py`（10 条，含 20 线程生成令牌/20 线程 copy）
    - `frontend/src/utils/favorite.spec.ts`、`frontend/src/utils/list.spec.ts`（11 条纯函数用例）
- 契约 / 数据 / 安全影响：**无**（端点、字段、错误码均按 API_CONTRACT 实现；未改表结构，无 Alembic 迁移；未放宽 S 项。公开分享响应经测试断言不含 `tasting_note`/`username`/`user_id`）
- 测试证据：

  | 命令 | 范围 | 结果 | 说明 |
  |---|---|---|---|
  | `cd backend; python -m pytest -q -k "FAV or fav_" tests/test_favorites.py` | TC-FAV-01~08 | 8 passed | 含 20 线程同用户收藏、12 用户并发收藏、10 线程并发取消 |
  | `cd backend; python -m pytest -q -k "note or perm or list" tests/test_lists.py` | TC-NOTE-01~05、PERM-03 | 8 passed | 含 20 线程清单 get-or-create |
  | `cd backend; python -m pytest -q -k "share" tests/test_shares.py` | TC-SHARE-01~10、PERM-03 | 10 passed | 含 20 线程生成、20 线程 copy |
  | `cd backend; python -m pytest -q` | 全量后端 | **61 passed** | 254 warnings（Pydantic/SQL echo），无失败 |
  | `cd backend; python -m ruff check app tests` | 后端 lint | All checks passed | —— |
  | `cd frontend; npm run test:run` | Vitest | **25 passed**（3 文件） | 新增 favorite 7 条、list 4 条 |
  | `cd frontend; npm run lint` | ESLint | 通过 | —— |
  | `cd frontend; npm run typecheck` | vue-tsc | 通过 | —— |
  | `cd frontend; npm run build` | 生产构建 | 通过 | 仅 chunk >500kB 既有警告 |
  | 浏览器手工冒烟（Playwright 子代理） | 登录→收藏→我的清单 | PASS | 心形按下、计数 2,180→2,181、`/my` 显示“共 1 款茶” |
  | 浏览器手工冒烟（Playwright 子代理） | 笔记→标题→生成→撤销→旧链接 | PASS | 笔记可见、标题“我的精选茶单”、token `IBLUuslR`、撤销后旧链接显示“这份分享已被撤销” |
  | `python scripts/check_all.py` | 链接/常量/分层/UI/记录/密钥 | **全部通过** | 205 条链接；29/60/32/7 一致；五层 0 违规；前台仅 3 项既有 EP 基线 |

- 验收结论：通过。手工冒烟未覆盖游客态公开页与游客一键收藏，这两项由 `test_share_05/09` pytest 覆盖。
- 基线例外：无新增（未在 `views/components` 直接 import Element Plus；分页、权限与响应字段均按契约）
- 遗留问题：
  - 前端人工冒烟未覆盖游客公开页与“一键收藏全部”的浏览器路径；已由 SHARE-05/09/10 后端用例覆盖，后续 T5-02 可补 Playwright 冒烟
  - `share_tokens.token` 大小写敏感依赖 MySQL 列 collation `utf8mb4_bin`；若未来切换数据库需补等价约束
- 回滚方式：revert 本次提交（移除 T3 新增 schema/repo/service/router、前端组件与页面、三份测试与两份 spec，恢复三个前端占位页与后端路由占位）
- 关联 ADR：无（均为契约内实现，无架构/技术选型变更）

## 2026-11-08｜阶段 2：茶品数据与浏览闭环（T2-01 ~ T2-05）

- 任务卡 / 分级：T2-01 ~ T2-05 / **B**（实现 API_CONTRACT 已定稿的 6 个只读端点与对应前台页面；未改契约路径/字段/响应体，未改表结构、认证机制与安全控制）
- 需求来源：PRD FR-1.1~1.6（列表/筛选/排序/搜索/分页）、FR-2.1~2.3（首页聚合/热门/随机）、FR-3.1（详情）、FR-6.3（下架不物理删除）；API_CONTRACT §4.2.1~§4.2.6、§2.2、§2.3、§2.3.1、§1.6；PAGE_SPECS §3/§4/§5；DESIGN_SYSTEM
- 主要变更：
  - **后端（T2-01）**
    - `app/repositories/tea_repo.py`（新建）：`list_teas` / `list_hot` / `get_random` / `count_by_category` / `count_by_province` / `get_by_id`；省级产地用 `substring_index(origin,' ',1)` 派生；仅查询，无业务判断
    - `app/services/teas.py`：参数解析、枚举校验（非法 → 40000）、keyword ≤50、page/page_size 夹取（上限 50）、sort 稳定次级键、`is_active=1` 过滤；详情不存在 40400 / 下架 40401；查询全部下沉到 repository（清除 §3.1 遗留）
    - `app/routers/teas.py`：6 个只读端点，静态段 `/categories` `/origins` `/hot` `/random` 先于 `/{tea_id}` 注册
    - `app/schemas/tea.py`、`app/schemas/__init__.py`：TeaListItem / TeaListResponse / TeaDetail（tips_* 扁平化、时间输出 `Z`）/ CategoryCount / OriginCount / TeaCreateRequest
    - `tests/test_teas.py`（新建）：20 条用例覆盖 6 端点、筛选组合、排序、分页夹取、搜索、40400/40401、下架隐藏
  - **前端（T2-02 ~ T2-05）**
    - `types/index.ts`：Tea / TeaListItem / TeaListData / CategoryCount / OriginCount / TeaSort / TeaListParams
    - `api/teas.ts`（新建）：6 个只读请求封装，路径与参数严格对齐契约
    - `utils/teaQuery.ts`（新建）+ `utils/teaQuery.spec.ts`（新建）：URL query（`category/origin/season/q/sort/page`）↔ 筛选状态 ↔ API 参数（keyword）双向转换、已选条件标签；14 条纯函数单测
    - `stores/tea.ts`：列表状态（list/total/page/pageSize/loading/error）+ 请求序号防竞态 + 茶类/产地计数缓存
    - `components/AppHeader.vue`、`AppFooter.vue`、`CategoryTag.vue`、`TeaCard.vue`（新建）：全站导航/页脚、茶类标签、图像失败占位茶卡；均无 Element Plus
    - `views/TeaListView.vue`：筛选面板（同维多选 / 跨维 AND，真实请求后端）、已选 pill 单项移除/清空、排序、搜索关键词 pill、URL 回填与前进后退同步、骨架屏、加载失败重试、空结果 + 热门推荐、分页（12 条/页）
    - `views/HomeView.vue`：Hero 搜索 150ms 防抖建议（最多 6 条，真实请求）、六大茶类计数入口、热门轨道（8 条）、随机发现 + 换一批
    - `views/TeaDetailView.vue`：骨架屏、主图失败占位、可点击茶类标签回跳筛选、冲泡参考、四大感官、tips 空值整块隐藏、同类推荐（同 category 排除自身，最多 4）、40400/40401 友好引导 + 3 款热门；收藏/笔记/分享仅入口（未登录跳登录，已登录提示下一阶段）
- 契约 / 数据 / 安全影响：无契约变更（6 端点均按 API_CONTRACT §4.2 实现）；无表结构/迁移变更；无安全控制项变更（只读接口对游客开放，权限不变）。文档无需同步修改。
- 测试证据：

  | 命令 | 范围 | 结果 | 说明 |
  |---|---|---|---|
  | `cd backend; python -m pytest -q` | 后端全量 | **34 passed**（1 health + 13 auth + 20 teas），12 warnings（既有依赖弃用告警） | 覆盖 6 端点与筛选/排序/分页/404 |
  | `cd backend; python -m ruff check app tests` | 后端 lint | All checks passed | —— |
  | `cd backend; python -m ruff format --check app tests` | 后端格式 | 33 files already formatted | 本次格式化 `tests/test_teas.py` |
  | `cd frontend; npm run lint` | ESLint | 通过（无输出即 0 error） | 新组件未引入 Element Plus |
  | `cd frontend; npm run typecheck` | vue-tsc | 通过 | —— |
  | `cd frontend; npm run test:run` | Vitest | **14 passed**（1 file） | `src/utils/teaQuery.spec.ts` |
  | `cd frontend; npm run build` | 生产构建 | 通过（1719 modules，5.11s） | 仅有既有 chunk >500kB 体积告警 |
  | `python scripts/check_all.py` | 链接/常量/分层/UI/记录/密钥 | 全部 OK | 五层遗留 **0 项**；前台 Element Plus 仅剩 3 项既有基线 |
  | 浏览器实测（真实 HTTP） | 列表页 | PASS | 6 张真实卡片；点「绿茶」后 `?category=green` 且仅剩西湖龙井；切「收藏最多」后 `?sort=favorite` |
  | 浏览器实测（真实 HTTP） | 首页 | PASS | 6 类计数各 1（合计 6）；热门 6 张（数据仅 6 条）；随机发现显示西湖龙井；输入「龙井」出现建议 |
  | 浏览器实测（真实 HTTP） | 详情页 `/teas/1` | PASS | 西湖龙井、85℃/3g/90s、四大感官、4 块小贴士；茶类标签跳 `?category=green` |
  | 浏览器实测（真实 HTTP） | 下架 `/teas/3` | PASS | 临时将 id=3 `is_active=0`：显示「这款茶已下架」+ 列表/首页入口 + 3 款热门；**已验证恢复 `is_active=1` 与 `updated_at`** |

- 已确认口径（本阶段）：
  - 40401 响应 `data=null`，无法得知茶类，下架详情引导改用「热门推荐 3 款」而非 PRD 的「同类 3 款」（PAGE_SPECS 对无效 id 同样用热门引导）
  - 详情页收藏/笔记/分享按钮只做入口，写操作属阶段 3
- 验收结论：通过
- 基线例外：未新增。触达 `services/teas.py` 时已把 `db.query` 下沉到 repository，`check_layers` 历史遗留由 2 项降为 0 项；Element Plus 3 项基线未触碰
- 遗留问题：
  - 收藏清单内「下架灰显占位」依赖阶段 3 收藏清单页面，本阶段尚无清单模块；后端详情已按 40401 处理，未物理删除
  - 同类推荐逻辑已实现，但种子数据每类仅 1 款，当前详情页不展示同类卡；补种子数据后自动生效
  - 种子主图为外链 URL（前端原样消费、不构造路径；加载失败已占位）；上传接口与 `/uploads` 落地属 T4-04
  - 前端 `api/request.ts`、`stores/toast.ts`、`main.ts` 仍引用 Element Plus（既有基线，未新增引用）
- 回滚方式：回退本批前端/后端改动并删除 `app/repositories/tea_repo.py`、`api/teas.ts`、`utils/teaQuery*`、4 个组件即可；数据库无结构变更，无需迁移回滚
- 关联 ADR：无

## 2026-11-08｜用户认证模块（注册/登录/当前用户/退出）

- 任务卡 / 分级：B（实现已有契约定义的 5 个认证端点，跨 Router/Service/Repository/Schema 多层 + 前后端联动；不改契约、不改表结构、不改认证机制）
- 需求来源：用户要求实现用户认证模块，含注册、登录、获取当前用户、退出登录；前后端联动；表单校验与路由守卫
- 认证机制确认：用户确认沿用项目已确认的 **HttpOnly Cookie 方案**（`tea_session` + itsdangerous 签名），不使用 JWT/Authorization 头（C 类冲突已对话确认，2026-11-08）
- 主要变更：
  - **后端**：
    - `core/security.py`：bcrypt `rounds=10` 对齐 SECURITY S-01；新增 `DUMMY_HASH` 常量用于登录等时比对（S-04）
    - `schemas/auth.py`：用户名正则 `^[A-Za-z0-9\u4e00-\u9fa5]{3,20}$`、密码 6-64、`extra='forbid'`；`UserResponse` 补 `created_at`/`role` Literal；新增 `UsernameAvailabilityResponse`
    - `repositories/__init__.py` + `repositories/user_repo.py`（新建）：`get_by_username`/`get_by_id`/`create_user`，纯查询无业务判断
    - `services/auth.py`：下沉到 repository；注册捕获 `IntegrityError`→40910；登录对不存在用户做哑哈希等时比对（S-04）
    - `core/auth_deps.py`（新建）：`get_current_user`（验签→查库→40100）、`get_admin_user`（role 校验→40300）
    - `routers/auth.py`：新增 `GET /username-availability`；`/register`、`/login` 返回契约 `User`；Cookie 补 `secure`/`path`；`/me` 用 `Depends(get_current_user)`；`/logout` 清 Cookie 带相同属性；移除对 Model 的直接 import
    - `core/response.py`：新增 `RequestValidationError` 处理器，FastAPI 422 重映射为 400/40000（API_CONTRACT §1.6）
    - `tests/test_auth.py`（新建）：13 条用例覆盖注册/重复注册/格式校验/登录成功/错误密码/不存在用户/未登录 /me/已登录 /me/登出/可用性/密码哈希
  - **前端**：
    - `types/index.ts`：`User` 补 `created_at`
    - `api/auth.ts`（新建）：`login`/`register`/`logout`/`getMe`/`checkUsernameAvailability`
    - `stores/user.ts`：接 `api/auth`；`hydrate()` 调 `/auth/me` 校验 Cookie；移除 localStorage 依赖
    - `api/request.ts`：401 非公开接口跳转 `/login?redirect=...`；公开接口不跳转避免死循环
    - `views/LoginView.vue`（新建）：自研表单，必填校验、错误提示、登录成功跳来源页
    - `views/RegisterView.vue`（新建）：用户名 3-20 中英数、密码 6-64、确认密码、防抖可用性校验
    - `router/index.ts`：加 `/login`、`/register`；守卫用 `useUserStore`；受保护页未登录跳登录
    - `main.ts`：启动时 `userStore.hydrate()` 恢复登录态后再挂载
  - **环境**：`backend/.env` 的 `MYSQL_PASSWORD` 更新为实际密码；执行 `database/init.sql` 建库 + 种子数据
- 契约 / 数据 / 安全影响：无（严格按 API_CONTRACT §4.1 实现；未改表结构；未改 SECURITY 控制项；bcrypt cost=10 与文档一致）
- 清理的基线遗留：
  - `services/auth.py` 的 `db.query` 直查 → 下沉到 `repositories/`（§3.1 遗留 -1）
  - `core/auth_deps.py` 不存在 → 已创建（G-01）
  - `routers/auth.py` 响应缺 role/created_at → 已按契约补齐（G-02）
  - `main.py` 异常处理器未注册 → 此前任务已注册；本次补 `RequestValidationError` 映射
- 测试证据：

  | 命令 | 范围 | 结果 | 说明 |
  |---|---|---|---|
  | `cd backend; python -m pytest -q` | 后端全量 | 14 passed（1 health + 13 auth） | AUTH-01~AUTH-09 全覆盖 |
  | `cd backend; python -m ruff check app tests` | 后端 lint | All checks passed | —— |
  | `cd backend; python -m ruff format --check app tests` | 后端格式 | 31 files already formatted | —— |
  | `python scripts/check_layers.py` | 五层分层 | 通过 | 仅遗留 `services/teas.py` 基线项，未新增违规 |
  | `python scripts/check_frontend.py` | 前台 UI | 通过 | 仅遗留 Element Plus 3 项基线 |
  | `cd frontend; npm run lint` | ESLint | 通过（0 errors, 0 warnings） | —— |
  | `cd frontend; npm run typecheck` | vue-tsc | 通过 | —— |
  | `cd frontend; npm run build` | 生产构建 | 通过 | 仅有 chunk >500kB 警告（预存） |
  | 端到端冒烟（真实 HTTP） | 注册/登录/me/登出 | 全部通过 | 见下方明细 |

  端到端冒烟明细：
  - 注册 → 200 + User(id/username/role/created_at) + `Set-Cookie: tea_session=...; HttpOnly; Max-Age=2592000; Path=/; SameSite=lax`
  - 重复注册 → 409 + `{"code":40910,"message":"用户名已存在","data":null}`
  - 错误密码登录 → 401 + `code=40110`
  - 正确密码登录 → 200 + User
  - `/me` 带 Cookie → 200 + User
  - `/me` 无 Cookie → 401 + `code=40100`
  - `/me` 无效 Cookie → 401 + `code=40100`
  - 登出 → 200，后续 `/me` → 401
  - 用户名可用性 → 200 + `available:false`（已存在用户）
  - 种子 admin/admin123 登录 → 200 + `role=admin`
  - 数据库验证：`users.password_hash` 以 `$2b$10$` 开头，响应体与日志不含密码

- 验收结论：通过（14 测试全绿；ruff/分层/前端检查全过；端到端 9 场景全部符合契约）
- 遗留问题：
  - 前端 `api/request.ts`、`stores/toast.ts`、`main.ts` 仍引用 Element Plus（基线遗留，本次未触碰 toast 替换）
  - `services/teas.py` 仍 `db.query` 直查（基线遗留，非本次范围）
  - TEST_PLAN 其余 47 条用例待落地（本次落地 AUTH 组 13 条 + 已有 health 1 条）
- 回滚方式：revert 本提交；数据库可 `DROP DATABASE tea_guide` 后重跑 init.sql
- 关联 ADR：无（沿用已确认的认证机制设计，未产生新架构决策）

## 2026-11-08｜前后端基础工程核对与补齐

- 任务编号 / 分级：TASK-20261108-01 / A
- 需求来源：开发计划第一个任务（搭建前后端基础工程）；AGENTS.md §5/§7（统一响应体）、§13 已知待办（`register_exception_handlers` 未注册，安全 P0）
- 现状核对（7 项）：接口前缀 `/api/v1`、`request.ts` 的 `withCredentials: true`、npm lockfile 均已合规，跳过；`repositories/` 层本次不建——健康检查不查库，按 §3.1 基线待 teas/auth 端点触达查询时再下沉
- 主要变更：
  - `backend/app/main.py`：注册 `register_exception_handlers(app)`；`/api/v1/health` 改为统一响应体 `ok({"status": "ok"})`
  - `backend/tests/test_health.py`：断言同步为 `{code: 0, message: "ok", data: {status: "ok"}}`
  - `backend/.env.example`：新增（数据库 / SECRET_KEY / 管理员账号等参数示例）
  - `backend/.env`：由示例复制生成（开发默认值，.gitignore 已覆盖，不进 Git）
- 契约 / 数据 / 安全影响：健康检查不在 API_CONTRACT 29 个业务端点内，契约文档无需变更；安全影响为正面修复（业务异常不再退化为 500）
- 测试证据：

  | 命令 | 范围 | 结果 | 说明 |
  |---|---|---|---|
  | `python -m ruff check app tests` | 后端静态检查 | All checks passed | —— |
  | `python -m pytest -q` | 健康检查用例 | 1 passed（2 条 deprecation 警告，为依赖既有行为） | —— |
  | `npm run build` | 前端 typecheck + 构建 | 成功（vue-tsc + vite build 通过；chunk >500kB 警告为既有体积提示） | —— |
  | `Invoke-WebRequest http://127.0.0.1:8000/api/v1/health` | 后端直连 | 200，`{"code":0,"message":"ok","data":{"status":"ok"}}` | —— |
  | `Invoke-WebRequest http://localhost:5173/api/v1/health` | 经 Vite 代理前后端通信 | 200，同上统一响应体 | 5173 监听在 `[::1]`，需用 localhost 访问 |
  | `Invoke-WebRequest http://localhost:5173/` | 前端首页 | 200 | —— |
  | `npm run test:run` / `npm run lint` | 前端测试 / lint | 未运行 | 本次无前端代码改动 |

- 验收结论：通过（前后端均在本机运行，健康检查经代理返回统一响应体）
- 基线例外：无新增；`request.ts` 引用 ElMessage 属 §3.1 既有遗留，本任务未触达
- 遗留问题：
  - MySQL 建库与 `init.sql` 种子数据为下一任务（T0-02a），本次健康检查不依赖数据库
  - `config.py` 使用 class-based Config（Pydantic V2 弃用警告），触达配置项时再迁移为 `ConfigDict`
  - SECRET_KEY / 管理员密码为默认值，上线前必须轮换（AGENTS §13）
- 回滚方式：还原 `main.py`、`test_health.py`，删除 `.env` / `.env.example`
- 关联 ADR：无

## 2026-11-07｜生成 MVP 开发计划

- 任务编号 / 分级：TASK-20261107-PLAN / B（纯文档产出，未触碰业务规则、契约、表结构与安全项）
- 需求来源：用户要求基于已确认文档生成 `docs/development/PLANS.md`，并在答复决策项后继续完善计划（不编码）
- 主要变更：
  - `docs/development/PLANS.md`：v1.0 新增 6 阶段 / 27 个任务的开发计划，含目标、输入、输出、模块、依赖、验收标准、测试要求与非目标
  - 计划将用户建议顺序中的"失物拾物/认领"更正为"茶品发现/收藏分享"（依据 API_CONTRACT §1.12 与 PRD 核心闭环），该修正已获用户确认（D1）
  - 明确 G3 为 MVP 闭环里程碑、G0–G3 为优先交付范围，并列出 3 组允许并行的任务对与关键路径
  - v1.1 按用户答复更新：D1 认可、D2（Alembic 基线）暂缓、D3 由用户逐阶段下达指令、D4 本机 MySQL 已装但无数据库、D5 暂不编码
  - v1.1 新增：任务总索引、27 任务实施步骤、测试环境与数据约定、通用 DoD、文档同步矩阵、前置环境核对清单；T0-02 拆分为 02a（建两库 + init.sql，可先做）/ 02b（Alembic 基线，待 D2）
- 契约 / 数据 / 安全影响：无（未改端点、字段、表结构、S 项）
- 测试证据：

  | 命令 | 范围 | 结果 | 说明 |
  |---|---|---|---|
  | `python scripts/check_all.py` | 链接/常量/分层/前端/记录/密钥 | OK：204 条链接有效，29/60/32/7 一致，无新增基线违规 | 文档改动后复跑 |
  | `pytest` / `npm run test:run` | 业务测试 | 未运行 | 本次仅完善计划文档，无代码改动 |

- 验收结论：通过（计划 v1.1 已按用户答复定稿；按 D5 不进入编码）
- 基线例外：无
- 遗留问题：仅 D2（Alembic 基线口径）待定，不阻塞 G0 的 T0-01/02a/03/04 准备；开工需用户另行指令；计划确认后可回填 AGENTS.md 文档索引
- 回滚方式：删除 `docs/development/PLANS.md` 并回退本条记录
- 关联 ADR：无（D2 确认后若选择"init.sql 即基线"，再补提议 ADR）

## 2026-11-07｜规范化落地：自动化闸门与现状基线

- 任务编号 / 分级：TASK-20261107-NORMS / C（修改 CI 关键流程与项目规范；用户于 2026-11-07 以"全部优化一下"确认）
- 需求来源：用户对 AI 项目规范有效性审计后的整改要求
- 主要变更：
  - `AGENTS.md`：新增 §0 速览（命令/路由表/五条红线）、§3.1 现状基线；补全 C 类清单与用户豁免；新增文档冲突优先级；更新 §13 待办
  - `docs/development/DEVELOPMENT_GUIDE.md` v1.2：A/B 唯一边界、npm 命令、CI/构建类 C 项、用户豁免、C 类前置 ADR、测试与 CI 现状
  - `harness/TASK_TEMPLATE.md`：新增任务编号、边界确认、用户确认记录、基线例外；修正 `tea_type`→`category` 与 npm 命令
  - `harness/build-log.md`：模板补任务编号/基线例外；明确 ADR 时点
  - `docs/development/ADR/README.md` + `ADR-0002-enforce-norms-with-automation.md`：自动化闸门决策（基线 + CI + 渐进清理）
  - `.github/workflows/ci.yml`：替换 Next.js 模板，改为后端 lint/format/test、前端 lint/format/typecheck/test、文档与记录守卫三个作业
  - `.github/pull_request_template.md`：任务卡、C 类确认、测试证据、文档同步清单
  - `scripts/check_links.py` / `check_constants.py` / `check_layers.py` / `check_frontend.py` / `check_records.py` / `check_secrets.py` / `check_all.py`：可执行规范检查
  - `frontend/`：新增 lint/format/typecheck/test 脚本与 ESLint、Prettier、Vitest 配置；移除 `toast.ts` 未使用 import；Prettier 统一 `src/` 格式
  - `backend/`：新增 `pyproject.toml`、`tests/test_health.py`；Ruff 自动修复 21 项并格式化 14 个文件
  - `docs/architecture/TECH_STACK.md`：包管理器统一为 npm
  - `specs/*`：标注为历史草稿，非权威
- 契约 / 数据 / 安全影响：无（未改端点、字段、表结构、S 项）
- 测试证据：

  | 命令 | 范围 | 结果 | 说明 |
  |---|---|---|---|
  | `python scripts/check_all.py` | 链接/常量/分层/UI/记录/密钥 | 全部 OK | 链接 189 条；常量 29/60/32/7；2 项分层与 3 项 Element Plus 为基线遗留 |
  | `cd backend; python -m ruff check app tests` | 后端 lint | All checks passed | 自动修复 21 项 |
  | `cd backend; python -m ruff format --check app tests` | 后端格式 | 27 files already formatted | 首次基线格式化 14 个文件 |
  | `cd backend; python -m pytest -q` | 健康检查 | 1 passed, 2 warnings | 仅验证应用可启动；TEST_PLAN 未落地 |
  | `cd frontend; npm run lint` | ESLint | 通过 | 基线文件已豁免 |
  | `cd frontend; npm run format:check` | Prettier | 通过 | 覆盖 `src/**` |
  | `cd frontend; npm run typecheck` | vue-tsc | 通过 | —— |
  | `cd frontend; npm run test:run` | Vitest | 0 tests, exit 0 | `--passWithNoTests`；尚无纯函数用例 |
  | `cd frontend; npm run build` | 生产构建 | 通过 | 仅有 chunk >500kB 警告 |
  | `npm ci --dry-run --prefix frontend` | lockfile 同步 | 通过 | —— |
  | `python -c "import yaml; ..."` | CI YAML 语法 | 通过 | —— |

- 验收结论：有条件通过（TEST_PLAN 未落地；CI 尚未在 GitHub Actions 实跑）
- 基线例外：Element Plus 3 个文件、Service 直连查询 2 个文件；本次只登记，未新增违规
- 遗留问题：
  - TEST_PLAN 60 条用例待落地；前端 Vitest 尚无用例
  - CI 配置已完成本地静态检查，但尚未在 GitHub Actions 实跑
  - `npm ci` 尚未在干净环境验证（本地使用 `npm install`）
  - 历史遗留清理：repositories 下沉、`auth_deps.py`、异常处理器注册、Element Plus 前台替换
- 回滚方式：revert 本提交；脚本与 CI 为新增文件，不影响运行时
- 关联 ADR：ADR-0002（本次为规范机制建设，ADR 与实施同批完成；后续 C 类按新规前置）

## 2026-11-07｜建立开发知识沉淀机制

- 任务卡 / 分级：B（纯文档与流程建设，未触碰业务规则、API 契约、表结构与安全项；用户已明确指定产出物）
- 需求来源：用户要求建立 ADR 与 build-log 机制，并更新 AGENTS.md
- 主要变更：
  - `docs/development/ADR/README.md`：新增 ADR 目录说明、触发条件、编号与状态规则、索引
  - `docs/development/ADR/TEMPLATE.md`：新增决策记录模板（背景 / 驱动因素 / 备选方案 / 最终选择 / 影响 / 验证）
  - `docs/development/ADR/ADR-0001-knowledge-capture-mechanism.md`：记录本机制自身的三方案对比与选型
  - `harness/build-log.md`：新增本日志、条目模板与问题复发台账
  - `docs/api/README.md`：新增接口文档目录索引与变更同步清单
  - `docs/architecture/README.md`：新增架构/数据文档索引与变更同步清单
  - `AGENTS.md`：§10 增补文档索引，新增 §10.1 知识沉淀机制，§12 增加交付留痕要求
  - `docs/development/DEVELOPMENT_GUIDE.md`：阶段 9「更新相关文档」增加任务留痕一行
- 契约 / 数据 / 安全影响：无（未修改 API_CONTRACT、openapi.yaml、DATA_MODEL、init.sql、Alembic、SECURITY）
- 测试证据：

  | 命令 | 范围 | 结果 | 说明 |
  |---|---|---|---|
  | PowerShell 相对链接存在性校验 | 新增/修改的 8 份 Markdown 中的相对链接 | 8 文件全部通过 | 输出 `ALL LINKS OK (8 files)` |
  | `pytest` / `vitest` | 后端 / 前端 | 未运行 | 本次无代码改动，不声称通过 |

- 验收结论：通过（纯文档变更，链接校验通过；无代码测试可跑）
- 遗留问题：无
- 回滚方式：优先 `git checkout backup-20261107-pre-knowledge-capture` 回到本次变更前（tag 指向 e37a97c）；或删除新增的 ADR/build-log/README 文件，还原 AGENTS.md 与 DEVELOPMENT_GUIDE.md 对应段落
- 关联 ADR：[ADR-0001](../docs/development/ADR/ADR-0001-knowledge-capture-mechanism.md)


