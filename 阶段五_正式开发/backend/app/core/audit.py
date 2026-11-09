"""审计写入：与业务同事务调用，业务回滚则审计不落库。

对应原 Java audit.AuditService。
"""

import json
from datetime import datetime
from typing import Any, Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.pagination import normalize
from app.core.response import current_request, get_trace_id


class AuditService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def record(
        self,
        action: str,
        object_type: str,
        object_id: Optional[int] = None,
        reason: Optional[str] = None,
        before_state: Any = None,
        after_state: Any = None,
    ) -> None:
        from app.models.audit import AuditLog

        request = current_request()
        principal = getattr(request.state, "principal", None) if request is not None else None
        row = AuditLog(
            operator_id=principal.id if principal else 0,
            operator_role=principal.role.name.lower() if principal else "system",
            action=action,
            object_type=object_type,
            object_id=object_id,
            reason=reason,
            before_state=self._to_json(before_state),
            after_state=self._to_json(after_state),
            ip=self._client_ip(request),
            request_id=get_trace_id() or None,
        )
        self.db.add(row)
        self.db.flush()

    def search(
        self,
        operator_id: Optional[int],
        action: Optional[str],
        start: Optional[datetime],
        end: Optional[datetime],
        page: int,
        size: int,
    ) -> tuple[list, int]:
        from app.models.audit import AuditLog

        page, size = normalize(page, size)
        stmt = select(AuditLog)
        if operator_id is not None:
            stmt = stmt.where(AuditLog.operator_id == operator_id)
        if action:
            stmt = stmt.where(AuditLog.action == action.strip())
        if start is not None:
            stmt = stmt.where(AuditLog.created_at >= start)
        if end is not None:
            stmt = stmt.where(AuditLog.created_at <= end)
        total = len(self.db.execute(stmt).scalars().all())
        rows = (
            self.db.execute(stmt.order_by(AuditLog.id.desc()).limit(size).offset((page - 1) * size))
            .scalars()
            .all()
        )
        return rows, total

    def export(
        self,
        operator_id: Optional[int],
        action: Optional[str],
        start: Optional[datetime],
        end: Optional[datetime],
    ) -> list:
        from app.models.audit import AuditLog

        stmt = select(AuditLog)
        if operator_id is not None:
            stmt = stmt.where(AuditLog.operator_id == operator_id)
        if action:
            stmt = stmt.where(AuditLog.action == action.strip())
        if start is not None:
            stmt = stmt.where(AuditLog.created_at >= start)
        if end is not None:
            stmt = stmt.where(AuditLog.created_at <= end)
        return self.db.execute(stmt.order_by(AuditLog.id.desc()).limit(5000)).scalars().all()

    def latest_reason(self, action: str, object_type: str, object_id: int) -> Optional[str]:
        from app.models.audit import AuditLog

        row = self.db.execute(
            select(AuditLog)
            .where(
                AuditLog.action == action,
                AuditLog.object_type == object_type,
                AuditLog.object_id == object_id,
            )
            .order_by(AuditLog.id.desc())
            .limit(1)
        ).scalars().first()
        return row.reason if row else None

    @staticmethod
    def _to_json(value: Any) -> Optional[str]:
        if value is None:
            return None
        try:
            return json.dumps(value, ensure_ascii=False, default=str)
        except (TypeError, ValueError):
            return '{"note":"serialize_failed"}'

    @staticmethod
    def _client_ip(request: Any) -> Optional[str]:
        if request is None:
            return None
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            return forwarded.split(",")[0].strip()
        return request.client.host if request.client else None
