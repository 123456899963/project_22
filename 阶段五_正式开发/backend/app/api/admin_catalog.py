"""管理端茶品与分类接口：状态机、审核、上下架与内容建设状态。"""

from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.response import ok, page_result
from app.core.security import Principal, admin_required
from app.services import admin_catalog_service

router = APIRouter()


class TeaWriteRequest(BaseModel):
    name: Optional[str] = None
    categoryId: Optional[int] = None
    subcategoryId: Optional[int] = None
    originSummary: Optional[str] = None
    qualityDesc: Optional[str] = None
    waterTempMin: Optional[int] = None
    waterTempMax: Optional[int] = None
    ratioGrams: Optional[Decimal] = None
    ratioWaterMl: Optional[int] = None
    vessel: Optional[str] = None
    steepSecondsMin: Optional[int] = None
    steepSecondsMax: Optional[int] = None
    steepTimes: Optional[int] = None
    productionYear: Optional[int] = None
    version: Optional[int] = None


class TeaReviewRequest(BaseModel):
    decision: Optional[str] = None
    reason: Optional[str] = None
    version: Optional[int] = None


class ReasonRequest(BaseModel):
    reason: Optional[str] = None


class SubcategoryPatchRequest(BaseModel):
    contentStatus: Optional[str] = None


@router.get("/admin/teas")
def list_teas(
    status: Optional[str] = None,
    category: Optional[str] = None,
    keyword: Optional[str] = None,
    page: int = 1,
    size: int = 12,
    _: Principal = Depends(admin_required),
    db: Session = Depends(get_db),
):
    items, safe_page, safe_size, total = admin_catalog_service.list_teas(
        db, status, category, keyword, page, size
    )
    return ok(page_result(items, safe_page, safe_size, total))


@router.post("/admin/teas")
def create_tea(
    payload: TeaWriteRequest,
    principal: Principal = Depends(admin_required),
    db: Session = Depends(get_db),
):
    return ok(admin_catalog_service.create(db, payload.model_dump(), principal.id))


@router.get("/admin/teas/{tea_id}")
def get_tea(tea_id: int, _: Principal = Depends(admin_required), db: Session = Depends(get_db)):
    return ok(admin_catalog_service.get(db, tea_id))


@router.patch("/admin/teas/{tea_id}")
def update_tea(
    tea_id: int,
    payload: TeaWriteRequest,
    _: Principal = Depends(admin_required),
    db: Session = Depends(get_db),
):
    return ok(admin_catalog_service.update(db, tea_id, payload.model_dump()))


@router.post("/admin/teas/{tea_id}/submit")
def submit_tea(tea_id: int, _: Principal = Depends(admin_required), db: Session = Depends(get_db)):
    admin_catalog_service.submit(db, tea_id)
    return ok()


@router.post("/admin/teas/{tea_id}/review")
def review_tea(
    tea_id: int,
    payload: TeaReviewRequest,
    _: Principal = Depends(admin_required),
    db: Session = Depends(get_db),
):
    admin_catalog_service.review(db, tea_id, payload.decision, payload.reason, payload.version)
    return ok()


@router.post("/admin/teas/{tea_id}/unpublish")
def unpublish_tea(
    tea_id: int,
    payload: ReasonRequest,
    _: Principal = Depends(admin_required),
    db: Session = Depends(get_db),
):
    admin_catalog_service.unpublish(db, tea_id, payload.reason)
    return ok()


@router.post("/admin/teas/{tea_id}/publish")
def publish_tea(
    tea_id: int,
    payload: ReasonRequest,
    _: Principal = Depends(admin_required),
    db: Session = Depends(get_db),
):
    admin_catalog_service.publish(db, tea_id, payload.reason)
    return ok()


@router.delete("/admin/teas/{tea_id}")
def delete_tea(tea_id: int, _: Principal = Depends(admin_required), db: Session = Depends(get_db)):
    admin_catalog_service.delete(db, tea_id)
    return ok()


@router.get("/admin/categories")
def list_categories(_: Principal = Depends(admin_required), db: Session = Depends(get_db)):
    return ok(admin_catalog_service.categories(db))


@router.patch("/admin/categories/{subcategory_id}")
def patch_subcategory(
    subcategory_id: int,
    payload: SubcategoryPatchRequest,
    _: Principal = Depends(admin_required),
    db: Session = Depends(get_db),
):
    admin_catalog_service.patch_subcategory(db, subcategory_id, payload.contentStatus)
    return ok()
