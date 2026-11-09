"""测试数据工厂：只创建用例所需的最小数据，唯一后缀避免相互污染。"""

import uuid
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import Role, jwt_service, token_store
from app.core.timeutil import now
from app.models.account import UserIdentity, UserProfile
from app.models.catalog import (
    Tea,
    TeaCategory,
    TeaGrade,
    TeaSubcategory,
    TeaTag,
)
from app.models.media import MediaImage
from app.models.tag import Tag

TAG_DIMENSIONS = ("shape", "color", "soup", "ferment", "aroma")


def suffix() -> str:
    return uuid.uuid4().hex[:8]


def create_user(db: Session, nickname: str | None = None, status: str = "active") -> int:
    identity = UserIdentity(
        openid=f"test-openid-{suffix()}", status=status, registered_at=now()
    )
    db.add(identity)
    db.flush()
    db.add(UserProfile(user_id=identity.id, nickname=nickname or f"测试茶友{identity.id}"))
    db.commit()
    return int(identity.id)


def auth_headers(user_id: int, role: str = "USER", status: str = "active") -> dict:
    issued = jwt_service.issue_access_token(user_id, Role.parse(role), status)
    token_store.mark_access(issued.jti, user_id, issued.expires_in)
    return {"Authorization": f"Bearer {issued.token}"}


def _category_pair(db: Session) -> tuple[int, int]:
    category = db.execute(select(TeaCategory).order_by(TeaCategory.id)).scalars().first()
    subcategory = (
        db.execute(
            select(TeaSubcategory)
            .where(TeaSubcategory.category_id == category.id)
            .order_by(TeaSubcategory.id)
        )
        .scalars()
        .first()
    )
    return int(category.id), int(subcategory.id)


def create_isolated_category(db: Session) -> tuple[int, str, int, str]:
    """为单个用例新建独立分类/亚类，配合 subcategory 过滤避免用例间计数串扰。"""
    stamp = suffix()
    category = TeaCategory(code=f"tcat{stamp}", name=f"测试类{stamp}", sort_order=99)
    db.add(category)
    db.flush()
    subcategory = TeaSubcategory(
        category_id=category.id,
        code=f"tsub{stamp}",
        name=f"测试亚类{stamp}",
        content_status="normal",
        sort_order=1,
    )
    db.add(subcategory)
    db.commit()
    return int(category.id), category.code, int(subcategory.id), subcategory.code


def create_tea(
    db: Session,
    *,
    name: str | None = None,
    year: int | None = None,
    status: str = "published",
    category_id: int | None = None,
    subcategory_id: int | None = None,
) -> int:
    if category_id is None or subcategory_id is None:
        category_id, subcategory_id = _category_pair(db)
    stamp = suffix()
    tea = Tea(
        tea_code=f"TST{stamp}",
        name=name or f"测试茶{stamp}",
        name_pinyin=f"ceshi{stamp}",
        name_initials="cs",
        category_id=category_id,
        subcategory_id=subcategory_id,
        production_year=year,
        status=status,
        image_count=0,
        gallery_ready=False,
        published_version=1 if status == "published" else 0,
        version=1,
        published_at=now() if status == "published" else None,
        last_update_at=now(),
    )
    db.add(tea)
    db.commit()
    return int(tea.id)


def add_grade(db: Session, tea_id: int, grade: str, sort_order: int = 0) -> None:
    db.add(TeaGrade(tea_id=tea_id, grade=grade, sort_order=sort_order))
    db.commit()


def add_image(
    db: Session,
    tea_id: int,
    *,
    seq: int = 1,
    status: str = "published",
    uploaded_by: int | None = None,
    image_type: str = "dry",
) -> int:
    image = MediaImage(
        tea_id=tea_id,
        image_type=image_type,
        seq=seq,
        storage_path=f"test/{tea_id}/{seq}.jpg",
        thumb_path=None,
        display_path=None,
        original_name=f"{seq}.jpg",
        mime="image/jpeg",
        size_bytes=1024,
        source_type="self",
        status=status,
        uploaded_by=uploaded_by,
        created_at=now(),
        updated_at=now(),
    )
    db.add(image)
    db.commit()
    return int(image.id)


def grant_five_dimensions(db: Session, tea_id: int) -> None:
    for dimension in TAG_DIMENSIONS:
        tag = (
            db.execute(
                select(Tag).where(Tag.dimension == dimension, Tag.status == "enabled")
            )
            .scalars()
            .first()
        )
        if tag is None:
            tag = Tag(dimension=dimension, name=f"{dimension}-{suffix()}", status="enabled")
            db.add(tag)
            db.flush()
        db.add(TeaTag(tea_id=tea_id, tag_id=int(tag.id)))
    db.commit()


def utc_naive(value: datetime) -> datetime:
    return value
