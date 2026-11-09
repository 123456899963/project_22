"""茶品目录读侧（M02）：首页、分类、列表筛选、详情与纠错落库。

对应原 Java com.mingmai.catalog.service.CatalogService 与 CatalogMediaListener。
仅暴露已上架茶品；下架/不存在对游客统一 404，避免泄露状态。
"""

from decimal import Decimal
from typing import Any, Mapping

from sqlalchemy import bindparam, func, select, text
from sqlalchemy.orm import Session

from app.core.errors import BizException, ErrorCode
from app.core.pagination import normalize
from app.core.storage import storage_service
from app.core.timeutil import iso, now
from app.models.catalog import (
    Tea,
    TeaAlias,
    TeaCategory,
    TeaGrade,
    TeaHarvestPeriod,
    TeaRegion,
    TeaRevision,
    TeaStandard,
    TeaSubcategory,
    TeaSubcategoryExtra,
    TeaTag,
)
from app.models.engagement import Comment
from app.models.media import MediaImage
from app.models.submission import Submission
from app.models.tag import Tag

DISCLAIMER = "本页内容为茶叶品鉴知识整理，仅供参考，不构成任何医疗或健康建议。"
IDENTIFY_ENTRY = "按外形、色泽、汤色、发酵与香气自查"

# 与 TeaQueryMapper.xml listColumns 保持同一投影口径；coverPath 由服务层转站内 URL
_LIST_COLUMNS = """
        t.id                AS id,
        t.name              AS name,
        c.code              AS categoryCode,
        c.name              AS categoryName,
        s.code              AS subcategoryCode,
        s.name              AS subcategoryName,
        (SELECT g.grade FROM tea_grade g WHERE g.tea_id = t.id ORDER BY g.sort_order LIMIT 1) AS grade,
        t.production_year   AS productionYear,
        (SELECT r.region_name FROM tea_region r
          WHERE r.tea_id = t.id AND r.region_type = 'primary'
          ORDER BY r.sort_order LIMIT 1) AS originPrimary,
        (SELECT COALESCE(m.thumb_path, m.storage_path) FROM media_image m
          WHERE m.tea_id = t.id AND m.status = 'published' AND m.deleted_at IS NULL
          ORDER BY FIELD(m.image_type, 'dry','soup','leaf','pack','detail'), m.seq LIMIT 1) AS coverPath,
        (SELECT GROUP_CONCAT(DISTINCT tg.name ORDER BY tg.id SEPARATOR ',') FROM tea_tag tt
          JOIN tag tg ON tg.id = tt.tag_id
          WHERE tt.tea_id = t.id AND tg.status = 'enabled') AS tags
"""

_PUBLISHED_BASE = """
FROM tea t
JOIN tea_category c ON c.id = t.category_id
JOIN tea_subcategory s ON s.id = t.subcategory_id
WHERE t.status = 'published' AND t.deleted_at IS NULL
"""

_IMAGE_TYPE_ORDER = "FIELD(image_type,'dry','soup','leaf','pack','detail')"

# 提交审核必须齐全的五维标签，顺序沿用 TagService.DIMENSIONS
TAG_DIMENSIONS = ("shape", "color", "soup", "ferment", "aroma")


# ---------------------------------------------------------------- 首页与分类

def home(db: Session) -> dict:
    last_update = db.execute(
        text("SELECT MAX(t.last_update_at) FROM tea t WHERE t.status = 'published' AND t.deleted_at IS NULL")
    ).scalar_one()
    featured_rows = db.execute(
        text(
            "SELECT " + _LIST_COLUMNS + _PUBLISHED_BASE
            + " ORDER BY t.published_at DESC, t.last_update_at DESC, t.id DESC LIMIT :limit"
        ),
        {"limit": 8},
    ).mappings().all()
    return {
        "categories": categories(db),
        "featured": [_to_summary(row) for row in featured_rows],
        "identifyEntry": IDENTIFY_ENTRY,
        "updatedAt": iso(last_update),
    }


def categories(db: Session) -> list[dict]:
    cats = db.execute(
        select(TeaCategory).order_by(TeaCategory.sort_order, TeaCategory.id)
    ).scalars().all()
    subs = db.execute(
        select(TeaSubcategory).order_by(TeaSubcategory.sort_order, TeaSubcategory.id)
    ).scalars().all()
    counts = {
        row["subcategory_id"]: int(row["tea_count"])
        for row in db.execute(
            text(
                "SELECT t.subcategory_id AS subcategory_id, COUNT(*) AS tea_count "
                "FROM tea t WHERE t.status = 'published' AND t.deleted_at IS NULL "
                "GROUP BY t.subcategory_id"
            )
        ).mappings()
    }

    views: list[dict] = []
    for category in cats:
        children = [sub for sub in subs if sub.category_id == category.id]
        child_views = [
            {
                "code": sub.code,
                "name": sub.name,
                "teaCount": counts.get(sub.id, 0),
                "contentStatus": sub.content_status,
            }
            for sub in children
        ]
        total = sum(child["teaCount"] for child in child_views)
        content_status = "normal" if any(sub.content_status == "normal" for sub in children) else "constructing"
        views.append(
            {
                "code": category.code,
                "name": category.name,
                "teaCount": total,
                "contentStatus": content_status,
                "subcategories": child_views,
            }
        )
    return views


def category_detail(db: Session, code: str) -> dict:
    for view in categories(db):
        if view["code"] == code:
            return view
    raise BizException(ErrorCode.CATALOG_001, "茶类不存在")


# ---------------------------------------------------------------- 列表

def list_teas(db: Session, flt: Mapping[str, Any], page: int, size: int) -> tuple[list[dict], int, int, int]:
    page, size = normalize(page, size)
    filter_sql, params, expanding = _filter_sql(flt)
    count_stmt = _compile(
        "SELECT COUNT(DISTINCT t.id) " + _PUBLISHED_BASE + filter_sql, expanding
    )
    total = int(db.execute(count_stmt, params).scalar_one())

    items: list[dict] = []
    if total > 0:
        list_params = dict(params)
        list_params["limit"] = size
        list_params["offset"] = (page - 1) * size
        list_stmt = _compile(
            "SELECT " + _LIST_COLUMNS + _PUBLISHED_BASE + filter_sql
            + _order_sql(flt.get("sort")) + " LIMIT :limit OFFSET :offset",
            expanding,
        )
        rows = db.execute(list_stmt, list_params).mappings().all()
        items = [_to_summary(row) for row in rows]
    return items, page, size, total


def _filter_sql(flt: Mapping[str, Any]) -> tuple[str, dict[str, Any], list[str]]:
    """同维多选取"或"、跨维取"与"；未传维度视为不限（对应 mapper 的 filters 片段）。"""
    clauses: list[str] = []
    params: dict[str, Any] = {}
    expanding: list[str] = []

    if flt.get("category"):
        clauses.append("AND c.code = :category")
        params["category"] = flt["category"]
    if flt.get("subcategory"):
        clauses.append("AND s.code = :subcategory")
        params["subcategory"] = flt["subcategory"]
    if flt.get("regions"):
        clauses.append(
            "AND EXISTS (SELECT 1 FROM tea_region r WHERE r.tea_id = t.id AND r.region_name IN :regions)"
        )
        params["regions"] = list(flt["regions"])
        expanding.append("regions")
    if flt.get("ferments"):
        clauses.append(
            "AND EXISTS (SELECT 1 FROM tea_tag tt JOIN tag tg ON tg.id = tt.tag_id "
            "WHERE tt.tea_id = t.id AND tg.dimension = 'ferment' AND tg.name IN :ferments)"
        )
        params["ferments"] = list(flt["ferments"])
        expanding.append("ferments")
    if flt.get("aromas"):
        clauses.append(
            "AND EXISTS (SELECT 1 FROM tea_tag tt JOIN tag tg ON tg.id = tt.tag_id "
            "WHERE tt.tea_id = t.id AND tg.dimension = 'aroma' AND tg.name IN :aromas)"
        )
        params["aromas"] = list(flt["aromas"])
        expanding.append("aromas")
    if flt.get("seasons"):
        clauses.append(
            "AND EXISTS (SELECT 1 FROM tea_harvest_period hp WHERE hp.tea_id = t.id "
            "AND hp.season_label IN :seasons)"
        )
        params["seasons"] = list(flt["seasons"])
        expanding.append("seasons")

    grade_values = flt.get("grade_values") or []
    include_ungraded = bool(flt.get("include_ungraded"))
    if grade_values or include_ungraded:
        parts: list[str] = []
        if grade_values:
            parts.append("EXISTS (SELECT 1 FROM tea_grade g WHERE g.tea_id = t.id AND g.grade IN :grade_values)")
            params["grade_values"] = list(grade_values)
            expanding.append("grade_values")
        if include_ungraded:
            parts.append("NOT EXISTS (SELECT 1 FROM tea_grade g2 WHERE g2.tea_id = t.id)")
        clauses.append("AND (" + " OR ".join(parts) + ")")

    # 未录入年份的茶品不进入年份筛选结果
    if flt.get("years"):
        clauses.append("AND t.production_year IS NOT NULL AND t.production_year IN :years")
        params["years"] = list(flt["years"])
        expanding.append("years")

    return "\n".join(clauses), params, expanding


def _order_sql(sort: str | None) -> str:
    if sort == "name_pinyin":
        return " ORDER BY t.name_pinyin ASC, t.id ASC"
    if sort == "grade_desc":
        return (
            " ORDER BY (SELECT CASE MAX(g.grade) WHEN '特级' THEN 1 WHEN '一级' THEN 2 "
            "WHEN '二级' THEN 3 ELSE 4 END FROM tea_grade g WHERE g.tea_id = t.id) ASC, "
            "t.name_pinyin ASC"
        )
    return " ORDER BY t.last_update_at DESC, t.id DESC"


def _compile(sql: str, expanding: list[str]):
    stmt = text(sql)
    for name in expanding:
        stmt = stmt.bindparams(bindparam(name, expanding=True))
    return stmt


# ---------------------------------------------------------------- 详情

def detail(db: Session, tea_id: int) -> dict:
    tea = db.get(Tea, tea_id)
    if tea is None or tea.deleted_at is not None or tea.status != "published":
        raise BizException(ErrorCode.CATALOG_001, "内容已下架或不存在")
    category = db.get(TeaCategory, tea.category_id)
    subcategory = db.get(TeaSubcategory, tea.subcategory_id)

    aliases = db.execute(
        select(TeaAlias).where(TeaAlias.tea_id == tea_id).order_by(TeaAlias.id)
    ).scalars().all()
    grades = db.execute(
        select(TeaGrade).where(TeaGrade.tea_id == tea_id).order_by(TeaGrade.sort_order)
    ).scalars().all()
    harvests = db.execute(
        select(TeaHarvestPeriod)
        .where(TeaHarvestPeriod.tea_id == tea_id)
        .order_by(TeaHarvestPeriod.sort_order, TeaHarvestPeriod.start_month)
    ).scalars().all()
    regions = db.execute(
        select(TeaRegion).where(TeaRegion.tea_id == tea_id).order_by(TeaRegion.sort_order)
    ).scalars().all()
    standards = db.execute(
        select(TeaStandard).where(TeaStandard.tea_id == tea_id).order_by(TeaStandard.id)
    ).scalars().all()
    tag_ids = db.execute(
        select(TeaTag.tag_id).where(TeaTag.tea_id == tea_id)
    ).scalars().all()

    images = _published_images(db, tea_id)
    return {
        "id": tea.id,
        "name": tea.name,
        "aliases": [alias.alias for alias in aliases],
        "category": {"code": category.code, "name": category.name},
        "subcategory": {"code": subcategory.code, "name": subcategory.name},
        "grades": [grade.grade for grade in grades],
        "productionYear": tea.production_year,
        "yearBand": year_band(tea.production_year),
        "origin": {
            "primary": [region.region_name for region in regions if region.region_type == "primary"],
            "secondary": [region.region_name for region in regions if region.region_type != "primary"],
        },
        "quality": {"tags": _tag_names(db, tag_ids), "description": tea.quality_desc},
        "brewing": _brewing(tea),
        "harvestPeriods": [
            period.season_label if period.season_label is not None else _month_range(period)
            for period in harvests
        ],
        "standards": [standard.standard_no for standard in standards],
        "extraSubcategories": _extra_subcategories(db, tea_id),
        "images": [_image_view(image) for image in images],
        "lastUpdateAt": iso(tea.last_update_at),
        "commentCount": _count_published_comments(db, tea_id),
        "disclaimer": DISCLAIMER,
    }


def _tag_names(db: Session, tag_ids: list[int]) -> list[str]:
    if not tag_ids:
        return []
    return list(
        db.execute(
            select(Tag.name)
            .where(Tag.id.in_(list(tag_ids)), Tag.status == "enabled")
            .order_by(Tag.id)
        ).scalars().all()
    )


def _extra_subcategories(db: Session, tea_id: int) -> list[dict]:
    sub_ids = db.execute(
        select(TeaSubcategoryExtra.subcategory_id).where(TeaSubcategoryExtra.tea_id == tea_id)
    ).scalars().all()
    if not sub_ids:
        return []
    subs = db.execute(
        select(TeaSubcategory).where(TeaSubcategory.id.in_(list(sub_ids)))
    ).scalars().all()
    return [{"code": sub.code, "name": sub.name} for sub in subs]


def _count_published_comments(db: Session, tea_id: int) -> int:
    return int(
        db.execute(
            select(func.count())
            .select_from(Comment)
            .where(
                Comment.tea_id == tea_id,
                Comment.status == "published",
                Comment.deleted_at.is_(None),
            )
        ).scalar_one()
    )


def _brewing(tea: Tea) -> dict[str, str]:
    brewing: dict[str, str] = {}
    if tea.water_temp_min is not None or tea.water_temp_max is not None:
        brewing["waterTemp"] = _range(tea.water_temp_min, tea.water_temp_max, "℃")
    if tea.ratio_grams is not None:
        amount = _decimal_text(tea.ratio_grams) + " g"
        brewing["teaAmount"] = (
            amount if tea.ratio_water_ml is None else amount + " / " + str(tea.ratio_water_ml) + " ml"
        )
    if tea.vessel is not None:
        brewing["vessel"] = tea.vessel
    if tea.steep_seconds_min is not None or tea.steep_seconds_max is not None:
        brewing["firstSteep"] = _range(tea.steep_seconds_min, tea.steep_seconds_max, " 秒")
    if tea.steep_times is not None:
        brewing["steepTimes"] = str(tea.steep_times) + " 次"
    return brewing


def _range(lower: int | None, upper: int | None, unit: str) -> str:
    if lower is None:
        return str(upper) + unit
    if upper is None:
        return str(lower) + unit
    return str(lower) + "–" + str(upper) + unit


def _decimal_text(value: Decimal) -> str:
    # 对应 BigDecimal.stripTrailingZeros().toPlainString()，避免 "1.00 g" 这类多余尾零
    return format(value.normalize(), "f")


def _month_range(period: TeaHarvestPeriod) -> str:
    if period.start_month is None:
        return "采摘期未录入"
    end_month = period.start_month if period.end_month is None else period.end_month
    return str(period.start_month) + "–" + str(end_month) + " 月"


def _to_summary(row: Mapping[str, Any]) -> dict:
    return {
        "id": row["id"],
        "name": row["name"],
        "categoryCode": row["categoryCode"],
        "categoryName": row["categoryName"],
        "subcategoryCode": row["subcategoryCode"],
        "subcategoryName": row["subcategoryName"],
        "grade": row["grade"],
        "productionYear": row["productionYear"],
        "yearBand": year_band(row["productionYear"]),
        "originPrimary": row["originPrimary"],
        "coverUrl": storage_service.url(row["coverPath"]) if row["coverPath"] else None,
        "tags": _split_tags(row["tags"]),
    }


def _split_tags(tags: str | None) -> list[str]:
    if not tags:
        return []
    return tags.split(",")


def year_band(year: int | None) -> str | None:
    """年份分档口径：≤3 年新茶，4–10 年中期茶，>10 年老茶；未录年份返回 null。"""
    if year is None:
        return None
    age = now().year - year
    if age <= 3:
        return "新茶"
    if age <= 10:
        return "中期茶"
    return "老茶"


# ---------------------------------------------------------------- 媒体与跨模块契约

def _published_images(db: Session, tea_id: int) -> list[MediaImage]:
    return list(
        db.execute(
            select(MediaImage)
            .where(
                MediaImage.tea_id == tea_id,
                MediaImage.status == "published",
                MediaImage.deleted_at.is_(None),
            )
            .order_by(text(_IMAGE_TYPE_ORDER), MediaImage.seq, MediaImage.id)
        ).scalars().all()
    )


def _image_item(image: MediaImage) -> dict:
    thumb = image.thumb_path if image.thumb_path is not None else image.storage_path
    return {
        "id": image.id,
        "type": image.image_type,
        "seq": image.seq,
        "url": storage_service.url(image.storage_path),
        "thumbUrl": storage_service.url(thumb),
        "status": image.status,
        "sourceType": image.source_type,
        "rightsHolder": image.rights_holder,
        "licenseScope": image.license_scope,
        "licenseCertNo": image.license_cert_no,
    }


def _image_view(image: MediaImage) -> dict:
    item = _image_item(image)
    return {
        "id": item["id"],
        "type": item["type"],
        "seq": item["seq"],
        "url": item["url"],
        "thumbUrl": item["thumbUrl"],
        "sourceLicense": _source_license(item),
    }


def _source_license(image: Mapping[str, Any]) -> str | None:
    cert_no = image["licenseCertNo"]
    if cert_no is None:
        return None
    holder = "" if image["rightsHolder"] is None else image["rightsHolder"] + " · "
    scope = "授权范围未注明" if image["licenseScope"] is None else image["licenseScope"]
    return holder + scope + " · 凭证 " + cert_no


def get_tea_or_404(db: Session, tea_id: int) -> Tea:
    """跨模块只读入口：茶品不存在或已软删一律 CATALOG_001。"""
    tea = db.get(Tea, tea_id)
    if tea is None or tea.deleted_at is not None:
        raise BizException(ErrorCode.CATALOG_001, "茶品不存在")
    return tea


def sync_media_state(db: Session, tea_id: int) -> None:
    """媒体变更后重算 image_count / gallery_ready。

    对应 Java CatalogMediaListener：不反向依赖 media 模块，由调用方在同一事务内提交。
    """
    tea = db.get(Tea, tea_id)
    if tea is None or tea.deleted_at is not None:
        return
    images = _published_images(db, tea_id)
    tea.image_count = len(images)
    tea.gallery_ready = len(images) >= 4 and all(
        image.source_type is not None
        and image.rights_holder is not None
        and image.license_cert_no is not None
        for image in images
    )
    tea.last_update_at = now()
    db.flush()


def apply_correction(db: Session, submission_id: int, diffs: list[dict], operator_id: int) -> None:
    """T4 纠错采纳落库：仅支持标量子字段与别名，与 Java applyCorrection 口径一致。

    diffs 元素可来自 ORM 行或 DTO，fieldKey / newValue 兼容 camelCase 与 snake_case。
    修订记录与业务同事务写入，由调用方（审核模块）统一提交。
    """
    submission = db.get(Submission, submission_id)
    if submission is None or submission.deleted_at is not None:
        raise BizException(ErrorCode.CATALOG_001, "投稿不存在")
    if not diffs:
        raise BizException(ErrorCode.SYS_001, "纠错内容缺失，无法采纳")

    tea_id = submission.tea_id
    if tea_id is None:
        raise BizException(ErrorCode.CATALOG_001, "茶品不存在")
    tea = db.get(Tea, tea_id)
    if tea is None or tea.deleted_at is not None or tea.status != "published":
        raise BizException(ErrorCode.CATALOG_001)

    revision_no = int(
        db.execute(
            select(func.max(TeaRevision.revision_no)).where(TeaRevision.tea_id == tea_id)
        ).scalar()
        or 0
    )

    for diff in diffs:
        field_key = _diff_value(diff, "fieldKey", "field_key")
        new_value = _diff_value(diff, "newValue", "new_value")
        note = _diff_value(diff, "reason")
        _apply_single_correction(db, tea, field_key, new_value)

        revision_no += 1
        db.add(
            TeaRevision(
                tea_id=tea_id,
                revision_no=revision_no,
                source="correction",
                submission_id=submission_id,
                status="published",
                snapshot={
                    "teaId": tea_id,
                    "fieldKey": field_key,
                    "newValue": _trimmed(new_value),
                    "appliedAt": iso(now()),
                },
                change_note=note,
                created_by=operator_id,
                reviewed_by=operator_id,
                reviewed_at=now(),
            )
        )

    db.flush()


def _diff_value(diff: Any, *keys: str) -> Any:
    for key in keys:
        if isinstance(diff, Mapping) and key in diff:
            return diff[key]
        if hasattr(diff, key):
            return getattr(diff, key)
    return None


def _apply_single_correction(db: Session, tea: Tea, field_key: str | None, new_value: str | None) -> None:
    value = _trimmed(new_value)
    if not value:
        raise BizException(ErrorCode.SYS_001, "纠错内容为空")
    if field_key == "name":
        if len(value) > 80:
            raise BizException(ErrorCode.SYS_001, "茶名不超过 80 字")
        tea.name = value
    elif field_key == "origin":
        if len(value) > 300:
            raise BizException(ErrorCode.SYS_001, "产地描述不超过 300 字")
        tea.origin_summary = value
    elif field_key == "quality":
        tea.quality_desc = value
    elif field_key == "productionYear":
        try:
            year = int(value)
        except ValueError as exc:
            raise BizException(ErrorCode.SYS_001, "年份需为 4 位数字") from exc
        if year < 1900 or year > 2100:
            raise BizException(ErrorCode.SYS_001, "年份需在 1900–2100 之间")
        tea.production_year = year
    elif field_key == "alias":
        if len(value) > 60:
            raise BizException(ErrorCode.SYS_001, "别名不超过 60 字")
        exists = db.execute(
            select(TeaAlias.id).where(TeaAlias.tea_id == tea.id, TeaAlias.alias == value).limit(1)
        ).scalars().first()
        if exists is None:
            db.add(TeaAlias(tea_id=tea.id, alias=value))
    else:
        raise BizException(ErrorCode.SYS_001, "该字段暂不支持在线纠错，请直接编辑茶品")

    tea.last_update_at = now()
    tea.version = (tea.version or 0) + 1


def _trimmed(value: str | None) -> str:
    return "" if value is None else str(value).strip()
