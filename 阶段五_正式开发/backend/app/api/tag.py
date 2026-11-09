"""标签词表接口：公共五维选项与后台标签库/新增申请审核。"""

from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.response import ok
from app.core.security import Principal, admin_required
from app.services import tag_service

router = APIRouter()


class TagCreateRequest(BaseModel):
    dimension: str = Field(min_length=1)
    name: str = Field(min_length=1, max_length=32)


class TagStatusRequest(BaseModel):
    status: str = Field(min_length=1)


class TagRequestReviewRequest(BaseModel):
    decision: str = Field(min_length=1)
    reason: Optional[str] = Field(default=None, max_length=200)


# ---------------- 公共词表 ----------------

@router.get("/tags")
def list_tags(db: Session = Depends(get_db)):
    return ok(tag_service.list_enabled(db))


# ---------------- 后台标签库 ----------------

@router.get("/admin/tags")
def admin_list_tags(
    dimension: Optional[str] = None,
    status: Optional[str] = None,
    _: Principal = Depends(admin_required),
    db: Session = Depends(get_db),
):
    return ok(tag_service.list_tags(db, dimension, status))


@router.post("/admin/tags")
def create_tag(
    payload: TagCreateRequest,
    _: Principal = Depends(admin_required),
    db: Session = Depends(get_db),
):
    return ok(tag_service.create(db, payload.dimension, payload.name))


@router.patch("/admin/tags/{tag_id}")
def update_tag_status(
    tag_id: int,
    payload: TagStatusRequest,
    _: Principal = Depends(admin_required),
    db: Session = Depends(get_db),
):
    return ok(tag_service.update_status(db, tag_id, payload.status))


# ---------------- 后台标签新增申请 ----------------

@router.get("/admin/tag-requests")
def list_tag_requests(
    status: Optional[str] = None,
    _: Principal = Depends(admin_required),
    db: Session = Depends(get_db),
):
    return ok(tag_service.list_requests(db, status))


@router.post("/admin/tag-requests/{request_id}/review")
def review_tag_request(
    request_id: int,
    payload: TagRequestReviewRequest,
    principal: Principal = Depends(admin_required),
    db: Session = Depends(get_db),
):
    tag_service.review_request(db, request_id, payload.decision, payload.reason, principal.id)
    return ok()
