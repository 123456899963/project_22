"""审计日志仓储层：仅封装查询，不做业务判断（ARCHITECTURE §3）"""

from datetime import datetime

from sqlalchemy.orm import Session

from app.models.operation_log import OperationLog
from app.models.user import User


def search(
    db: Session,
    *,
    user_id: int | None = None,
    action: str | None = None,
    start: datetime | None = None,
    end: datetime | None = None,
    offset: int = 0,
    limit: int = 20,
) -> tuple[list[OperationLog], int]:
    """按条件查询审计日志，支持时间范围 + 用户 + 动作筛选。"""
    query = db.query(OperationLog)

    if user_id is not None:
        query = query.filter(OperationLog.user_id == user_id)
    if action:
        query = query.filter(OperationLog.action == action)
    if start is not None:
        query = query.filter(OperationLog.created_at >= start)
    if end is not None:
        query = query.filter(OperationLog.created_at <= end)

    query = query.order_by(OperationLog.created_at.desc(), OperationLog.id.desc())

    total = query.count()
    items = query.offset(offset).limit(limit).all()
    return items, total


def list_all(db: Session, *, limit: int = 500) -> list[OperationLog]:
    """导出用：不限条件拉取（由 Service 层控制 limit）。"""
    return (
        db.query(OperationLog)
        .order_by(OperationLog.created_at.desc(), OperationLog.id.desc())
        .limit(limit)
        .all()
    )


def get_username_map(db: Session, log_ids: list[int]) -> dict[int, str]:
    """左联 users 表：把 log 里的 user_id 映射成 username。"""
    logs = db.query(OperationLog).filter(OperationLog.id.in_(log_ids)).all()
    user_ids = {log.user_id for log in logs if log.user_id is not None}
    if not user_ids:
        return {}
    users = db.query(User.id, User.username).filter(User.id.in_(user_ids)).all()
    return {u.id: u.username for u in users}
