# 茗脉 · 数据库实体关系设计（ER）

| 项 | 内容 |
|---|---|
| 文档版本 | V1.0 |
| 编写日期 | 2026-11-07 |
| 适用阶段 | 阶段三 技术架构与工程 · 第 3 轮 |
| 上游依据 | [PRD](../product/PRD.md) V1.3、[PAGE_SPECS](../design/PAGE_SPECS.md) V1.4、[ARCHITECTURE](ARCHITECTURE.md)、[MODULE_DESIGN](MODULE_DESIGN.md) |
| DDL 权威源 | [`database/init.sql`](../../database/init.sql) |
| 字段口径 | [DATA_MODEL.md](DATA_MODEL.md) |
| 下游交付 | 第 4 轮 API 契约、第 5 轮测试用例 |

---

## 1 设计原则

| 原则 | 落地方式 |
|---|---|
| 身份与资料分离 | `user_identity` 存 openid/状态；`user_profile` 存昵称头像；内容表只引用 `user_id` |
| 线上版本 + 修订草稿 | `tea` 为线上版本；`tea_revision` 以 JSON 快照保存草稿/历史，审核通过后回写 |
| 结构化优先 | 等级、采摘期、产区、标准号、五维标签均为子表，不塞 JSON 数组（修订快照除外） |
| 受控词表 | 五维标签只能来自 `tag`；新增走 `tag_request` 审核，停用不删除 |
| 枚举用字符串 | 状态列 `VARCHAR` + `CHECK`，避免 ENUM 变更需重建表；枚举值见 DATA_MODEL §2 |
| 软删除 | 茶品、评论、投稿、图片使用 `deleted_at`；审计、消息、版本历史不做物理删除 |
| 留痕只增 | 审核、上下架、处罚、白名单、配置变更统一写 `audit_log`，同事务提交 |
| 单库事务 | 跨模块副作用走提交后事件 + `task_retry` 补偿，不使用分布式事务 |

---

## 2 实体分组与主键

### 2.1 账号与会话（M01，4 表）

| 表 | 主键 | 外键 | 说明 |
|---|---|---|---|
| `user_identity` | `id` | — | openid 唯一；账号状态 active/deleting/deleted |
| `user_profile` | `user_id` | → user_identity | 昵称、头像 |
| `account_deletion_request` | `id` | → user_identity | 7 天冷静期，可撤销 |
| `admin_whitelist` | `id` | —（user_id 可空） | openid 唯一；role = admin/super |

### 2.2 茶品与分类（M02 + M04，13 表）

| 表 | 主键 | 外键 | 说明 |
|---|---|---|---|
| `tea_category` | `id` | — | 6 行，code 唯一 |
| `tea_subcategory` | `id` | → category | 23 行；(category_id, code) 唯一 |
| `tag` | `id` | — | (dimension, name) 唯一；启用/停用 |
| `tag_request` | `id` | → user_identity | 新增申请，驳回必填理由 |
| `tea` | `id` | → category, subcategory | tea_code 唯一；状态 + 乐观锁 version |
| `tea_alias` | `id` | → tea | (tea_id, alias) 唯一 |
| `tea_grade` | `id` | → tea | (tea_id, grade) 唯一；无行 = 未分档 |
| `tea_harvest_period` | `id` | → tea | 可多条；season_label 供采摘季节筛选 |
| `tea_region` | `id` | → tea | 结构化产区，供产区筛选与对比 |
| `tea_standard` | `id` | → tea | (tea_id, standard_no) 唯一 |
| `tea_subcategory_extra` | `id` | → tea, subcategory | 跨亚类附加标签，不重复计数 |
| `tea_tag` | `id` | → tea, tag | (tea_id, tag_id) 唯一 |
| `tea_revision` | `id` | → tea | (tea_id, revision_no) 唯一；待审核唯一 |

### 2.3 图鉴与媒体（M03，2 表）

| 表 | 主键 | 外键 | 说明 |
|---|---|---|---|
| `media_image` | `id` | → tea | (tea_id, seq) 唯一；授权字段内嵌；单图 ≤5MB |
| `gallery_user_shot` | `id` | → tea, media_image | 关联 T3 投稿；授权勾选与采纳状态 |

### 2.4 用户互动（M06，5 表）

| 表 | 主键 | 外键 | 说明 |
|---|---|---|---|
| `user_favorite` | `id` | → user, tea | (user_id, tea_id) 唯一；want/drank |
| `browse_history` | `id` | → user, tea | (user_id, tea_id) 唯一；按 viewed_at 淘汰至 50 |
| `compare_item` | `id` | → user, tea | (user_id, tea_id) 唯一；应用层限 3 |
| `comment` | `id` | → tea, user | 状态四态；`like_count` 冗余计数（待确认） |
| `comment_like` | `(comment_id, user_id)` | → comment, user | 复合唯一，防重复点赞 |

### 2.5 投稿与修订（M07，3 表）

| 表 | 主键 | 外键 | 说明 |
|---|---|---|---|
| `submission` | `id` | → user, tea | T1/T3/T4；状态六态；重提次数 ≤2 |
| `submission_image` | `id` | → submission, image | (submission_id, seq) 唯一 |
| `submission_field_diff` | `id` | → submission | (submission_id, field_key) 唯一 |

### 2.6 审核与治理（M08，5 表）

| 表 | 主键 | 外键 | 说明 |
|---|---|---|---|
| `report` | `id` | → reporter, tea | (举报人, 对象类型, 对象 ID) 唯一；SLA 截止时间 |
| `report_evidence` | `id` | → report | 证据图片 |
| `sanction` | `id` | → user | mute/ban；active/expired/revoked |
| `appeal` | `id` | → report / sanction / user | 每案仅 1 次（应用层） |
| `audit_log` | `id` | —（操作者不设 FK） | 只增不改；保留 180 天 |

### 2.7 站内消息（M09，1 表）

| 表 | 主键 | 外键 | 说明 |
|---|---|---|---|
| `message` | `id` | → user | 4 类；未读计数；180 天清理 |

### 2.8 运营工具（M10，4 表）

| 表 | 主键 | 外键 | 说明 |
|---|---|---|---|
| `import_task` | `id` | → operator | 7 态；单批 ≤500 行 |
| `import_row_error` | `id` | → task | 逐行错误 |
| `system_config` | `config_key` | — | 配置键值 + 是否可编辑 |
| `system_config_log` | `id` | → user | 配置变更记录 |

### 2.9 平台补偿（M11，1 表）

| 表 | 主键 | 说明 |
|---|---|---|
| `task_retry` | `id` | 领域事件失败重试，最多 5 次 |

合计 **38 张表**。

---

## 3 实体关系图

### 3.1 账号与内容主链

```
user_identity 1 ──── 1 user_profile
      │
      ├─ 1:N account_deletion_request
      ├─ 1:N user_favorite ──── N:1 tea
      ├─ 1:N browse_history ─── N:1 tea
      ├─ 1:N compare_item   ─── N:1 tea
      ├─ 1:N comment        ─── N:1 tea
      ├─ 1:N submission     ─── N:1 tea
      └─ 1:N message

tea_category 1 ──── N tea_subcategory 1 ──── N tea
                                        │
                                        ├─ N tea_alias
                                        ├─ N tea_grade
                                        ├─ N tea_harvest_period
                                        ├─ N tea_region
                                        ├─ N tea_standard
                                        ├─ N tea_subcategory_extra
                                        ├─ N tea_tag ─── N:1 tag
                                        ├─ N media_image
                                        ├─ N tea_revision
                                        └─ N gallery_user_shot
```

### 3.2 审核治理链

```
submission 1 ──── N submission_image
     │  └──── N submission_field_diff
     ├─ 0..1 tea_revision（T4 通过后生成）
     └─ 0..1 gallery_user_shot（T3 通过后入册）

report 1 ──── N report_evidence
   │
   └─ 0..1 appeal ─── 0..1 sanction
```

---

## 4 关键关系与约束

| 关系 | 基数 | 约束 | 说明 |
|---|---|---|---|
| 茶类 → 亚类 | 1:N | 亚类必须属于某茶类 | 23 亚类固定，空亚类保留入口 |
| 茶品 → 亚类 | N:1 | 1 个主亚类；其余走 `tea_subcategory_extra` | 跨亚类不重复计数（R-07） |
| 茶品 → 等级 | 1:N | 0～3 档；无行即"未分档" | 同页分档，不单独成页 |
| 茶品 → 图片 | 1:N | 上架需 4～5 张；`seq` 唯一 | 2～3 张仅草稿 |
| 茶品 → 修订 | 1:N | 同一茶品最多 1 条待审核修订 | 生成列 `pending_guard` 唯一索引 |
| 用户 → 收藏 | 1:N | 同一茶品仅一次；≤500 | 分组否则应用校验 |
| 用户 → 历史 | 1:N | 同一茶品仅一条；≤50 | `viewed_at` 更新即置顶 |
| 用户 → 对比 | 1:N | 同一茶品仅一次；≤3 | 服务端持久化，双端一致 |
| 用户 → 评论 | 1:N | 可多；同茶品不限 | 作者可删不可改 |
| 投稿 → 茶品 | N:1 | T1/T3/T4 均需关联茶品 | 校验茶品已上架 |
| 投稿 → 纠错 | 1:1 | 同一茶品同一字段仅 1 条待审核 | 生成列 `pending_guard` 唯一索引 |
| 举报 → 对象 | N:1 | 对象类型 ∈ image/comment/user_shot | 同一举报人对同一对象仅一次 |
| 举报 → 申诉 | 1:0..1 | 被处理方 1 次 | 复核仅超管 |

唯一约束汇总：

| 表 | 唯一键 | 防重语义 |
|---|---|---|
| `user_identity` | `openid` | 一个微信身份一个账号 |
| `admin_whitelist` | `openid` | 一个 openid 一个角色 |
| `tea` | `tea_code` | 茶品编码唯一 |
| `tea_alias` | `(tea_id, alias)` | 同茶品别名不重复 |
| `tea_grade` | `(tea_id, grade)` | 同茶品等级不重复 |
| `tea_standard` | `(tea_id, standard_no)` | 标准号不重复 |
| `tea_tag` | `(tea_id, tag_id)` | 标签不重复 |
| `media_image` | `(tea_id, seq)` | 图序唯一 |
| `user_favorite` | `(user_id, tea_id)` | 收藏不重复 |
| `browse_history` | `(user_id, tea_id)` | 历史去重 |
| `compare_item` | `(user_id, tea_id)` | 对比不重复 |
| `comment_like` | `(comment_id, user_id)` | 点赞不重复 |
| `report` | `(reporter_id, object_type, object_id)` | 同一对象不重复举报 |
| `tea_revision` | `(tea_id, revision_no)`、`pending_guard` | 版本号唯一 + 待审唯一 |
| `submission` | `pending_guard` | 同茶同字段待审纠错唯一 |

---

## 5 数据生命周期

| 对象 | 创建 | 更新 | 删除/归档 |
|---|---|---|---|
| 账号 | 首次微信授权 | 资料修改、状态流转 | 注销冷静期 7 天 → 解绑 openid、内容匿名化，记录保留 |
| 茶品 | 新建草稿 | 每次审核通过更新 `last_update_at` | 逻辑删除仅限从未上架草稿；已上架走下架 |
| 修订 | 编辑已上架/纠错通过 | 审核状态流转 | 历史永久保留，仅后台可见 |
| 图片 | 上传即草稿 | 采纳/上架切换状态 | 原图保留；孤儿清理仅限无引用且超 7 天 |
| 评论 | 发布即待审核 | 审核、点赞计数 | 作者删除置 `deleted_at`；治理删除同 |
| 投稿 | 草稿保存 | 提交、驳回重提、通过 | 不物理删除；锁定后仅可新建 |
| 举报 | 提交即待响应 | 受理、处理、申诉 | 记录永久保留（合规追溯） |
| 审计 | 操作即写 | 不更新 | 180 天后每月归档清理 |
| 消息 | 审核/系统触发 | 已读 | 180 天后清理 |
| 补偿任务 | 事件失败即写 | 重试状态 | 成功 30 天后清理 |

---

## 6 模块归属对照

| 模块 | 表 |
|---|---|
| M01 | user_identity、user_profile、account_deletion_request、admin_whitelist |
| M02 | tea_category、tea_subcategory、tea、tea_alias、tea_grade、tea_harvest_period、tea_region、tea_standard、tea_subcategory_extra、tea_revision |
| M03 | media_image、gallery_user_shot |
| M04 | tag、tag_request |
| M06 | user_favorite、browse_history、compare_item、comment、comment_like |
| M07 | submission、submission_image、submission_field_diff |
| M08 | report、report_evidence、sanction、appeal、audit_log |
| M09 | message |
| M10 | import_task、import_row_error、system_config、system_config_log |
| M11 | task_retry |

`tea_tag` 为 M02 与 M04 的关联表，写入归属 M02，词表归属 M04。

---

## 7 本轮验收

1. 38 张表覆盖 MODULE_DESIGN 中 11 个模块的全部核心实体，无孤立表。
2. 所有一对多、多对多关系均有外键或唯一约束；跨模块引用不设冗余外键（如 audit_log 操作者）。
3. 关键业务约束（同茶同字段待审唯一、待审修订唯一、重复举报）在数据库层可拦截。
4. 图片 4～5 张、单图 ≤5MB、收藏 500、历史 50、对比 3 等上限在文档注明应用层校验。
5. 软删除与归档策略不影响审计、版本历史与举报追溯。
6. DDL 可在 MySQL 8.0 直接执行，字符集、时区、引擎统一。
