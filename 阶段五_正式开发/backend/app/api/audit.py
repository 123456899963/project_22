"""审计日志只读查询；导出仅超管（CSV）。"""

from datetime import datetime
from typing import Any, Optional

from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.core.audit import AuditService
from app.core.db import get_db
from app.core.errors import BizException, ErrorCode
from app.core.response import ok, page_result
from app.core.security import Principal, admin_required
from app.core.timeutil import iso

router = APIRouter()


def _parse(value: Optional[str]) -> Optional[datetime]:
    if not value or not value.strip():
        return None
    try:
        return datetime.fromisoformat(value.strip())
    except ValueError as exc:
        raise BizException(ErrorCode.SYS_001, "时间格式需为 ISO 8601") from exc


def _view(row: Any, include_state: bool = True) -> dict:
    payload = {
        "id": row.id,
        "operatorId": row.operator_id,
        "operatorRole": row.operator_role,
        "action": row.action,
        "objectType": row.object_type,
        "objectId": row.object_id,
        "reason": row.reason,
        "ip": row.ip,
        "requestId": row.request_id,
        "createdAt": iso(row.created_at),
    }
    if include_state:
        payload["beforeState"] = row.before_state
        payload["afterState"] = row.after_state
    return payload


def _escape(value: Any) -> str:
    if value is None:
        return ""
    return '"' + str(value).replace('"', '""') + '"'


@router.get("/admin/audit-logs")
def list_audit_logs(
    operator: Optional[int] = None,
    action: Optional[str] = None,
    start: Optional[str] = Query(default=None, alias="from"),
    end: Optional[str] = Query(default=None, alias="to"),
    page: int = 1,
    size: int = 12,
    export: bool = False,
    principal: Principal = Depends(admin_required),
    db: Session = Depends(get_db),
):
    from_time, to_time = _parse(start), _parse(end)
    service = AuditService(db)
    if export:
        if not principal.role.name == "SUPER":
            raise BizException(ErrorCode.AUTH_003)
        rows = service.export(operator, action, from_time, to_time)
        lines = ["\ufeffid,operatorId,role,action,objectType,objectId,reason,ip,requestId,createdAt\n"]
        for row in rows:
            lines.append(
                f"{row.id},{row.operator_id},{_escape(row.operator_role)},{_escape(row.action)},"
                f"{_escape(row.object_type)},{row.object_id or ''},{_escape(row.reason)},{_escape(row.ip)},"
                f"{_escape(row.request_id)},"
                f"{row.created_at.strftime('%Y-%m-%d %H:%M:%S') if row.created_at else ''}\n"
            )
        return Response(
            content="".join(lines).encode("utf-8"),
            media_type="text/csv; charset=utf-8",
            headers={"Content-Disposition": "attachment; filename=audit-logs.csv"},
        )
    rows, total = service.search(operator, action, from_time, to_time, page, size)
    safe_page, safe_size = max(page, 1), min(max(size, 1), 50)
    return ok(page_result([_view(row) for row in rows], safe_page, safe_size, total))
