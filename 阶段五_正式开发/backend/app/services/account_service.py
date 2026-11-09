"""账号资料、个人中心聚合与注销冷静期。

申请注销后立即吊销该账号全部 access 令牌，只有撤销注销（DELETE /me/deletion）在 deleting 状态下放行。
"""

from datetime import timedelta
from typing import Collection

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.errors import BizException, ErrorCode
from app.core.security import token_store
from app.core.timeutil import iso, now
from app.models.account import AccountDeletionRequest, UserIdentity, UserProfile
from app.services import auth_service

COOLING_DAYS = 7


def get_profile(db: Session, user_id: int) -> dict:
    return auth_service.view(db, user_id)


def update_profile(db: Session, user_id: int, nickname: str | None, avatar_url: str | None) -> dict:
    if nickname is None and avatar_url is None:
        raise BizException(ErrorCode.SYS_001, "昵称与头像至少修改一项")
    profile = db.get(UserProfile, user_id)
    if profile is None:
        raise BizException(ErrorCode.AUTH_001)
    if nickname is not None:
        profile.nickname = nickname.strip()
    if avatar_url is not None:
        profile.avatar_url = avatar_url.strip() or None
    db.flush()
    db.commit()
    return auth_service.view(db, user_id)


def profiles_by_ids(db: Session, user_ids: Collection[int]) -> dict[int, dict]:
    if not user_ids:
        return {}
    rows = db.execute(select(UserProfile).where(UserProfile.user_id.in_(list(user_ids)))).scalars().all()
    return {row.user_id: {"nickname": row.nickname, "avatarUrl": row.avatar_url} for row in rows}


def overview(db: Session, user_id: int) -> dict:
    from app.services import engagement_service, message_service, submission_service

    return {
        "favorites": engagement_service.count_favorites(db, user_id),
        "history": engagement_service.count_history(db, user_id),
        "submissions": submission_service.count_submissions(db, user_id),
        "unread": message_service.count_unread(db, user_id),
    }


def admin_search(db: Session, keyword: str | None, page: int, size: int) -> tuple[list[dict], int]:
    from app.core.pagination import normalize

    page, size = normalize(page, size)
    stmt = select(UserIdentity)
    if keyword and keyword.strip():
        trimmed = keyword.strip()
        if trimmed.isdigit():
            stmt = stmt.where(UserIdentity.id == int(trimmed))
        else:
            ids = (
                db.execute(select(UserProfile.user_id).where(UserProfile.nickname.like(f"%{trimmed}%")))
                .scalars()
                .all()
            )
            if not ids:
                return [], 0
            stmt = stmt.where(UserIdentity.id.in_(list(ids)))
    total = db.execute(select(func.count()).select_from(stmt.subquery())).scalar_one()
    rows = (
        db.execute(stmt.order_by(UserIdentity.registered_at.desc()).limit(size).offset((page - 1) * size))
        .scalars()
        .all()
    )
    profiles = profiles_by_ids(db, [row.id for row in rows])
    items = [
        {
            "id": row.id,
            "nickname": profiles.get(row.id, {}).get("nickname", "茶友"),
            "avatarUrl": profiles.get(row.id, {}).get("avatarUrl"),
            "status": row.status,
            "registeredAt": iso(row.registered_at),
        }
        for row in rows
    ]
    return items, total


def request_deletion(db: Session, user_id: int) -> dict:
    existing = _find_pending(db, user_id)
    if existing is not None:
        return _to_view(existing)
    current = now()
    request = AccountDeletionRequest(
        user_id=user_id,
        requested_at=current,
        effective_at=current + timedelta(days=COOLING_DAYS),
        status="pending",
    )
    db.add(request)
    identity = db.get(UserIdentity, user_id)
    if identity is None:
        raise BizException(ErrorCode.AUTH_001)
    identity.status = "deleting"
    db.flush()
    db.commit()
    token_store.revoke_all_access(user_id)
    return _to_view(request)


def cancel_deletion(db: Session, user_id: int) -> None:
    pending = _find_pending(db, user_id)
    if pending is None:
        raise BizException(ErrorCode.CATALOG_002, "当前没有待撤销的注销申请")
    pending.status = "cancelled"
    pending.cancelled_at = now()
    identity = db.get(UserIdentity, user_id)
    if identity is not None and identity.status == "deleting":
        identity.status = "active"
    db.commit()


def _find_pending(db: Session, user_id: int) -> AccountDeletionRequest | None:
    return db.execute(
        select(AccountDeletionRequest)
        .where(
            AccountDeletionRequest.user_id == user_id,
            AccountDeletionRequest.status == "pending",
        )
        .order_by(AccountDeletionRequest.requested_at.desc())
        .limit(1)
    ).scalars().first()


def _to_view(request: AccountDeletionRequest) -> dict:
    return {
        "status": request.status,
        "requestedAt": iso(request.requested_at),
        "effectiveAt": iso(request.effective_at),
    }
