"""发现模块（搜索 / 识茶自查 / 图鉴浏览）。

结构化精确匹配：名称、拼音、首字母与别名命中；识茶按五维标签跨维 AND、同维 OR，
只给候选与建议，不给"识别结论"。复杂查询沿用原 DiscoveryQueryMapper/TeaQueryMapper 口径。
"""

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.errors import BizException, ErrorCode
from app.core.storage import storage_service
from app.core.timeutil import now
from app.services import tag_service

MAX_QUERY_LENGTH = 40
DIMENSIONS = ("shape", "color", "soup", "ferment", "aroma")

_SUMMARY_COLUMNS = """
    t.id AS id,
    t.name AS name,
    c.code AS category_code,
    c.name AS category_name,
    s.code AS subcategory_code,
    s.name AS subcategory_name,
    (SELECT g.grade FROM tea_grade g WHERE g.tea_id = t.id ORDER BY g.sort_order LIMIT 1) AS grade,
    t.production_year AS production_year,
    (SELECT r.region_name FROM tea_region r
      WHERE r.tea_id = t.id AND r.region_type = 'primary'
      ORDER BY r.sort_order LIMIT 1) AS origin_primary,
    (SELECT COALESCE(m.thumb_path, m.storage_path) FROM media_image m
      WHERE m.tea_id = t.id AND m.status = 'published' AND m.deleted_at IS NULL
      ORDER BY FIELD(m.image_type, 'dry','soup','leaf','pack','detail'), m.seq LIMIT 1) AS cover_path,
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

_SEARCH_CONDITION = """
    AND (
        t.name LIKE :like
        OR t.name_pinyin LIKE :like
        OR t.name_initials LIKE :like
        OR EXISTS (SELECT 1 FROM tea_alias a2 WHERE a2.tea_id = t.id
                   AND (a2.alias LIKE :like OR a2.pinyin LIKE :like OR a2.initials LIKE :like))
    )
"""

_SEARCH_SQL = f"""
    SELECT {_SUMMARY_COLUMNS},
        (SELECT a.alias FROM tea_alias a
          WHERE a.tea_id = t.id
            AND (a.alias LIKE :like OR a.pinyin LIKE :like OR a.initials LIKE :like)
          ORDER BY LENGTH(a.alias) LIMIT 1) AS matched_alias
    {_PUBLISHED_BASE}
    {_SEARCH_CONDITION}
    ORDER BY t.last_update_at DESC, t.id DESC
    LIMIT :limit OFFSET :offset
"""

_COUNT_SEARCH_SQL = f"""
    SELECT COUNT(DISTINCT t.id)
    {_PUBLISHED_BASE}
    {_SEARCH_CONDITION}
"""

_FEATURED_SQL = f"""
    SELECT {_SUMMARY_COLUMNS}
    {_PUBLISHED_BASE}
    ORDER BY t.published_at DESC, t.last_update_at DESC, t.id DESC
    LIMIT :limit
"""

_TAG_INDEX_SQL = """
    SELECT tt.tea_id AS tea_id, tg.dimension AS dimension, tg.name AS name
    FROM tea_tag tt
    JOIN tag tg ON tg.id = tt.tag_id
    JOIN tea t ON t.id = tt.tea_id
    WHERE t.status = 'published' AND t.deleted_at IS NULL AND tg.status = 'enabled'
"""

_OFFICIAL_GALLERY_SELECT = """
    SELECT m.id AS id, m.tea_id AS tea_id, t.name AS tea_name, c.code AS category_code,
           m.image_type AS image_type, m.seq AS seq,
           m.storage_path AS storage_path, m.thumb_path AS thumb_path,
           NULL AS author_nickname, NULL AS anonymous
    FROM media_image m
    JOIN tea t ON t.id = m.tea_id
    JOIN tea_category c ON c.id = t.category_id
    WHERE m.status = 'published' AND m.deleted_at IS NULL
      AND t.status = 'published' AND t.deleted_at IS NULL
"""

_OFFICIAL_GALLERY_COUNT = """
    SELECT COUNT(*)
    FROM media_image m
    JOIN tea t ON t.id = m.tea_id
    JOIN tea_category c ON c.id = t.category_id
    WHERE m.status = 'published' AND m.deleted_at IS NULL
      AND t.status = 'published' AND t.deleted_at IS NULL
"""

_USER_GALLERY_SELECT = """
    SELECT gs.id AS id, gs.tea_id AS tea_id, t.name AS tea_name, c.code AS category_code,
           'user' AS image_type, NULL AS seq,
           m.storage_path AS storage_path, m.thumb_path AS thumb_path,
           CASE WHEN gs.anonymous = 1 THEN NULL ELSE p.nickname END AS author_nickname,
           gs.anonymous AS anonymous
    FROM gallery_user_shot gs
    JOIN media_image m ON m.id = gs.image_id
    JOIN tea t ON t.id = gs.tea_id
    JOIN tea_category c ON c.id = t.category_id
    LEFT JOIN user_profile p ON p.user_id = gs.author_id
    WHERE gs.status = 'adopted'
      AND m.status = 'published' AND m.deleted_at IS NULL
      AND t.status = 'published' AND t.deleted_at IS NULL
"""

_USER_GALLERY_COUNT = """
    SELECT COUNT(*)
    FROM gallery_user_shot gs
    JOIN media_image m ON m.id = gs.image_id
    JOIN tea t ON t.id = gs.tea_id
    JOIN tea_category c ON c.id = t.category_id
    WHERE gs.status = 'adopted'
      AND m.status = 'published' AND m.deleted_at IS NULL
      AND t.status = 'published' AND t.deleted_at IS NULL
"""


def _clamp(page: int, size: int) -> tuple[int, int]:
    return max(page, 1), max(1, min(size, 50))


def _year_band(year: int | None) -> str | None:
    if year is None:
        return None
    age = now().year - year
    if age <= 3:
        return "新茶"
    if age <= 10:
        return "中期茶"
    return "老茶"


def _split_tags(value: str | None) -> list[str]:
    if value is None or not value.strip():
        return []
    return value.split(",")


def _summary(row) -> dict:
    cover_path = row["cover_path"]
    return {
        "id": row["id"],
        "name": row["name"],
        "categoryCode": row["category_code"],
        "categoryName": row["category_name"],
        "subcategoryCode": row["subcategory_code"],
        "subcategoryName": row["subcategory_name"],
        "grade": row["grade"],
        "productionYear": row["production_year"],
        "yearBand": _year_band(row["production_year"]),
        "originPrimary": row["origin_primary"],
        "coverUrl": storage_service.url(cover_path) if cover_path else None,
        "tags": _split_tags(row["tags"]),
    }


def search(db: Session, keyword: str | None, page: int, size: int) -> tuple[list[dict], int, int, int]:
    safe_page, safe_size = _clamp(page, size)
    q = "" if keyword is None else keyword.strip()
    if not q or len(q) > MAX_QUERY_LENGTH:
        return [], safe_page, safe_size, 0

    params = {"like": f"%{q}%"}
    total = db.execute(text(_COUNT_SEARCH_SQL), params).scalar_one()
    if total == 0:
        return [], safe_page, safe_size, 0

    params.update(limit=safe_size, offset=(safe_page - 1) * safe_size)
    rows = db.execute(text(_SEARCH_SQL), params).mappings().all()
    items = []
    for row in rows:
        summary = _summary(row)
        summary["matchedAlias"] = row["matched_alias"]
        items.append(summary)
    return items, safe_page, safe_size, total


def identify_options(db: Session) -> list[dict]:
    return tag_service.list_enabled(db)


def _criteria(payload: dict) -> dict[str, list[str]]:
    criteria: dict[str, list[str]] = {}
    for dimension in DIMENSIONS:
        values = payload.get(dimension)
        if not values:
            continue
        filtered = [value for value in values if value and value.strip()]
        if filtered:
            criteria[dimension] = filtered
    return criteria


def identify_results(db: Session, payload: dict, page: int, size: int) -> dict:
    criteria = _criteria(payload)
    if not criteria:
        raise BizException(ErrorCode.SYS_001, "请至少选择一个外形/色泽/汤色/发酵/香气特征")
    safe_page, safe_size = _clamp(page, size)

    index: dict[int, dict[str, set[str]]] = {}
    for row in db.execute(text(_TAG_INDEX_SQL)).mappings().all():
        index.setdefault(row["tea_id"], {}).setdefault(row["dimension"], set()).add(row["name"])

    scores: dict[int, int] = {}
    for tea_id, dimensions in index.items():
        score = 0
        matched_all = True
        for dimension, values in criteria.items():
            names = dimensions.get(dimension)
            if names is None:
                matched_all = False
                break
            matched = sum(1 for value in values if value in names)
            if matched == 0:
                matched_all = False
                break
            score += matched
        if matched_all:
            scores[tea_id] = score

    total = len(scores)
    if total == 0:
        return {
            "items": [],
            "suggestions": _featured(db, 3),
            "page": safe_page,
            "size": safe_size,
            "total": 0,
            "hasMore": False,
        }

    ordered_ids = [tea_id for tea_id, _ in sorted(scores.items(), key=lambda item: (-item[1], item[0]))]
    summaries = _summaries_by_ids(db, ordered_ids)
    all_items = [summaries[tea_id] for tea_id in ordered_ids if tea_id in summaries]
    start = min((safe_page - 1) * safe_size, len(all_items))
    end = min(start + safe_size, len(all_items))
    return {
        "items": all_items[start:end],
        "suggestions": [],
        "page": safe_page,
        "size": safe_size,
        "total": len(all_items),
        "hasMore": safe_page * safe_size < len(all_items),
    }


def _featured(db: Session, limit: int) -> list[dict]:
    rows = db.execute(text(_FEATURED_SQL), {"limit": limit}).mappings().all()
    return [_summary(row) for row in rows]


def _summaries_by_ids(db: Session, ids: list[int]) -> dict[int, dict]:
    if not ids:
        return {}
    params = {f"id{index}": value for index, value in enumerate(ids)}
    placeholders = ", ".join(f":id{index}" for index in range(len(ids)))
    sql = (
        f"SELECT {_SUMMARY_COLUMNS} {_PUBLISHED_BASE} "
        f"AND t.id IN ({placeholders}) ORDER BY t.name_pinyin ASC, t.id ASC"
    )
    rows = db.execute(text(sql), params).mappings().all()
    return {row["id"]: _summary(row) for row in rows}


def gallery(
    db: Session, tab: str, category: str | None, page: int, size: int
) -> tuple[list[dict], int, int, int]:
    safe_page, safe_size = _clamp(page, size)
    offset = (safe_page - 1) * safe_size
    user_tab = tab == "user"
    category_condition = " AND c.code = :category" if category else ""

    select_sql = (_USER_GALLERY_SELECT if user_tab else _OFFICIAL_GALLERY_SELECT) + category_condition
    count_sql = (_USER_GALLERY_COUNT if user_tab else _OFFICIAL_GALLERY_COUNT) + category_condition
    params: dict = {}
    if category:
        params["category"] = category
    total = db.execute(text(count_sql), params).scalar_one()
    if total == 0:
        return [], safe_page, safe_size, 0

    order_by = (
        " ORDER BY gs.adopted_at DESC, gs.id DESC"
        if user_tab
        else " ORDER BY m.created_at DESC, m.id DESC"
    )
    params.update(limit=safe_size, offset=offset)
    rows = db.execute(text(select_sql + order_by + " LIMIT :limit OFFSET :offset"), params).mappings().all()

    items = []
    for row in rows:
        storage_path = row["storage_path"]
        thumb_path = row["thumb_path"] if row["thumb_path"] is not None else storage_path
        items.append(
            {
                "id": row["id"],
                "teaId": row["tea_id"],
                "teaName": row["tea_name"],
                "categoryCode": row["category_code"],
                "imageType": row["image_type"],
                "seq": row["seq"],
                "url": storage_service.url(storage_path),
                "thumbUrl": storage_service.url(thumb_path),
                "authorNickname": row["author_nickname"],
                "anonymous": bool(row["anonymous"]) if user_tab else None,
                "tab": "user" if user_tab else "official",
            }
        )
    return items, safe_page, safe_size, total
