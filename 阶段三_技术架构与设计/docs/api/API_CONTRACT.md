# 茗脉 · API 契约（API_CONTRACT）

| 项 | 内容 |
|---|---|
| 文档版本 | V1.0 |
| 编写日期 | 2026-11-07 |
| 适用阶段 | 阶段三 技术架构与工程 · 第 4 轮 |
| 上游依据 | [PRD](../product/PRD.md) V1.3、[PAGE_SPECS](../design/PAGE_SPECS.md) V1.4、[MODULE_DESIGN](../architecture/MODULE_DESIGN.md)、[ER](../architecture/ER.md) |
| 机器可读契约 | [`openapi.yaml`](openapi.yaml) |
| 下游交付 | 第 5 轮测试计划、阶段五前后端联调 |

---

## 1 通用约定

### 1.1 基线与传输

| 项 | 约定 |
|---|---|
| Base URL | `/api/v1` |
| 编码 | UTF-8；请求/响应 `application/json`（上传为 `multipart/form-data`） |
| 时间 | ISO 8601 带时区，如 `2026-11-07T10:30:00+08:00`；日期 `YYYY-MM-DD` |
| 认证 | `Authorization: Bearer {accessToken}`；刷新用 `POST /auth/refresh` |
| 链路标识 | 请求可带 `X-Request-Id`，响应头回传；错误响应体也包含 `traceId` |
| 幂等 | 写接口可带 `Idempotency-Key`；V1 仅对收藏、举报、点赞、审核动作生效 |
| 版本 | 路径版本；不兼容变更升 `/api/v2`，V1 内只做加法 |

### 1.2 统一响应

成功：

```json
{
  "code": "OK",
  "message": "success",
  "data": {},
  "traceId": "9f3c2a1b"
}
```

失败：

```json
{
  "code": "MM-AUTH-001",
  "message": "请先登录",
  "details": [{"field": "q", "reason": "关键词过长"}],
  "traceId": "9f3c2a1b"
}
```

| HTTP | 语义 | 典型错误码 |
|---|---|---|
| 200 | 查询/更新成功 | OK |
| 201 | 创建成功 | OK |
| 400 | 参数错误/上传内容不合法 | MM-SYS-001、MM-MEDIA-001、MM-MEDIA-003 |
| 401 | 未登录/令牌失效/授权失败 | MM-AUTH-001、MM-AUTH-002、MM-AUTH-006 |
| 403 | 无权限/账号受限/额度用尽 | MM-AUTH-003、MM-AUTH-004、MM-SUB-001、MM-GOV-003、MM-SYS-004 |
| 404 | 不存在或已下架 | MM-CATALOG-001 |
| 409 | 状态或数据冲突 | MM-CATALOG-002、MM-CATALOG-003、MM-MEDIA-004、MM-SUB-002、MM-SUB-004、MM-SUB-005、MM-GOV-001、MM-GOV-002、MM-GOV-004 |
| 413 | 文件过大 | MM-MEDIA-002 |
| 429 | 限流 | MM-SYS-002 |
| 500 | 未预期 | MM-SYS-003 |
| 503 | 依赖不可用 | MM-SYS-003 |

**错误码字典**

| 错误码 | HTTP | 含义 | 典型场景 |
|---|---|---|---|
| `MM-AUTH-001` | 401 | 未登录或令牌缺失/无效 | 访问 `/me/**`、`/admin/**` |
| `MM-AUTH-002` | 401 | 访问令牌已过期 | 需用 refresh 换取新令牌 |
| `MM-AUTH-003` | 403 | 角色或资源归属不足 | 用户访问他人资源、非管理员访问后台 |
| `MM-AUTH-004` | 403 | 账号状态受限 | 注销冷静期、禁言、封禁期间写操作 |
| `MM-AUTH-005` | 400 | 登录 state/ticket 过期或已使用 | 扫码回调重放、二维码超时 |
| `MM-AUTH-006` | 401 | 微信授权失败 | `code2Session` 返回错误 |
| `MM-CATALOG-001` | 404 | 茶品不存在或未上架 | 游客访问已下架条目 |
| `MM-CATALOG-002` | 409 | 状态迁移不允许或并发冲突 | 重复审核、非法状态跳转 |
| `MM-CATALOG-003` | 409 | 上架条件不满足 | 图片少于 4 张、必填字段缺失 |
| `MM-MEDIA-001` | 400 | 文件类型或内容不合法 | 扩展名/MIME/魔数不符 |
| `MM-MEDIA-002` | 413 | 文件超过大小限制 | 单图 >5MB |
| `MM-MEDIA-003` | 400 | 授权凭证或来源缺失 | 官方图鉴缺权利人与授权范围 |
| `MM-MEDIA-004` | 409 | 图片顺序冲突 | 同茶品同图序重复 |
| `MM-SUB-001` | 403 | 当日投稿数量超限 | 第 4 条投稿 |
| `MM-SUB-002` | 409 | 投稿查重命中 | 同茶同类同类型重复提交 |
| `MM-SUB-004` | 409 | 投稿状态不允许 | 锁定后重提、非法审核动作 |
| `MM-SUB-005` | 409 | 同茶同字段已有待审核纠错 | 并发 T4 提交 |
| `MM-GOV-001` | 409 | 重复举报 | 同一对象 24 小时内再次举报 |
| `MM-GOV-002` | 409 | 申诉次数超限 | 第 2 次申诉 |
| `MM-GOV-003` | 403 | 不可处置自己 | 管理员禁言/封禁自身 |
| `MM-GOV-004` | 409 | 系统约束冲突 | 移除最后一名超级管理员 |
| `MM-SYS-001` | 400 | 参数校验失败 | 枚举越界、分页越界、排序字段非法 |
| `MM-SYS-002` | 429 | 触发限流 | 登录、搜索、评论、上传超频 |
| `MM-SYS-003` | 500/503 | 未预期错误或依赖不可用 | 数据库/Redis 不可用、未捕获异常 |
| `MM-SYS-004` | 403 | 配置项只读 | 修改不可编辑的系统配置 |

### 1.3 分页与排序

| 参数 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `page` | int | 1 | 从 1 开始 |
| `size` | int | 12 | 最大 50 |
| `sort` | string | 场景默认 | `updated_desc` / `name_pinyin` / `grade_desc` |

分页响应：

```json
{"items": [], "page": 1, "size": 12, "total": 0, "hasMore": false}
```

### 1.4 错误码清单

| 域 | 码 | HTTP | 含义 |
|---|---|---|---|
| AUTH | 001 | 401 | 未登录 |
| AUTH | 002 | 401 | 令牌过期，需刷新或重登 |
| AUTH | 003 | 403 | 无权限（角色或归属不符） |
| AUTH | 004 | 403 | 账号禁言/封禁/注销申请中 |
| AUTH | 005 | 400 | 登录 state 失效，请刷新二维码 |
| AUTH | 006 | 502 | 微信授权失败 |
| CATALOG | 001 | 404 | 茶品不存在或已下架 |
| CATALOG | 002 | 409 | 当前状态不允许该操作 |
| CATALOG | 003 | 400 | 图片未达上架门槛 |
| MEDIA | 001 | 400 | 图片格式不支持 |
| MEDIA | 002 | 413 | 图片超过 5MB |
| MEDIA | 003 | 400 | 授权凭证缺失 |
| MEDIA | 004 | 409 | 图序冲突 |
| SUB | 001 | 403 | 今日投稿额度已满 |
| SUB | 002 | 409 | 疑似重复投稿 |
| SUB | 003 | 409 | 重提次数已达上限 |
| SUB | 004 | 409 | 投稿状态不允许该操作 |
| SUB | 005 | 409 | 同茶同字段已有待审核纠错 |
| GOV | 001 | 409 | 重复举报 |
| GOV | 002 | 409 | 已申诉，仅可申诉 1 次 |
| GOV | 003 | 403 | 不可处置自己 |
| GOV | 004 | 409 | 必须保留至少 1 名超管 |
| SYS | 001 | 400 | 参数校验失败 |
| SYS | 002 | 429 | 触发限流 |
| SYS | 003 | 500/503 | 服务异常 |
| SYS | 004 | 409 | 只读配置不可修改 |

---

## 2 认证与账号（M01）

| 方法 | 路径 | 角色 | 说明 |
|---|---|---|---|
| POST | `/auth/qrcode` | 公开 | 生成登录二维码与一次性 state |
| GET | `/auth/qrcode/{ticket}` | 公开 | 轮询扫码状态（pending/scanned/confirmed/expired） |
| POST | `/auth/wechat/callback` | 公开 | 微信回调换 openid，签发令牌 |
| POST | `/auth/refresh` | 公开 | refresh token 换新 access |
| POST | `/auth/logout` | 登录 | 注销当前设备令牌 |
| GET | `/me/profile` | 登录 | 昵称、头像、角色、账号状态 |
| PATCH | `/me/profile` | 登录 | 修改昵称/头像 |
| GET | `/me/overview` | 登录 | 个人中心计数聚合（收藏/投稿/未读） |
| POST | `/me/deletion` | 登录 | 申请注销（7 天冷静期） |
| DELETE | `/me/deletion` | 登录 | 撤销注销申请 |

关键字段：

- `POST /auth/qrcode` → `{ticket, qrContent, expiresIn}`
- `POST /auth/wechat/callback` body `{code, state}` → `{accessToken, refreshToken, expiresIn, user:{id,nickname,avatarUrl,role,status}}`
- `PATCH /me/profile` body `{nickname?, avatarUrl?}`；昵称 2～20 字，禁止敏感词。

约束：state 5 分钟一次性；access 2 小时、refresh 7 天；`role ∈ visitor/user/admin/super`；账号状态 `active/deleting/deleted`。

---

## 3 公共内容（M02/M03/M04/M05）

### 3.1 首页与分类

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/home` | 首屏聚合：六类入口、精选 8 款、识茶入口文案、更新日期 |
| GET | `/categories` | 6 茶类及亚类（含茶品数、内容建设状态） |
| GET | `/categories/{code}` | 单茶类详情与亚类列表 |

### 3.2 茶品列表与详情

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/teas` | 列表 + 8 维筛选 + 排序 + 分页 |
| GET | `/teas/{id}` | 详情（线上版本；下架对游客 404） |
| GET | `/teas/compare` | 按 `ids` 取 2～3 款对照数据（登录） |

`GET /teas` 参数：

| 参数 | 类型 | 说明 |
|---|---|---|
| `category` | string | 茶类 code |
| `subcategory` | string | 亚类 code；不传 = 全部 |
| `region` | string[] | 产区名，多值为"或" |
| `ferment` | string[] | 发酵度标签 |
| `aroma` | string[] | 香气标签 |
| `season` | string[] | 明前/雨前/春茶等 |
| `grade` | string[] | 特级/一级/二级/未分档 |
| `year` | int[] | 生产年份倒序多选 |
| `sort` | string | `updated_desc`（默认）/`name_pinyin`/`grade_desc` |
| `page`、`size` | int | 分页 |

同维度多选取"或"，跨维度取"与"，不传该维度为"不限"；未录入年份的茶品不进入 `year` 筛选结果。

茶品详情关键字段：

```
id, name, aliases[], category{code,name}, subcategory{code,name}, extraSubcategories[],
grades[]（空数组=未分档）, productionYear, yearBand（新茶/中期茶/老茶，系统计算）,
origin{primary[], secondary[]}, quality{tags[], description}, brewing{...},
harvestPeriods[], standards[], images[{id,type,seq,url,thumbUrl,sourceLicense}],
sourceRefs[], lastUpdateAt, commentCount, publishedVersion
```

### 3.3 搜索与自查

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/search?q=&page=&size=` | 结构化精确匹配；别名命中返回 `matchedAlias` |
| GET | `/identify/options` | 五维受控标签选项（仅启用标签） |
| POST | `/identify/results` | 提交五维条件，返回候选茶品 |

`POST /identify/results` body：

```json
{"shape":["条索"],"color":["翠绿"],"soup":["浅黄绿"],"ferment":["不发酵"],"aroma":["豆香"],"page":1,"size":12}
```

未选维度视为"不限"；同维多选取"或"；无匹配返回空列表 + `suggestions`（3 款相近茶品），不返回任何"识别结论"。

### 3.4 图鉴

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/gallery?tab=official\|user&category=&page=` | 官方图鉴/用户实拍图墙 |

图片项字段：`id, teaId, teaName, imageType, url, thumbUrl, sourceLabel, authorNickname?（用户实拍）, licenseStatus?`。返回图片 URL 一律为 `/uploads/...` 站内路径，不返回磁盘绝对路径。

### 3.5 关于与协议

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/pages/about` | 关于、用户协议、隐私政策、免责声明、版本号 |

---

## 4 会员接口（M06/M07/M08/M09）

### 4.1 收藏

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/me/favorites?group=want\|drank&page=&size=` | 分组列表，按收藏时间倒序 |
| POST | `/me/favorites` | 收藏，默认 want；超 500 返回 403 |
| PATCH | `/me/favorites/{teaId}` | 移动分组 `{group}` |
| DELETE | `/me/favorites/{teaId}` | 取消收藏 |

### 4.2 浏览历史

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/me/history?page=&size=` | 最近 50 条，倒序 |
| POST | `/me/history` | 记录浏览 `{teaId}`；重复则更新时间 |
| DELETE | `/me/history` | 清空 |

### 4.3 对比

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/me/compare` | 当前对比篮 |
| POST | `/me/compare` | 加入 `{teaId}`；超 3 返回 409 |
| DELETE | `/me/compare?teaId=` | 移除 |
| DELETE | `/me/compare` | 清空 |

### 4.4 评论

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/teas/{teaId}/comments?page=&size=` | 已发布评论；登录时附作者自己的待审核评论 |
| POST | `/teas/{teaId}/comments` | 发布 `{content, imageId?}`；进入待审核 |
| DELETE | `/me/comments/{id}` | 作者删除自己的评论 |
| POST | `/comments/{id}/like` | 点赞 |
| DELETE | `/comments/{id}/like` | 取消点赞 |

评论字段：`id, content, imageUrl?, author{nickname, avatarUrl}, likeCount, liked, status（仅作者可见）, createdAt`。长度 1～200 字；命中导流词直接 400。

### 4.5 投稿

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/me/submissions?type=&status=&page=` | 我的投稿 |
| POST | `/me/submissions` | 新建草稿（T1/T3/T4） |
| GET | `/me/submissions/{id}` | 详情（仅本人） |
| PATCH | `/me/submissions/{id}` | 修改草稿 |
| DELETE | `/me/submissions/{id}` | 删除草稿 |
| POST | `/me/submissions/{id}/submit` | 提交审核（校验必填、额度、查重） |
| POST | `/me/submissions/{id}/resubmit` | 驳回后重提（≤2 次） |
| GET | `/me/submissions/{id}/preview` | 草稿/审核中预览 |

类型差异：

| 类型 | 必填 |
|---|---|
| T1 | `teaId`、`title`、`body`（≥300 字） |
| T3 | `teaId`、`images[1..5]`、`licenseGranted=true` |
| T4 | `teaId`、`correctionFieldKey`、`newValue`、`reason`（20～200 字） |

### 4.6 举报与申诉

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/reports` | 提交举报 `{objectType, objectId, teaId?, reportType, description, evidence?}` |
| POST | `/reports/{id}/appeal` | 被处理方申诉 `{reason}`，每案 1 次 |

同一举报人对同一对象重复提交返回 409。

### 4.7 站内消息

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/me/messages?type=&unreadOnly=&page=` | 消息列表 + 未读数 |
| PATCH | `/me/messages/{id}/read` | 单条已读 |
| PATCH | `/me/messages/read-all` | 全部已读 |

---

## 5 管理端（M01/M02/M03/M04/M08/M10）

所有接口要求角色 `admin` 或 `super`；标注"仅超管"的除外。

### 5.1 工作台与白名单

| 方法 | 路径 | 角色 | 说明 |
|---|---|---|---|
| GET | `/admin/dashboard` | admin | 待审核数、待响应举报、超时数、近 7 日上架数 |
| GET | `/admin/admins` | super | 白名单列表 |
| POST | `/admin/admins` | super | 新增 `{openid, role, note}` |
| DELETE | `/admin/admins/{id}` | super | 移除（至少保留 1 名超管） |

### 5.2 茶品管理

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/admin/teas?status=&category=&keyword=&page=` | 全状态列表；含图数、待审修订标记 |
| POST | `/admin/teas` | 新建草稿 |
| GET | `/admin/teas/{id}` | 编辑详情（含草稿修订） |
| PATCH | `/admin/teas/{id}` | 保存草稿（带 `version` 乐观锁） |
| POST | `/admin/teas/{id}/submit` | 提交审核（校验图片 ≥4） |
| POST | `/admin/teas/{id}/review` | 审核 `{decision: approve\|reject, reason, version}` |
| POST | `/admin/teas/{id}/unpublish` | 下架 `{reason}` |
| POST | `/admin/teas/{id}/publish` | 恢复上架 `{reason}` |

### 5.3 分类、标签与图片

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/admin/categories` | 分类与亚类（含内容建设状态） |
| PATCH | `/admin/categories/{subcategoryId}` | 切换 normal/constructing |
| GET | `/admin/tags?dimension=&status=` | 标签库 |
| POST | `/admin/tags` | 新增标签（受控入库） |
| PATCH | `/admin/tags/{id}` | 启用/停用 |
| GET | `/admin/tag-requests?status=` | 新增申请 |
| POST | `/admin/tag-requests/{id}/review` | `{decision, reason}` |
| GET | `/admin/teas/{id}/media` | 图片与授权信息 |
| POST | `/admin/media` | 上传（multipart：teaId、imageType、seq、sourceType、credential） |
| DELETE | `/admin/media/{id}` | 删除（逻辑删除 + 文件清理任务） |

### 5.4 审核与治理

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/admin/submissions?type=&status=&overdue=&page=` | 投稿队列 |
| GET | `/admin/submissions/{id}` | 详情（字段差异、历史、证据） |
| POST | `/admin/submissions/{id}/review` | `{decision: approve\|reject, reason}` |
| GET | `/admin/comments?status=&overdue=&page=` | 评论审核 |
| POST | `/admin/comments/{id}/review` | `{decision, reason}` |
| GET | `/admin/reports?status=&objectType=&page=` | 举报列表 |
| GET | `/admin/reports/{id}` | 详情（证据、处理记录、申诉） |
| POST | `/admin/reports/{id}/handle` | `{decision: valid\|invalid, resultNote, action}` |
| POST | `/admin/appeals/{id}/review` | 仅超管 `{decision: uphold\|overturn, note}` |
| GET | `/admin/users?keyword=&sanctionStatus=&page=` | 用户列表 |
| POST | `/admin/users/{id}/sanctions` | `{type: mute\|ban, reason, endAt?}` |
| POST | `/admin/users/{id}/sanctions/{sid}/revoke` | 解除处罚 |
| GET | `/admin/audit-logs?operator=&action=&from=&to=&page=` | 审计只读；超管可 `export=true` |

审核动作统一要求：`reason` 在驳回/处置时必填；`version` 用于茶品乐观锁；重复审核返回 409。

### 5.5 批量导入与配置

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/admin/imports/template` | 下载 xlsx 模板 |
| POST | `/admin/imports` | 上传（multipart），返回任务与校验结果 |
| GET | `/admin/imports/{id}` | 任务状态 |
| GET | `/admin/imports/{id}/errors` | 错误行清单 |
| POST | `/admin/imports/{id}/confirm` | 校验通过后确认导入 |
| GET | `/admin/settings` | 配置列表（含只读标记） |
| PATCH | `/admin/settings` | 仅超管，批量更新可编辑项 |

---

## 6 权限矩阵

| 接口组 | 游客 | 用户 | 管理员 | 超管 |
|---|---|---|---|---|
| `/home`、`/categories`、`/teas`、`/search`、`/identify`、`/gallery`、`/pages/about` | ✅ | ✅ | ✅ | ✅ |
| `/teas/{id}/comments`（读） | ✅ | ✅ | ✅ | ✅ |
| `/auth/*` | ✅ | ✅ | ✅ | ✅ |
| `/me/*`、`/reports`（提交） | ❌ | ✅ | ✅ | ✅ |
| `/admin/teas`、`/admin/media`、`/admin/categories`、`/admin/tags`、`/admin/submissions`、`/admin/comments`、`/admin/reports`、`/admin/users`、`/admin/imports`、`/admin/dashboard` | ❌ | ❌ | ✅ | ✅ |
| `/admin/audit-logs` | ❌ | ❌ | 只读 | ✅ |
| `/admin/admins`、`/admin/settings`、`/admin/appeals/*` | ❌ | ❌ | ❌ | ✅ |

数据级：`/me/*` 仅本人；投稿详情/预览仅作者；举报证据仅管理员；审计导出仅超管。

---

## 7 状态码与动作映射

| 资源 | 动作 | 前置状态 | 结果状态 |
|---|---|---|---|
| 茶品 | submit | draft | pending |
| 茶品 | review approve | pending | published |
| 茶品 | review reject | pending | draft |
| 茶品 | unpublish | published | offline |
| 茶品 | publish | offline | published |
| 投稿 | submit / resubmit | draft / rejected | pending |
| 投稿 | review approve | pending | approved（T4 → revised） |
| 投稿 | review reject | pending | rejected；第 2 次 → locked |
| 评论 | review approve | pending | published |
| 评论 | review reject | pending | rejected |
| 举报 | handle valid | pending/processing | resolved_valid |
| 举报 | handle invalid | pending/processing | resolved_invalid |
| 申诉 | review uphold | pending | upheld |
| 申诉 | review overturn | pending | overturned |

状态不允许时返回 `MM-CATALOG-002` / `MM-SUB-004` / 409。

---

## 8 与文档一致性

| 项 | 结论 |
|---|---|
| 页面覆盖 | 38 页所需读写接口均有落点，未新增页面专属接口 |
| 模块前缀 | 与 MODULE_DESIGN §7 一致；审核动作走资源子路径 |
| V1 边界 | 无价格、支付、关注、私信、AI 识图、第三方登录 |
| 数据字段 | 与 ER/DATA_MODEL 对齐；不暴露 openid、磁盘路径、内部快照 |
| 待确认 | 评论点赞计数方式、批量导入部分成功；不阻塞契约 |

---

## 9 本轮验收

1. 所有接口均有方法、路径、角色、状态约束，错误码可枚举。
2. 8 维筛选、搜索、自查、图鉴、投稿、举报、审核、导入九类核心链路请求/响应完整。
3. 统一响应、分页、幂等、时间格式在全文一致。
4. 权限矩阵与 MODULE_DESIGN §5 一致。
5. openapi.yaml 可作为 Mock 与前后端联调依据，路径与本文一一对应。
