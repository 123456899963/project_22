# 阶段六补强 · P0 测试准出任务清单（R12）

> 依据 [spec-p0.md](spec-p0.md)。每项完成后勾选，并在 build-log 记录证据；未执行必须标注“未验证”。

## 1 代码缺口修复

- [x] T7-01 新增 `backend/app/core/ratelimit.py`：Redis 计数、三档阈值、异常放行、`SYS_002` 429
- [x] T7-02 改 `backend/app/main.py`：在鉴权中间件内挂限流，保持 `X-Request-Id` 回传
- [x] T7-03 新增 `GET /api/v1/pages/about`：`app/api/ops.py` 路由 + `ops_service.about()` 静态内容
- [x] T7-04 后端 `compileall` + `/pages/about`、限流冒烟

## 2 测试补齐

- [x] T7-05 新增 `backend/tests/test_security.py`：SECURITY §14 #1–#9 用例 + #10 静态检查
- [x] T7-06 新增 `backend/tests/test_permission_matrix.py`：4 角色 × 7 接口组参数化
- [x] T7-07 新增 `backend/tests/test_core_flow.py`：列表→详情→搜索→收藏→投稿→审核→上下架
- [x] T7-08 执行 `pytest -q` 全绿（失败先修，不删用例、不放宽断言）

## 3 前端 E2E

- [x] T7-09 扩展 `frontend/e2e/smoke.spec.ts`：列表 → 搜索 → 详情 → 收藏
- [x] T7-10 执行 `npm run test:e2e`（依赖 8080 后端 + 5173 前端；未起则标注未验证）

## 4 缺陷与文档

- [x] T7-11 新增 `docs/development/stage6/DEFECTS.md`（含 #10 备份未验证、Docker 未实跑）
- [x] T7-12 修 `TEST_PLAN.md` §11.2 命令与路径数口径（以实测为准）
- [x] T7-13 勾选 `stage6/tasks.md` 已完成项；`PROGRESS.md` §7 增补 R12；`harness/build-log.md` 追加记录
- [x] T7-14 汇报：实测证据、未验证清单、剩余缺陷

## 5 停止线

- [x] T7-15 R12 完成后停止，不进入阶段七

---

## 验收命令

```bash
cd backend && .venv/Scripts/python -m pytest -q
cd backend && .venv/Scripts/python -m compileall app
cd frontend && npm run type-check && npm run test:unit && npm run build
cd frontend && npm run test:e2e
```
