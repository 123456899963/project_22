"""用户仓储层：仅封装 SQLAlchemy 查询，不做业务判断（ARCHITECTURE §3 红线）"""

from sqlalchemy.orm import Session

from app.models.operation_log import OperationLog
from app.models.user import User


def get_by_username(db: Session, username: str) -> User | None:
    """按用户名查询（登录、注册查重、可用性校验共用）。"""
    return db.query(User).filter(User.username == username).first()


def get_by_id(db: Session, user_id: int) -> User | None:
    """按主键查询（会话鉴权后取用户实体）。"""
    return db.query(User).filter(User.id == user_id).first()


def create_user(db: Session, username: str, password_hash: str) -> User:
    """创建新用户。调用方负责唯一性判断；唯一冲突由 IntegrityError 上抛给 Service 处理。"""
    user = User(username=username, password_hash=password_hash)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def update_avatar(db: Session, user_id: int, avatar_url: str) -> User | None:
    """写入头像地址（ADR-0004）。记录不存在返回 None。"""
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        return None
    user.avatar_url = avatar_url
    db.commit()
    db.refresh(user)
    return user


def add_avatar_log(db: Session, user_id: int, detail: str) -> OperationLog:
    """头像变更留痕（SECURITY S-35）；由调用方提交事务。"""
    log = OperationLog(
        user_id=user_id,
        action="avatar_update",
        target_type="user",
        target_id=user_id,
        detail=detail[:500],
    )
    db.add(log)
    return log
