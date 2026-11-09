# 阶段六补强 Spec · P0 测试准出

| 项 | 内容 |
|---|---|
| 文档版本 | V1.0 |
| 编写日期 | 2026-11-08 |
| 上游依据 | [TEST_PLAN](../../testing/TEST_PLAN.md) §10.2、§11；[SECURITY](../../architecture/SECURITY.md) §14；[API_CONTRACT](../../api/API_CONTRACT.md) §6；[ARCHITECTURE](../../architecture/ARCHITECTURE.md) §7.3；[AGENTS.md](../../../AGENTS.md) |
| 关系 | 承接 [spec.md](spec.md)（R9–R11）。本轮为 **R12**，只补准出缺口，不新增 PRD 外功能 |
| 停止线 | R12 完成后停止；不进入阶段七 |

---

## 1 现状判定（基于实际代码与既有测试）

| 项 | 现状 | 结论 |
|---|---|---|
| 后端 pytest | 29 passed（core/api/catalog/submission/governance） | 有基线，但缺安全与权限专项 |
| 安全 10 项（SECURITY §14） | 未逐项用例化 | **缺口** |
| 权限矩阵（API_CONTRACT §6） | 仅零散 2 条（游客 401、用户 403） | **缺口** |
| 核心链路 E2E | Playwright 仅 2 条冒烟（首页、后台登录） | **缺口** |
| 限流 429（§14 #6 / ARCHITECTURE §7.3） | 仅 `ErrorCode.SYS_002`，无中间件 | **P0 缺陷** |
| `GET /pages/about`（API_CONTRACT 第 241 行） | 后端无该路由 | **P0 缺陷** |
| 备份可恢复（§14 #10） | 需 mysqldump/Docker，当前环境无 | 标记未验证 + 缺陷登记 |
| TEST_PLAN §11.2 命令 | 写 `npm run typecheck` / `npm run lint`，与实际 scripts 不符 | 文档缺陷 |

---

## 2 范围与设计决策

### D-01 安全 10 项用例化（新增 `backend/tests/test_security.py`）

| # | 用例 | 判定 |
|---|---|---|
| 1 | 错误密钥签名 / 过期 / 篡改 payload 的 JWT | 401 `MM-AUTH-001` |
| 1 | refresh 重放 | 第二次 401 `MM-AUTH-002` |
| 2 | 游客 `/me/profile` | 401 `MM-AUTH-001` |
| 2 | 用户访问他人投稿详情 | 404 |
| 2 | 用户访问 `/admin/teas` | 403 `MM-AUTH-003` |
| 3 | 非白名单用户命中 admin 接口 | 403；移除白名单后旧令牌失效（`revoke_all_access`）→ 401 |
| 4 | `.jpg` 实为 exe 魔数 / `text/plain` MIME / 6MB / 文件名 `../` | 400 `MM-MEDIA-001`、413 `MM-MEDIA-002`；响应 URL 不含 `..` |
| 5 | 搜索 `' OR 1=1 --`、非法 `sort`、`<script>` 文本 | 不报 5xx、结果不被污染；响应 `Content-Type` 为 JSON（不做 HTML 渲染） |
| 6 | 投稿第 4 条 / 重复举报 / 通用写接口超频 | 403 `MM-SUB-001` / 409 `MM-GOV-001` / 429 `MM-SYS-002` |
| 7 | `/me/profile`、`/me/submissions/{id}`、`/teas/{id}` 响应 | 无 `openid` 键、无 Bearer 令牌串、无磁盘绝对路径（`C:\\`、`/d/`、`/Users/`） |
| 8 | 审核后审计记录 + `DELETE /admin/audit-logs` | 记录存在；删除返回 405 |
| 9 | 注销冷静期 | 写接口 403 `MM-AUTH-004`；GET 可读；撤销后恢复 |
| 10 | 备份 | 静态检查 `deploy/backup.sh` 与恢复说明存在；实跑标记 **未验证** |

实现约束：
- 复用 `tests/factories.py`（`create_user` / `auth_headers` / `create_tea` / `add_image`）；
- 白名单场景直接在 `admin_whitelist` 表插入并调用 `whitelist_service.remove`，不伪造 role；
- 上传用例沿用 `test_submission.py` 的 `PNG_1X1` 最小字节，超大文件用 `b"\xff\xd8\xff" + b"0" * 6MB` 只在内存构造，不落盘。

### D-02 权限矩阵逐格（新增 `backend/tests/test_permission_matrix.py`）

- 4 角色（游客 / USER / ADMIN / SUPER）× 7 组接口，`pytest.mark.parametrize` 覆盖；
- 组映射：公开读（`/home`、`/teas`、`/search`、`/gallery`）、`/me/*` 读、投稿写、`/reports` 写、`/admin/teas` 读、`/admin/audit-logs` 读、`/admin/admins` 读；
- 期望：公开读 200；`/me` 游客 401、其余 200（用前端角色头直接签发）；`/admin/*` 游客与用户 403；`/admin/audit-logs` ADMIN 200；`/admin/admins` 仅 SUPER 200。
- 只断言状态码与错误码，不断言业务数据量，避免测试库累积干扰。

### D-03 限流中间件（新增 `backend/app/core/ratelimit.py`，改 `app/main.py`）

- 规则按 ARCHITECTURE §7.3 取最小集：
  - `POST /api/v1/auth/qrcode`、`GET /api/v1/auth/qrcode/*`：IP 10 次/分钟；
  - `POST /api/v1/teas/{id}/comments`：用户 20 次/日；
  - 其余写方法（POST/PATCH/PUT/DELETE）：用户或 IP 60 次/分钟。
- Redis `INCR + EXPIRE`，键 `mm:rate:{scope}:{identity}:{window}`；
- Redis 异常时放行（与 ARCHITECTURE §9 降级一致），不记录敏感身份；
- 超限抛 `BizException(ErrorCode.SYS_002)` → 429；
- 挂载点：`main.py` 的 `trace_and_auth` 内，`optional_principal` 之后、`call_next` 之前。

### D-04 补 `GET /api/v1/pages/about`（改 `app/api/ops.py` + `app/services/ops_service.py`）

- 返回中性静态内容：`title`、`sections`（关于 / 用户协议 / 隐私政策 / 免责声明）、`version`；
- 不含功效、禁忌、医疗表述（AGENTS §9.5）；
- 无需登录，不写审计。

### D-05 核心链路 E2E

- **API 层全链路**（新增 `backend/tests/test_core_flow.py`）：上架茶品 → 列表命中 → 详情 → 搜索 → 收藏 → 投稿（T3 上传 + 授权）→ 管理员审核通过 → 用户实拍出现 → 下架后游客 404 → 恢复上架。一次用例串起 M02/M05/M06/M07/M08。
- **Playwright**（改 `frontend/e2e/smoke.spec.ts`）：追加“列表 → 搜索 → 详情 → 收藏”用户侧链路；后台审核保持在 API 层，避免依赖新建待审数据。
- 前置：前端 `npm run dev`、后端 `uvicorn` 均在运行；未运行时 E2E 用例 skip 并在文档标注（不伪造通过）。

### D-06 缺陷与文档

- 新增 `docs/development/stage6/DEFECTS.md`：级别、状态、复现、修复/接受理由、关闭证据；
- 修 `TEST_PLAN.md` §11.2 命令为 `npm run type-check` / `npm run test:unit` / `npm run test:e2e`，删除不存在的 `lint`；
- 以脚本实测数量更新 `TEST_PLAN.md` 顶部“73 条 API 路径”口径（以 openapi 实际 path 数为准）；
- 勾选 `stage6/tasks.md` 已完成项；
- `PROGRESS.md` §7 增补“P0 准出补强”小节，`harness/build-log.md` 追加本轮记录。

---

## 3 验收与取证（必须实际执行）

```bash
cd backend && .venv/Scripts/python -m pytest -q
cd backend && .venv/Scripts/python -m compileall app
cd frontend && npm run type-check && npm run test:unit && npm run build
cd frontend && npm run test:e2e   # 需先起后端 8080 + 前端 5173，未起则如实标注
```

准出判据：
1. 安全 10 项：1–9 有用例且通过；10 静态检查通过、实跑标注未验证；
2. 权限矩阵 4×7 全格断言通过；
3. 核心链路 API E2E 通过；Playwright 用户链路通过（或按环境限制标注）；
4. `DEFECTS.md` 无“P0 未关闭”；
5. PROGRESS/build-log 与实测一致，未验证项显式标注。

---

## 4 批准门

本轮涉及新增中间件与 1 个公开接口（均已在 API_CONTRACT / ARCHITECTURE 有依据），以及新增测试与文档。需确认后执行；执行顺序见 [tasks-p0.md](tasks-p0.md)。
