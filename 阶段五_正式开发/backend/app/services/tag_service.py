"""标签词表（M04）：公共只读选项与后台维护。

停用不删除；新增申请驳回必填理由；仅启用标签对外可见。
"""

from collections.abc import Collection

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.audit import AuditService
from app.core.errors import BizException, ErrorCode
from app.core.timeutil import iso, now
from app.models.tag import Tag, TagRequest

DIMENSIONS = ["shape", "color", "soup", "ferment", "aroma"]


def _to_item(tag: Tag) -> dict:
    return {
        "id": tag.id,
        "dimension": tag.dimension,
        "name": tag.name,
        "status": tag.status,
    }


def list_enabled(db: Session) -> list[dict]:
    rows = (
        db.execute(
            select(Tag)
            .where(Tag.status == "enabled")
            .order_by(Tag.dimension.asc(), Tag.id.asc())
        )
        .scalars()
        .all()
    )
    grouped: dict[str, list[dict]] = {dimension: [] for dimension in DIMENSIONS}
    for tag in rows:
        grouped.setdefault(tag.dimension, []).append({"code": tag.name, "label": tag.name})
    return [{"dimension": dimension, "values": values} for dimension, values in grouped.items()]


def names_by_ids(db: Session, ids: Collection[int] | None) -> list[str]:
    if not ids:
        return []
    rows = (
        db.execute(
            select(Tag)
            .where(Tag.id.in_(list(ids)), Tag.status == "enabled")
            .order_by(Tag.id.asc())
        )
        .scalars()
        .all()
    )
    return [row.name for row in rows]


def dimensions_of_ids(db: Session, ids: Collection[int] | None) -> set[str]:
    if not ids:
        return set()
    rows = (
        db.execute(select(Tag).where(Tag.id.in_(list(ids)), Tag.status == "enabled"))
        .scalars()
        .all()
    )
    return {row.dimension for row in rows}


def enabled_names_by_dimension(db: Session, dimension: str) -> set[str]:
    rows = (
        db.execute(
            select(Tag).where(Tag.dimension == dimension, Tag.status == "enabled")
        )
        .scalars()
        .all()
    )
    return {row.name for row in rows}


def list_tags(db: Session, dimension: str | None, status: str | None) -> list[dict]:
    stmt = select(Tag)
    if dimension and dimension.strip():
        stmt = stmt.where(Tag.dimension == dimension)
    if status and status.strip():
        stmt = stmt.where(Tag.status == status)
    rows = db.execute(stmt.order_by(Tag.dimension.asc(), Tag.id.asc())).scalars().all()
    return [_to_item(row) for row in rows]


def create(db: Session, dimension: str, name: str) -> dict:
    if dimension not in DIMENSIONS:
        raise BizException(ErrorCode.SYS_001, "非法的标签维度")
    trimmed = name.strip()
    if not trimmed:
        raise BizException(ErrorCode.SYS_001, "标签名不能为空")
    exists = db.execute(
        select(func.count())
        .select_from(Tag)
        .where(Tag.dimension == dimension, Tag.name == trimmed)
    ).scalar_one()
    if exists > 0:
        raise BizException(ErrorCode.SYS_001, "同维度下标签已存在")
    tag = Tag(
        dimension=dimension,
        name=trimmed,
        status="enabled",
        created_at=now(),
        updated_at=now(),
    )
    db.add(tag)
    db.flush()
    AuditService(db).record(
        "tag_create", "tag", tag.id, None, None, {"dimension": dimension, "name": trimmed}
    )
    db.commit()
    return _to_item(tag)


def update_status(db: Session, tag_id: int, status: str) -> dict:
    if status not in ("enabled", "disabled"):
        raise BizException(ErrorCode.SYS_001, "状态只能是 enabled 或 disabled")
    tag = db.get(Tag, tag_id)
    if tag is None:
        raise BizException(ErrorCode.CATALOG_001, "标签不存在")
    before = tag.status
    tag.status = status
    db.flush()
    AuditService(db).record(
        "tag_status", "tag", tag_id, None, {"status": before}, {"status": status}
    )
    db.commit()
    return _to_item(tag)


def list_requests(db: Session, status: str | None) -> list[dict]:
    stmt = select(TagRequest)
    if status and status.strip():
        stmt = stmt.where(TagRequest.status == status)
    rows = db.execute(stmt.order_by(TagRequest.created_at.desc())).scalars().all()
    return [
        {
            "id": row.id,
            "dimension": row.dimension,
            "name": row.name,
            "status": row.status,
            "reason": row.reason,
            "createdAt": iso(row.created_at),
        }
        for row in rows
    ]


def review_request(
    db: Session,
    request_id: int,
    decision: str,
    reason: str | None,
    reviewer_id: int,
) -> None:
    request = db.get(TagRequest, request_id)
    if request is None:
        raise BizException(ErrorCode.CATALOG_001, "标签申请不存在")
    if request.status != "pending":
        raise BizException(ErrorCode.CATALOG_002, "该申请已审核")
    if decision not in ("approve", "reject"):
        raise BizException(ErrorCode.SYS_001, "decision 只能是 approve 或 reject")
    if decision == "reject" and (reason is None or not reason.strip()):
        raise BizException(ErrorCode.SYS_001, "驳回必须填写理由")
    if decision == "approve":
        exists = db.execute(
            select(func.count())
            .select_from(Tag)
            .where(Tag.dimension == request.dimension, Tag.name == request.name)
        ).scalar_one()
        if exists == 0:
            db.add(
                Tag(
                    dimension=request.dimension,
                    name=request.name,
                    status="enabled",
                    created_at=now(),
                    updated_at=now(),
                )
            )
    request.status = "approved" if decision == "approve" else "rejected"
    request.reason = reason.strip() if reason is not None else None
    request.reviewed_by = reviewer_id
    request.reviewed_at = now()
    db.flush()
    AuditService(db).record(
        "tag_request_review",
        "tag_request",
        request_id,
        reason,
        {"status": "pending"},
        {"status": request.status},
    )
    db.commit()
