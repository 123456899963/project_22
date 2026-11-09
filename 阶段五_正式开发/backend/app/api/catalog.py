"""前台茶品目录接口：首页、分类、列表筛选与详情（路径由 main 挂 /api/v1）。"""

from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.response import ok, page_result
from app.services import catalog_service

router = APIRouter()

DEFAULT_SORT = "updated_desc"
SUPPORTED_SORTS = ("updated_desc", "name_pinyin", "grade_desc")


@router.get("/home")
def home(db: Session = Depends(get_db)):
    return ok(catalog_service.home(db))


@router.get("/categories")
def categories(db: Session = Depends(get_db)):
    return ok(catalog_service.categories(db))


@router.get("/categories/{code}")
def category_detail(code: str, db: Session = Depends(get_db)):
    return ok(catalog_service.category_detail(db, code))


@router.get("/teas")
def list_teas(
    category: Optional[str] = None,
    subcategory: Optional[str] = None,
    region: Optional[list[str]] = Query(default=None),
    ferment: Optional[list[str]] = Query(default=None),
    aroma: Optional[list[str]] = Query(default=None),
    season: Optional[list[str]] = Query(default=None),
    grade: Optional[list[str]] = Query(default=None),
    year: Optional[list[int]] = Query(default=None),
    sort: str = DEFAULT_SORT,
    page: int = 1,
    size: int = 12,
    db: Session = Depends(get_db),
):
    items, safe_page, safe_size, total = catalog_service.list_teas(
        db,
        _build_filter(category, subcategory, region, ferment, aroma, season, grade, year, sort),
        page,
        size,
    )
    return ok(page_result(items, safe_page, safe_size, total))


@router.get("/teas/{tea_id}")
def tea_detail(tea_id: int, db: Session = Depends(get_db)):
    return ok(catalog_service.detail(db, tea_id))


def _build_filter(
    category: Optional[str],
    subcategory: Optional[str],
    regions: Optional[list[str]],
    ferments: Optional[list[str]],
    aromas: Optional[list[str]],
    seasons: Optional[list[str]],
    grades: Optional[list[str]],
    years: Optional[list[int]],
    sort: Optional[str],
) -> dict:
    include_ungraded = False
    grade_values: list[str] = []
    if grades:
        for value in grades:
            if value == "未分档":
                include_ungraded = True
            elif value.strip():
                grade_values.append(value)
    return {
        "category": _blank_to_null(category),
        "subcategory": _blank_to_null(subcategory),
        "regions": _non_empty(regions),
        "ferments": _non_empty(ferments),
        "aromas": _non_empty(aromas),
        "seasons": _non_empty(seasons),
        "grade_values": grade_values or None,
        "include_ungraded": include_ungraded,
        "years": years or None,
        "sort": sort if sort in SUPPORTED_SORTS else DEFAULT_SORT,
    }


def _non_empty(values: Optional[list[str]]) -> Optional[list[str]]:
    if not values:
        return None
    filtered = [value for value in values if value and value.strip()]
    return filtered or None


def _blank_to_null(value: Optional[str]) -> Optional[str]:
    return None if value is None or not value.strip() else value
