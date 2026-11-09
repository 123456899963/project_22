#!/usr/bin/env sh
# 每日备份：MySQL 全量 + 上传目录增量，保留 7 份。
set -eu

BACKUP_DIR="${BACKUP_DIR:-/data/mm/backups}"
KEEP="${KEEP:-7}"
STAMP="$(date +%Y%m%d-%H%M%S)"
DB_NAME="${MM_DB_NAME:-mingmai}"
DB_HOST="${MM_DB_HOST:-mysql}"
DB_USER="${MM_DB_USER:-mingmai}"

mkdir -p "$BACKUP_DIR"

mysqldump -h "$DB_HOST" -u "$DB_USER" -p"${MM_DB_PASSWORD:?MM_DB_PASSWORD required}" \
  --single-transaction --routines --triggers "$DB_NAME" \
  | gzip > "$BACKUP_DIR/${DB_NAME}-${STAMP}.sql.gz"

tar -czf "$BACKUP_DIR/uploads-${STAMP}.tar.gz" -C /data/mm uploads

# 只保留最近 KEEP 份（按文件名时间排序）
ls -1t "$BACKUP_DIR"/${DB_NAME}-*.sql.gz 2>/dev/null | tail -n +$((KEEP + 1)) | xargs -r rm -f
ls -1t "$BACKUP_DIR"/uploads-*.tar.gz 2>/dev/null | tail -n +$((KEEP + 1)) | xargs -r rm -f
