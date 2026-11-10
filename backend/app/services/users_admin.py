"""用户管理业务层"""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.core.response import TeaGuideError
from app.repositories import user_admin_repo
from app.schemas.users_admin import AdminUserItem, AdminUserListData


def list_users(
    db: Session,
    *,
    role: str | None = None,
    keyword: str | None = None,
    page: int = 1,
    page_size: int = 20,
) -> AdminUserListData:
    safe_page = max(page, 1)
    safe_size = min(max(page_size, 1), 50)
    items, total = user_admin_repo.list_users(
        db, role=role, keyword=keyword, offset=(safe_page - 1) * safe_size, limit=safe_size
    )
    return AdminUserListData(
        items=[
            AdminUserItem(id=u.id, username=u.username, role=u.role, created_at=u.created_at)
            for u in items
        ],
        total=total,
        page=safe_page,
        page_size=safe_size,
    )


def update_user_role(db: Session, *, user_id: int, role: str) -> None:
    user = user_admin_repo.get_by_id(db, user_id)
    if user is None:
        raise TeaGuideError(40400, "用户不存在")
    user_admin_repo.update_role(db, user, role)
    db.commit()
