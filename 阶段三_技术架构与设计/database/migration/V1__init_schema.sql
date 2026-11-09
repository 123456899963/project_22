-- 茗脉 V1 初始结构（由 database/init.sql 抽取，供 Flyway 执行）
-- 不含 CREATE DATABASE / USE，库由连接串指定；勿手改本脚本，变更走 V2+ 迁移。


-- ============================================================
-- 一、账号与会话（M01）
-- ============================================================

CREATE TABLE IF NOT EXISTS user_identity (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  openid          VARCHAR(64)     NOT NULL COMMENT '微信 openid，唯一身份标识',
  unionid         VARCHAR(64)     NULL COMMENT '微信 unionid，可空',
  status          VARCHAR(16)     NOT NULL DEFAULT 'active' COMMENT 'active/deleting/deleted',
  registered_at   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_login_at   DATETIME        NULL,
  deleted_at      DATETIME        NULL,
  created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_user_openid (openid),
  KEY idx_user_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='账号身份（与资料分离存储）';

CREATE TABLE IF NOT EXISTS user_profile (
  user_id         BIGINT UNSIGNED NOT NULL,
  nickname        VARCHAR(60)     NOT NULL DEFAULT '茶友',
  avatar_url      VARCHAR(500)    NULL,
  updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id),
  CONSTRAINT fk_profile_user FOREIGN KEY (user_id) REFERENCES user_identity (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户资料';

CREATE TABLE IF NOT EXISTS account_deletion_request (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id         BIGINT UNSIGNED NOT NULL,
  requested_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  effective_at    DATETIME        NOT NULL COMMENT '申请后 7 天',
  status          VARCHAR(16)     NOT NULL DEFAULT 'pending' COMMENT 'pending/cancelled/executed',
  cancelled_at    DATETIME        NULL,
  executed_at     DATETIME        NULL,
  PRIMARY KEY (id),
  KEY idx_deletion_user_status (user_id, status),
  KEY idx_deletion_effective (status, effective_at),
  CONSTRAINT fk_deletion_user FOREIGN KEY (user_id) REFERENCES user_identity (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='注销申请与冷静期';

CREATE TABLE IF NOT EXISTS admin_whitelist (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  openid          VARCHAR(64)     NOT NULL,
  user_id         BIGINT UNSIGNED NULL,
  role            VARCHAR(16)     NOT NULL DEFAULT 'admin' COMMENT 'admin/super',
  note            VARCHAR(200)    NULL,
  created_by      BIGINT UNSIGNED NULL,
  created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at      DATETIME        NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_whitelist_openid (openid),
  KEY idx_whitelist_role (role, deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='管理员 openid 白名单';

-- ============================================================
-- 二、茶品与分类（M02）
-- ============================================================

CREATE TABLE IF NOT EXISTS tea_category (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code            VARCHAR(32)     NOT NULL COMMENT 'green/white/yellow/oolong/red/dark',
  name            VARCHAR(32)     NOT NULL,
  intro           VARCHAR(200)    NULL,
  sort_order      TINYINT         NOT NULL DEFAULT 0,
  color_token     VARCHAR(32)     NULL COMMENT '设计系统茶色 token',
  created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_category_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='六大茶类';

CREATE TABLE IF NOT EXISTS tea_subcategory (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  category_id     BIGINT UNSIGNED NOT NULL,
  code            VARCHAR(40)     NOT NULL,
  name            VARCHAR(40)     NOT NULL,
  content_status  VARCHAR(16)     NOT NULL DEFAULT 'constructing' COMMENT 'normal/constructing',
  sort_order      TINYINT         NOT NULL DEFAULT 0,
  created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_sub_code (category_id, code),
  KEY idx_sub_category (category_id, sort_order),
  CONSTRAINT fk_sub_category FOREIGN KEY (category_id) REFERENCES tea_category (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='23 个亚类';

CREATE TABLE IF NOT EXISTS tag (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  dimension       VARCHAR(16)     NOT NULL COMMENT 'shape/color/soup/ferment/aroma',
  name            VARCHAR(32)     NOT NULL,
  status          VARCHAR(16)     NOT NULL DEFAULT 'enabled' COMMENT 'enabled/disabled',
  created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_tag_dim_name (dimension, name),
  KEY idx_tag_dim_status (dimension, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='五维受控标签词表';

CREATE TABLE IF NOT EXISTS tag_request (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  dimension       VARCHAR(16)     NOT NULL,
  name            VARCHAR(32)     NOT NULL,
  status          VARCHAR(16)     NOT NULL DEFAULT 'pending' COMMENT 'pending/approved/rejected',
  reason          VARCHAR(200)    NULL COMMENT '审核意见，驳回必填',
  requested_by    BIGINT UNSIGNED NULL,
  reviewed_by     BIGINT UNSIGNED NULL,
  reviewed_at     DATETIME        NULL,
  created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_tag_req_status (status, created_at),
  CONSTRAINT fk_tag_req_user FOREIGN KEY (requested_by) REFERENCES user_identity (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='标签新增申请';

CREATE TABLE IF NOT EXISTS tea (
  id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tea_code            VARCHAR(40)     NOT NULL,
  name                VARCHAR(80)     NOT NULL,
  name_pinyin         VARCHAR(120)    NULL,
  name_initials       VARCHAR(40)     NULL,
  category_id         BIGINT UNSIGNED NOT NULL,
  subcategory_id      BIGINT UNSIGNED NOT NULL,
  origin_summary      VARCHAR(300)    NULL COMMENT '产地集中分布描述',
  quality_desc        TEXT            NULL COMMENT '品质特征自由补充描述',
  water_temp_min      SMALLINT        NULL,
  water_temp_max      SMALLINT        NULL,
  ratio_grams         DECIMAL(6,2)    NULL DEFAULT 1.00 COMMENT '茶水比：克',
  ratio_water_ml      SMALLINT        NULL COMMENT '茶水比：毫升',
  vessel              VARCHAR(32)     NULL,
  steep_seconds_min   SMALLINT        NULL,
  steep_seconds_max   SMALLINT        NULL,
  steep_times         TINYINT         NULL,
  production_year     SMALLINT        NULL COMMENT '4 位年份，可空',
  status              VARCHAR(16)     NOT NULL DEFAULT 'draft' COMMENT 'draft/pending/published/offline',
  image_count         TINYINT         NOT NULL DEFAULT 0,
  gallery_ready       TINYINT(1)      NOT NULL DEFAULT 0 COMMENT '图片 >=4 且凭证齐全',
  published_version   INT             NOT NULL DEFAULT 0,
  version             INT             NOT NULL DEFAULT 0 COMMENT '乐观锁',
  submitted_at        DATETIME        NULL,
  published_at        DATETIME        NULL,
  last_update_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by          BIGINT UNSIGNED NULL,
  created_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at          DATETIME        NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_tea_code (tea_code),
  KEY idx_tea_status_cat (status, category_id, subcategory_id, last_update_at),
  KEY idx_tea_year (production_year, status),
  KEY idx_tea_name (name),
  KEY idx_tea_pinyin (name_pinyin),
  CONSTRAINT fk_tea_category FOREIGN KEY (category_id) REFERENCES tea_category (id),
  CONSTRAINT fk_tea_subcategory FOREIGN KEY (subcategory_id) REFERENCES tea_subcategory (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='茶品主表（线上版本）';

CREATE TABLE IF NOT EXISTS tea_alias (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tea_id          BIGINT UNSIGNED NOT NULL,
  alias           VARCHAR(60)     NOT NULL,
  pinyin          VARCHAR(120)    NULL,
  initials        VARCHAR(40)     NULL,
  created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_alias_tea (tea_id, alias),
  KEY idx_alias_name (alias),
  KEY idx_alias_pinyin (pinyin),
  CONSTRAINT fk_alias_tea FOREIGN KEY (tea_id) REFERENCES tea (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='茶品别名';

CREATE TABLE IF NOT EXISTS tea_grade (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tea_id          BIGINT UNSIGNED NOT NULL,
  grade           VARCHAR(8)      NOT NULL COMMENT '特级/一级/二级',
  sort_order      TINYINT         NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uk_grade_tea (tea_id, grade),
  CONSTRAINT fk_grade_tea FOREIGN KEY (tea_id) REFERENCES tea (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='等级分档（可多档，无记录视为未分档）';

CREATE TABLE IF NOT EXISTS tea_harvest_period (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tea_id          BIGINT UNSIGNED NOT NULL,
  start_month     TINYINT         NOT NULL,
  end_month       TINYINT         NOT NULL,
  season_label    VARCHAR(16)     NOT NULL COMMENT '明前/雨前/春茶/秋茶等',
  note            VARCHAR(60)     NULL,
  sort_order      TINYINT         NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_harvest_tea (tea_id, sort_order),
  KEY idx_harvest_season (season_label),
  CONSTRAINT fk_harvest_tea FOREIGN KEY (tea_id) REFERENCES tea (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='采摘期（可多条）';

CREATE TABLE IF NOT EXISTS tea_region (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tea_id          BIGINT UNSIGNED NOT NULL,
  region_name     VARCHAR(60)     NOT NULL,
  region_type     VARCHAR(16)     NOT NULL DEFAULT 'primary' COMMENT 'primary/secondary',
  flavor_note     VARCHAR(200)    NULL,
  sort_order      TINYINT         NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_region_tea (tea_id, sort_order),
  KEY idx_region_name (region_name),
  CONSTRAINT fk_region_tea FOREIGN KEY (tea_id) REFERENCES tea (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='结构化产区，供筛选与对比';

CREATE TABLE IF NOT EXISTS tea_standard (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tea_id          BIGINT UNSIGNED NOT NULL,
  standard_no     VARCHAR(60)     NOT NULL,
  standard_type   VARCHAR(16)     NOT NULL DEFAULT 'national' COMMENT 'national/industry/local/other',
  note            VARCHAR(100)    NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_std_tea (tea_id, standard_no),
  CONSTRAINT fk_std_tea FOREIGN KEY (tea_id) REFERENCES tea (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='标准号（可多个）';

CREATE TABLE IF NOT EXISTS tea_subcategory_extra (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tea_id          BIGINT UNSIGNED NOT NULL,
  subcategory_id  BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_extra_tea_sub (tea_id, subcategory_id),
  CONSTRAINT fk_extra_tea FOREIGN KEY (tea_id) REFERENCES tea (id),
  CONSTRAINT fk_extra_sub FOREIGN KEY (subcategory_id) REFERENCES tea_subcategory (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='跨亚类附加标签，不重复计入';

CREATE TABLE IF NOT EXISTS tea_tag (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tea_id          BIGINT UNSIGNED NOT NULL,
  tag_id          BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_tea_tag (tea_id, tag_id),
  KEY idx_tea_tag_tag (tag_id),
  CONSTRAINT fk_tea_tag_tea FOREIGN KEY (tea_id) REFERENCES tea (id),
  CONSTRAINT fk_tea_tag_tag FOREIGN KEY (tag_id) REFERENCES tag (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='茶品五维特征标签关联';

CREATE TABLE IF NOT EXISTS tea_revision (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tea_id          BIGINT UNSIGNED NOT NULL,
  revision_no     INT             NOT NULL,
  source          VARCHAR(16)     NOT NULL DEFAULT 'admin_edit' COMMENT 'admin_edit/correction',
  submission_id   BIGINT UNSIGNED NULL,
  status          VARCHAR(16)     NOT NULL DEFAULT 'draft' COMMENT 'draft/pending/published/rejected',
  snapshot        JSON            NOT NULL COMMENT '茶品全量快照（含子表）',
  pending_guard   BIGINT UNSIGNED GENERATED ALWAYS AS (CASE WHEN status = 'pending' THEN tea_id ELSE NULL END) STORED COMMENT '保证同一茶品仅一条待审核修订',
  change_note     VARCHAR(300)    NULL,
  review_note     VARCHAR(300)    NULL,
  created_by      BIGINT UNSIGNED NULL,
  reviewed_by     BIGINT UNSIGNED NULL,
  reviewed_at     DATETIME        NULL,
  created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_rev_tea_no (tea_id, revision_no),
  UNIQUE KEY uk_rev_pending (pending_guard),
  KEY idx_rev_tea_status (tea_id, status),
  CONSTRAINT fk_rev_tea FOREIGN KEY (tea_id) REFERENCES tea (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='茶品修订版本：线上版本 + 修订草稿';

-- ============================================================
-- 三、图鉴与媒体（M03）
-- ============================================================

CREATE TABLE IF NOT EXISTS media_image (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tea_id          BIGINT UNSIGNED NOT NULL,
  image_type      VARCHAR(16)     NOT NULL COMMENT 'dry/soup/leaf/pack/detail',
  seq             TINYINT         NOT NULL DEFAULT 1,
  storage_path    VARCHAR(300)    NOT NULL COMMENT '原图相对路径',
  thumb_path      VARCHAR(300)    NULL COMMENT '640x480',
  display_path    VARCHAR(300)    NULL COMMENT '1600x1200',
  original_name   VARCHAR(200)    NULL,
  mime            VARCHAR(32)     NOT NULL,
  size_bytes      INT UNSIGNED    NOT NULL,
  width           SMALLINT        NULL,
  height          SMALLINT        NULL,
  source_type     VARCHAR(16)     NOT NULL COMMENT 'self/agency/stock/user',
  rights_holder   VARCHAR(100)    NULL,
  license_scope   VARCHAR(200)    NULL,
  license_expire  DATE            NULL,
  license_cert_no VARCHAR(80)     NULL,
  status          VARCHAR(16)     NOT NULL DEFAULT 'draft' COMMENT 'draft/published/offline',
  uploaded_by     BIGINT UNSIGNED NULL,
  created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at      DATETIME        NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_image_tea_seq (tea_id, seq),
  KEY idx_image_tea_status (tea_id, status),
  CONSTRAINT fk_image_tea FOREIGN KEY (tea_id) REFERENCES tea (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='图鉴图片与授权凭证';

CREATE TABLE IF NOT EXISTS gallery_user_shot (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tea_id          BIGINT UNSIGNED NOT NULL,
  submission_id   BIGINT UNSIGNED NOT NULL,
  image_id        BIGINT UNSIGNED NOT NULL,
  author_id       BIGINT UNSIGNED NOT NULL,
  anonymous       TINYINT(1)      NOT NULL DEFAULT 0,
  license_granted TINYINT(1)      NOT NULL DEFAULT 0,
  status          VARCHAR(16)     NOT NULL DEFAULT 'candidate' COMMENT 'candidate/adopted/rejected',
  adopted_by      BIGINT UNSIGNED NULL,
  adopted_at      DATETIME        NULL,
  created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_shot_submission_image (submission_id, image_id),
  KEY idx_shot_tea_status (tea_id, status),
  CONSTRAINT fk_shot_tea FOREIGN KEY (tea_id) REFERENCES tea (id),
  CONSTRAINT fk_shot_image FOREIGN KEY (image_id) REFERENCES media_image (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户实拍相册';

-- ============================================================
-- 四、用户互动（M06）
-- ============================================================

CREATE TABLE IF NOT EXISTS user_favorite (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id         BIGINT UNSIGNED NOT NULL,
  tea_id          BIGINT UNSIGNED NOT NULL,
  fav_group       VARCHAR(16)     NOT NULL DEFAULT 'want' COMMENT 'want/drank',
  created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_fav_user_tea (user_id, tea_id),
  KEY idx_fav_user_group (user_id, fav_group, created_at),
  CONSTRAINT fk_fav_user FOREIGN KEY (user_id) REFERENCES user_identity (id),
  CONSTRAINT fk_fav_tea FOREIGN KEY (tea_id) REFERENCES tea (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='收藏（想喝/已喝）';

CREATE TABLE IF NOT EXISTS browse_history (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id         BIGINT UNSIGNED NOT NULL,
  tea_id          BIGINT UNSIGNED NOT NULL,
  viewed_at       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_history_user_tea (user_id, tea_id),
  KEY idx_history_user_time (user_id, viewed_at),
  CONSTRAINT fk_history_user FOREIGN KEY (user_id) REFERENCES user_identity (id),
  CONSTRAINT fk_history_tea FOREIGN KEY (tea_id) REFERENCES tea (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='浏览历史（去重，保留 50 条）';

CREATE TABLE IF NOT EXISTS compare_item (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id         BIGINT UNSIGNED NOT NULL,
  tea_id          BIGINT UNSIGNED NOT NULL,
  sort_order      TINYINT         NOT NULL DEFAULT 0,
  created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_compare_user_tea (user_id, tea_id),
  KEY idx_compare_user (user_id, sort_order),
  CONSTRAINT fk_compare_user FOREIGN KEY (user_id) REFERENCES user_identity (id),
  CONSTRAINT fk_compare_tea FOREIGN KEY (tea_id) REFERENCES tea (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='对比篮，最多 3 款';

CREATE TABLE IF NOT EXISTS comment (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tea_id          BIGINT UNSIGNED NOT NULL,
  user_id         BIGINT UNSIGNED NOT NULL,
  content         VARCHAR(1000)   NOT NULL,
  image_id        BIGINT UNSIGNED NULL,
  status          VARCHAR(16)     NOT NULL DEFAULT 'pending' COMMENT 'pending/published/rejected/deleted',
  like_count      INT UNSIGNED    NOT NULL DEFAULT 0,
  reject_reason   VARCHAR(200)    NULL,
  reviewed_by     BIGINT UNSIGNED NULL,
  reviewed_at     DATETIME        NULL,
  deleted_at      DATETIME        NULL,
  created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_comment_tea_status (tea_id, status, created_at),
  KEY idx_comment_user (user_id, created_at),
  CONSTRAINT fk_comment_tea FOREIGN KEY (tea_id) REFERENCES tea (id),
  CONSTRAINT fk_comment_user FOREIGN KEY (user_id) REFERENCES user_identity (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='评论，先审后发';

CREATE TABLE IF NOT EXISTS comment_like (
  comment_id      BIGINT UNSIGNED NOT NULL,
  user_id         BIGINT UNSIGNED NOT NULL,
  created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (comment_id, user_id),
  KEY idx_like_user (user_id),
  CONSTRAINT fk_like_comment FOREIGN KEY (comment_id) REFERENCES comment (id),
  CONSTRAINT fk_like_user FOREIGN KEY (user_id) REFERENCES user_identity (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='评论点赞';

-- ============================================================
-- 五、投稿与修订（M07）
-- ============================================================

CREATE TABLE IF NOT EXISTS submission (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id         BIGINT UNSIGNED NOT NULL,
  type            VARCHAR(8)      NOT NULL COMMENT 'T1/T3/T4',
  tea_id          BIGINT UNSIGNED NULL,
  correction_field_key VARCHAR(40) NULL COMMENT 'T4 纠错字段键；同一茶品同一字段仅一条待审核',
  title           VARCHAR(120)    NULL,
  body            MEDIUMTEXT      NULL,
  anonymous       TINYINT(1)      NOT NULL DEFAULT 0,
  status          VARCHAR(16)     NOT NULL DEFAULT 'draft' COMMENT 'draft/pending/approved/rejected/locked/revised',
  pending_guard   VARCHAR(90)     GENERATED ALWAYS AS (
                    CASE WHEN status = 'pending' AND type = 'T4'
                         THEN CONCAT(tea_id, ':', correction_field_key) ELSE NULL END
                  ) STORED COMMENT '并发纠错唯一约束',
  reject_reason   VARCHAR(300)    NULL,
  resubmit_count  TINYINT         NOT NULL DEFAULT 0 COMMENT '驳回后重提次数，上限 2',
  submitted_at    DATETIME        NULL,
  reviewed_by     BIGINT UNSIGNED NULL,
  reviewed_at     DATETIME        NULL,
  locked_at       DATETIME        NULL,
  created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at      DATETIME        NULL,
  PRIMARY KEY (id),
  KEY idx_sub_user_status (user_id, status, created_at),
  KEY idx_sub_status_time (status, submitted_at),
  KEY idx_sub_tea (tea_id, status),
  UNIQUE KEY uk_sub_pending_correction (pending_guard),
  CONSTRAINT fk_sub_user FOREIGN KEY (user_id) REFERENCES user_identity (id),
  CONSTRAINT fk_sub_tea FOREIGN KEY (tea_id) REFERENCES tea (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户投稿 T1/T3/T4';

CREATE TABLE IF NOT EXISTS submission_image (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  submission_id   BIGINT UNSIGNED NOT NULL,
  image_id        BIGINT UNSIGNED NOT NULL,
  seq             TINYINT         NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  UNIQUE KEY uk_sub_image_seq (submission_id, seq),
  CONSTRAINT fk_sub_image_sub FOREIGN KEY (submission_id) REFERENCES submission (id),
  CONSTRAINT fk_sub_image_img FOREIGN KEY (image_id) REFERENCES media_image (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='投稿附件';

CREATE TABLE IF NOT EXISTS submission_field_diff (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  submission_id   BIGINT UNSIGNED NOT NULL,
  field_key       VARCHAR(40)     NOT NULL COMMENT '如 origin/grade/brewing',
  old_value       VARCHAR(500)    NULL,
  new_value       VARCHAR(500)    NULL,
  reason          VARCHAR(300)    NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_diff_sub_field (submission_id, field_key),
  CONSTRAINT fk_diff_sub FOREIGN KEY (submission_id) REFERENCES submission (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='T4 纠错字段差异';

-- ============================================================
-- 六、审核与治理（M08）
-- ============================================================

CREATE TABLE IF NOT EXISTS report (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  reporter_id     BIGINT UNSIGNED NOT NULL,
  object_type     VARCHAR(16)     NOT NULL COMMENT 'image/comment/user_shot',
  object_id       BIGINT UNSIGNED NOT NULL,
  tea_id          BIGINT UNSIGNED NULL,
  report_type     VARCHAR(32)     NOT NULL COMMENT '侵权/不实/违规/其他',
  description     VARCHAR(1000)   NOT NULL,
  status          VARCHAR(24)     NOT NULL DEFAULT 'pending' COMMENT 'pending/processing/resolved_valid/resolved_invalid',
  first_response_at DATETIME      NULL,
  sla_deadline    DATETIME        NOT NULL,
  handler_id      BIGINT UNSIGNED NULL,
  result_note     VARCHAR(300)    NULL,
  resolved_at     DATETIME        NULL,
  created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_report_reporter_object (reporter_id, object_type, object_id),
  KEY idx_report_status_sla (status, sla_deadline),
  KEY idx_report_tea (tea_id, status),
  CONSTRAINT fk_report_reporter FOREIGN KEY (reporter_id) REFERENCES user_identity (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='举报/投诉';

CREATE TABLE IF NOT EXISTS report_evidence (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  report_id       BIGINT UNSIGNED NOT NULL,
  storage_path    VARCHAR(300)    NOT NULL,
  seq             TINYINT         NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  KEY idx_evidence_report (report_id, seq),
  CONSTRAINT fk_evidence_report FOREIGN KEY (report_id) REFERENCES report (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='举报证据';

CREATE TABLE IF NOT EXISTS sanction (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id         BIGINT UNSIGNED NOT NULL,
  sanction_type   VARCHAR(16)     NOT NULL COMMENT 'mute/ban',
  reason          VARCHAR(300)    NOT NULL,
  start_at        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  end_at          DATETIME        NULL COMMENT '禁言可定期，封禁可空',
  status          VARCHAR(16)     NOT NULL DEFAULT 'active' COMMENT 'active/expired/revoked',
  operator_id     BIGINT UNSIGNED NOT NULL,
  revoked_by      BIGINT UNSIGNED NULL,
  revoked_at      DATETIME        NULL,
  created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_sanction_user_status (user_id, status, start_at),
  KEY idx_sanction_expire (status, end_at),
  CONSTRAINT fk_sanction_user FOREIGN KEY (user_id) REFERENCES user_identity (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='禁言/封禁记录';

CREATE TABLE IF NOT EXISTS appeal (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  report_id       BIGINT UNSIGNED NULL,
  sanction_id     BIGINT UNSIGNED NULL,
  appellant_id    BIGINT UNSIGNED NOT NULL,
  reason          VARCHAR(1000)   NOT NULL,
  status          VARCHAR(16)     NOT NULL DEFAULT 'pending' COMMENT 'pending/upheld/overturned',
  reviewer_id     BIGINT UNSIGNED NULL,
  review_note     VARCHAR(300)    NULL,
  reviewed_at     DATETIME        NULL,
  created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_appeal_status (status, created_at),
  KEY idx_appeal_appellant (appellant_id),
  CONSTRAINT fk_appeal_report FOREIGN KEY (report_id) REFERENCES report (id),
  CONSTRAINT fk_appeal_sanction FOREIGN KEY (sanction_id) REFERENCES sanction (id),
  CONSTRAINT fk_appeal_user FOREIGN KEY (appellant_id) REFERENCES user_identity (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='申诉（每案 1 次）';

CREATE TABLE IF NOT EXISTS audit_log (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  operator_id     BIGINT UNSIGNED NOT NULL,
  operator_role   VARCHAR(16)     NOT NULL,
  action          VARCHAR(40)     NOT NULL COMMENT 'review/publish/unpublish/ban/whitelist/config...',
  object_type     VARCHAR(32)     NOT NULL,
  object_id       BIGINT UNSIGNED NULL,
  reason          VARCHAR(300)    NULL,
  before_state    JSON            NULL,
  after_state     JSON            NULL,
  ip              VARCHAR(64)     NULL,
  request_id      VARCHAR(64)     NULL,
  created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_audit_object (object_type, object_id, created_at),
  KEY idx_audit_operator (operator_id, created_at),
  KEY idx_audit_time (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='操作审计，保留 180 天';

-- ============================================================
-- 七、站内消息（M09）
-- ============================================================

CREATE TABLE IF NOT EXISTS message (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id         BIGINT UNSIGNED NOT NULL,
  type            VARCHAR(16)     NOT NULL COMMENT 'review/correction/report/system',
  title           VARCHAR(100)    NOT NULL,
  summary         VARCHAR(500)    NULL,
  target_type     VARCHAR(32)     NULL,
  target_id       BIGINT UNSIGNED NULL,
  is_read         TINYINT(1)      NOT NULL DEFAULT 0,
  read_at         DATETIME        NULL,
  created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_msg_user_unread (user_id, is_read, created_at),
  KEY idx_msg_created (created_at),
  CONSTRAINT fk_msg_user FOREIGN KEY (user_id) REFERENCES user_identity (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='站内消息，保留 180 天';

-- ============================================================
-- 八、运营工具（M10）
-- ============================================================

CREATE TABLE IF NOT EXISTS import_task (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  operator_id     BIGINT UNSIGNED NOT NULL,
  file_name       VARCHAR(200)    NOT NULL,
  file_path       VARCHAR(300)    NULL,
  status          VARCHAR(24)     NOT NULL DEFAULT 'uploading' COMMENT 'uploading/validating/validation_failed/ready/importing/completed/failed',
  total_rows      INT             NOT NULL DEFAULT 0,
  success_rows    INT             NOT NULL DEFAULT 0,
  error_rows      INT             NOT NULL DEFAULT 0,
  error_report_path VARCHAR(300)  NULL,
  created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  started_at      DATETIME        NULL,
  finished_at     DATETIME        NULL,
  PRIMARY KEY (id),
  KEY idx_import_status (status, created_at),
  CONSTRAINT fk_import_operator FOREIGN KEY (operator_id) REFERENCES user_identity (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='批量导入任务';

CREATE TABLE IF NOT EXISTS import_row_error (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  task_id         BIGINT UNSIGNED NOT NULL,
  row_no          INT             NOT NULL,
  column_name     VARCHAR(60)     NULL,
  error_msg       VARCHAR(300)    NOT NULL,
  PRIMARY KEY (id),
  KEY idx_import_err_task (task_id, row_no),
  CONSTRAINT fk_import_err_task FOREIGN KEY (task_id) REFERENCES import_task (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='导入校验错误行';

CREATE TABLE IF NOT EXISTS system_config (
  config_key      VARCHAR(64)     NOT NULL,
  config_value    VARCHAR(1000)   NOT NULL,
  value_type      VARCHAR(16)     NOT NULL DEFAULT 'string' COMMENT 'string/int/bool/json',
  editable        TINYINT(1)      NOT NULL DEFAULT 1,
  description     VARCHAR(200)    NULL,
  updated_by      BIGINT UNSIGNED NULL,
  updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (config_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='系统配置';

CREATE TABLE IF NOT EXISTS system_config_log (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  config_key      VARCHAR(64)     NOT NULL,
  old_value       VARCHAR(1000)   NULL,
  new_value       VARCHAR(1000)   NOT NULL,
  updated_by      BIGINT UNSIGNED NOT NULL,
  created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_config_log_key (config_key, created_at),
  CONSTRAINT fk_config_log_user FOREIGN KEY (updated_by) REFERENCES user_identity (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='配置变更记录';

-- ============================================================
-- 九、平台补偿任务（M11）
-- ============================================================

CREATE TABLE IF NOT EXISTS task_retry (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  event_type      VARCHAR(64)     NOT NULL,
  payload         JSON            NOT NULL,
  status          VARCHAR(16)     NOT NULL DEFAULT 'pending' COMMENT 'pending/running/success/failed',
  retry_count     TINYINT         NOT NULL DEFAULT 0,
  max_retry       TINYINT         NOT NULL DEFAULT 5,
  next_retry_at   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_error      VARCHAR(500)    NULL,
  created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_retry_due (status, next_retry_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='领域事件失败补偿';

-- ============================================================
-- 十、基础数据：6 茶类 / 23 亚类 / 五维标签 / 系统配置
-- ============================================================

INSERT INTO tea_category (code, name, intro, sort_order, color_token) VALUES
('green',  '绿茶', '不发酵，清汤绿叶，鲜爽为上', 1, '--tea-green'),
('white',  '白茶', '微发酵，毫香清甜，越陈越醇', 2, '--tea-white'),
('yellow', '黄茶', '轻发酵，黄汤黄叶，甜香柔和', 3, '--tea-yellow'),
('oolong', '青茶', '半发酵，香气高扬，岩韵/观音韵', 4, '--tea-oolong'),
('red',    '红茶', '全发酵，红汤红叶，甜香醇厚', 5, '--tea-red'),
('dark',   '黑茶', '后发酵，陈香醇厚，适合煮饮', 6, '--tea-dark')
ON DUPLICATE KEY UPDATE name = VALUES(name), intro = VALUES(intro), sort_order = VALUES(sort_order);

INSERT INTO tea_subcategory (category_id, code, name, content_status, sort_order)
SELECT c.id, v.code, v.name, 'constructing', v.sort_order
FROM tea_category c
JOIN (
  SELECT 'green' AS cat, 'shaqing' AS code, '炒青' AS name, 1 AS sort_order
  UNION ALL SELECT 'green','hongqing','烘青',2
  UNION ALL SELECT 'green','shaiqing','晒青',3
  UNION ALL SELECT 'green','zhengqing','蒸青',4
  UNION ALL SELECT 'white','yinzhen','白毫银针',1
  UNION ALL SELECT 'white','mudan','白牡丹',2
  UNION ALL SELECT 'white','gongmei','贡眉',3
  UNION ALL SELECT 'white','shoumei','寿眉',4
  UNION ALL SELECT 'yellow','huangya','黄芽',1
  UNION ALL SELECT 'yellow','huangxiao','黄小',2
  UNION ALL SELECT 'yellow','huangda','黄大',3
  UNION ALL SELECT 'oolong','minbei','闽北',1
  UNION ALL SELECT 'oolong','minnan','闽南',2
  UNION ALL SELECT 'oolong','guangdong','广东',3
  UNION ALL SELECT 'oolong','taiwan','台湾',4
  UNION ALL SELECT 'red','xiaozhong','小种',1
  UNION ALL SELECT 'red','gongfu','工夫',2
  UNION ALL SELECT 'red','hongsu','红碎',3
  UNION ALL SELECT 'dark','hunan','湖南',1
  UNION ALL SELECT 'dark','hubei','湖北',2
  UNION ALL SELECT 'dark','sichuan','四川',3
  UNION ALL SELECT 'dark','yunnan','云南（含普洱）',4
  UNION ALL SELECT 'dark','guangxi','广西',5
) v ON v.cat = c.code
ON DUPLICATE KEY UPDATE name = VALUES(name), sort_order = VALUES(sort_order);

INSERT INTO tag (dimension, name, status) VALUES
('shape','条索','enabled'),('shape','扁平','enabled'),('shape','卷曲','enabled'),
('shape','颗粒','enabled'),('shape','针形','enabled'),('shape','片状','enabled'),
('shape','饼状','enabled'),('shape','束形','enabled'),('shape','螺形','enabled'),
('color','翠绿','enabled'),('color','黄绿','enabled'),('color','墨绿','enabled'),
('color','白毫显露','enabled'),('color','银白','enabled'),('color','青褐','enabled'),
('color','乌褐','enabled'),('color','红褐','enabled'),('color','黑褐','enabled'),
('soup','浅黄绿','enabled'),('soup','黄绿','enabled'),('soup','金黄','enabled'),
('soup','橙黄','enabled'),('soup','橙红','enabled'),('soup','深红','enabled'),('soup','酒红','enabled'),
('ferment','不发酵','enabled'),('ferment','微发酵','enabled'),('ferment','轻发酵','enabled'),
('ferment','半发酵','enabled'),('ferment','全发酵','enabled'),('ferment','后发酵','enabled'),
('aroma','豆香','enabled'),('aroma','栗香','enabled'),('aroma','花香','enabled'),
('aroma','果香','enabled'),('aroma','蜜香','enabled'),('aroma','松烟香','enabled'),
('aroma','陈香','enabled'),('aroma','枣香','enabled'),('aroma','毫香','enabled'),
('aroma','清香','enabled'),('aroma','焦糖香','enabled'),('aroma','药香','enabled')
ON DUPLICATE KEY UPDATE status = VALUES(status);

INSERT INTO system_config (config_key, config_value, value_type, editable, description) VALUES
('site.name', '茗脉', 'string', 0, '站点名称'),
('upload.max_mb', '5', 'int', 0, '单图大小上限（MB），PRD 固定值'),
('upload.allowed_mime', '["image/jpeg","image/png","image/webp"]', 'json', 0, '允许的图片 MIME'),
('gallery.publish_min', '4', 'int', 0, '上架所需最少图片数'),
('gallery.publish_max', '5', 'int', 0, '图鉴最多图片数'),
('submission.daily_limit', '3', 'int', 1, '每人每日投稿上限'),
('submission.resubmit_max', '2', 'int', 0, '驳回后最多重提次数'),
('comment.daily_limit', '20', 'int', 1, '每人每日评论上限'),
('report.daily_limit', '10', 'int', 1, '每人每日举报上限'),
('report.sla_hours', '48', 'int', 0, '举报首次响应时限（小时）'),
('review.sla_hours', '24', 'int', 0, '审核时限（工作日小时）'),
('favorite.limit', '500', 'int', 0, '收藏总数上限'),
('history.limit', '50', 'int', 0, '浏览历史保留条数'),
('account.deletion_days', '7', 'int', 0, '注销冷静期（天）'),
('audit.retention_days', '180', 'int', 0, '审计日志保留天数'),
('message.retention_days', '180', 'int', 0, '站内消息保留天数'),
('backup.keep_count', '7', 'int', 1, '数据库备份保留份数')
ON DUPLICATE KEY UPDATE description = VALUES(description);
