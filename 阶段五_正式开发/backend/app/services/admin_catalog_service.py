"""管理端茶品（M02）：状态机唯一迁移点（draft → pending → published ↔ offline）。

对应原 Java com.mingmai.catalog.service.AdminCatalogService；审核、上下架动作同事务写审计。
"""

import random
import time
from typing import Any, Mapping

from sqlalchemy import func, select, text, update
from sqlalchemy.orm import Session

from app.core.audit import AuditService
from app.core.errors import BizException, ErrorCode
from app.core.pagination import normalize
from app.core.storage import storage_service
from app.core.timeutil import iso, now
from app.models.catalog import (
    Tea,
    TeaCategory,
    TeaSubcategory,
    TeaTag,
)
from app.models.media import MediaImage
from app.models.tag import Tag
from app.services.catalog_service import TAG_DIMENSIONS

_IMAGE_TYPE_ORDER = "FIELD(image_type,'dry','soup','leaf','pack','detail')"


def list_teas(
    db: Session,
    status: str | None,
    category: str | None,
    keyword: str | None,
    page: int,
    size: int,
) -> tuple[list[dict], int, int, int]:
    page, size = normalize(page, size)
    stmt = select(Tea).where(Tea.deleted_at.is_(None))
    if status is not None and status.strip():
        stmt = stmt.where(Tea.status == status.strip())
    if keyword is not None and keyword.strip():
        stmt = stmt.where(Tea.name.like("%" + keyword.strip() + "%"))
    if category is not None and category.strip():
        category_row = db.execute(
            select(TeaCategory).where(TeaCategory.code == category.strip()).limit(1)
        ).scalars().first()
        if category_row is None:
            raise BizException(ErrorCode.CATALOG_001, "茶类不存在")
        stmt = stmt.where(Tea.category_id == category_row.id)

    total = int(db.execute(select(func.count()).select_from(stmt.subquery())).scalar_one())
    rows = (
        db.execute(
            stmt.order_by(Tea.last_update_at.desc(), Tea.id.desc())
            .limit(size)
            .offset((page - 1) * size)
        )
        .scalars()
        .all()
    )

    category_names = {
        row.id: row.name for row in db.execute(select(TeaCategory)).scalars().all()
    }
    sub_names = {
        row.id: row.name for row in db.execute(select(TeaSubcategory)).scalars().all()
    }
    items = [_to_item(tea, category_names, sub_names) for tea in rows]
    return items, page, size, total


def get(db: Session, tea_id: int) -> dict:
    tea = _require_tea(db, tea_id)
    images = _images_by_tea(db, tea_id)
    reject_reason = AuditService(db).latest_reason("tea_review", "tea", tea_id)
    return {
        "id": tea.id,
        "teaCode": tea.tea_code,
        "name": tea.name,
        "namePinyin": tea.name_pinyin,
        "nameInitials": tea.name_initials,
        "categoryId": tea.category_id,
        "subcategoryId": tea.subcategory_id,
        "originSummary": tea.origin_summary,
        "qualityDesc": tea.quality_desc,
        "waterTempMin": tea.water_temp_min,
        "waterTempMax": tea.water_temp_max,
        "ratioGrams": _decimal_value(tea.ratio_grams),
        "ratioWaterMl": tea.ratio_water_ml,
        "vessel": tea.vessel,
        "steepSecondsMin": tea.steep_seconds_min,
        "steepSecondsMax": tea.steep_seconds_max,
        "steepTimes": tea.steep_times,
        "productionYear": tea.production_year,
        "status": tea.status,
        "imageCount": tea.image_count,
        "galleryReady": bool(tea.gallery_ready),
        "version": tea.version,
        "lastUpdateAt": iso(tea.last_update_at),
        "rejectReason": reject_reason,
        "images": [
            {
                "id": image.id,
                "type": image.image_type,
                "seq": image.seq,
                "url": _image_url(image, thumb=False),
                "thumbUrl": _image_url(image, thumb=True),
                "sourceLicense": image.license_cert_no,
            }
            for image in images
        ],
    }


# ---------------------------------------------------------------- 状态机写操作

def create(db: Session, payload: Mapping[str, Any], operator_id: int) -> dict:
    category_id = _validate_category_pair(db, payload.get("categoryId"), payload.get("subcategoryId"))
    values = _apply_values(payload)
    tea = Tea(
        **values,
        category_id=category_id,
        tea_code=_generate_tea_code(),
        status="draft",
        image_count=0,
        gallery_ready=False,
        published_version=0,
        version=0,
        last_update_at=now(),
        created_by=operator_id,
    )
    db.add(tea)
    db.flush()
    AuditService(db).record(
        "tea_create", "tea", tea.id, None, None, {"status": tea.status, "name": tea.name}
    )
    db.commit()
    category_names = _name_map(db)
    sub_names = _name_map(db, subcategory=True)
    return _to_item(tea, category_names, sub_names)


def update(db: Session, tea_id: int, payload: Mapping[str, Any]) -> dict:
    tea = _require_tea(db, tea_id)
    if tea.status != "draft":
        raise BizException(ErrorCode.CATALOG_002, "仅草稿可编辑；已提交或已上架内容请走修订流程")

    category_id = _validate_category_pair(db, payload.get("categoryId"), payload.get("subcategoryId"))
    values = _apply_values(payload)
    values["category_id"] = category_id
    before_version = tea.version or 0
    request_version = payload.get("version")
    if request_version is not None and int(request_version) != before_version:
        raise BizException(ErrorCode.CATALOG_002, "数据已被他人修改，请刷新后重试")

    base_version = before_version if request_version is None else int(request_version)
    new_version = base_version + 1
    values["version"] = new_version
    values["last_update_at"] = now()

    # MyBatis-Plus @Version 等价：以读取到的 version 作为 WHERE 条件，命中 0 行即并发冲突
    result = db.execute(
        update(Tea)
        .where(Tea.id == tea_id, Tea.deleted_at.is_(None), Tea.version == base_version)
        .values(**values)
    )
    if result.rowcount == 0:
        raise BizException(ErrorCode.CATALOG_002, "数据已被他人修改，请刷新后重试")

    AuditService(db).record(
        "tea_update", "tea", tea_id, None,
        {"version": before_version}, {"version": new_version},
    )
    db.commit()
    db.refresh(tea)
    category_names = _name_map(db)
    sub_names = _name_map(db, subcategory=True)
    return _to_item(tea, category_names, sub_names)


def submit(db: Session, tea_id: int) -> None:
    tea = _require_tea(db, tea_id)
    if tea.status != "draft":
        raise BizException(ErrorCode.CATALOG_002, "仅草稿可提交审核")
    if _count_published_images(db, tea_id) < 4:
        raise BizException(ErrorCode.CATALOG_003, "提交审核需至少 4 张已发布图片")
    dimensions = _tag_dimensions(db, _tag_ids(db, tea_id))
    if not set(TAG_DIMENSIONS).issubset(dimensions):
        raise BizException(ErrorCode.CATALOG_003, "提交审核需补齐外形/色泽/汤色/发酵/香气五维标签")

    before = tea.status
    tea.status = "pending"
    tea.submitted_at = now()
    tea.last_update_at = now()
    db.flush()
    AuditService(db).record("tea_submit", "tea", tea_id, None, {"status": before}, {"status": "pending"})
    db.commit()


def review(db: Session, tea_id: int, decision: str | None, reason: str | None, version: int | None) -> None:
    tea = _require_tea(db, tea_id)
    if tea.status != "pending":
        raise BizException(ErrorCode.CATALOG_002, "该茶品不在待审核状态")
    if version is not None and tea.version is not None and int(version) != int(tea.version):
        raise BizException(ErrorCode.CATALOG_002, "数据已被他人修改，请刷新后重试")
    if decision not in ("approve", "reject"):
        raise BizException(ErrorCode.SYS_001, "decision 只能是 approve 或 reject")
    trimmed_reason = (reason or "").strip()
    if decision == "reject" and len(trimmed_reason) < 10:
        raise BizException(ErrorCode.SYS_001, "驳回理由不少于 10 字")

    before = tea.status
    if decision == "approve":
        tea.status = "published"
        tea.published_at = now()
        tea.published_version = (tea.published_version or 0) + 1
        _activate_subcategory(db, tea.subcategory_id)
    else:
        tea.status = "draft"
    tea.last_update_at = now()
    db.flush()
    AuditService(db).record(
        "tea_review", "tea", tea_id, reason, {"status": before}, {"status": tea.status}
    )
    db.commit()


def unpublish(db: Session, tea_id: int, reason: str | None) -> None:
    tea = _require_tea(db, tea_id)
    if tea.status != "published":
        raise BizException(ErrorCode.CATALOG_002, "仅已上架茶品可下架")
    _require_reason(reason)
    tea.status = "offline"
    tea.last_update_at = now()
    db.flush()
    AuditService(db).record(
        "tea_unpublish", "tea", tea_id, reason, {"status": "published"}, {"status": "offline"}
    )
    db.commit()


def publish(db: Session, tea_id: int, reason: str | None) -> None:
    tea = _require_tea(db, tea_id)
    if tea.status != "offline":
        raise BizException(ErrorCode.CATALOG_002, "仅已下架茶品可恢复上架")
    _require_reason(reason)
    tea.status = "published"
    tea.published_at = now()
    tea.last_update_at = now()
    db.flush()
    AuditService(db).record(
        "tea_publish", "tea", tea_id, reason, {"status": "offline"}, {"status": "published"}
    )
    db.commit()


def delete(db: Session, tea_id: int) -> None:
    tea = _require_tea(db, tea_id)
    if tea.status != "draft":
        raise BizException(ErrorCode.CATALOG_002, "仅草稿可删除")
    tea.deleted_at = now()
    db.flush()
    AuditService(db).record(
        "tea_delete", "tea", tea_id, None, {"status": "draft"}, {"deleted": True}
    )
    db.commit()


# ---------------------------------------------------------------- 分类管理

def categories(db: Session) -> list[dict]:
    cats = db.execute(
        select(TeaCategory).order_by(TeaCategory.sort_order, TeaCategory.id)
    ).scalars().all()
    subs = db.execute(
        select(TeaSubcategory).order_by(TeaSubcategory.sort_order, TeaSubcategory.id)
    ).scalars().all()
    counts: dict[int, int] = {}
    for row in db.execute(
        text(
            "SELECT t.subcategory_id AS subcategory_id, COUNT(*) AS tea_count "
            "FROM tea t WHERE t.deleted_at IS NULL GROUP BY t.subcategory_id"
        )
    ).mappings():
        counts[row["subcategory_id"]] = int(row["tea_count"])

    views: list[dict] = []
    for category in cats:
        children = [
            {
                "id": sub.id,
                "categoryId": sub.category_id,
                "code": sub.code,
                "name": sub.name,
                "contentStatus": sub.content_status,
                "teaCount": counts.get(sub.id, 0),
                "sortOrder": sub.sort_order,
            }
            for sub in subs
            if sub.category_id == category.id
        ]
        views.append(
            {
                "code": category.code,
                "name": category.name,
                "sortOrder": category.sort_order,
                "subcategories": children,
            }
        )
    return views


def patch_subcategory(db: Session, subcategory_id: int, content_status: str | None) -> None:
    if content_status not in ("normal", "constructing"):
        raise BizException(ErrorCode.SYS_001, "内容建设状态只能是 normal 或 constructing")
    subcategory = db.get(TeaSubcategory, subcategory_id)
    if subcategory is None:
        raise BizException(ErrorCode.CATALOG_001, "亚类不存在")
    before = subcategory.content_status
    subcategory.content_status = content_status
    db.flush()
    AuditService(db).record(
        "subcategory_status", "tea_subcategory", subcategory_id, None,
        {"contentStatus": before}, {"contentStatus": content_status},
    )
    db.commit()


# ---------------------------------------------------------------- 内部工具

def _require_tea(db: Session, tea_id: int) -> Tea:
    tea = db.get(Tea, tea_id)
    if tea is None or tea.deleted_at is not None:
        raise BizException(ErrorCode.CATALOG_001, "茶品不存在")
    return tea


def _validate_category_pair(db: Session, category_id: int | None, subcategory_id: int | None) -> int:
    if category_id is None or subcategory_id is None:
        raise BizException(ErrorCode.SYS_001, "茶类与亚类必填")
    category = db.get(TeaCategory, int(category_id))
    subcategory = db.get(TeaSubcategory, int(subcategory_id))
    if category is None or subcategory is None or subcategory.category_id != int(category_id):
        raise BizException(ErrorCode.SYS_001, "茶类与亚类不匹配")
    return int(category_id)


def _apply_values(payload: Mapping[str, Any]) -> dict[str, Any]:
    name = payload.get("name")
    if name is None or not str(name).strip() or len(str(name)) > 80:
        raise BizException(ErrorCode.SYS_001, "茶名必填且不超过 80 字")
    _check_range(payload.get("waterTempMin"), payload.get("waterTempMax"), 0, 100, "水温")
    _check_range(payload.get("steepSecondsMin"), payload.get("steepSecondsMax"), 0, 600, "出汤时间")
    year = payload.get("productionYear")
    if year is not None and (int(year) < 1900 or int(year) > 2100):
        raise BizException(ErrorCode.SYS_001, "年份需为 1900–2100 的四位年份")
    ratio_grams = payload.get("ratioGrams")
    if ratio_grams is not None and float(ratio_grams) <= 0:
        raise BizException(ErrorCode.SYS_001, "投茶量必须大于 0")

    return {
        "name": str(name).strip(),
        "origin_summary": _trim(payload.get("originSummary")),
        "quality_desc": _trim(payload.get("qualityDesc")),
        "water_temp_min": payload.get("waterTempMin"),
        "water_temp_max": payload.get("waterTempMax"),
        "ratio_grams": ratio_grams,
        "ratio_water_ml": payload.get("ratioWaterMl"),
        "vessel": _trim(payload.get("vessel")),
        "steep_seconds_min": payload.get("steepSecondsMin"),
        "steep_seconds_max": payload.get("steepSecondsMax"),
        "steep_times": payload.get("steepTimes"),
        "production_year": year,
        "subcategory_id": payload.get("subcategoryId"),
    }


def _check_range(lower: Any, upper: Any, minimum: int, maximum: int, label: str) -> None:
    if lower is not None and (int(lower) < minimum or int(lower) > maximum):
        raise BizException(ErrorCode.SYS_001, label + "下限超出合理范围")
    if upper is not None and (int(upper) < minimum or int(upper) > maximum):
        raise BizException(ErrorCode.SYS_001, label + "上限超出合理范围")
    if lower is not None and upper is not None and int(lower) > int(upper):
        raise BizException(ErrorCode.SYS_001, label + "下限不能大于上限")


def _activate_subcategory(db: Session, subcategory_id: int) -> None:
    subcategory = db.get(TeaSubcategory, subcategory_id)
    if subcategory is not None and subcategory.content_status == "constructing":
        subcategory.content_status = "normal"


def _tag_ids(db: Session, tea_id: int) -> list[int]:
    return list(
        db.execute(select(TeaTag.tag_id).where(TeaTag.tea_id == tea_id)).scalars().all()
    )


def _tag_dimensions(db: Session, tag_ids: list[int]) -> set[str]:
    if not tag_ids:
        return set()
    return set(
        db.execute(
            select(Tag.dimension).where(Tag.id.in_(list(tag_ids)), Tag.status == "enabled")
        ).scalars().all()
    )


def _count_published_images(db: Session, tea_id: int) -> int:
    return int(
        db.execute(
            select(func.count())
            .select_from(MediaImage)
            .where(
                MediaImage.tea_id == tea_id,
                MediaImage.status == "published",
                MediaImage.deleted_at.is_(None),
            )
        ).scalar_one()
    )


def _images_by_tea(db: Session, tea_id: int) -> list[MediaImage]:
    return list(
        db.execute(
            select(MediaImage)
            .where(MediaImage.tea_id == tea_id, MediaImage.deleted_at.is_(None))
            .order_by(text(_IMAGE_TYPE_ORDER), MediaImage.seq, MediaImage.id)
        ).scalars().all()
    )


def _image_url(image: MediaImage, thumb: bool) -> str:
    relative = (image.thumb_path or image.storage_path) if thumb else image.storage_path
    return storage_service.url(relative)


def _name_map(db: Session, subcategory: bool = False) -> dict[int, str]:
    if subcategory:
        return {row.id: row.name for row in db.execute(select(TeaSubcategory)).scalars().all()}
    return {row.id: row.name for row in db.execute(select(TeaCategory)).scalars().all()}


def _to_item(tea: Tea, category_names: Mapping[int, str], sub_names: Mapping[int, str]) -> dict:
    return {
        "id": tea.id,
        "teaCode": tea.tea_code,
        "name": tea.name,
        "categoryId": tea.category_id,
        "categoryName": category_names.get(tea.category_id),
        "subcategoryId": tea.subcategory_id,
        "subcategoryName": sub_names.get(tea.subcategory_id),
        "status": tea.status,
        "imageCount": tea.image_count,
        "galleryReady": bool(tea.gallery_ready),
        "productionYear": tea.production_year,
        "lastUpdateAt": iso(tea.last_update_at),
        "hasPendingRevision": False,
    }


def _generate_tea_code() -> str:
    return "T" + str(int(time.time() * 1000)) + str(random.randint(10, 98))


def _require_reason(reason: str | None) -> None:
    if reason is None or not reason.strip():
        raise BizException(ErrorCode.SYS_001, "必须填写原因")


def _trim(value: Any) -> str | None:
    if value is None or not str(value).strip():
        return None
    return str(value).strip()


def _decimal_value(value: Any) -> float | None:
    return None if value is None else float(value)
