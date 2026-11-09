-- V2 · T3 补图授权声明落库（阶段六 R9，处置 D2）
-- 依据：PRD §6.4 T3 补图需勾选授权；DATA_MODEL submission 表扩展。
-- 只前滚，不修改已发布的 V1/init.sql；回滚见文件末尾注释。

USE mingmai;

ALTER TABLE submission
  ADD COLUMN license_granted TINYINT(1) NOT NULL DEFAULT 0
    COMMENT 'T3 用户补图授权声明' AFTER anonymous,
  ADD COLUMN license_granted_at DATETIME NULL
    COMMENT '授权勾选时间' AFTER license_granted;

-- 回滚（仅用于测试环境，生产禁止直接执行）：
-- ALTER TABLE submission
--   DROP COLUMN license_granted_at,
--   DROP COLUMN license_granted;
