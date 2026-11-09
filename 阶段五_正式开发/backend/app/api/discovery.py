"""发现接口：全站搜索、识茶自查选项与结果、图鉴浏览（游客可访问）。"""

from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.response import ok, page_result
from app.services import discovery_service

router = APIRouter()


class IdentifyRequest(BaseModel):
    shape: Optional[list[str]] = None
    color: Optional[list[str]] = None
    soup: Optional[list[str]] = None
    ferment: Optional[list[str]] = None
    aroma: Optional[list[str]] = None


@router.get("/search")
def search(
    q: Optional[str] = None,
    page: int = 1,
    size: int = 12,
    db: Session = Depends(get_db),
):
    items, safe_page, safe_size, total = discovery_service.search(db, q, page, size)
    return ok(page_result(items, safe_page, safe_size, total))


@router.get("/identify/options")
def identify_options(db: Session = Depends(get_db)):
    return ok(discovery_service.identify_options(db))


@router.post("/identify/results")
def identify_results(
    payload: IdentifyRequest,
    page: int = 1,
    size: int = 12,
    db: Session = Depends(get_db),
):
    return ok(discovery_service.identify_results(db, payload.model_dump(), page, size))


@router.get("/gallery")
def gallery(
    tab: str = "official",
    category: Optional[str] = None,
    page: int = 1,
    size: int = 12,
    db: Session = Depends(get_db),
):
    items, safe_page, safe_size, total = discovery_service.gallery(db, tab, category, page, size)
    return ok(page_result(items, safe_page, safe_size, total))
