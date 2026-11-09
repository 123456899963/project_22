#!/usr/bin/env sh
# 证书放置 + 服务启动 + 上线自检（在 Linux 目标机、仓库根目录执行）
#
# 用法：
#   sh deploy/go-live.sh <证书链文件> <私钥文件>     # 放置/更新证书后启动
#   sh deploy/go-live.sh                            # 证书已在 deploy/certs 时，仅启动
#
# 说明：证书文件以 deploy/certs/server.crt（需含中间证书链）与 server.key 命名，
#      容器只读挂载该目录；私钥权限固定 600。
set -eu

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

CERTS="$ROOT/deploy/certs"
COMPOSE_FILE="$ROOT/deploy/docker-compose.yml"
ENV_FILE="$ROOT/deploy/.env"

log() { printf '\n==> %s\n' "$1"; }
fail() { printf 'FAIL: %s\n' "$1" >&2; exit 1; }

# ---------- 1. 证书放置 ----------
CERT_SRC="${1:-}"
KEY_SRC="${2:-}"
CERTS_UPDATED=0

mkdir -p "$CERTS"

if [ -n "$CERT_SRC" ] || [ -n "$KEY_SRC" ]; then
  [ -n "$CERT_SRC" ] && [ -n "$KEY_SRC" ] || fail "需同时提供证书与私钥两个路径"
  [ -f "$CERT_SRC" ] || fail "证书文件不存在: $CERT_SRC"
  [ -f "$KEY_SRC" ] || fail "私钥文件不存在: $KEY_SRC"
  STAMP="$(date +%Y%m%d-%H%M%S)"
  if [ -f "$CERTS/server.crt" ]; then cp "$CERTS/server.crt" "$CERTS/server.crt.bak-$STAMP"; fi
  if [ -f "$CERTS/server.key" ]; then cp "$CERTS/server.key" "$CERTS/server.key.bak-$STAMP"; fi
  cp "$CERT_SRC" "$CERTS/server.crt"
  cp "$KEY_SRC" "$CERTS/server.key"
  CERTS_UPDATED=1
  log "证书已放置：deploy/certs/server.crt + server.key"
fi

chmod 644 "$CERTS/server.crt" 2>/dev/null || fail "缺少 deploy/certs/server.crt"
chmod 600 "$CERTS/server.key" 2>/dev/null || fail "缺少 deploy/certs/server.key"

log "校验证书与私钥"
if command -v openssl >/dev/null 2>&1; then
  openssl x509 -in "$CERTS/server.crt" -noout -subject -dates \
    || fail "server.crt 无法解析（确认是 PEM 且包含证书链）"
  x509_pub="$(openssl x509 -in "$CERTS/server.crt" -noout -pubkey)"
  key_pub="$(openssl pkey -in "$CERTS/server.key" -pubout 2>/dev/null)" \
    || fail "server.key 无法解析（确认是未加密的 PEM 私钥）"
  [ "$x509_pub" = "$key_pub" ] || fail "证书与私钥不匹配"
  echo "OK：证书可解析、私钥可解析、二者公钥一致"
else
  echo "WARN：未安装 openssl，跳过证书解析与配对校验"
fi

# ---------- 2. 生产配置检查 ----------
log "检查 deploy/.env"
[ -f "$ENV_FILE" ] || fail "缺少 deploy/.env（复制 deploy/.env.example 后填写）"

missing=0
for key in MM_JWT_SECRET MM_DB_PASSWORD MM_DB_ROOT_PASSWORD; do
  if ! grep -Eq "^${key}=.+" "$ENV_FILE"; then
    echo "缺少或为空：$key"
    missing=1
  fi
done
[ "$missing" -eq 0 ] || fail "请先补齐 deploy/.env 中的必填项"

if grep -Eq "^MM_WECHAT_MOCK=true" "$ENV_FILE"; then
  echo "WARN：MM_WECHAT_MOCK=true，真实微信登录与开发登录同时处于 mock 状态"
fi

# ---------- 3. 启动服务 ----------
if docker compose version >/dev/null 2>&1; then
  DC="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  DC="docker-compose"
else
  fail "未找到 docker compose / docker-compose"
fi

log "校验 compose 配置"
$DC -f "$COMPOSE_FILE" config >/dev/null || fail "compose 配置不合法"

log "构建并启动（mysql / redis / backend / nginx）"
$DC -f "$COMPOSE_FILE" up -d --build

if [ "$CERTS_UPDATED" -eq 1 ]; then
  log "证书已更新，重启 nginx 使其生效"
  $DC -f "$COMPOSE_FILE" restart nginx
fi

# ---------- 4. 上线自检 ----------
log "等待服务就绪（最多 120s）"
tries=0
until curl -kfsS https://127.0.0.1/api/v1/home 2>/dev/null | grep -q '"code":"OK"'; do
  tries=$((tries + 1))
  if [ "$tries" -ge 24 ]; then
    fail "服务未在 120s 内返回 /api/v1/home"
  fi
  sleep 5
done
echo "OK：后端经 nginx 可访问"

log "nginx 配置语法"
$DC -f "$COMPOSE_FILE" exec -T nginx nginx -t

log "HTTP → HTTPS 跳转"
http_code="$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1/ || true)"
[ "$http_code" = "301" ] && echo "OK：http 返回 301" || fail "http 未跳转（实际 $http_code）"

log "HTTPS 首页与接口"
https_code="$(curl -k -s -o /dev/null -w '%{http_code}' https://127.0.0.1/ || true)"
[ "$https_code" = "200" ] && echo "OK：https 首页 200" || fail "https 首页异常（实际 $https_code）"
curl -kfsS https://127.0.0.1/api/v1/home | grep -q '"code":"OK"' \
  && echo "OK：/api/v1/home 返回 code=OK" || fail "/api/v1/home 响应异常"

log "数据库端口仅绑定回环"
if command -v ss >/dev/null 2>&1; then
  for port in 3306 6379; do
    line="$(ss -lnt | grep ":$port " || true)"
    case "$line" in
      *127.0.0.1:$port*) echo "OK：$port 仅监听 127.0.0.1" ;;
      "") fail "$port 未监听（容器是否启动？）" ;;
      *) fail "$port 监听地址异常：$line" ;;
    esac
  done
else
  echo "WARN：未安装 ss，跳过端口核查（请手工执行 netstat -lnt | grep -E '3306|6379'）"
fi

cat <<EOF

==> 上线完成
站点：      https://<域名>/（后台 /admin/login）
证书：      $(openssl x509 -in "$CERTS/server.crt" -noout -enddate 2>/dev/null || echo "见 deploy/certs/server.crt")
容器：      $DC -f deploy/docker-compose.yml ps
回滚：      $DC -f deploy/docker-compose.yml up -d --force-recreate backend nginx
EOF
