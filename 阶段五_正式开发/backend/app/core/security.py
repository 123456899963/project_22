"""鉴权与会话：JWT 签发/解析、Redis 令牌白名单、角色层级、账号状态门禁。

对应原 Java security 包：JwtService / TokenStore / Role / UserPrincipal / AuthInterceptor。
"""

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from enum import IntEnum
from typing import Callable, Optional, Protocol

import jwt
import redis
from fastapi import Depends, Request
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.db import get_db
from app.core.errors import BizException, ErrorCode
from app.core.response import current_request

READ_ONLY_METHODS = {"GET", "HEAD", "OPTIONS"}


class Role(IntEnum):
    """角色层级：游客 < 用户 < 管理员 < 超管。"""

    VISITOR = 0
    USER = 1
    ADMIN = 2
    SUPER = 3

    def at_least(self, required: "Role") -> bool:
        return int(self) >= int(required)

    @classmethod
    def parse(cls, value: str | None) -> "Role":
        if not value:
            return cls.VISITOR
        try:
            return cls[value.strip().upper()]
        except KeyError:
            return cls.VISITOR


@dataclass(frozen=True)
class Principal:
    """请求级登录主体：只保留业务需要字段，openid 不进入响应与日志。"""

    id: int
    nickname: str | None
    role: Role
    status: str | None

    @property
    def is_admin(self) -> bool:
        return self.role.at_least(Role.ADMIN)


@dataclass(frozen=True)
class IssuedToken:
    token: str
    jti: str
    expires_in: int


@dataclass(frozen=True)
class ParsedToken:
    principal: Principal
    jti: str


class JwtService:
    """access token 签发与解析；refresh token 由 TokenStore 存 Redis。"""

    def __init__(self, secret: str | None = None, expire_seconds: int | None = None) -> None:
        self._secret = secret or settings.jwt_secret
        self._expire = expire_seconds or settings.access_expire_seconds

    def issue_access_token(self, user_id: int, role: Role, status: str | None) -> IssuedToken:
        import uuid

        jti = uuid.uuid4().hex
        now = datetime.now(timezone.utc)
        payload = {
            "sub": str(user_id),
            "jti": jti,
            "role": role.name,
            "status": status,
            "iat": int(now.timestamp()),
            "exp": int((now + timedelta(seconds=self._expire)).timestamp()),
        }
        token = jwt.encode(payload, self._secret, algorithm="HS256")
        return IssuedToken(token=token, jti=jti, expires_in=self._expire)

    def parse(self, token: str) -> ParsedToken:
        claims = jwt.decode(token, self._secret, algorithms=["HS256"])
        principal = Principal(
            id=int(claims["sub"]),
            nickname=None,
            role=Role.parse(claims.get("role")),
            status=claims.get("status"),
        )
        return ParsedToken(principal=principal, jti=claims.get("jti") or "")


class TokenStore:
    """令牌状态存储：access 白名单（支持注销即时失效）+ refresh 一次性凭证。

    Redis 不可用时降级：access 放行（靠短有效期兜底），refresh 视为无效。
    """

    ACCESS_PREFIX = "mm:access:"
    ACCESS_USER_PREFIX = "mm:access:user:"
    REFRESH_PREFIX = "mm:refresh:"

    def __init__(self, client: "redis.Redis | None" = None) -> None:
        self._redis = client or redis.Redis.from_url(
            settings.redis_url, decode_responses=True, socket_timeout=3, socket_connect_timeout=3
        )

    def mark_access(self, jti: str, user_id: int, seconds: int) -> None:
        try:
            self._redis.set(self.ACCESS_PREFIX + jti, str(user_id), ex=seconds)
            user_key = self.ACCESS_USER_PREFIX + str(user_id)
            self._redis.sadd(user_key, jti)
            self._redis.expire(user_key, seconds + 60)
        except Exception:
            return

    def is_access_active(self, jti: str) -> bool:
        try:
            return bool(self._redis.exists(self.ACCESS_PREFIX + jti))
        except Exception:
            return True

    def revoke_access(self, jti: str) -> None:
        try:
            self._redis.delete(self.ACCESS_PREFIX + jti)
        except Exception:
            return

    def revoke_all_access(self, user_id: int) -> None:
        try:
            jtis = self._redis.smembers(self.ACCESS_USER_PREFIX + str(user_id))
            if jtis:
                self._redis.delete(*[self.ACCESS_PREFIX + item for item in jtis])
            self._redis.delete(self.ACCESS_USER_PREFIX + str(user_id))
        except Exception:
            return

    def save_refresh(self, token: str, user_id: int, seconds: int) -> None:
        self._redis.set(self.REFRESH_PREFIX + token, str(user_id), ex=seconds)

    def consume_refresh(self, token: str) -> Optional[int]:
        try:
            value = self._redis.get(self.REFRESH_PREFIX + token)
            if value is None:
                return None
            self._redis.delete(self.REFRESH_PREFIX + token)
            return int(value)
        except Exception:
            return None

    def revoke_refresh(self, token: str) -> None:
        try:
            self._redis.delete(self.REFRESH_PREFIX + token)
        except Exception:
            return


class StatusProvider(Protocol):
    def __call__(self, db: Session, user_id: int) -> Optional[str]: ...


_status_provider: Optional[StatusProvider] = None


def register_status_provider(provider: StatusProvider) -> None:
    """由 moderation 模块注册账号状态覆写（封禁/禁言/注销冷静期）。"""
    global _status_provider
    _status_provider = provider


jwt_service = JwtService()
token_store = TokenStore()


def _bearer_jti(request: Request) -> tuple[Optional[Principal], Optional[str]]:
    authorization = request.headers.get("authorization")
    if not authorization or not authorization.startswith("Bearer "):
        return None, None
    try:
        parsed = jwt_service.parse(authorization[7:])
    except Exception:
        return None, None
    if not parsed.jti or not token_store.is_access_active(parsed.jti):
        return None, None
    return parsed.principal, parsed.jti


def optional_principal(request: Request) -> Optional[Principal]:
    principal, jti = _bearer_jti(request)
    if jti:
        request.state.mm_jti = jti
    request.state.principal = principal
    return principal


def current_principal(request: Request) -> Principal:
    principal: Optional[Principal] = getattr(request.state, "principal", None)
    if principal is None:
        raise BizException(ErrorCode.AUTH_001)
    return principal


def _check_account_status(request: Request, principal: Principal, db: Session) -> None:
    status = principal.status
    if _status_provider is not None:
        override = _status_provider(db, principal.id)
        if override:
            status = override
    if not status:
        return
    if request.method in ("GET", "HEAD"):
        return
    path = request.url.path
    if path.endswith("/auth/logout"):
        return
    # 注销冷静期内必须允许撤销注销，否则用户无法自救
    if path.endswith("/me/deletion") and request.method == "DELETE":
        return
    if status in ("banned", "deleting"):
        raise BizException(ErrorCode.AUTH_004)
    # 禁言只限制写操作，站内阅读与浏览不受影响
    if status == "muted" and request.method not in READ_ONLY_METHODS:
        raise BizException(ErrorCode.AUTH_004)


def require_role(required: Role) -> Callable[..., Principal]:
    """生成角色依赖：未登录 401、权限不足 403、并执行账号状态门禁。"""

    def dependency(request: Request, db: Session = Depends(get_db)) -> Principal:
        principal = current_principal(request)
        if not principal.role.at_least(required):
            raise BizException(ErrorCode.AUTH_003)
        _check_account_status(request, principal, db)
        return principal

    return dependency


user_required = require_role(Role.USER)
admin_required = require_role(Role.ADMIN)
super_required = require_role(Role.SUPER)


def client_ip(request: Request) -> Optional[str]:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else None


def audit_request() -> Optional[Request]:
    return current_request()
