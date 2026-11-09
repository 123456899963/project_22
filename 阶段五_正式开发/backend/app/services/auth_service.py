"""认证与会话：二维码 state、微信回调、令牌签发/刷新/注销、开发模拟登录。

对应原 Java account.service.AuthService。
"""

import uuid
from typing import Optional

import httpx
import redis
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.errors import BizException, ErrorCode
from app.core.security import IssuedToken, jwt_service, token_store
from app.core.timeutil import now
from app.models.account import AdminWhitelist, UserIdentity, UserProfile


def _redis() -> "redis.Redis":
    return redis.Redis.from_url(settings.redis_url, decode_responses=True, socket_timeout=3)


def create_qr_code() -> dict:
    ticket = uuid.uuid4().hex
    client = _redis()
    client.set(f"mm:wx:state:{ticket}", ticket, ex=300)
    client.set(f"mm:wx:status:{ticket}", "pending", ex=300)
    content = (
        "https://open.weixin.qq.com/connect/qrconnect"
        f"?appid={settings.wechat_app_id}"
        f"&redirect_uri={settings.wechat_qrcode_redirect}"
        f"&response_type=code&scope=snsapi_login&state={ticket}"
    )
    return {"ticket": ticket, "qrContent": content, "expiresIn": 300}


def qr_status(ticket: str) -> dict:
    status = _redis().get(f"mm:wx:status:{ticket}")
    return {"status": status or "expired"}


def wechat_login(db: Session, code: str, state: str) -> dict:
    client = _redis()
    if client.get(f"mm:wx:state:{state}") is None:
        raise BizException(ErrorCode.AUTH_005)
    client.delete(f"mm:wx:state:{state}")
    openid, unionid = _resolve_openid(code)
    client.set(f"mm:wx:status:{state}", "confirmed", ex=300)
    result = login_with_openid(db, openid, unionid, "茶友")
    db.commit()
    return result


def dev_login(db: Session, openid: str, nickname: str) -> dict:
    if not settings.wechat_mock:
        raise BizException(ErrorCode.AUTH_006, "开发登录已关闭")
    result = login_with_openid(db, openid, None, nickname)
    db.commit()
    return result


def refresh(db: Session, refresh_token: str) -> dict:
    user_id = token_store.consume_refresh(refresh_token)
    if user_id is None:
        raise BizException(ErrorCode.AUTH_002)
    identity = db.get(UserIdentity, user_id)
    if identity is None or identity.status == "deleted":
        raise BizException(ErrorCode.AUTH_002)
    profile = db.get(UserProfile, user_id)
    role = resolve_role(db, identity.openid)
    return issue_tokens(db, identity, profile.nickname if profile else "茶友", role, identity.status)


def logout(refresh_token: Optional[str], jti: Optional[str]) -> None:
    if jti:
        token_store.revoke_access(jti)
    if refresh_token:
        token_store.revoke_refresh(refresh_token)


def view(db: Session, user_id: int) -> dict:
    identity = db.get(UserIdentity, user_id)
    if identity is None:
        raise BizException(ErrorCode.AUTH_001)
    profile = db.get(UserProfile, user_id)
    return {
        "id": user_id,
        "nickname": profile.nickname if profile else "茶友",
        "avatarUrl": profile.avatar_url if profile else None,
        "role": resolve_role(db, identity.openid).name.lower(),
        "status": identity.status,
    }


def login_with_openid(db: Session, openid: str, unionid: Optional[str], nickname: str) -> dict:
    identity = db.execute(
        select(UserIdentity)
        .where(UserIdentity.openid == openid, UserIdentity.status != "deleted")
        .limit(1)
    ).scalars().first()
    if identity is None:
        identity = UserIdentity(openid=openid, unionid=unionid, status="active", registered_at=now(), last_login_at=now())
        db.add(identity)
        db.flush()
        db.add(UserProfile(user_id=identity.id, nickname=nickname if nickname else "茶友"))
        db.flush()
    else:
        identity.last_login_at = now()
        db.flush()
    profile = db.get(UserProfile, identity.id)
    role = resolve_role(db, openid)
    return issue_tokens(db, identity, profile.nickname if profile else nickname, role, identity.status)


def issue_tokens(db: Session, identity: UserIdentity, nickname: str, role, status: str) -> dict:
    issued: IssuedToken = jwt_service.issue_access_token(identity.id, role, status)
    token_store.mark_access(issued.jti, identity.id, issued.expires_in)
    refresh_token = uuid.uuid4().hex
    token_store.save_refresh(refresh_token, identity.id, settings.refresh_expire_seconds)
    profile = db.get(UserProfile, identity.id)
    return {
        "accessToken": issued.token,
        "refreshToken": refresh_token,
        "expiresIn": issued.expires_in,
        "user": {
            "id": identity.id,
            "nickname": nickname,
            "avatarUrl": profile.avatar_url if profile else None,
            "role": role.name.lower(),
            "status": status,
        },
    }


def resolve_role(db: Session, openid: str) -> "object":
    from app.core.security import Role

    whitelist = db.execute(
        select(AdminWhitelist)
        .where(AdminWhitelist.openid == openid, AdminWhitelist.deleted_at.is_(None))
        .limit(1)
    ).scalars().first()
    if whitelist is None:
        return Role.USER
    return Role.SUPER if whitelist.role == "super" else Role.ADMIN


def _resolve_openid(code: str) -> tuple[str, Optional[str]]:
    """网站扫码（qrconnect/snsapi_login）授权回调的 code 必须用 sns/oauth2/access_token 换取 openid。

    jscode2session 属于小程序登录接口，与本项目的扫码流程不兼容。
    """
    if settings.wechat_mock:
        return f"mock_{code}", None
    if not settings.wechat_app_id or not settings.wechat_app_secret:
        raise BizException(ErrorCode.AUTH_006, "微信登录未配置")
    with httpx.Client(timeout=10) as client:
        response = client.get(
            "https://api.weixin.qq.com/sns/oauth2/access_token",
            params={
                "appid": settings.wechat_app_id,
                "secret": settings.wechat_app_secret,
                "code": code,
                "grant_type": "authorization_code",
            },
        )
        body = response.json()
    if not body or not body.get("openid"):
        raise BizException(ErrorCode.AUTH_006)
    return str(body["openid"]), body.get("unionid")
