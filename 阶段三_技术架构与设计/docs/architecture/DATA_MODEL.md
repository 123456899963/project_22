# 茗脉 · 数据模型与字段口径（DATA_MODEL）

| 项 | 内容 |
|---|---|
| 文档版本 | V1.0 |
| 编写日期 | 2026-11-07 |
| 适用阶段 | 阶段三 技术架构与工程 · 第 3 轮 |
| 上游依据 | [PRD](../product/PRD.md) V1.3、[ER](ER.md)、[MODULE_DESIGN](MODULE_DESIGN.md) |
| DDL | [`database/init.sql`](../../database/init.sql) |
| 下游交付 | 第 4 轮 API 契约、第 5 轮测试计划 |

---

## 1 命名与类型约定

| 项 | 约定 |
|---|---|
| 表名 | 小写下划线，按域命名；关联表用 `主体_关联体` |
| 主键 | `BIGINT UNSIGNED AUTO_INCREMENT`；纯关联表可用复合主键 |
| 外键 | `xxx_id`，命名 `fk_表_目标` |
| 时间 | `DATETIME`，统一 `Asia/Shanghai`；创建 `created_at`、更新 `updated_at` |
| 软删除 | `deleted_at DATETIME NULL`；查询默认过滤 |
| 金额 | V1 无价格字段，不预留 |
| 枚举 | `VARCHAR` + `CHECK`；新增值需迁移脚本，不改旧值 |
| JSON | 仅用于快照（`tea_revision.snapshot`）、审计前后状态、补偿载荷 |
| 布尔 | `TINYINT(1)`，0/1 |
| 文本长度 | 短评 1000、长文 `MEDIUMTEXT`、理由 300 |

---

## 2 枚举字典

### 2.1 账号

| 字段 | 取值 | 说明 |
|---|---|---|
| `user_identity.status` | active / deleting / deleted | deleting 为注销冷静期；deleted 解绑 openid |
| `account_deletion_request.status` | pending / cancelled / executed | 仅 pending 可撤销 |
| `admin_whitelist.role` | admin / super | super 仅初始配置与白名单维护者 |

### 2.2 茶品与媒体

| 字段 | 取值 | 说明 |
|---|---|---|
| `tea.status` | draft / pending / published / offline | 对应草稿/待审核/已上架/已下架 |
| `tea_revision.status` | draft / pending / published / rejected | published 表示该快照已回写线上 |
| `tea_grade.grade` | 特级 / 一级 / 二级 | 无记录 = 未分档 |
| `tea_standard.standard_type` | national / industry / local / other | 国标/行标/地标/其他 |
| `tea_region.region_type` | primary / secondary | 集中分布 / 其他分布 |
| `media_image.image_type` | dry / soup / leaf / pack / detail | 干茶/汤色/叶底/包装/细节 |
| `media_image.source_type` | self / agency / stock / user | 自拍/机构/图库/用户授权 |
| `media_image.status` | draft / published / offline | 随茶品状态联动 |
| `gallery_user_shot.status` | candidate / adopted / rejected | 候选/已采纳/已拒绝 |
| `tag.dimension` | shape / color / soup / ferment / aroma | 五维 |
| `tag.status` | enabled / disabled | 停用不删除 |
| `tag_request.status` | pending / approved / rejected | 驳回必填理由 |
| `tea_subcategory.content_status` | normal / constructing | 内容建设中/正常 |

### 2.3 互动与投稿

| 字段 | 取值 | 说明 |
|---|---|---|
| `user_favorite.fav_group` | want / drank | 想喝 / 已喝，固定两组 |
| `comment.status` | pending / published / rejected / deleted | 先审后发；deleted 保留记录 |
| `submission.type` | T1 / T3 / T4 | 品鉴长文 / 补图 / 纠错 |
| `submission.status` | draft / pending / approved / rejected / locked / revised | locked 为两次驳回后；revised 为 T4 已生成修订 |

### 2.4 治理与运营

| 字段 | 取值 | 说明 |
|---|---|---|
| `report.object_type` | image / comment / user_shot | 举报对象 |
| `report.status` | pending / processing / resolved_valid / resolved_invalid | 待响应/处理中/成立/不成立 |
| `sanction.sanction_type` | mute / ban | 禁言 / 封禁 |
| `sanction.status` | active / expired / revoked | 到期任务置 expired；超管可 revoke |
| `appeal.status` | pending / upheld / overturned | 申诉中/维持/撤销 |
| `message.type` | review / correction / report / system | 审核结果/纠错结果/投诉结果/系统 |
| `import_task.status` | uploading / validating / validation_failed / ready / importing / completed / failed | 导入七态 |
| `system_config.value_type` | string / int / bool / json | 配置值类型 |
| `task_retry.status` | pending / running / success / failed | 补偿任务 |

---

## 3 表清单与数据量预估

| 域 | 表数 | V1 预估行数 | 增长驱动 |
|---|---|---|---|
| 账号 | 4 | 用户 1 万级、白名单 <20 | 注册 |
| 茶品分类 | 13 | 茶品 46、子表合计 <600 | 内容录入 |
| 图鉴媒体 | 2 | 图片 <300、实拍 <500 | 投稿采纳 |
| 用户互动 | 5 | 收藏/历史 10 万级、评论 1 万级 | 用户行为 |
| 投稿 | 3 | 千级 | 用户投稿 |
| 治理 | 5 | 举报百级、审计万级 | 运营 |
| 消息 | 1 | 万级（180 天滚动） | 审核结果 |
| 运营 | 4 | 导入任务百级、配置 <30 | 运营 |
| 补偿 | 1 | 百级 | 事件失败 |

合计 38 表，V1 单机 MySQL 容量压力可忽略。

---

## 4 关键字段口径

### 4.1 年份与区间标签

| 项 | 口径 |
|---|---|
| 存储 | 仅 `tea.production_year`（4 位） |
| 区间计算 | 当前年 − 生产年 ≤3 → 新茶；4～10 → 中期茶；>10 → 老茶 |
| 计算时机 | 查询/接口层按自然年实时计算，不落库；每年 1 月 1 日自动变化 |
| 筛选 | 仅 `production_year IS NOT NULL` 的茶品进入年份筛选；年份选项倒序 |

### 4.2 图鉴就绪

| 字段 | 维护方 | 口径 |
|---|---|---|
| `media_image.status` | M03 | 茶品下架时全部转 offline；恢复时转 published |
| `tea.image_count` | M03 同步 | 当前 `status IN ('draft','published')` 的图片数 |
| `tea.gallery_ready` | M03 同步 | 图片 ≥4 且 `license_cert_no` 齐全时为 1 |
| 上架校验 | M02 | 提交审核时要求 `image_count ≥4` 且 `gallery_ready = 1` |

### 4.3 版本与并发

| 字段 | 口径 |
|---|---|
| `tea.version` | 乐观锁；每次线上内容变更 +1，审核动作校验 |
| `tea.published_version` | 最近一次发布的 `tea_revision.revision_no`；初始 0 |
| `tea_revision.snapshot` | 茶品全量 JSON（含别名、等级、采摘期、产区、标准号、标签、图序） |
| 待审唯一 | 生成列 `pending_guard = tea_id`（仅 pending），唯一索引拦截第二条待审 |
| 纠错待审唯一 | `submission.pending_guard = tea_id:field_key`（仅 T4+pending） |

### 4.4 计数与上限

| 对象 | 上限 | 实现 |
|---|---|---|
| 收藏 | 500 | 写入前 `COUNT`，冲突返回 403 |
| 浏览历史 | 50 | 写后按 `viewed_at` 删除第 51 条起 |
| 对比 | 3 | 写入前计数，超限 409 |
| 投稿/日 | 3 | Redis 日计数 + 数据库当日 `COUNT` 兜底 |
| 评论/日 | 20 | Redis 计数 |
| 举报/日 | 10 | Redis 计数 |
| 图片 | 5 张/茶品；单图 5MB | `media_image` 唯一 (tea_id, seq) + 应用校验 |
| 重提 | 2 次 | `submission.resubmit_count`，达 2 置 locked |

### 4.5 评论点赞

`comment.like_count` 为冗余计数，用于列表性能；点赞写 `comment_like` 并在同事务 `+1`，取消点赞 `-1`，以唯一键防重复。若第 4 轮确认改为实时聚合，则删除该列并改为查询统计（见 §8）。

---

## 5 索引与查询映射

| 查询场景 | 使用表/索引 |
|---|---|
| 茶类列表（已上架，按亚类） | `tea`：`idx_tea_status_cat(status, category_id, subcategory_id, last_update_at)` |
| 8 维筛选 | 产区 `tea_region.idx_region_name`；发酵度/香气 `tea_tag` → `tag(dimension,status)`；季节 `tea_harvest_period.idx_harvest_season`；等级 `tea_grade`；年份 `tea` |
| 名称/别名/拼音搜索 | `tea.idx_tea_name`、`idx_tea_pinyin`；`tea_alias.idx_alias_name`、`idx_alias_pinyin` |
| 图鉴列表 | `media_image`：`idx_image_tea_status(tea_id, status)` |
| 茶品详情 | `tea` 主键 + 子表 `tea_id` 索引 + `tea_tag` |
| 我的收藏/历史 | `user_favorite.idx_fav_user_group`；`browse_history.idx_history_user_time` |
| 评论列表 | `comment.idx_comment_tea_status(tea_id, status, created_at)` |
| 审核队列 | `submission.idx_sub_status_time(status, submitted_at)`；`tea` 状态索引 |
| 举报待办 | `report.idx_report_status_sla(status, sla_deadline)` |
| 审计查询 | `audit_log.idx_audit_object`、`idx_audit_operator`、`idx_audit_time` |
| 未读消息 | `message.idx_msg_user_unread(user_id, is_read, created_at)` |

说明：MySQL 8 不支持部分索引，因此"仅待审核唯一"使用生成列 + 唯一索引实现；不做全文索引，检索走 `LIKE`/前缀匹配 + 拼音列（46 款规模足够）。

---

## 6 数据生命周期与清理

| 对象 | 保留 | 清理方式 |
|---|---|---|
| 审计日志 | 180 天 | 每月归档至冷表/文件后 `DELETE` |
| 站内消息 | 180 天 | 每日按 `created_at` 删除 |
| 补偿任务 | 成功 30 天 | 每日清理 |
| 孤儿图片 | 无引用 7 天 | 每周扫描存储，删文件与记录 |
| 导入错误行 | 随任务保留 90 天 | 每日清理 |
| 注销账号内容 | 永久匿名化 | 保留记录，`user_id` 不变，昵称置"已注销用户" |
| 茶品修订历史 | 永久 | 仅后台可见 |
| 举报与处罚 | 永久 | 合规追溯，不删除 |

---

## 7 初始化与迁移

| 项 | 做法 |
|---|---|
| 首次建库 | 执行 `database/init.sql`（建库、38 表、基础分类/标签/配置） |
| 版本迭代 | Flyway `V{版本}__{描述}.sql`，只前滚；禁止修改已执行脚本 |
| 本地重置 | 删除库后重跑 init.sql；不保留演示图 |
| 备份 | 每日 `mysqldump` + 上传目录增量，保留 7 份 |
| 时区 | 连接串 `serverTimezone=Asia/Shanghai` |
| 字符集 | `utf8mb4`，排序规则 `utf8mb4_0900_ai_ci` |

种子数据范围：6 茶类、23 亚类（默认 `constructing`）、43 个五维标签、17 项系统配置。茶品与图片不写死在 init.sql，由后台录入或批量导入。

---

## 8 待确认项

| # | 事项 | 影响 | 建议 |
|---|---|---|---|
| 1 | 评论点赞用冗余计数还是实时聚合 | `comment.like_count` 是否保留 | V1 用冗余计数，取消点赞需事务保证 |
| 2 | 批量导入是否允许部分成功 | `import_task.status` 与事务粒度 | 暂按整批通过才导入，失败不改库 |
| 3 | 茶品等级是否可多档并存 | `tea_grade` 已是 1:N | 按原型"同页分档"保留多档 |
| 4 | 浏览历史是否需匿名设备级记录 | 影响是否引入 device_id | V1 仅登录用户，不记录游客 |

---

## 9 本轮验收

1. 38 张表与 ER 文档一一对应，表名、主键、外键无遗漏。
2. 所有状态列均有枚举字典与 CHECK 约束，取值与 PRD §10 一致。
3. 年份区间、图鉴就绪、版本并发、计数上限四类口径均写明存储与计算位置。
4. 8 维筛选、搜索、审核队列、举报待办、未读消息均有可用索引。
5. 初始化脚本仅含基础数据，不含演示图与生产数据。
6. 生命周期覆盖 180 天审计/消息、7 天冷静期、7 天孤儿图片宽限。
