"""站内消息（M09）：审核结果、纠错采纳、举报处理、系统通知。

对应 Java notification.service.MessageService / MessageStatsService。
消息只读不可删除，保留 180 天由清理任务负责。
"""

from datetime import timedelta
from typing import Optional

from sqlalchemy import delete, func, select, update
from sqlalchemy.orm import Session

from app.core.errors import BizException, ErrorCode
from app.core.pagination import normalize
from app.core.timeutil import iso, now
from app.models.notification import Message

TYPES = {"review", "correction", "report", "system"}
RETENTION_DAYS = 180


def list_messages(
    db: Session,
    user_id: int,
    type: Optional[str],
    unread_only: bool,
    page: int,
    size: int,
) -> tuple[list[dict], int]:
    safe_page, safe_size = normalize(page, size)
    stmt = select(Message).where(Message.user_id == user_id)
    if type is not None and type.strip():
        if type not in TYPES:
            raise BizException(ErrorCode.SYS_001, "消息类型不合法")
        stmt = stmt.where(Message.type == type)
    if unread_only:
        stmt = stmt.where(Message.is_read.is_(False))
    stmt = stmt.order_by(Message.created_at.desc(), Message.id.desc())
    total = int(
        db.execute(select(func.count()).select_from(stmt.subquery())).scalar_one()
    )
    rows = db.execute(
        stmt.limit(safe_size).offset((safe_page - 1) * safe_size)
    ).scalars().all()
    items = [
        {
            "id": row.id,
            "type": row.type,
            "title": row.title,
            "summary": row.summary,
            "targetType": row.target_type,
            "targetId": row.target_id,
            "read": bool(row.is_read),
            "createdAt": iso(row.created_at),
        }
        for row in rows
    ]
    return items, total


def count_unread(db: Session, user_id: int) -> int:
    return int(
        db.execute(
            select(func.count())
            .select_from(Message)
            .where(Message.user_id == user_id, Message.is_read.is_(False))
        ).scalar_one()
    )


def mark_read(db: Session, user_id: int, message_id: int) -> None:
    message = db.get(Message, message_id)
    if message is None or message.user_id != user_id:
        raise BizException(ErrorCode.CATALOG_001, "消息不存在")
    if bool(message.is_read):
        return
    message.is_read = True
    message.read_at = now()
    db.commit()


def mark_all_read(db: Session, user_id: int) -> None:
    db.execute(
        update(Message)
        .where(Message.user_id == user_id, Message.is_read.is_(False))
        .values(is_read=True, read_at=now())
    )
    db.commit()


def purge_expired(db: Session, days: int = RETENTION_DAYS) -> int:
    """清理超过保留期的站内消息（PRD/M09：180 天）。返回删除条数。"""
    result = db.execute(
        delete(Message).where(Message.created_at < now() - timedelta(days=days))
    )
    db.commit()
    return int(result.rowcount or 0)


def notify(
    db: Session,
    user_id: int,
    type: str,
    title: str,
    summary: Optional[str] = None,
    target_type: Optional[str] = None,
    target_id: Optional[int] = None,
) -> None:
    """业务动作产生站内消息，由审核/治理/投稿服务在同一事务内调用。

    这里只 flush 不 commit，事务提交由调用方负责，保证业务与消息同成同败。
    """
    db.add(
        Message(
            user_id=user_id,
            type=type,
            title=title,
            summary=summary,
            target_type=target_type,
            target_id=target_id,
            is_read=False,
            created_at=now(),
        )
    )
    db.flush()
