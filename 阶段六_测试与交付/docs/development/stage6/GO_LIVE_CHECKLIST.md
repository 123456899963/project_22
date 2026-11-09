# 茗脉 V1 上线检查单

> 适用：阶段六交付后的正式上线准备。所有命令在本仓库根目录或注明目录下执行；每项完成后打勾并填写执行人与日期。
> 原则：未实际执行的项不得标记为通过；无法验证的项写「未验证 + 原因」。

---

## 1 内容与账号（业务前置）

- [ ] 后台录入 6 大类 / 23 亚类 / 46 款茶品，其中已上架茶品 ≥40 款并有五维标签。
- [ ] 图片总量 ≥184 张（目标 200 张），每款上架茶品 ≥4 张；`image_count` 与 `gallery_ready` 正常。
- [ ] `gallery_ready` 为真的茶品在 `/gallery` 可见，用户实拍进入候选区。
- [ ] 生产库无 E2E 演示数据（`E2ELONGJING` / `E2ETIEGUANYIN` 等 `tests/seed_e2e.py` 写入的茶品）。
- [ ] 超级管理员白名单已配置真实 openid，测试白名单（如 `dev_openid_001`）已移除。
- [ ] 关于页 / 用户协议 / 隐私政策 / 免责声明文案已由业务确认（`ops_service.ABOUT_SECTIONS`）。

## 2 生产配置（`deploy/.env`）

| 变量 | 要求 |
|---|---|
| `MM_JWT_SECRET` | 必填，≥32 位随机串；`python -c "import secrets;print(secrets.token_urlsafe(48))"` |
| `MM_DB_PASSWORD` / `MM_DB_ROOT_PASSWORD` | 必填，不得沿用 `mingmai_dev` / `root_dev` |
| `MM_DB_NAME` / `MM_DB_USER` | 与建库一致，库字符集 `utf8mb4` / `utf8mb4_unicode_ci` |
| `MM_WECHAT_MOCK` | 必须 `false`（同时自动关闭 `/auth/dev-login`） |
| `MM_WECHAT_APPID` / `MM_WECHAT_APP_SECRET` | 微信开放平台网站应用凭据 |
| `MM_PROFILE` | `prod` |

- [ ] `.env` 已创建且未提交到版本库；`git status` 无敏感文件。
- [ ] 微信开放平台回调域名登记为 `https://<域名>/api/v1/auth/wechat/callback`（与 `MM_WECHAT_QRCODE_REDIRECT` 一致）。
- [ ] 确认前端包内不含 AppSecret / 数据库口令（构建产物无 `MM_` 变量）。

## 3 部署

```bash
docker compose -f deploy/docker-compose.yml build
docker compose -f deploy/docker-compose.yml up -d
docker compose -f deploy/docker-compose.yml ps
docker compose -f deploy/docker-compose.yml logs --tail=100 backend
```

也可以直接用脚本完成「证书放置 → 配置检查 → 构建启动 → 自检」：

```bash
sh deploy/go-live.sh <证书链文件> <私钥文件>   # 首次或证书更新
sh deploy/go-live.sh                          # 证书已就位，仅启动并自检
```

- [ ] 4 个服务健康：mysql / redis healthy，backend healthy，nginx running。
- [ ] 首次启动时 `database/init.sql` 与 `database/migration/V2__submission_license.sql` 已执行（数据卷为空才生效）；若数据卷已存在，按 `migration/V{n}__*.sql` 顺序手工执行并记录。
- [ ] `docker-compose.yml` 已将 mysql 3306 / redis 6379 绑定到 `127.0.0.1`（仓库已配置，上线时确认未被改动）。
- [ ] 证书已放入 `deploy/certs/server.crt`（含中间证书链）与 `server.key`，权限 600；私钥未提交版本库。
- [ ] `nginx.conf` 已为 443 启用 TLS（仓库已配置：80→443 跳转、TLS1.2/1.3、安全响应头），容器内 `nginx -t` 通过。
- [ ] 证书申请：使用云厂商证书或 certbot（certbot 需在 nginx 停止时用 standalone，或改用 DNS 校验），续期后 `docker compose restart nginx`。
- [ ] 脚本已在目标机实跑一次（`sh deploy/go-live.sh`，当前未验证：本机无 Docker/bash）。
- [ ] 上传目录 `uploads` 卷已挂载，`/uploads/xxx` 直出 200 且目录列表关闭。
- [ ] 服务器时区为 Asia/Shanghai（compose 已设 `TZ` 与 MySQL `default-time-zone=+08:00`）。

## 4 上线前验证（须留输出证据）

### 4.1 构建与测试

```bash
# 后端
cd backend && .venv/Scripts/python -m pytest -q          # 期望 105 passed
cd backend && .venv/Scripts/python -m compileall app tests
# 前端
cd frontend && npm ci && npm run type-check && npm run build
cd frontend && npx playwright test                       # 期望 3 passed（需 5173 + 8080）
```

- [ ] 后端全量用例通过：______ passed（日期：____）。
- [ ] 前端 type-check / build 通过，`dist` 产物存在。
- [ ] Playwright 冒烟通过：______ passed。

### 4.2 接口冒烟（经 Nginx 域名）

```bash
curl -i https://<域名>/health
curl -i https://<域名>/api/v1/home
curl -i https://<域名>/api/v1/pages/about
curl -i https://<域名>/api/v1/teas?size=12
```

- [ ] 四个地址均 200，响应头含 `X-Request-Id`，响应体 `code:"OK"`。
- [ ] HTTP 跳转：`curl -I http://<域名>/` 返回 301，`Location` 为 `https://...`。
- [ ] TLS：`curl -I https://<域名>/` 返回 200 且协议为 HTTP/2；证书链校验通过（`openssl s_client -connect <域名>:443` 无 `verify error`）。
- [ ] 端口暴露：`ss -lntp` 或 `netstat` 确认 3306 / 6379 仅监听 `127.0.0.1`，443 正常对外。
- [ ] 错误路径抽查：未登录访问 `/api/v1/me/profile` 返回 401 `MM-AUTH-001`；用户访问 `/api/v1/admin/teas` 返回 403。
- [ ] 静态资源与图片经 Nginx 返回 200，`/assets/*` 带长缓存头。

### 4.3 性能（生产链路）

```bash
# backend 目录，指向经 Nginx 的域名
$env:MM_PERF_BASE="https://<域名>"   # Windows；Linux 用 export
.venv/Scripts/python -m tests.perf_smoke
```

- [ ] 100 并发只读 p95 ≤300ms：实测 p95=______ms。
- [ ] 本机参考值：4 worker p95≈48–58ms、单 worker p95≈155ms（回环，非生产）。

### 4.4 安全抽查（SECURITY §14）

- [ ] #1 认证：伪造/过期 JWT 均 401；refresh 重放第二次 401。
- [ ] #2 越权：他人投稿详情 404；用户调管理端 403；`/admin/admins` 仅超级管理员可用。
- [ ] #3 白名单：移除管理员后旧令牌立即 401。
- [ ] #4 上传：改扩展名 / 改 MIME / >5MB / 路径穿越均被拒。
- [ ] #5 注入：搜索 `' OR 1=1 --` 正常返回且无异常；非法排序回退默认。
- [ ] #6 限流：`/auth/qrcode` 第 11 次/分钟返回 429 `MM-SYS-002` 且带 `Retry-After`。
- [ ] #7 隐私：响应无 openid 全量、无 Bearer、无绝对路径。
- [ ] #8 审计：审核动作写审计；`DELETE /admin/audit-logs` 返回 405。
- [ ] #9 注销：冷静期内写操作 403 `MM-AUTH-004`，撤销后恢复。
- [ ] #10 备份：见 5.1，须完成一次**恢复演练**。

## 5 运维与备份

### 5.1 备份

```bash
# 按 deploy/backup.sh 变量约定（MM_DB_HOST / MM_DB_USER / MM_DB_PASSWORD / BACKUP_DIR）
sh deploy/backup.sh
# 恢复演练（需 root 或 DBA 权限，目标为临时库）
gunzip -c <备份>.sql.gz | mysql -h <host> -u root -p <临时库>
```

- [ ] 每日备份已加入 cron（建议 02:00），保留 7 份。
- [ ] 备份文件包含 38 张表与 uploads 目录。
- [ ] **恢复演练已完成**（当前未验证：本机 `mingmai` 账号无建库权限）。

### 5.2 运行保障

- [ ] `/health` 探活监控已接入（建议 15s 间隔，连续 3 次失败告警）。
- [ ] 日志落盘与轮转已配置（审计 180 天、消息 180 天自动清理逻辑已生效）。
- [ ] Redis 开启 AOF（compose 已配置）；MySQL 数据卷纳入主机快照。
- [ ] HTTPS 证书到期提醒已设置。

## 6 回滚

- [ ] 发布前已记录当前镜像 tag / 前端 `dist` 版本。
- [ ] 应用回滚：`docker compose -f deploy/docker-compose.yml up -d --force-recreate backend nginx`（切回上一 tag）。
- [ ] 数据库只前滚：不修改已发布迁移脚本；需要回退时用 5.1 备份恢复到新库并切换连接。
- [ ] 回滚后复跑 4.2 冒烟。

## 7 已知未验证项（上线前必须闭环）

| 项 | 状态 | 来源 |
|---|---|---|
| 备份恢复演练 | 未验证（无建库权限） | DEFECTS D-03 |
| Docker Compose 实跑 | 未验证（本机无 Docker） | DEFECTS D-04 |
| 非 Chromium 浏览器兼容 | 未验证（仅装 chromium） | DEFECTS D-08 |
| 导入页浏览器端到端 | 未验证 | DEFECTS D-12 |
| 微信真实扫码登录 | 代码已修正，未与微信联调 | 本轮 R14 |
| 移动端真机 | 仅 390×844 视口截图走查 | 本轮 R14 |

## 8 签核

| 角色 | 姓名 | 日期 | 结论 |
|---|---|---|---|
| 研发 |  |  |  |
| 测试 |  |  |  |
| 运维 |  |  |  |
| 业务负责人 |  |  |  |
