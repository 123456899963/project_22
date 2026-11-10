"""审计日志业务层：查询 + 分页 + CSV 导出"""

from __future__ import annotations

import csv
import io
from datetime import datetime

from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.repositories import audit_repo
from app.schemas.audit import AuditLogItem, AuditLogListData


def list_logs(
    db: Session,
    *,
    user_id: int | None = None,
    action: str | None = None,
    start: datetime | None = None,
    end: datetime | None = None,
    page: int = 1,
    page_size: int = 20,
) -> AuditLogListData:
    """审计日志分页查询（管理员只读）。"""
    safe_page = max(page, 1)
    safe_size = min(max(page_size, 1), 50)
    offset = (safe_page - 1) * safe_size

    items, total = audit_repo.search(
        db,
        user_id=user_id,
        action=action,
        start=start,
        end=end,
        offset=offset,
        limit=safe_size,
    )

    # 批量查出 username（左联 users）
    username_map = audit_repo.get_username_map(db, [log.id for log in items])

    item_list = [
        AuditLogItem(
            id=log.id,
            user_id=log.user_id,
            username=username_map.get(log.id),
            action=log.action,
            target_type=log.target_type,
            target_id=log.target_id,
            detail=log.detail,
            created_at=log.created_at,
        )
        for log in items
    ]

    return AuditLogListData(
        items=item_list,
        total=total,
        page=safe_page,
        page_size=safe_size,
    )


def export_csv(db: Session, *, limit: int = 2000) -> StreamingResponse:
    """CSV 导出（最多 2000 条，避免超大文件）。"""
    items = audit_repo.list_all(db, limit=limit)
    username_map = audit_repo.get_username_map(db, [log.id for log in items])

    buf = io.StringIO(newline="")
    writer = csv.writer(buf)
    writer.writerow(
        ["id", "user_id", "username", "action", "target_type", "target_id", "detail", "created_at"]
    )
    for log in items:
        writer.writerow(
            [
                log.id,
                log.user_id or "",
                username_map.get(log.id) or "",
                log.action,
                log.target_type or "",
                log.target_id or "",
                (log.detail or "").replace("\n", " "),
                log.created_at.strftime("%Y-%m-%d %H:%M:%S") if log.created_at else "",
            ]
        )

    buf.seek(0)
    return StreamingResponse(
        iter([buf.read().encode("utf-8-sig")]),
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": 'attachment; filename="audit-logs.csv"',
        },
    )
