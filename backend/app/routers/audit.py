"""审计日志路由（管理员只读，API_CONTRACT 补充端点）

路径前缀：/api/v1/admin（由 main.py 统一 include）。
鉴权：router 级 Depends(get_admin_user)，所有管理员均可查询；CSV 导出限超管（users.role='admin' 也可，因 MVP 只有 admin 一个管理员角色）。
"""

from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.auth_deps import get_admin_user
from app.core.database import get_db
from app.core.response import ok
from app.services import audit as audit_service

router = APIRouter(dependencies=[Depends(get_admin_user)])


def _parse_dt(value: str | None) -> datetime | None:
    """前端传 ISO 格式字符串，解析失败返回 None（不抛 400，容错）。"""
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


@router.get("/audit-logs")
def list_audit_logs(
    user_id: int | None = Query(None, description="操作者 user_id"),
    action: str | None = Query(None, description="动作名，如 create_tea"),
    start: str | None = Query(None, alias="from", description="起始时间 ISO 8601"),
    end: str | None = Query(None, alias="to", description="结束时间 ISO 8601"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=50),
    db: Session = Depends(get_db),
):
    """GET /admin/audit-logs 审计日志分页查询（管理员只读）。"""
    data = audit_service.list_logs(
        db,
        user_id=user_id,
        action=action,
        start=_parse_dt(start),
        end=_parse_dt(end),
        page=page,
        page_size=page_size,
    )
    return ok(data.model_dump(mode="json"))


@router.get("/audit-logs/export")
def export_audit_logs(
    db: Session = Depends(get_db),
):
    """GET /admin/audit-logs/export CSV 导出（最多 2000 条）。"""
    return audit_service.export_csv(db)
