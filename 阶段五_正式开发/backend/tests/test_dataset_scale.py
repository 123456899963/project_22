"""规模数据集：46 茶品 / ≥184 图，验证分页、状态可见性与年份筛选（TEST_PLAN §3.2）。"""

from sqlalchemy import func, select

from app.models.catalog import Tea
from app.models.media import MediaImage
from tests.factories import add_grade, add_image, create_isolated_category, create_tea


def test_dataset_scale_supports_pagination_and_filters(client, db):
    category_id, _category_code, subcategory_id, sub_code = create_isolated_category(db)
    created: list[int] = []
    for index in range(46):
        status = "published" if index < 40 else ("draft" if index < 43 else "offline")
        year = None if index % 5 == 0 else 2020 + index % 3
        tea_id = create_tea(
            db,
            name=f"规模茶{index:02d}",
            year=year,
            status=status,
            category_id=category_id,
            subcategory_id=subcategory_id,
        )
        created.append(tea_id)
        if index < 40:
            for seq in range(1, 6):
                add_image(db, tea_id, seq=seq)
        if index % 4 == 1:
            add_grade(db, tea_id, "special", 0)

    image_count = db.scalar(
        select(func.count()).select_from(MediaImage).where(MediaImage.tea_id.in_(created))
    )
    assert image_count >= 184
    assert db.scalar(select(func.count()).select_from(Tea).where(Tea.id.in_(created))) == 46

    page1 = client.get(
        "/api/v1/teas", params={"subcategory": sub_code, "page": 1, "size": 12}
    ).json()["data"]
    page2 = client.get(
        "/api/v1/teas", params={"subcategory": sub_code, "page": 2, "size": 12}
    ).json()["data"]
    assert page1["total"] == 40 and page1["hasMore"] is True
    assert len(page1["items"]) == 12 and len(page2["items"]) == 12
    assert {item["id"] for item in page1["items"]}.isdisjoint(
        {item["id"] for item in page2["items"]}
    )

    all_items = client.get(
        "/api/v1/teas", params={"subcategory": sub_code, "size": 50}
    ).json()["data"]["items"]
    visible_ids = {item["id"] for item in all_items}
    assert visible_ids == set(created[:40])

    year_items = client.get(
        "/api/v1/teas", params={"subcategory": sub_code, "year": 2020, "size": 50}
    ).json()["data"]["items"]
    unrecorded = {
        created[index] for index in range(46) if index < 40 and index % 5 == 0
    }
    assert unrecorded.isdisjoint({item["id"] for item in year_items})
