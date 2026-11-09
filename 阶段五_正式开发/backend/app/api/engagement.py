"""收藏 / 浏览历史 / 对比 / 评论接口（M06）。"""

from typing import Optional

from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.pagination import normalize
from app.core.response import ok, page_result
from app.core.security import Principal, user_required
from app.services import engagement_service

router = APIRouter(tags=["engagement"])


class FavoriteRequest(BaseModel):
    teaId: Optional[int] = None
    group: Optional[str] = None


class HistoryRequest(BaseModel):
    teaId: Optional[int] = None


class CompareRequest(BaseModel):
    teaId: Optional[int] = None


class CommentCreateRequest(BaseModel):
    content: Optional[str] = None
    imageId: Optional[int] = None


@router.get("/me/favorites")
def favorites(
    group: Optional[str] = Query(default=None),
    page: int = Query(default=1),
    size: int = Query(default=12),
    principal: Principal = Depends(user_required),
    db: Session = Depends(get_db),
):
    safe_page, safe_size = normalize(page, size)
    items, total = engagement_service.favorites(
        db, principal.id, group, safe_page, safe_size
    )
    return ok(page_result(items, safe_page, safe_size, total))


@router.post("/me/favorites")
def add_favorite(
    payload: FavoriteRequest,
    principal: Principal = Depends(user_required),
    db: Session = Depends(get_db),
):
    engagement_service.add_favorite(db, principal.id, payload.teaId, payload.group)
    return ok()


@router.patch("/me/favorites/{teaId}")
def move_favorite(
    teaId: int,
    payload: FavoriteRequest,
    principal: Principal = Depends(user_required),
    db: Session = Depends(get_db),
):
    engagement_service.move_favorite(db, principal.id, teaId, payload.group)
    return ok()


@router.delete("/me/favorites/{teaId}")
def remove_favorite(
    teaId: int,
    principal: Principal = Depends(user_required),
    db: Session = Depends(get_db),
):
    engagement_service.remove_favorite(db, principal.id, teaId)
    return ok()


@router.get("/me/history")
def history(
    page: int = Query(default=1),
    size: int = Query(default=12),
    principal: Principal = Depends(user_required),
    db: Session = Depends(get_db),
):
    safe_page, safe_size = normalize(page, size)
    items, total = engagement_service.history(db, principal.id, safe_page, safe_size)
    return ok(page_result(items, safe_page, safe_size, total))


@router.post("/me/history")
def record_history(
    payload: HistoryRequest,
    principal: Principal = Depends(user_required),
    db: Session = Depends(get_db),
):
    engagement_service.record_history(db, principal.id, payload.teaId)
    return ok()


@router.delete("/me/history")
def clear_history(
    principal: Principal = Depends(user_required),
    db: Session = Depends(get_db),
):
    engagement_service.clear_history(db, principal.id)
    return ok()


@router.get("/me/compare")
def compare(
    principal: Principal = Depends(user_required),
    db: Session = Depends(get_db),
):
    return ok(engagement_service.compare(db, principal.id))


@router.post("/me/compare")
def add_compare(
    payload: CompareRequest,
    principal: Principal = Depends(user_required),
    db: Session = Depends(get_db),
):
    return ok(engagement_service.add_compare(db, principal.id, payload.teaId))


@router.delete("/me/compare")
def remove_compare(
    teaId: Optional[int] = Query(default=None),
    principal: Principal = Depends(user_required),
    db: Session = Depends(get_db),
):
    return ok(engagement_service.remove_compare(db, principal.id, teaId))


@router.get("/teas/compare")
def compare_by_ids(
    ids: list[int] = Query(...),
    _: Principal = Depends(user_required),
    db: Session = Depends(get_db),
):
    return ok(engagement_service.compare_by_ids(db, ids))


@router.get("/teas/{teaId}/comments")
def comments(
    teaId: int,
    request: Request,
    page: int = Query(default=1),
    size: int = Query(default=12),
    db: Session = Depends(get_db),
):
    viewer = getattr(request.state, "principal", None)
    safe_page, safe_size = normalize(page, size)
    items, total = engagement_service.comments(
        db, teaId, viewer.id if viewer else None, safe_page, safe_size
    )
    return ok(page_result(items, safe_page, safe_size, total))


@router.post("/teas/{teaId}/comments")
def add_comment(
    teaId: int,
    payload: CommentCreateRequest,
    principal: Principal = Depends(user_required),
    db: Session = Depends(get_db),
):
    return ok(
        engagement_service.add_comment(
            db, principal.id, teaId, payload.content, payload.imageId
        )
    )


@router.delete("/me/comments/{id}")
def delete_comment(
    id: int,
    principal: Principal = Depends(user_required),
    db: Session = Depends(get_db),
):
    engagement_service.delete_comment(db, principal.id, id)
    return ok()


@router.post("/comments/{id}/like")
def like_comment(
    id: int,
    principal: Principal = Depends(user_required),
    db: Session = Depends(get_db),
):
    engagement_service.like_comment(db, principal.id, id)
    return ok()


@router.delete("/comments/{id}/like")
def unlike_comment(
    id: int,
    principal: Principal = Depends(user_required),
    db: Session = Depends(get_db),
):
    engagement_service.unlike_comment(db, principal.id, id)
    return ok()
