"""图鉴媒体（M03）：公开图片读取与管理端上传/删除。

上传校验与派生图由 core.storage 承担；入库后调用 catalog 的图鉴状态重算，
保持单向依赖（对应原 Java MediaChangedEvent 监听）。
"""

from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from app.core.errors import BizException, ErrorCode
from app.core.storage import storage_service
from app.core.timeutil import iso, now
from app.models.catalog import Tea
from app.models.media import GalleryUserShot, MediaImage

# 展示顺序：干茶 → 汤色 → 叶底 → 包装 → 细节（PRD R-22）
TYPE_ORDER = ("dry", "soup", "leaf", "pack", "detail")
TYPES = set(TYPE_ORDER)

_TYPE_ORDER = case(
    (MediaImage.image_type == "dry", 0),
    (MediaImage.image_type == "soup", 1),
    (MediaImage.image_type == "leaf", 2),
    (MediaImage.image_type == "pack", 3),
    (MediaImage.image_type == "detail", 4),
    else_=5,
)


def _thumb_path(image: MediaImage) -> str:
    return image.thumb_path if image.thumb_path is not None else image.storage_path


def to_item(image: MediaImage) -> dict:
    return {
        "id": image.id,
        "teaId": image.tea_id,
        "type": image.image_type,
        "seq": image.seq,
        "url": storage_service.url(image.storage_path),
        "thumbUrl": storage_service.url(_thumb_path(image)),
        "status": image.status,
        "sourceType": image.source_type,
        "rightsHolder": image.rights_holder,
        "licenseScope": image.license_scope,
        "licenseCertNo": image.license_cert_no,
        "createdAt": iso(image.created_at),
    }


def published_images(db: Session, tea_id: int) -> list[dict]:
    rows = (
        db.execute(
            select(MediaImage)
            .where(
                MediaImage.tea_id == tea_id,
                MediaImage.status == "published",
                MediaImage.deleted_at.is_(None),
            )
            .order_by(_TYPE_ORDER, MediaImage.seq.asc(), MediaImage.id.asc())
        )
        .scalars()
        .all()
    )
    return [to_item(row) for row in rows]


def gallery_ready(db: Session, tea_id: int) -> bool:
    images = published_images(db, tea_id)
    if len(images) < 4:
        return False
    return all(
        item["sourceType"] is not None
        and item["rightsHolder"] is not None
        and item["licenseCertNo"] is not None
        for item in images
    )


def count_published(db: Session, tea_id: int) -> int:
    return db.execute(
        select(func.count())
        .select_from(MediaImage)
        .where(
            MediaImage.tea_id == tea_id,
            MediaImage.status == "published",
            MediaImage.deleted_at.is_(None),
        )
    ).scalar_one()


def image_url(db: Session, image_id: int | None) -> str | None:
    """评论附图等按图片 ID 取展示地址；图片被删除时返回 None。"""
    if image_id is None:
        return None
    image = db.get(MediaImage, image_id)
    if image is None or image.deleted_at is not None:
        return None
    return storage_service.url(_thumb_path(image))


def exists_image(db: Session, image_id: int | None) -> bool:
    if image_id is None:
        return False
    image = db.get(MediaImage, image_id)
    return image is not None and image.deleted_at is None


def item(db: Session, image_id: int | None) -> dict | None:
    """按图片 ID 取完整视图，供投稿附件等跨模块只读展示。"""
    if image_id is None:
        return None
    image = db.get(MediaImage, image_id)
    if image is None or image.deleted_at is not None:
        return None
    return to_item(image)


def image_owner(db: Session, image_id: int | None) -> int | None:
    """举报对象归属：图片上传人，用于申诉资格判定。"""
    if image_id is None:
        return None
    image = db.get(MediaImage, image_id)
    return None if image is None or image.deleted_at is not None else image.uploaded_by


def user_shot_owner(db: Session, shot_id: int | None) -> int | None:
    if shot_id is None:
        return None
    shot = db.get(GalleryUserShot, shot_id)
    return None if shot is None else shot.author_id


def list_by_tea(db: Session, tea_id: int) -> list[dict]:
    rows = (
        db.execute(
            select(MediaImage)
            .where(MediaImage.tea_id == tea_id, MediaImage.deleted_at.is_(None))
            .order_by(_TYPE_ORDER, MediaImage.seq.asc(), MediaImage.id.asc())
        )
        .scalars()
        .all()
    )
    return [to_item(row) for row in rows]


def upload(
    db: Session,
    tea_id: int,
    image_type: str,
    seq: int | None,
    filename: str | None,
    content_type: str | None,
    content: bytes,
    source_type: str | None,
    rights_holder: str | None,
    license_scope: str | None,
    license_cert_no: str | None,
    operator_id: int,
) -> dict:
    if tea_id is None:
        raise BizException(ErrorCode.MEDIA_001, "缺少茶品 ID")
    if image_type not in TYPES:
        raise BizException(ErrorCode.MEDIA_001, "图片类型只能是 dry/soup/leaf/pack/detail")
    final_seq = seq if seq is not None else _next_seq(db, tea_id)
    _ensure_seq_available(db, tea_id, final_seq)

    extension = _extension_of(filename)
    relative_path = f"tea/{tea_id}/{image_type}-{final_seq}.{extension}"
    # 无扩展名时按 Java 默认 jpg 交给存储层做魔数校验
    store_name = filename if filename and "." in filename else f"upload.{extension}"
    stored = storage_service.store(store_name, content_type, content, relative_path)

    image = MediaImage(
        tea_id=tea_id,
        image_type=image_type,
        seq=final_seq,
        storage_path=stored.relative_path,
        thumb_path=stored.thumb_path,
        display_path=stored.display_path,
        original_name=filename,
        mime=content_type or "",
        size_bytes=stored.size,
        source_type=source_type,
        rights_holder=rights_holder,
        license_scope=license_scope,
        license_cert_no=license_cert_no,
        # 缺授权凭证（来源/权利人/凭证编号）只能进草稿
        status="published"
        if source_type is not None and rights_holder is not None and license_cert_no is not None
        else "draft",
        uploaded_by=operator_id,
        created_at=now(),
    )
    db.add(image)
    db.flush()

    from app.services import catalog_service

    catalog_service.sync_media_state(db, tea_id)
    db.commit()
    return to_item(image)


def upload_user_shot(
    db: Session,
    user_id: int,
    tea_id: int,
    image_type: str,
    filename: str | None,
    content_type: str | None,
    content: bytes,
) -> dict:
    """T3 用户补图：仅登录用户上传到已上架茶品，图片先入草稿，审核通过后进用户实拍。"""
    if image_type not in TYPES:
        raise BizException(ErrorCode.MEDIA_001, "图片类型只能是 dry/soup/leaf/pack/detail")
    tea = db.get(Tea, tea_id)
    if tea is None or tea.deleted_at is not None or tea.status != "published":
        raise BizException(ErrorCode.CATALOG_001, "关联茶品不存在或已下架")

    final_seq = _next_seq(db, tea_id)
    extension = _extension_of(filename)
    relative_path = f"user/{user_id}/{tea_id}/{image_type}-{final_seq}.{extension}"
    store_name = filename if filename and "." in filename else f"upload.{extension}"
    stored = storage_service.store(store_name, content_type, content, relative_path)

    nickname = _nickname(db, user_id)
    image = MediaImage(
        tea_id=tea_id,
        image_type=image_type,
        seq=final_seq,
        storage_path=stored.relative_path,
        thumb_path=stored.thumb_path,
        display_path=stored.display_path,
        original_name=filename,
        mime=content_type or "",
        size_bytes=stored.size,
        source_type="user",
        rights_holder=nickname,
        license_scope="用户投稿授权",
        license_cert_no=None,
        status="draft",
        uploaded_by=user_id,
        created_at=now(),
    )
    db.add(image)
    db.commit()
    return to_item(image)


def _nickname(db: Session, user_id: int) -> str:
    from app.services import account_service

    profile = account_service.profiles_by_ids(db, [user_id]).get(user_id) or {}
    return profile.get("nickname") or "茶友"


def delete(db: Session, image_id: int) -> None:
    image = db.get(MediaImage, image_id)
    if image is None or image.deleted_at is not None:
        raise BizException(ErrorCode.MEDIA_001, "图片不存在")
    image.deleted_at = now()
    db.flush()

    from app.services import catalog_service

    catalog_service.sync_media_state(db, image.tea_id)
    db.commit()


def _next_seq(db: Session, tea_id: int) -> int:
    # uk_image_tea_seq 覆盖软删除行，因此取全量最大序号，避免复用触发唯一键冲突
    latest = db.execute(
        select(func.max(MediaImage.seq)).where(MediaImage.tea_id == tea_id)
    ).scalar()
    return (latest or 0) + 1


def _ensure_seq_available(db: Session, tea_id: int, seq: int) -> None:
    exists = db.execute(
        select(MediaImage.id).where(MediaImage.tea_id == tea_id, MediaImage.seq == seq).limit(1)
    ).scalars().first()
    if exists is not None:
        raise BizException(ErrorCode.MEDIA_004)


def _extension_of(filename: str | None) -> str:
    if not filename or "." not in filename:
        return "jpg"
    return filename.rsplit(".", 1)[-1].lower()
