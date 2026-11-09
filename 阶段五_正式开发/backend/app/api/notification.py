"""站内消息接口（M09）：列表附带未读数，便于前台红点与分页共用一次请求。"""

from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.pagination import normalize
from app.core.response import ok, page_result
from app.core.security import Principal, user_required
from app.services import message_service

router = APIRouter(tags=["message"])


@router.get("/me/messages")
def list_messages(
    type: Optional[str] = Query(default=None),
    unreadOnly: bool = Query(default=False),
    page: int = Query(default=1),
    size: int = Query(default=12),
    principal: Principal = Depends(user_required),
    db: Session = Depends(get_db),
):
    safe_page, safe_size = normalize(page, size)
    items, total = message_service.list_messages(
        db, principal.id, type, unreadOnly, safe_page, safe_size
    )
    data = page_result(items, safe_page, safe_size, total)
    data["unread"] = message_service.count_unread(db, principal.id)
    return ok(data)


@router.patch("/me/messages/{id}/read")
def mark_read(
    id: int,
    principal: Principal = Depends(user_required),
    db: Session = Depends(get_db),
):
    message_service.mark_read(db, principal.id, id)
    return ok()


@router.patch("/me/messages/read-all")
def mark_all_read(
    principal: Principal = Depends(user_required),
    db: Session = Depends(get_db),
):
    message_service.mark_all_read(db, principal.id)
    return ok()
