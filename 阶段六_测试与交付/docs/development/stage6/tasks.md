# 阶段六 · 任务清单（tasks.md）

> 依据 `docs/development/stage6/spec.md`。按顺序执行，每完成一项立即取证；未执行项标"未验证"。

## R9 偏差处置

- [x] T6-01 迁移 `database/migration/V2__submission_license.sql` 新增 `submission.license_granted`、`license_granted_at`；同步 `backend/app/models/submission.py`。
- [x] T6-02 `backend/app/services/submission_service.py`：create 时按 `licenseGranted` 落库；T3 图片归属校验（仅本人 `uploaded_by`）。
- [x] T6-03 `backend/app/services/media_service.py` + `backend/app/api/media.py`：新增 `upload_user_shot` 与 `POST /me/uploads`。
- [x] T6-04 `backend/app/services/moderation_service.py`：T3 审核通过写 `gallery_user_shot`；举报说明上限改 200。
- [x] T6-05 `frontend/src/views/fore/SubmissionFormView.vue`：T3 上传接线（`/me/uploads`）。
- [x] T6-06 `frontend/src/modules/moderation.ts` + `frontend/src/views/admin/AdminImportView.vue`：三步导入流程。
- [x] T6-07 `backend/app/services/message_service.py` + `backend/app/main.py`：180 天清理任务（启动一次 + 24h 循环）。
- [x] T6-08 文档同步：`docs/api/API_CONTRACT.md`、`docs/api/openapi.yaml`、`docs/architecture/DATA_MODEL.md`。

## R10 测试

- [x] T6-10 准备 `mingmai_test`：root 建库授权 → `mingmai` 执行改写库名的 `init.sql` + `V2`（口令只走本机环境变量）。
- [x] T6-11 `backend/tests/{conftest.py,factories.py}`：环境隔离 + 最小夹具。
- [x] T6-12 `backend/tests/test_core.py`、`test_api_platform.py`、`test_catalog.py`、`test_submission.py`、`test_governance.py`。
- [x] T6-13 执行 `cd backend && .venv/Scripts/python -m pytest -q`，记录通过/失败/跳过数。
- [x] T6-14 前端 Vitest：`package.json` 脚本与依赖、`guard.spec.ts`、`auth.spec.ts`（原计划 catalog 用例改为路由守卫与鉴权 store）；执行 `npm run test:unit`。
- [x] T6-15 Playwright：安装 + `e2e/smoke.spec.ts`；执行 `npm run test:e2e`；失败则记录原因。

## R11 部署与交付

- [x] T6-20 执行 `python -m compileall app`、`npm run type-check`、`npm run build`，记录输出。
- [x] T6-21 幂等检查：`mingmai_test` 上重复执行 `init.sql`；`V2` 不重复执行。
- [x] T6-22 上线前 5 项检查（TEST_PLAN §11.3）：迁移、密钥、上传目录/演示图、备份脚本、回滚说明（备份实跑未验证）。
- [x] T6-23 Docker 不可用 → 静态检查 `deploy/*`，标注"未运行验证"。
- [x] T6-24 更新 `docs/development/PROGRESS.md`（阶段六章节）与 `harness/build-log.md`。
- [x] T6-25 阶段六复盘：逐条对照 TEST_PLAN/PRD/PAGE_SPECS，列一致项、修正项、未验证项；明确停止，不进入阶段七。

## 验证命令汇总

```bash
cd backend && .venv/Scripts/python -m compileall app
cd backend && .venv/Scripts/python -m pytest -q
cd frontend && npm run type-check
cd frontend && npm run build
cd frontend && npm run test:unit
cd frontend && npm run test:e2e
```

## 审批

本 spec 与 tasks 需用户确认后方进入执行；执行中如需偏离，先更新本文件再动代码。
