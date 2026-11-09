"""治理：上架条件、状态机、重复审核、举报去重、审计同事务、不可处置自己。"""

import json
from types import SimpleNamespace

import pytest
from sqlalchemy import select

from app.core.errors import BizException, ErrorCode
from app.models.audit import AuditLog
from app.models.catalog import Tea
from app.services import admin_catalog_service, moderation_service
from tests.factories import (
    add_image,
    create_isolated_category,
    create_tea,
    create_user,
    grant_five_dimensions,
)


def _ready_draft(db) -> int:
    cat_id, _cat_code, sub_id, _sub_code = create_isolated_category(db)
    tea_id = create_tea(db, status="draft", category_id=cat_id, subcategory_id=sub_id)
    for seq in range(1, 5):
        add_image(db, tea_id, seq=seq, status="published")
    grant_five_dimensions(db, tea_id)
    return tea_id


def test_submit_requires_four_images(db):
    tea_id = create_tea(db, status="draft")
    with pytest.raises(BizException) as exc:
        admin_catalog_service.submit(db, tea_id)
    assert exc.value.spec == ErrorCode.CATALOG_003


def test_review_publishes_and_writes_audit(db):
    tea_id = _ready_draft(db)
    admin_catalog_service.submit(db, tea_id)
    assert db.get(Tea, tea_id).status == "pending"

    create_user(db)
    admin_catalog_service.review(db, tea_id, "approve", None, None)
    assert db.get(Tea, tea_id).status == "published"

    audit = (
        db.execute(
            select(AuditLog).where(
                AuditLog.action == "tea_review", AuditLog.object_id == tea_id
            )
        )
        .scalars()
        .first()
    )
    assert audit is not None
    assert json.loads(audit.after_state) == {"status": "published"}


def test_repeated_review_conflicts(db):
    tea_id = _ready_draft(db)
    admin_catalog_service.submit(db, tea_id)
    admin_catalog_service.review(db, tea_id, "approve", None, None)
    with pytest.raises(BizException) as exc:
        admin_catalog_service.review(db, tea_id, "approve", None, None)
    assert exc.value.spec == ErrorCode.CATALOG_002


def test_duplicate_report_conflicts(db):
    reporter = create_user(db)
    payload = SimpleNamespace(
        objectType="comment",
        objectId=900000001,
        teaId=None,
        reportType="违规",
        description="评论含导流信息",
    )
    moderation_service.create_report(db, reporter, payload)
    with pytest.raises(BizException) as exc:
        moderation_service.create_report(db, reporter, payload)
    assert exc.value.spec == ErrorCode.GOV_001


def test_report_description_over_200_rejected(db):
    reporter = create_user(db)
    payload = SimpleNamespace(
        objectType="comment",
        objectId=900000002,
        teaId=None,
        reportType="其他",
        description="长" * 201,
    )
    with pytest.raises(BizException) as exc:
        moderation_service.create_report(db, reporter, payload)
    assert exc.value.spec == ErrorCode.SYS_001


def test_admin_cannot_sanction_self(db):
    admin_id = create_user(db)
    with pytest.raises(BizException) as exc:
        moderation_service.create_sanction(db, admin_id, admin_id, "mute", "理由", None)
    assert exc.value.spec == ErrorCode.GOV_003
