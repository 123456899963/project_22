"""收藏 / 浏览历史 / 对比篮 / 评论（M06）。

对应 Java engagement.service.EngagementService / CommentStatsService / EngagementStatsService。
收藏上限 500、历史保留最近 50 条、对比篮最多 3 款；评论先审后发。
"""

from typing import Optional

from sqlalchemy import and_, bindparam, delete, func, or_, select, text
from sqlalchemy.orm import Session

from app.core.errors import BizException, ErrorCode
from app.core.pagination import normalize
from app.core.storage import storage_service
from app.core.timeutil import iso, now
from app.models.engagement import BrowseHistory, Comment, CommentLike, CompareItem, UserFavorite
from app.models.media import MediaImage

FAVORITE_LIMIT = 500
HISTORY_LIMIT = 50
COMPARE_LIMIT = 3
COMMENT_MAX_LENGTH = 200
BANNED_WORDS = (
    "微信", "加v", "加V", "店铺", "http://", "https://", "qq", "QQ", "二维码", "代购", "链接",
)

TeaRow = dict[str, object]

# 与 Java EngagementQueryMapper.xml 的 teaColumns 保持一致（含图片排序与标签聚合）
TEA_COLUMNS = """
    t.id                AS teaId,
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


# ---------------- 个人中心只读统计 ----------------

def count_favorites(db: Session, user_id: int) -> int:
    return int(
        db.execute(
            select(func.count()).select_from(UserFavorite).where(UserFavorite.user_id == user_id)
        ).scalar_one()
    )


def count_history(db: Session, user_id: int) -> int:
    return int(
        db.execute(
            select(func.count()).select_from(BrowseHistory).where(BrowseHistory.user_id == user_id)
        ).scalar_one()
    )


def count_published_comments(db: Session, tea_id: int) -> int:
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


def count_pending_comments(db: Session) -> int:
    return int(
        db.execute(
            select(func.count())
            .select_from(Comment)
            .where(Comment.status == "pending", Comment.deleted_at.is_(None))
        ).scalar_one()
    )


def count_overdue_comments(db: Session, before) -> int:
    return int(
        db.execute(
            select(func.count())
            .select_from(Comment)
            .where(
                Comment.status == "pending",
                Comment.created_at < before,
                Comment.deleted_at.is_(None),
            )
        ).scalar_one()
    )


# ---------------- 收藏 ----------------

def favorites(db: Session, user_id: int, group: Optional[str], page: int, size: int) -> tuple[list[dict], int]:
    safe_page, safe_size = normalize(page, size)
    offset = (safe_page - 1) * safe_size
    group_clause = " AND f.fav_group = :group" if group else ""
    count_sql = text(
        f"""
        SELECT COUNT(*)
        FROM user_favorite f
        JOIN tea t ON t.id = f.tea_id
        WHERE f.user_id = :userId
          AND t.status = 'published' AND t.deleted_at IS NULL
        {group_clause}
        """
    )
    params: dict[str, object] = {"userId": user_id}
    if group:
        params["group"] = group
    total = int(db.execute(count_sql, params).scalar_one())
    if total == 0:
        return [], 0

    select_sql = text(
        f"""
        SELECT {TEA_COLUMNS},
               f.fav_group AS groupName,
               f.created_at AS createdAt
        FROM user_favorite f
        JOIN tea t ON t.id = f.tea_id
        JOIN tea_category c ON c.id = t.category_id
        JOIN tea_subcategory s ON s.id = t.subcategory_id
        WHERE f.user_id = :userId
          AND t.status = 'published' AND t.deleted_at IS NULL
        {group_clause}
        ORDER BY f.created_at DESC
        LIMIT :limit OFFSET :offset
        """
    )
    params.update(limit=safe_size, offset=offset)
    rows = db.execute(select_sql, params).mappings().all()
    items = [
        {
            "teaId": row["teaId"],
            "tea": _summary_from_row(row),
            "group": row["groupName"],
            "createdAt": iso(row["createdAt"]),
        }
        for row in rows
    ]
    return items, total


def add_favorite(db: Session, user_id: int, tea_id: Optional[int], group: Optional[str]) -> None:
    fav_group = _require_group(group)
    _require_published(db, tea_id)
    existing = db.execute(
        select(UserFavorite).where(
            UserFavorite.user_id == user_id, UserFavorite.tea_id == tea_id
        ).limit(1)
    ).scalars().first()
    if existing is not None:
        existing.fav_group = fav_group
        db.commit()
        return
    count = count_favorites(db, user_id)
    if count >= FAVORITE_LIMIT:
        raise BizException(ErrorCode.AUTH_003, "收藏上限为 500 款，请先整理收藏")
    db.add(
        UserFavorite(
            user_id=user_id, tea_id=tea_id, fav_group=fav_group, created_at=now(), updated_at=now()
        )
    )
    db.commit()


def move_favorite(db: Session, user_id: int, tea_id: int, group: Optional[str]) -> None:
    fav_group = _require_group(group)
    existing = db.execute(
        select(UserFavorite).where(
            UserFavorite.user_id == user_id, UserFavorite.tea_id == tea_id
        ).limit(1)
    ).scalars().first()
    if existing is None:
        raise BizException(ErrorCode.CATALOG_001, "收藏记录不存在")
    existing.fav_group = fav_group
    db.commit()


def remove_favorite(db: Session, user_id: int, tea_id: int) -> None:
    db.execute(
        delete(UserFavorite).where(
            UserFavorite.user_id == user_id, UserFavorite.tea_id == tea_id
        )
    )
    db.commit()


# ---------------- 浏览历史 ----------------

def history(db: Session, user_id: int, page: int, size: int) -> tuple[list[dict], int]:
    safe_page, safe_size = normalize(page, size)
    offset = (safe_page - 1) * safe_size
    total = int(
        db.execute(
            text(
                """
                SELECT COUNT(*)
                FROM browse_history h
                JOIN tea t ON t.id = h.tea_id
                WHERE h.user_id = :userId
                  AND t.status = 'published' AND t.deleted_at IS NULL
                """
            ),
            {"userId": user_id},
        ).scalar_one()
    )
    if total == 0:
        return [], 0
    rows = db.execute(
        text(
            f"""
            SELECT {TEA_COLUMNS},
                   h.viewed_at AS viewedAt
            FROM browse_history h
            JOIN tea t ON t.id = h.tea_id
            JOIN tea_category c ON c.id = t.category_id
            JOIN tea_subcategory s ON s.id = t.subcategory_id
            WHERE h.user_id = :userId
              AND t.status = 'published' AND t.deleted_at IS NULL
            ORDER BY h.viewed_at DESC
            LIMIT :limit OFFSET :offset
            """
        ),
        {"userId": user_id, "limit": safe_size, "offset": offset},
    ).mappings().all()
    items = [
        {"teaId": row["teaId"], "tea": _summary_from_row(row), "viewedAt": iso(row["viewedAt"])}
        for row in rows
    ]
    return items, total


def record_history(db: Session, user_id: int, tea_id: Optional[int]) -> None:
    _require_published(db, tea_id)
    existing = db.execute(
        select(BrowseHistory).where(
            BrowseHistory.user_id == user_id, BrowseHistory.tea_id == tea_id
        ).limit(1)
    ).scalars().first()
    if existing is not None:
        existing.viewed_at = now()
    else:
        db.add(BrowseHistory(user_id=user_id, tea_id=tea_id, viewed_at=now()))
    db.flush()
    _trim_history(db, user_id)
    db.commit()


def clear_history(db: Session, user_id: int) -> None:
    db.execute(delete(BrowseHistory).where(BrowseHistory.user_id == user_id))
    db.commit()


def _trim_history(db: Session, user_id: int) -> None:
    ids = db.execute(
        select(BrowseHistory.id)
        .where(BrowseHistory.user_id == user_id)
        .order_by(BrowseHistory.viewed_at.desc(), BrowseHistory.id.desc())
    ).scalars().all()
    if len(ids) <= HISTORY_LIMIT:
        return
    db.execute(delete(BrowseHistory).where(BrowseHistory.id.in_(ids[HISTORY_LIMIT:])))


# ---------------- 对比篮 ----------------

def compare(db: Session, user_id: int) -> dict:
    rows = db.execute(
        text(
            f"""
            SELECT {TEA_COLUMNS},
                   ci.sort_order AS sortOrder,
                   ci.created_at AS createdAt
            FROM compare_item ci
            JOIN tea t ON t.id = ci.tea_id
            JOIN tea_category c ON c.id = t.category_id
            JOIN tea_subcategory s ON s.id = t.subcategory_id
            WHERE ci.user_id = :userId
              AND t.status = 'published' AND t.deleted_at IS NULL
            ORDER BY ci.sort_order ASC, ci.id ASC
            """
        ),
        {"userId": user_id},
    ).mappings().all()
    return {"items": [_to_compare_item(db, row) for row in rows], "limit": COMPARE_LIMIT}


def compare_by_ids(db: Session, ids: list[int]) -> dict:
    if not ids or len(ids) < 2:
        raise BizException(ErrorCode.SYS_001, "请至少选择 2 款茶品进行对比")
    distinct = list(dict.fromkeys(ids))[:COMPARE_LIMIT]
    stmt = text(
        f"""
        SELECT {TEA_COLUMNS}
        FROM tea t
        JOIN tea_category c ON c.id = t.category_id
        JOIN tea_subcategory s ON s.id = t.subcategory_id
        WHERE t.status = 'published' AND t.deleted_at IS NULL
          AND t.id IN :ids
        ORDER BY t.name_pinyin ASC, t.id ASC
        """
    ).bindparams(bindparam("ids", expanding=True))
    rows = db.execute(stmt, {"ids": distinct}).mappings().all()
    return {"items": [_to_compare_item(db, row) for row in rows], "limit": COMPARE_LIMIT}


def add_compare(db: Session, user_id: int, tea_id: Optional[int]) -> dict:
    _require_published(db, tea_id)
    count = int(
        db.execute(
            select(func.count()).select_from(CompareItem).where(CompareItem.user_id == user_id)
        ).scalar_one()
    )
    exists = int(
        db.execute(
            select(func.count())
            .select_from(CompareItem)
            .where(CompareItem.user_id == user_id, CompareItem.tea_id == tea_id)
        ).scalar_one()
    )
    if exists == 0:
        if count >= COMPARE_LIMIT:
            raise BizException(ErrorCode.CATALOG_002, "对比篮最多 3 款，请先移除")
        db.add(
            CompareItem(
                user_id=user_id, tea_id=tea_id, sort_order=count + 1, created_at=now()
            )
        )
    db.commit()
    return compare(db, user_id)


def remove_compare(db: Session, user_id: int, tea_id: Optional[int]) -> dict:
    stmt = delete(CompareItem).where(CompareItem.user_id == user_id)
    if tea_id is not None:
        stmt = stmt.where(CompareItem.tea_id == tea_id)
    db.execute(stmt)
    db.commit()
    return compare(db, user_id)


def _to_compare_item(db: Session, row) -> dict:
    summary = _summary_from_row(row)
    try:
        detail = _compare_detail(db, int(row["teaId"]))
    except BizException:
        # 已下架茶品不展示对比细节
        detail = {}
    return {"tea": summary, "detail": detail}


def _compare_detail(db: Session, tea_id: int) -> dict[str, str]:
    from app.services import catalog_service

    tea_detail = catalog_service.detail(db, tea_id)
    detail: dict[str, str] = {
        "茶类": f"{tea_detail['category']['name']} / {tea_detail['subcategory']['name']}",
        "等级": "、".join(tea_detail["grades"]) if tea_detail["grades"] else "未分档",
        "年份": "未录入"
        if tea_detail["productionYear"] is None
        else f"{tea_detail['productionYear']}（{tea_detail['yearBand']}）",
        "产地": "、".join(tea_detail["origin"]["primary"])
        if tea_detail["origin"]["primary"]
        else "未录入",
        "品质标签": "、".join(tea_detail["quality"]["tags"])
        if tea_detail["quality"]["tags"]
        else "未录入",
    }
    labels = {
        "waterTemp": "水温",
        "teaAmount": "茶水比",
        "vessel": "器皿",
        "firstSteep": "首次出汤",
        "steepTimes": "冲泡次数",
    }
    for key, value in tea_detail["brewing"].items():
        detail[labels.get(key, key)] = value
    return detail


def year_band(year: Optional[int]) -> Optional[str]:
    """年份分档：≤3 年新茶，4–10 年中期茶，>10 年老茶；未录年份返回 None。"""
    if year is None:
        return None
    age = now().year - int(year)
    if age <= 3:
        return "新茶"
    if age <= 10:
        return "中期茶"
    return "老茶"


# ---------------- 评论 ----------------

def comments(
    db: Session, tea_id: int, viewer_id: Optional[int], page: int, size: int
) -> tuple[list[dict], int]:
    _require_published(db, tea_id)
    safe_page, safe_size = normalize(page, size)
    stmt = select(Comment).where(Comment.tea_id == tea_id, Comment.deleted_at.is_(None))
    if viewer_id is not None:
        stmt = stmt.where(
            or_(
                Comment.status == "published",
                and_(Comment.user_id == viewer_id, Comment.status.in_(("pending", "rejected"))),
            )
        )
    else:
        stmt = stmt.where(Comment.status == "published")
    stmt = stmt.order_by(Comment.created_at.desc(), Comment.id.desc())
    total = int(
        db.execute(select(func.count()).select_from(stmt.subquery())).scalar_one()
    )
    rows = db.execute(
        stmt.limit(safe_size).offset((safe_page - 1) * safe_size)
    ).scalars().all()
    liked_ids = _liked_comment_ids(db, viewer_id, [row.id for row in rows])
    profiles = _profiles(db, [row.user_id for row in rows])
    items = [_to_comment_item(db, row, profiles, liked_ids) for row in rows]
    return items, total


def add_comment(
    db: Session, user_id: int, tea_id: int, content: Optional[str], image_id: Optional[int]
) -> dict:
    _require_published(db, tea_id)
    trimmed = (content or "").strip()
    if not trimmed or len(trimmed) > COMMENT_MAX_LENGTH:
        raise BizException(ErrorCode.SYS_001, "评论需为 1–200 字")
    if any(word in trimmed for word in BANNED_WORDS):
        raise BizException(ErrorCode.SYS_001, "评论包含导流或链接信息，请修改后重试")
    comment = Comment(
        tea_id=tea_id,
        user_id=user_id,
        content=trimmed,
        image_id=image_id,
        status="pending",
        like_count=0,
        created_at=now(),
        updated_at=now(),
    )
    db.add(comment)
    db.flush()
    profiles = _profiles(db, [user_id])
    result = _to_comment_item(db, comment, profiles, set())
    db.commit()
    return result


def delete_comment(db: Session, user_id: int, comment_id: int) -> None:
    comment = db.get(Comment, comment_id)
    if comment is None or comment.deleted_at is not None:
        raise BizException(ErrorCode.CATALOG_001, "评论不存在")
    if comment.user_id != user_id:
        raise BizException(ErrorCode.AUTH_003)
    comment.status = "deleted"
    comment.deleted_at = now()
    db.commit()


def comment_owner(db: Session, comment_id: int) -> Optional[int]:
    comment = db.get(Comment, comment_id)
    if comment is None or comment.deleted_at is not None:
        return None
    return comment.user_id


def restore_comment(db: Session, comment_id: int) -> None:
    """申诉翻案后恢复评论展示。"""
    comment = db.get(Comment, comment_id)
    if comment is not None and comment.deleted_at is None and comment.status == "rejected":
        comment.status = "published"
        comment.reject_reason = None
        db.commit()


def like_comment(db: Session, user_id: int, comment_id: int) -> None:
    comment = _require_published_comment(db, comment_id)
    exists = int(
        db.execute(
            select(func.count())
            .select_from(CommentLike)
            .where(CommentLike.comment_id == comment_id, CommentLike.user_id == user_id)
        ).scalar_one()
    )
    if exists == 0:
        db.add(CommentLike(comment_id=comment_id, user_id=user_id, created_at=now()))
        db.flush()
    _refresh_like_count(db, comment)
    db.commit()


def unlike_comment(db: Session, user_id: int, comment_id: int) -> None:
    comment = _require_published_comment(db, comment_id)
    db.execute(
        delete(CommentLike).where(
            CommentLike.comment_id == comment_id, CommentLike.user_id == user_id
        )
    )
    _refresh_like_count(db, comment)
    db.commit()


def _refresh_like_count(db: Session, comment: Comment) -> None:
    count = int(
        db.execute(
            select(func.count())
            .select_from(CommentLike)
            .where(CommentLike.comment_id == comment.id)
        ).scalar_one()
    )
    comment.like_count = count
    db.flush()


def _require_published_comment(db: Session, comment_id: int) -> Comment:
    comment = db.get(Comment, comment_id)
    if comment is None or comment.deleted_at is not None or comment.status != "published":
        raise BizException(ErrorCode.CATALOG_001, "评论不存在或未通过审核")
    return comment


def _liked_comment_ids(
    db: Session, viewer_id: Optional[int], comment_ids: list[int]
) -> set[int]:
    if viewer_id is None or not comment_ids:
        return set()
    return set(
        db.execute(
            select(CommentLike.comment_id).where(
                CommentLike.user_id == viewer_id, CommentLike.comment_id.in_(comment_ids)
            )
        ).scalars().all()
    )


def _profiles(db: Session, user_ids: list[int]) -> dict[int, dict]:
    from app.services import account_service

    return account_service.profiles_by_ids(db, list(dict.fromkeys(user_ids)))


def _to_comment_item(
    db: Session, comment: Comment, profiles: dict[int, dict], liked_ids: set[int]
) -> dict:
    profile = profiles.get(comment.user_id) or {}
    return {
        "id": comment.id,
        "content": comment.content,
        "imageUrl": _image_url(db, comment.image_id),
        "author": {
            "nickname": profile.get("nickname") or "茶友",
            "avatarUrl": profile.get("avatarUrl"),
        },
        "likeCount": comment.like_count or 0,
        "liked": comment.id in liked_ids,
        "status": comment.status,
        "createdAt": iso(comment.created_at),
    }


def _image_url(db: Session, image_id: Optional[int]) -> Optional[str]:
    if image_id is None:
        return None
    image = db.get(MediaImage, image_id)
    if image is None or image.deleted_at is not None:
        return None
    path = image.thumb_path or image.storage_path
    return storage_service.url(path)


# ---------------- 通用 ----------------

def _require_group(group: Optional[str]) -> str:
    if group not in ("want", "drank"):
        raise BizException(ErrorCode.SYS_001, "收藏分组只能是 want 或 drank")
    return group


def _require_published(db: Session, tea_id: Optional[int]) -> None:
    if tea_id is None:
        raise BizException(ErrorCode.CATALOG_001, "茶品不存在或已下架")
    from app.services import catalog_service

    try:
        tea = catalog_service.get_tea_or_404(db, tea_id)
    except BizException as exc:
        raise BizException(ErrorCode.CATALOG_001, "茶品不存在或已下架") from exc
    if tea.deleted_at is not None or tea.status != "published":
        raise BizException(ErrorCode.CATALOG_001, "茶品不存在或已下架")


def _summary_from_row(row) -> dict:
    raw_tags = row["tags"]
    tags = [] if not raw_tags or not str(raw_tags).strip() else str(raw_tags).split(",")
    year = row["productionYear"]
    cover = row["coverPath"]
    return {
        "id": row["teaId"],
        "name": row["name"],
        "categoryCode": row["categoryCode"],
        "categoryName": row["categoryName"],
        "subcategoryCode": row["subcategoryCode"],
        "subcategoryName": row["subcategoryName"],
        "grade": row["grade"],
        "productionYear": year,
        "yearBand": year_band(year),
        "originPrimary": row["originPrimary"],
        "coverUrl": storage_service.url(cover) if cover else None,
        "tags": tags,
    }
