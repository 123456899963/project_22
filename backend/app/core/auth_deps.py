"""认证依赖：当前用户 / 管理员用户注入（SECURITY S-08 / S-11）

- get_current_user：验签 Cookie → 按 uid 查库 → 返回 User；失败抛 40100
- get_admin_user：在 get_current_user 基础上判断 role=='admin'，否则 40300
- 角色每次从 users.role 实时读取，不在 Cookie 中缓存
"""

from fastapi import Cookie, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.response import UserForbidden, UserUnauthorized
from app.core.security import verify_session_token
from app.models.user import User
from app.services import auth as auth_service


def get_current_user(
    tea_session: str | None = Cookie(default=None),
    db: Session = Depends(get_db),
) -> User:
    """从 HttpOnly Cookie 解析当前登录用户。

    无 Cookie / 签名无效 / 过期 / 用户不存在 → 40100。
    """
    if not tea_session:
        raise UserUnauthorized

    user_id = verify_session_token(tea_session)
    if user_id is None:
        raise UserUnauthorized

    user = auth_service.get_by_id(db, user_id)
    if user is None:
        raise UserUnauthorized
    return user


def get_optional_user(
    tea_session: str | None = Cookie(default=None),
    db: Session = Depends(get_db),
) -> User | None:
    """可选登录态（公开分享页计算 is_owner）：无/无效 Cookie 返回 None。"""
    if not tea_session:
        return None
    user_id = verify_session_token(tea_session)
    if user_id is None:
        return None
    return auth_service.get_by_id(db, user_id)


def get_admin_user(current_user: User = Depends(get_current_user)) -> User:
    """要求当前用户为管理员，否则 40300（SECURITY S-11）。"""
    if current_user.role != "admin":
        raise UserForbidden
    return current_user
