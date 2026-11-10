# 茶·图鉴

> 六大茶类结构化知识库平台 —— MVP 版本
> 核心闭环：**发现茶 → 查看详情 → 收藏 / 写笔记 / 分享**

---

## 1. 项目简介

「茶·图鉴」是一个面向茶爱好者的六大茶类（绿茶 / 白茶 / 黄茶 / 红茶 / 乌龙茶 / 黑茶）结构化知识库平台。系统将每款茶品整理为标准化图鉴卡片（外形、汤色、香气、滋味、冲泡参数、官方小贴士），支持多维筛选与关键词搜索，注册用户可以收藏茶品、撰写私有品鉴笔记、生成公开分享链接；管理员通过独立后台维护茶品与小贴士。

项目采用前后端分离架构，全部接口遵循统一响应体契约，开发过程遵循规范驱动开发（SDD）流程，权威文档见 `docs/` 目录。

## 2. 项目建设目标

- 构建六大茶类的结构化知识库，茶品信息字段标准化、可筛选、可检索。
- 打通「发现茶 → 查看详情 → 收藏 / 写笔记 / 分享」的 MVP 核心闭环。
- 三种角色支撑：游客（只读浏览）、注册用户（收藏、笔记、分享）、管理员（茶品与小贴士维护）。
- 建立规范驱动的工程体系：五层后端架构、统一 API 契约、安全控制项（S-01~S-32）、60 条测试用例与静态检查脚本。

**MVP 边界**（不在本期范围）：单一默认收藏清单「我的收藏」；3 维筛选（茶类 / 产地 / 季节，AND 逻辑）；链接分享；不做用户贡献内容与审核流程。第二阶段需求（PRD S1–S17）与暂不实现项（X1–X13）一律未开发。

## 3. 系统功能介绍

### 3.1 游客

- 首页：Hero 搜索（150ms 防抖建议）、六大茶类计数入口、热门茶品轨道、随机发现（换一批）。
- 茶品列表：茶类 / 产地 / 季节三维筛选（同维 OR、跨维 AND）、关键词搜索（名称与产地）、四种排序、分页（每页 12 条）、空结果与加载态。
- 茶品详情：主图、冲泡参考（水温 / 投茶量 / 浸泡时间）、四大感官描述、官方小贴士（空值区块隐藏）、同类推荐。
- 分享公开页：免登录只读查看他人分享的清单；下架茶品灰显；已撤销分享显示撤销态。

### 3.2 注册用户

- 注册 / 登录 / 退出（HttpOnly Cookie 会话，有效期 30 天）；注册时用户名可用性防抖校验。
- 收藏 / 取消收藏茶品（幂等，收藏计数原子增减；已下架茶品不可新增收藏）。
- 我的清单：首次访问自动创建默认清单「我的收藏」；支持修改清单标题（2–20 字）、移除条目、下架条目灰显。
- 品鉴笔记：对已收藏茶品撰写私有笔记（≤20,000 字，纯空白归一化为清空），仅本人可见。
- 分享：生成 8 位 URL-safe 分享链接（已有有效链接则复用）、复制链接、二次确认撤销（撤销后旧链接永久失效）；对他人分享的清单可「一键收藏全部」（跳过已收藏 / 已下架，返回 added / skipped / total 统计）。
- 登录前点击收藏 / 笔记 / 分享会暂存动作，登录回跳后自动继续。

### 3.3 管理员（`/admin` 后台，前端按需加载）

- 管理员登录（非 admin 角色登录后立即注销会话）。
- 数据概览：统计卡片、六大茶类分布、最近新增茶品。
- 茶品管理：新增 / 编辑（PUT 全量替换）/ 上架 / 下架（二次确认，软失效不物理删除）、茶类 / 状态 / 关键词筛选、分页、含下架列表。
- 官方小贴士维护（省略保持不变、置 null 清空）。
- 图片上传：仅 JPEG / PNG / WebP，≤5MB，服务端魔数校验，UUID 文件名，落盘 `uploads/YYYY/MM/`。
- 所有写操作同步写入 `operation_logs` 操作日志（同事务）。

### 3.4 接口概览

统一前缀 `/api/v1`，统一响应体 `{ code, message, data }`。共 **29 个业务端点**（auth 5 / teas 6 / favorites 3 / lists 3 / shares 4 / admin 8）+ 1 个健康检查端点 `/api/v1/health`。完整契约见 [docs/api/API_CONTRACT.md](docs/api/API_CONTRACT.md) 与 [docs/api/openapi.yaml](docs/api/openapi.yaml)。

## 4. 系统技术栈

| 层 | 技术 |
|---|---|
| 前端 | Vue 3（`<script setup>`）+ TypeScript + Vite + Vue Router 4 + Pinia + Axios |
| UI | 前台自研组件（`:root` CSS 变量 + BEM，视觉还原自 `原型/`）；Element Plus **仅用于管理员后台**且按需动态加载 |
| 后端 | Python 3.11+ / FastAPI / SQLAlchemy 2.0（同步模式）/ Alembic / PyMySQL |
| 安全 | bcrypt（cost=10）密码哈希 / itsdangerous 签名 Cookie 会话 |
| 数据库 | MySQL 5.7.19 · InnoDB · utf8mb4 / utf8mb4_unicode_ci，共 7 张表 |
| 测试 | 后端 pytest + httpx（TestClient，真实 MySQL 测试库）；前端 Vitest（纯函数） |
| 包管理 | npm（`frontend/package-lock.json` 为唯一 lockfile）；Python venv + pip |
| 部署形态 | 开发期 Vite proxy 同源；生产 Nginx 反代 + Uvicorn（见 §13） |

技术选型定稿见 [docs/architecture/TECH_STACK.md](docs/architecture/TECH_STACK.md)。

## 5. 项目目录结构

```text
项目二/
├── backend/                    # FastAPI 后端
│   ├── app/
│   │   ├── main.py             # 应用入口（中间件 / 异常处理 / 路由注册 / 静态挂载）
│   │   ├── core/               # config / database / security / response / auth_deps
│   │   ├── routers/            # 路由层：auth / teas / favorites / lists / shares / admin
│   │   ├── services/           # 业务规则与事务边界
│   │   ├── repositories/       # SQLAlchemy 查询封装
│   │   ├── models/             # ORM 实体（7 张表一一对应）
│   │   ├── schemas/            # Pydantic DTO
│   │   ├── scripts/            # 管理员工具（rotate_admin_password）
│   │   └── alembic/            # 迁移环境（baseline 迁移尚未生成，见 §12）
│   ├── tests/                  # pytest 用例（106 条）
│   ├── uploads/                # 图片本地存储（不进 Git）
│   ├── run.py                  # 开发启动脚本
│   ├── requirements.txt
│   └── .env.example            # 环境变量示例
├── frontend/                   # Vue 3 SPA
│   └── src/
│       ├── api/                # Axios 实例与请求封装（baseURL=/api/v1，withCredentials）
│       ├── assets/  components/  router/  stores/  styles/  types/  utils/
│       ├── views/              # 前台页面（首页/列表/详情/我的清单/分享/登录/注册/404）
│       └── views/admin/        # 管理员后台 5 页（动态 import 按需加载）
├── database/
│   └── init.sql                # 建库 + 建表 + 索引 + 种子数据
├── docs/                       # 权威文档（PRD / 架构 / API 契约 / 安全 / 设计 / 测试）
├── scripts/                    # 静态检查脚本（check_all.py 等 7 个）
├── harness/                    # 任务卡模板与 build-log.md 开发日志
├── .github/                    # CI 工作流与 PR 模板
├── 原型/                        # 静态原型（前台视觉还原基准，勿改）
└── AGENTS.md                   # 项目工作指南（入口文档）
```

## 6. 数据库初始化方法

前置条件：已安装并启动 MySQL 5.7.19+。

```bash
mysql -u root -p < database/init.sql
```

脚本将创建数据库 `tea_guide`（utf8mb4 / utf8mb4_unicode_ci）、7 张表（`users` / `teas` / `tea_tips` / `collection_lists` / `favorite_items` / `share_tokens` / `operation_logs`）及种子数据（管理员账号 1 个、六大茶类示例茶品各 1 款、对应小贴士）。

注意事项：

- 脚本**不包含 DROP TABLE**，重复执行会在建表阶段报错；如需重建请先手动删除数据库。
- 种子管理员为开发用途，初始口令见 `database/init.sql` 注释，**上线前必须使用轮换脚本修改**（见 §9）。
- 运行测试前需额外创建测试库：测试默认连接 `tea_guide_test`（结构与 `tea_guide` 相同，可再次执行 init.sql 后改名导入，或设置 `DATABASE_URL_TEST` 指向自定义测试库）。

## 7. 后端启动方法

前置条件：Python 3.11+（开发验证使用 3.12）、已完成 §6 数据库初始化。

```bash
cd backend
python -m venv .venv
# Windows PowerShell:
.venv\Scripts\Activate.ps1
pip install -r requirements.txt

# 首次运行：复制并按本机环境修改配置（TEA_SECRET_KEY 必填，缺失将拒绝启动）
copy .env.example .env
python -c "import secrets; print(secrets.token_urlsafe(48))"   # 生成 TEA_SECRET_KEY 填入 .env

python run.py
```

- 开发模式监听 `http://127.0.0.1:8000`，开启热重载。
- 接口文档（Swagger UI）：`http://127.0.0.1:8000/docs`
- 健康检查：`GET http://127.0.0.1:8000/api/v1/health`，正常返回 `{"code":0,"message":"ok","data":{"status":"ok"}}`。

## 8. 前端启动方法

前置条件：Node.js 20+（开发验证使用 v24，CI 使用 20）与 npm。

```bash
cd frontend
npm install
npm run dev
```

- 开发服务器：`http://localhost:5173`
- Vite 已将 `/api` 与 `/uploads` 代理到 `http://127.0.0.1:8000`，开发期前后端同源，无需处理跨域。
- 管理员后台入口：`http://localhost:5173/admin/login`
- 生产构建：`npm run build`（产物在 `frontend/dist/`）。

## 9. 配置文件说明

| 文件 | 用途 | 关键项 |
|---|---|---|
| `backend/.env` | 后端环境变量（**不进 Git**，由 `.env.example` 复制生成） | 见下表 |
| `backend/.env.example` | 环境变量示例（可提交） | 全部项含注释 |
| `backend/alembic.ini` | Alembic 迁移配置 | 连接串为占位值，实际由 `app/alembic/env.py` 从配置注入 |
| `backend/pyproject.toml` | Ruff lint / format 配置 | —— |
| `frontend/vite.config.ts` | 开发服务器与代理 | 端口 5173；`/api`、`/uploads` 代理至 8000 |
| `frontend/vitest.config.ts` | 前端单元测试配置 | —— |
| `frontend/eslint.config.js` / `.prettierrc.json` | 前端代码规范 | —— |
| `.github/workflows/ci.yml` | CI：后端 lint+test、前端 lint+test、文档守卫 | —— |

`backend/.env` 关键环境变量：

| 变量 | 说明 | 默认值 / 要求 |
|---|---|---|
| `DEBUG` | 调试模式（开启会将 SQL 写入日志） | 默认 `false`，生产必须保持 `false` |
| `TEA_PROFILE` | 环境标识（local / dev / prod） | 默认 `local` |
| `TEA_DB_HOST` / `TEA_DB_PORT` / `TEA_DB_USER` / `TEA_DB_PASSWORD` / `TEA_DB_NAME` | MySQL 连接 | 密码无默认值，必须注入 |
| `TEA_SECRET_KEY` | 会话签名密钥 | **必填，缺失拒绝启动**；用 `secrets.token_urlsafe(48)` 生成 |
| `TEA_CORS_ORIGINS` | 跨域白名单（开发期允许的前端源） | 默认 `["http://localhost:5173","http://127.0.0.1:5173"]` |
| `TEA_UPLOAD_DIR` | 图片本地存储路径 | 默认 `uploads` |
| `SESSION_EXPIRE_DAYS` | 会话有效期（天） | 30 |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | 管理员初始账号 | 密码无默认值，生产必须注入 |
| `DATABASE_URL_TEST` | （可选）测试库连接串 | 默认使用 `tea_guide_test` |

管理员密码轮换（不重启服务即可生效）：

```bash
cd backend
python -m app.scripts.rotate_admin_password --password "新密码"
```

> 请勿将真实数据库密码、TEA_SECRET_KEY 等敏感信息提交到仓库；`.env` 已被 `.gitignore` 覆盖。

## 10. 测试方法和测试结果

### 10.1 测试方法

| 范围 | 命令 |
|---|---|
| 后端全量测试 | `cd backend; python -m pytest -q` |
| 后端 lint / 格式 | `cd backend; python -m ruff check app tests; python -m ruff format --check app tests` |
| 前端单元测试 | `cd frontend; npm run test:run` |
| 前端 lint / 类型 / 格式 / 构建 | `cd frontend; npm run lint; npm run typecheck; npm run format:check; npm run build` |
| 全量静态检查（链接 / 常量 / 分层 / UI / 记录 / 密钥） | `python scripts/check_all.py` |

测试用例依据 [docs/testing/TEST_PLAN.md](docs/testing/TEST_PLAN.md)（60 条用例：高 32 / 中 25 / 低 3），覆盖 29 个业务端点、7 张表约束与 32 项安全控制；后端测试使用真实 MySQL 测试库 `tea_guide_test`（与开发库隔离），断言同时检查 HTTP 状态码、业务 `code` 与数据库最终状态。详细逐条记录见 [docs/testing/TEST_REPORT.md](docs/testing/TEST_REPORT.md)。

### 10.2 测试结果（2026-11-09 实际执行）

| 项 | 结果 |
|---|---|
| 后端 pytest 全量 | **106 passed**（0 失败、0 跳过；含 20 线程并发收藏 / 分享真实并发用例） |
| TEST_PLAN 60 条系统用例 | **60 / 60 通过，高优先级 32 / 32 通过**（2026-11-08 G5 系统测试 + 缺陷修复复测） |
| 前端 Vitest | **30 passed**（4 个 spec 文件，纯函数用例） |
| 前端 ESLint / vue-tsc / Prettier / 生产构建 | 全部通过（构建存在主 chunk >500 kB 体积告警，非失败） |
| `scripts/check_all.py` 静态检查 | 全部通过（205 条文档链接、29/60/32/7 常量一致、五层分层 0 违规、153 个文件无敏感信息泄露） |
| GitHub Actions CI | **未运行**（工作流已配置，尚未在远端实际执行，不标记为通过） |

## 11. 系统截图

> **当前缺失。** 仓库中尚未收录系统截图。

建议交付前补充以下页面截图（启动前后端后截取，放入 `docs/images/` 并更新本节）：

- 前台：首页（Hero + 六大茶类入口 + 热门轨道）、茶品列表页（筛选面板展开态）、茶品详情页、我的清单页、分享公开页。
- 后台：管理员登录页、数据概览页、茶品管理列表页、茶品编辑页。

## 12. 当前已知问题和后续改进方向

### 已知问题 / 限制

1. **系统截图缺失**：README §11 待补充真实页面截图。
2. **CI 未实跑**：`.github/workflows/ci.yml` 已配置但未在 GitHub Actions 实际执行验证。
3. **Alembic baseline 迁移未生成**：当前建表以 `database/init.sql` 为准；正式上线前需在空库生成 baseline migration 并对现有环境执行 `alembic stamp`。
4. **构建体积告警**：前端主 chunk 超过 500 kB（Element Plus 已拆分为 admin 异步 chunk），后续可进一步拆分优化。
5. **随机关联推荐成本**：热门 / 随机推荐使用 `ORDER BY RAND()`，当前数据量级（<1000）下可接受，数据量增长后需改为随机偏移方案。
6. **登出后旧 Cookie 重放**：Cookie 会话登出仅清除客户端，服务端未做会话吊销（安全设计已知限制，SECURITY S-10 已记录）。
7. **种子数据量小**：示例茶品仅 6 款（每类 1 款），详情页「同类推荐」在同类数据增加后才能展示效果。
8. **登出 / 上架等写操作依赖人工冒烟外的自动化覆盖已补齐，但生产环境 Nginx 的 `client_max_body_size 6m` 配置与 413 复测属部署项，尚未执行。**

### 后续改进方向（均未实现，属规划项）

- 生成 Alembic baseline 迁移，切换为迁移驱动的表结构管理。
- 补充 Docker Compose（`web` + `api` + `mysql`）一键部署与真实服务器部署验证。
- 在 GitHub Actions 实跑 CI 并回填结果。
- PRD 第二阶段需求（S1–S17，如更丰富的用户能力与运营能力）按后续计划评估；暂不实现项（X1–X13）维持不开发。

## 13. 部署条件检查与部署步骤

### 13.1 部署条件检查结论

| 检查项 | 状态 | 说明 |
|---|---|---|
| 前端生产构建 | ✅ | `npm run build` 通过，产出 `frontend/dist/` |
| 后端依赖清单 | ✅ | `requirements.txt` 完整，含 `uvicorn[standard]` 可用于生产 |
| 配置模板 | ✅ | `.env.example` 完整；缺失 `TEA_SECRET_KEY` 时后端拒绝启动，避免弱密钥上线 |
| 数据库初始化脚本 | ✅ | `database/init.sql` 可建库建表 + 种子数据 |
| 数据库迁移 | ⚠️ | Alembic 环境已就绪但 baseline 迁移未生成，暂以 init.sql 为准 |
| Web 服务器 / 容器配置 | ✅ | `deploy/docker-compose.yml`（3 服务 mysql/backend/nginx）、`deploy/nginx.conf`、`backend/Dockerfile`、`deploy/nginx/Dockerfile` 已就绪（2026-11-10 移植自 tea-atlas-2，变量名统一 TEA_* 体系） |
| 实机部署验证 | ❌ | **本机无 Docker 未实机验证**；配置文件已就绪，首次部署需在目标服务器执行 |
| 管理员口令 | ⚠️ | 种子管理员口令为开发用途，部署后必须立即轮换 |

**结论：具备完整部署条件（可构建、可配置、依赖明确、deploy 容器配置就绪），需在目标服务器实机验证 docker compose up。**

### 13.2 部署步骤（依据架构文档整理，**尚未实机验证**）

目标形态（[TECH_STACK.md](docs/architecture/TECH_STACK.md) §3.6）：浏览器 → Nginx（80/443）→ 静态托管 `dist/` + 反代 `/api`、`/uploads` → Uvicorn（127.0.0.1:8000）→ MySQL。

1. **服务器准备**：安装 Python 3.11+、Node.js 20+、MySQL 5.7.19+、Nginx。
2. **数据库初始化**：`mysql -u root -p < database/init.sql`。
3. **后端部署**：
   - `cd backend; python -m venv .venv; pip install -r requirements.txt`
   - 编写 `.env`：注入随机 `TEA_SECRET_KEY`、真实 `TEA_DB_PASSWORD`、初始 `ADMIN_PASSWORD`；确认 `DEBUG=false`
   - 生产启动（不开热重载）：`uvicorn app.main:app --host 127.0.0.1 --port 8000`
4. **前端部署**：`cd frontend; npm ci; npm run build`，将 `dist/` 交给 Nginx 托管。
5. **Nginx 配置**（需新建）：站点根目录指向 `frontend/dist/`；`location /api/` 与 `location /uploads/` 反代至 `http://127.0.0.1:8000`；`client_max_body_size 6m;`（对齐应用层 6MB 请求体上限）；SPA 路由需配置 `try_files $uri /index.html;`。
6. **管理员口令轮换**：`cd backend; python -m app.scripts.rotate_admin_password --password "新密码"`。
7. **上线验证**：访问 `https://<域名>/api/v1/health` 应返回 `{"code":0,...}`；验证注册 / 登录 / 收藏 / 分享主链路；复测超大请求体返回 413。

### 13.3 Docker Compose 一键部署（推荐生产方式）

已就绪的 `deploy/` 目录提供一键容器化部署能力（2026-11-10 移植自 tea-atlas-2）。

**前置条件**：目标服务器安装 Docker Engine + Docker Compose v2。

**服务编排**：3 个容器（mysql 5.7 / backend Python 3.11 + Uvicorn 8080 / nginx 1.24），挂载 3 个 volume（tea-mysql-data / tea-uploads / tea-logs）。

```bash
# 1. 复制环境变量模板，填写真实值（TEA_SECRET_KEY 必填，用 secrets.token_urlsafe(48) 生成）
cp deploy/.env.example deploy/.env
# 编辑 deploy/.env：TEA_DB_PASSWORD / TEA_DB_ROOT_PASSWORD / TEA_SECRET_KEY / TEA_CORS_ORIGINS

# 2. 放置 HTTPS 证书（可选：证书由 Nginx 只读挂载 deploy/certs/ 目录）
#    sh deploy/go-live.sh /path/to/server.crt /path/to/server.key

# 3. 构建并启动（首次执行会拉取基础镜像 + 构建前后端）
docker compose -f deploy/docker-compose.yml up -d --build

# 4. 数据库初始化（首次启动：init.sql 建表 + Alembic 迁移）
docker exec tea-mysql mysql -uroot -p"${TEA_DB_ROOT_PASSWORD}" tea_atlas < database/init.sql
docker exec tea-backend alembic stamp 0007_content_platform

# 5. 等待 3 服务 healthy，访问验证
curl -kfsS https://127.0.0.1/api/v1/teas/ | head

# 6. 管理员口令轮换（容器内执行）
docker exec tea-backend python -m app.scripts.rotate_admin_password --password "新密码"
```

**环境变量一览**（`deploy/.env`，全部为可选/必填，注释见 `deploy/.env.example`）：

| 变量 | 容器内 | 说明 |
|---|---|---|
| `TEA_PROFILE` | backend | prod / dev / local |
| `TEA_DB_HOST` / `TEA_DB_PORT` / `TEA_DB_NAME` / `TEA_DB_USER` / `TEA_DB_PASSWORD` | mysql / backend | mysql 容器内部署为 `mysql:3306` |
| `TEA_DB_ROOT_PASSWORD` | mysql | mysql root 初始密码 |
| `TEA_SECRET_KEY` | backend | **必填**，会话签名密钥 |
| `TEA_UPLOAD_DIR` | backend | `/data/tea/uploads`（与 nginx `/var/www/uploads` 同 volume） |
| `TEA_CORS_ORIGINS` | backend | 跨域白名单 |

**运维脚本**：

| 文件 | 用途 |
|---|---|
| `deploy/go-live.sh` | 证书放置 + compose 启动 + 上线自检（Linux 执行） |
| `deploy/backup.sh` | 每日备份：mysqldump 全量 + uploads tar，保留 7 份 |

**回滚**：`docker compose -f deploy/docker-compose.yml up -d --force-recreate backend nginx`

---

## 文档索引

| 文档 | 说明 |
|---|---|
| [AGENTS.md](AGENTS.md) | 项目工作指南（速览 / 红线 / 任务路由） |
| [docs/product/PRD.md](docs/product/PRD.md) | 产品需求（功能分级唯一依据） |
| [docs/architecture/](docs/architecture/) | 技术栈 / 架构 / 数据模型 / 安全控制 |
| [docs/api/API_CONTRACT.md](docs/api/API_CONTRACT.md) | API 契约（前后端联调唯一依据） |
| [docs/design/](docs/design/) | 设计系统与页面规范 |
| [docs/testing/TEST_PLAN.md](docs/testing/TEST_PLAN.md) / [TEST_REPORT.md](docs/testing/TEST_REPORT.md) | 测试用例与实测报告 |
| [harness/build-log.md](harness/build-log.md) | 开发变更与测试证据流水 |
