"""用户管理仓储层：列表 + 角色更新"""

from sqlalchemy.orm import Session

from app.models.user import User


def list_users(
    db: Session,
    *,
    role: str | None = None,
    keyword: str | None = None,
    offset: int = 0,
    limit: int = 20,
) -> tuple[list[User], int]:
    query = db.query(User)
    if role:
        query = query.filter(User.role == role)
    if keyword:
        query = query.filter(User.username.like(f"%{keyword}%"))
    query = query.order_by(User.created_at.desc(), User.id.desc())
    total = query.count()
    items = query.offset(offset).limit(limit).all()
    return items, total


def get_by_id(db: Session, user_id: int) -> User | None:
    return db.query(User).filter(User.id == user_id).first()


def update_role(db: Session, user: User, role: str) -> None:
    user.role = role
