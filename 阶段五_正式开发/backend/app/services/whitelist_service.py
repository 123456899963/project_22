"""管理员白名单：openid 决定角色；变更即时失效目标账号令牌；任何时刻至少保留 1 名超管。"""

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.audit import AuditService
from app.core.errors import BizException, ErrorCode
from app.core.security import token_store
from app.core.timeutil import iso, now
from app.models.account import AdminWhitelist, UserIdentity


def _mask_openid(openid: str | None) -> str:
    if not openid or len(openid) <= 8:
        return "****"
    return openid[:4] + "****" + openid[-4:]


def _to_view(row: AdminWhitelist) -> dict:
    return {
        "id": row.id,
        "userId": row.user_id,
        "openidMasked": _mask_openid(row.openid),
        "role": row.role,
        "note": row.note,
        "createdAt": iso(row.created_at),
    }


def list_whitelist(db: Session) -> list[dict]:
    rows = (
        db.execute(
            select(AdminWhitelist)
            .where(AdminWhitelist.deleted_at.is_(None))
            .order_by(AdminWhitelist.created_at.desc())
        )
        .scalars()
        .all()
    )
    return [_to_view(row) for row in rows]


def add(db: Session, openid: str, role: str | None, note: str | None, operator_id: int) -> dict:
    if role not in ("admin", "super"):
        raise BizException(ErrorCode.SYS_001, "角色只能是 admin 或 super")
    trimmed = openid.strip()
    existing = db.execute(
        select(AdminWhitelist)
        .where(AdminWhitelist.openid == trimmed, AdminWhitelist.deleted_at.is_(None))
        .limit(1)
    ).scalars().first()
    if existing is not None:
        raise BizException(ErrorCode.GOV_004, "该 openid 已在白名单中")
    identity = db.execute(
        select(UserIdentity)
        .where(UserIdentity.openid == trimmed, UserIdentity.status != "deleted")
        .limit(1)
    ).scalars().first()

    whitelist = AdminWhitelist(
        openid=trimmed,
        user_id=identity.id if identity else None,
        role=role,
        note=note.strip() if note and note.strip() else None,
        created_by=operator_id,
        created_at=now(),
    )
    db.add(whitelist)
    db.flush()
    if identity is not None:
        token_store.revoke_all_access(identity.id)
    AuditService(db).record(
        "whitelist_add", "admin_whitelist", whitelist.id, note, None, {"role": role}
    )
    db.commit()
    return _to_view(whitelist)


def remove(db: Session, whitelist_id: int, operator_id: int) -> None:
    whitelist = db.get(AdminWhitelist, whitelist_id)
    if whitelist is None or whitelist.deleted_at is not None:
        raise BizException(ErrorCode.CATALOG_001, "白名单记录不存在")
    if whitelist.user_id == operator_id:
        raise BizException(ErrorCode.GOV_003, "不能移除自己的管理员权限")
    if whitelist.role == "super":
        other_supers = db.execute(
            select(func.count()).select_from(AdminWhitelist).where(
                AdminWhitelist.role == "super",
                AdminWhitelist.deleted_at.is_(None),
                AdminWhitelist.id != whitelist_id,
            )
        ).scalar_one()
        if other_supers == 0:
            raise BizException(ErrorCode.GOV_004)
    whitelist.deleted_at = now()
    db.flush()
    if whitelist.user_id is not None:
        token_store.revoke_all_access(whitelist.user_id)
    AuditService(db).record(
        "whitelist_remove", "admin_whitelist", whitelist_id, None, {"role": whitelist.role}, None
    )
    db.commit()
