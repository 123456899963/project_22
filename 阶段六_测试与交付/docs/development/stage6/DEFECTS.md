# 阶段六 · 缺陷与准出记录（R12）

| 项 | 内容 |
|---|---|
| 记录日期 | 2026-11-08 |
| 依据 | [TEST_PLAN](../../testing/TEST_PLAN.md) §10.2 准出、[SECURITY](../../architecture/SECURITY.md) §14 |
| 状态口径 | 已关闭（有实测证据）/ 接受（环境限制+计划）/ 未关闭 |
| 判定 | P0 未关闭 = 阻断准出；P1 需有处理计划；P2 可排期 |

---

## 1 缺陷清单

| # | 级别 | 问题 | 影响 | 处置 | 状态 |
|---|---|---|---|---|---|
| D-01 | P0 | 写接口无限流，`MM-SYS-002` 无实现 | SECURITY §14 #6 不达标 | 新增 `app/core/ratelimit.py` 并在鉴权中间件挂载；Redis 异常放行 | 已关闭：`test_over_frequency_returns_429` |
| D-02 | P0 | `GET /api/v1/pages/about` 未实现（API_CONTRACT 已定义） | P18 关于页无数据源，契约不一致 | `ops_service.about()` + `api/ops.py` 路由 | 已关闭：权限矩阵与 8090 冒烟 200 |
| D-03 | P1 | `deploy/backup.sh` 未实跑，恢复流程未演练 | §14 #10 只有静态证据 | 等价命令实测：dump 368,683 字节 / 38 张表成功；恢复到独立库被 MySQL 拒绝（mingmai 用户无建库权限），脚本依赖 Linux 路径 `/data/mm` | 部分关闭（未验证恢复） |
| D-04 | P1 | Docker Compose 未实际启动 | 部署口径仅静态检查 | 本机 Docker 不可用 | 接受（未验证）：保留 `docker compose config` 待办 |
| D-05 | P2 | TEST_PLAN §11.2 命令写 `typecheck` / `lint`，仓库无该脚本 | 文档误导执行者 | 改为 `type-check` / `test:unit` / `test:e2e`，说明无 ESLint | 已关闭 |
| D-06 | P2 | TEST_PLAN 与契约路径数 73 与实际 openapi 74 不一致 | 统计口径偏差 | 更新为 74 | 已关闭 |
| D-07 | P1 | 完整数据集（46 茶品 / 184 图）未建立 | 筛选、图鉴、分页覆盖不足 | 新增 `backend/tests/test_dataset_scale.py`：46 茶品（40 已上架 / 3 草稿 / 3 下架）、200 图，验证分页、状态可见性、年份筛选 | 已关闭 |
| D-08 | P1 | 非 Chromium 浏览器兼容未验证 | TEST_PLAN §8 未执行 | 环境仅安装 Chromium（ms-playwright 无 firefox/webkit） | 未关闭（有计划） |
| D-09 | P1 | 100 并发 P95 ≤300ms 未压测 | §9 性能目标未取证 | 首轮单 worker 实测 p50=3942ms / p95=4026ms；定位为脚本每请求新建 TCP 连接，测到 Windows 回环建连开销。`perf_smoke.py` 改为复用连接池（`httpx.Limits(max_connections=CONCURRENCY)`）+ 5 次预热后复测：4 worker（8091）p50=28.1–33.9ms / p95=47.9–57.9ms（连测 4 次 3 次 PASS、1 次 ReadTimeout）；单 worker（8080）p50=97.9ms / p95=154.7ms PASS | 已关闭（本机实测达标；1 次超时异常已记录，生产需 Nginx 前置复验） |
| D-10 | P2 | dev 库无已上架茶品，E2E 无数据可走 | 核心链路无法执行 | 新增 `backend/tests/seed_e2e.py`（仅 dev、幂等，不写 init.sql） | 已关闭：Playwright 3 passed |
| D-11 | P2 | 消息 180 天清理只验证函数与常量，未跨日实跑 | 定时任务跨日行为未验证 | 新增 `backend/tests/test_message_retention.py`：181 天删除、179 天保留；定时循环本身仍按启动即跑 + 24h | 已关闭（保留期逻辑） |
| D-12 | P2 | 审计日志不可改：仅验证无删除路由（405） | DB 账号权限未验证 | 需 DBA 级验证 | 接受（未验证） |
| D-13 | P2 | PAGE_SPECS §3.3 残留 Flask 表述 | 文档不一致 | 按 AGENTS §1.1 以 TECH_STACK 为准 | 接受（历史文档不改） |
| D-14 | P2 | PRD 规则编号 R-14～R-17 重号 | 引用歧义 | 以条款文字为准 | 接受（历史文档不改） |
| D-15 | P1 | 全站 UI 走查发现：接口 ISO 时间原文直接渲染（首页/收藏/历史/投稿/评论/后台 8 张表）、移动端「六大茶类」标题被挤成两行、投稿表单「搜索」按钮竖排换行、后台分页显示英文 `Total` | 可读性与移动端观感 | 新增 `frontend/src/utils/datetime.ts` 统一 `YYYY-MM-DD HH:mm` 并替换 12 处；`HomeView` 的 `.section-head` 加 `flex-wrap`；`.tea-search` 按钮 `nowrap`；`AdminLayout` 加 `ElConfigProvider` 中文 locale | 已关闭：53 路由 × 2 轮走查 0 控制台错误 / 0 失败接口 / 0 横向溢出 |
| D-16 | P1 | 真实微信扫码换码调用了小程序接口 `sns/jscode2session`，与 `qrconnect` 扫码流程不匹配，上线后真实登录必失败 | 真实微信登录不可用 | `auth_service._resolve_openid` 改为 `sns/oauth2/access_token`，回传 openid + unionid；新增 `tests/test_wechat_login.py` 4 例（mock / 正常换码 / 缺凭据 / 微信错误码） | 已关闭（代码与单测）；**真实微信联调未验证**（无 AppID/Secret） |

---

## 2 准出判定（对应 TEST_PLAN §10.2）

| 条件 | 结果 | 证据 |
|---|---|---|
| P0 用例全部关闭 | 通过 | 后端 `pytest` 105 passed；安全 10 项 §14 #1–#9 全绿 |
| 权限矩阵逐格 | 通过 | 4 角色 × 9 组参数化用例全绿 |
| 核心链路 E2E | 通过 | `test_core_flow.py`（API 全链路）+ Playwright 3 passed |
| 安全 10 项 | 9 项通过 / #10 静态通过、实跑未验证 | 见 D-03 |
| 发布准入（备份 + 回滚） | 脚本与回滚说明存在，演练未做 | 见 D-03 / D-04 |

**结论**：P0 已无未关闭项；P1 未关闭项均有处理计划；本轮不进入阶段七。
