"""写接口限流：Redis 计数，超限返回 429 MM-SYS-002（ARCHITECTURE §7.3）。

设计约束：
- 阈值取 §7.3 最小集（登录二维码/轮询、评论发布、其余写接口）；
- Redis 异常时放行并保持业务可用（ARCHITECTURE §9 降级口径）；
- 键中只放用户 ID 或 IP，不落 openid、令牌等敏感标识。
"""

import time
from typing import Optional

import redis
from fastapi import Request
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.core.errors import ErrorCode
from app.core.response import fail
from app.core.security import client_ip

WRITE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}

# (scope, 阈值, 窗口秒数)
_RULES = {
    "auth": ("auth", 10, 60),
    "comment": ("comment", 20, 24 * 60 * 60),
    "write": ("write", 60, 60),
}

_redis = redis.Redis.from_url(
    settings.redis_url,
    decode_responses=True,
    socket_timeout=1,
    socket_connect_timeout=1,
)


def check(request: Request) -> Optional[JSONResponse]:
    """校验当前请求是否超限；超限直接返回 429 响应，否则返回 None。"""
    rule = _rule(request)
    if rule is None:
        return None
    scope, limit, window = rule
    identity = _identity(request)
    if identity is None:
        return None
    bucket = str(int(time.time() // window))
    key = f"mm:rate:{scope}:{identity}:{bucket}"
    try:
        current = _redis.incr(key)
        if current == 1:
            _redis.expire(key, window)
    except Exception:
        # Redis 不可用时放行，由 access 短有效期与其他校验兜底
        return None
    if current <= limit:
        return None
    return JSONResponse(
        status_code=ErrorCode.SYS_002.status,
        content=fail(ErrorCode.SYS_002.code, ErrorCode.SYS_002.message),
        headers={"Retry-After": str(window)},
    )


def _rule(request: Request) -> Optional[tuple[str, int, int]]:
    if request.method not in WRITE_METHODS:
        return None
    path = request.url.path
    if path == "/api/v1/auth/qrcode" or path.startswith("/api/v1/auth/qrcode/"):
        return _RULES["auth"]
    if path.startswith("/api/v1/teas/") and path.endswith("/comments"):
        return _RULES["comment"]
    return _RULES["write"]


def _identity(request: Request) -> Optional[str]:
    principal = getattr(request.state, "principal", None)
    if principal is not None:
        return f"u{principal.id}"
    ip = client_ip(request)
    return f"ip{ip}" if ip else None
