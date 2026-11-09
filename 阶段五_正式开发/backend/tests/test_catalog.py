"""目录读侧：同维 OR、跨维 AND、未录年份、空等级、下架 404。"""

import pytest

from app.core.errors import BizException, ErrorCode
from app.services import catalog_service
from tests.factories import add_grade, create_isolated_category, create_tea


@pytest.fixture
def catalog_set(db):
    _cat_id, _cat_code, sub_id, sub_code = create_isolated_category(db)
    cat_id, cat_code = _cat_id, _cat_code
    special = create_tea(
        db, name="筛选特级", year=2020, category_id=cat_id, subcategory_id=sub_id
    )
    first = create_tea(
        db, name="筛选一级", year=None, category_id=cat_id, subcategory_id=sub_id
    )
    ungraded = create_tea(
        db, name="筛选未分档", year=2021, category_id=cat_id, subcategory_id=sub_id
    )
    add_grade(db, special, "特级", 0)
    add_grade(db, first, "一级", 1)
    return {
        "category": cat_code,
        "subcategory": sub_code,
        "special": special,
        "first": first,
        "ungraded": ungraded,
    }


def test_same_dimension_multiselect_is_union(db, catalog_set):
    items, _page, _size, total = catalog_service.list_teas(
        db,
        {
            "subcategory": catalog_set["subcategory"],
            "grade_values": ["特级", "一级"],
        },
        1,
        10,
    )
    assert total == 2
    assert {item["id"] for item in items} == {catalog_set["special"], catalog_set["first"]}


def test_cross_dimension_is_intersection(db, catalog_set):
    _items, _page, _size, total = catalog_service.list_teas(
        db,
        {
            "category": catalog_set["category"],
            "subcategory": catalog_set["subcategory"],
            "grade_values": ["特级"],
        },
        1,
        10,
    )
    assert total == 1


def test_ungraded_filter_only_returns_empty_grade(db, catalog_set):
    _items, _page, _size, total = catalog_service.list_teas(
        db,
        {
            "subcategory": catalog_set["subcategory"],
            "include_ungraded": True,
        },
        1,
        10,
    )
    assert total == 1


def test_year_filter_excludes_unrecorded_year(db, catalog_set):
    _items, _page, _size, total = catalog_service.list_teas(
        db, {"subcategory": catalog_set["subcategory"], "years": [2020]}, 1, 10
    )
    assert total == 1


def test_offline_tea_detail_returns_404(db):
    cat_id, _cat_code, sub_id, _sub_code = create_isolated_category(db)
    offline = create_tea(
        db, status="offline", category_id=cat_id, subcategory_id=sub_id
    )
    with pytest.raises(BizException) as exc:
        catalog_service.detail(db, offline)
    assert exc.value.spec == ErrorCode.CATALOG_001
