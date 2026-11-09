"""投稿：T1/T3/T4 必填差异、日限额、锁定、授权落库与用户实拍。"""

import pytest
from sqlalchemy import select

from app.core.errors import BizException, ErrorCode
from app.models.media import GalleryUserShot
from app.models.submission import Submission
from app.services import moderation_service, submission_service
from tests.factories import (
    add_image,
    auth_headers,
    create_isolated_category,
    create_tea,
    create_user,
)

PNG_1X1 = bytes.fromhex(
    "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489"
    "0000000a49444154789c6360000002000100ffff03000006000557bfabd4"
    "0000000049454e44ae426082"
)


def test_t1_body_shorter_than_300_rejected_at_submit(db):
    user = create_user(db)
    tea = create_tea(db)
    created = submission_service.create(
        db, user, {"type": "T1", "teaId": tea, "title": "短正文", "body": "太短"}
    )
    with pytest.raises(BizException) as exc:
        submission_service.submit(db, user, created["id"])
    assert exc.value.spec == ErrorCode.SYS_001


def test_t3_requires_license_on_create(db):
    user = create_user(db)
    tea = create_tea(db)
    with pytest.raises(BizException) as exc:
        submission_service.create(db, user, {"type": "T3", "teaId": tea, "licenseGranted": False})
    assert "授权" in exc.value.message


def test_t3_rejects_image_uploaded_by_other_user(db):
    owner = create_user(db)
    other = create_user(db)
    tea = create_tea(db)
    image_id = add_image(db, tea, seq=20, uploaded_by=other)
    with pytest.raises(BizException) as exc:
        submission_service.create(
            db,
            owner,
            {"type": "T3", "teaId": tea, "imageIds": [image_id], "licenseGranted": True},
        )
    assert exc.value.spec == ErrorCode.SYS_001


def test_t4_reason_shorter_than_20_rejected_at_submit(db):
    user = create_user(db)
    tea = create_tea(db)
    created = submission_service.create(
        db,
        user,
        {
            "type": "T4",
            "teaId": tea,
            "correctionFieldKey": "name",
            "newValue": "更正后的茶名",
            "reason": "太短",
        },
    )
    with pytest.raises(BizException) as exc:
        submission_service.submit(db, user, created["id"])
    assert "20" in exc.value.message


def test_daily_quota_blocks_fourth_submit(db):
    user = create_user(db)
    body = "茶" * 320
    submitted = 0
    for index in range(3):
        tea = create_tea(db)
        created = submission_service.create(
            db,
            user,
            {"type": "T1", "teaId": tea, "title": f"当日第{index + 1}篇", "body": body},
        )
        submission_service.submit(db, user, created["id"])
        submitted += 1
    assert submitted == 3

    fourth_tea = create_tea(db)
    fourth = submission_service.create(
        db,
        user,
        {"type": "T1", "teaId": fourth_tea, "title": "当日第4篇", "body": body},
    )
    with pytest.raises(BizException) as exc:
        submission_service.submit(db, user, fourth["id"])
    assert exc.value.spec == ErrorCode.SUB_001


def test_locked_submission_cannot_resubmit(db):
    user = create_user(db)
    tea = create_tea(db)
    created = submission_service.create(
        db, user, {"type": "T1", "teaId": tea, "title": "锁定用例", "body": "茶" * 320}
    )
    submission = db.get(Submission, created["id"])
    submission.status = "locked"
    db.commit()
    with pytest.raises(BizException) as exc:
        submission_service.resubmit(db, user, created["id"])
    assert exc.value.spec == ErrorCode.SUB_004


def test_t3_upload_persists_license_and_creates_user_shot(client, db):
    user = create_user(db)
    tea = create_tea(db, status="published")
    upload = client.post(
        "/api/v1/me/uploads",
        data={"teaId": str(tea), "type": "dry"},
        files={"file": ("补图.png", PNG_1X1, "image/png")},
        headers=auth_headers(user),
    )
    assert upload.status_code == 200
    image_id = upload.json()["data"]["id"]

    created = submission_service.create(
        db,
        user,
        {"type": "T3", "teaId": tea, "imageIds": [image_id], "licenseGranted": True},
    )
    detail = submission_service.detail(db, user, created["id"])
    assert detail["licenseGranted"] is True
    submission_service.submit(db, user, created["id"])

    admin = create_user(db)
    moderation_service.review_submission(db, admin, created["id"], "approve", None)
    shot = (
        db.execute(
            select(GalleryUserShot).where(GalleryUserShot.submission_id == created["id"])
        )
        .scalars()
        .first()
    )
    assert shot is not None
    assert bool(shot.license_granted) is True
    assert shot.status == "candidate"
