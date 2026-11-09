"""安全验收自检（SECURITY §14 #1–#10）。

可在测试库 + 本地 Redis 上验证的项逐条用例化；依赖外部环境（mysqldump/Docker）的
备份恢复仅做静态检查，实跑口径在 DEFECTS.md 标注“未验证”。
"""

import json
import time
import uuid
from pathlib import Path

import jwt
import pytest
from sqlalchemy import select

from app.core import ratelimit
from app.core.config import settings
from app.core.security import token_store
from app.core.timeutil import now
from app.models.account import AdminWhitelist, UserIdentity
from app.models.audit import AuditLog
from app.models.catalog import Tea
from app.services import admin_catalog_service, submission_service, whitelist_service
from tests.factories import (
    add_image,
    auth_headers,
    create_isolated_category,
    create_tea,
    create_user,
    grant_five_dimensions,
)

PNG_1X1 = bytes.fromhex(
    "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489"
    "0000000a49444154789c6360000002000100ffff03000006000557bfabd4"
    "0000000049454e44ae426082"
)
REPO_ROOT = Path(__file__).resolve().parents[2]


def _redis_available() -> bool:
    try:
        return bool(token_store._redis.ping())
    except Exception:
        return False


@pytest.fixture(autouse=True)
def _reset_rate_limit_keys():
    """清空限流键，避免同一分钟内多次跑测试造成误伤。"""
    try:
        keys = ratelimit._redis.keys("mm:rate:*")
        if keys:
            ratelimit._redis.delete(*keys)
    except Exception:
        pass
    yield


# ---------------- #1 认证 ----------------

def test_forged_jwt_signature_rejected(client, db):
    user = create_user(db)
    claims = {
        "sub": str(user),
        "jti": uuid.uuid4().hex,
        "role": "SUPER",
        "status": "active",
        "exp": int(time.time()) + 3600,
    }
    forged = jwt.encode(claims, "wrong-secret", algorithm="HS256")
    response = client.get("/api/v1/me/profile", headers={"Authorization": f"Bearer {forged}"})
    assert response.status_code == 401
    assert response.json()["code"] == "MM-AUTH-001"


def test_expired_jwt_rejected(client, db):
    user = create_user(db)
    expired = jwt.encode(
        {"sub": str(user), "jti": uuid.uuid4().hex, "role": "USER", "exp": int(time.time()) - 60},
        settings.jwt_secret,
        algorithm="HS256",
    )
    response = client.get("/api/v1/me/profile", headers={"Authorization": f"Bearer {expired}"})
    assert response.status_code == 401


def test_tampered_jwt_payload_rejected(client, db):
    valid = auth_headers(create_user(db))["Authorization"].split(" ", 1)[1]
    head, payload, signature = valid.split(".")
    payload = payload[:-4] + ("AAAA" if payload[-4:] != "AAAA" else "BBBB")
    response = client.get(
        "/api/v1/me/profile", headers={"Authorization": f"Bearer {head}.{payload}.{signature}"}
    )
    assert response.status_code == 401


def test_refresh_token_replay_rejected(client, db):
    if not _redis_available():
        pytest.skip("Redis 不可用，refresh 重放无法验证")
    user = create_user(db)
    refresh_token = uuid.uuid4().hex
    token_store.save_refresh(refresh_token, user, 600)
    first = client.post("/api/v1/auth/refresh", json={"refreshToken": refresh_token})
    assert first.status_code == 200
    second = client.post("/api/v1/auth/refresh", json={"refreshToken": refresh_token})
    assert second.status_code == 401
    assert second.json()["code"] == "MM-AUTH-002"


# ---------------- #2 越权 ----------------

def test_visitor_me_returns_401(client):
    response = client.get("/api/v1/me/profile")
    assert response.status_code == 401
    assert response.json()["code"] == "MM-AUTH-001"


def test_user_cannot_read_others_submission(client, db):
    owner = create_user(db)
    other = create_user(db)
    tea = create_tea(db)
    created = submission_service.create(
        db, owner, {"type": "T1", "teaId": tea, "title": "他人投稿", "body": "茶" * 320}
    )
    response = client.get(
        f"/api/v1/me/submissions/{created['id']}", headers=auth_headers(other)
    )
    assert response.status_code == 404


def test_user_cannot_enter_admin(client, db):
    response = client.get("/api/v1/admin/teas", headers=auth_headers(create_user(db)))
    assert response.status_code == 403
    assert response.json()["code"] == "MM-AUTH-003"


# ---------------- #3 管理员白名单 ----------------

def _openid_of(db, user_id: int) -> str:
    return db.get(UserIdentity, user_id).openid


def test_non_whitelisted_user_gets_user_role(client, db):
    user = create_user(db)
    login = client.post(
        "/api/v1/auth/dev-login", json={"openid": _openid_of(db, user), "nickname": "普通茶友"}
    )
    assert login.status_code == 200
    assert login.json()["data"]["user"]["role"].upper() == "USER"
    token = login.json()["data"]["accessToken"]
    denied = client.get("/api/v1/admin/teas", headers={"Authorization": f"Bearer {token}"})
    assert denied.status_code == 403


def test_whitelist_removal_revokes_existing_token(client, db):
    if not _redis_available():
        pytest.skip("Redis 不可用，白名单即时失效无法验证")
    user = create_user(db)
    whitelist = AdminWhitelist(
        openid=_openid_of(db, user), user_id=user, role="admin", created_at=now()
    )
    db.add(whitelist)
    db.commit()
    db.refresh(whitelist)

    login = client.post(
        "/api/v1/auth/dev-login", json={"openid": whitelist.openid, "nickname": "测试管理员"}
    )
    token = login.json()["data"]["accessToken"]
    headers = {"Authorization": f"Bearer {token}"}
    assert client.get("/api/v1/admin/teas", headers=headers).status_code == 200

    operator = create_user(db)
    whitelist_service.remove(db, whitelist.id, operator)
    after = client.get("/api/v1/admin/teas", headers=headers)
    assert after.status_code == 401


# ---------------- #4 上传 ----------------

def test_upload_rejects_fake_extension(client, db):
    user = create_user(db)
    tea = create_tea(db, status="published")
    response = client.post(
        "/api/v1/me/uploads",
        data={"teaId": str(tea), "type": "dry"},
        files={"file": ("fake.jpg", b"MZ\x90\x00\x03\x00\x00\x00", "image/jpeg")},
        headers=auth_headers(user),
    )
    assert response.status_code == 400
    assert response.json()["code"] == "MM-MEDIA-001"


def test_upload_rejects_wrong_mime(client, db):
    user = create_user(db)
    tea = create_tea(db, status="published")
    response = client.post(
        "/api/v1/me/uploads",
        data={"teaId": str(tea), "type": "dry"},
        files={"file": ("photo.png", PNG_1X1, "text/plain")},
        headers=auth_headers(user),
    )
    assert response.status_code == 400
    assert response.json()["code"] == "MM-MEDIA-001"


def test_upload_rejects_oversize(client, db):
    user = create_user(db)
    tea = create_tea(db, status="published")
    oversize = b"\xff\xd8\xff" + b"0" * (6 * 1024 * 1024)
    response = client.post(
        "/api/v1/me/uploads",
        data={"teaId": str(tea), "type": "dry"},
        files={"file": ("big.jpg", oversize, "image/jpeg")},
        headers=auth_headers(user),
    )
    assert response.status_code == 413
    assert response.json()["code"] == "MM-MEDIA-002"


def test_upload_path_traversal_filename_is_neutralized(client, db):
    user = create_user(db)
    tea = create_tea(db, status="published")
    response = client.post(
        "/api/v1/me/uploads",
        data={"teaId": str(tea), "type": "dry"},
        files={"file": ("../../../evil.png", PNG_1X1, "image/png")},
        headers=auth_headers(user),
    )
    assert response.status_code == 200
    url = response.json()["data"]["url"]
    assert url.startswith("/uploads/")
    assert ".." not in url


# ---------------- #5 注入 ----------------

def test_search_injection_returns_empty_without_error(client):
    response = client.get("/api/v1/search", params={"q": "' OR 1=1 --"})
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["total"] == 0 and data["items"] == []


def test_invalid_sort_falls_back_without_error(client):
    response = client.get("/api/v1/teas", params={"sort": "name_pinyin; DROP TABLE tea"})
    assert response.status_code == 200
    assert response.json()["code"] == "OK"


def test_xss_text_is_returned_as_json_not_html(client, db):
    user = create_user(db)
    tea = create_tea(db, status="published")
    payload = "<script>alert(1)</script>"
    response = client.post(
        f"/api/v1/teas/{tea}/comments",
        json={"content": payload},
        headers=auth_headers(user),
    )
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("application/json")
    assert response.json()["data"]["content"] == payload


# ---------------- #6 限流 ----------------

def test_submission_quota_over_http_returns_403(client, db):
    user = create_user(db)
    headers = auth_headers(user)
    body = {"title": "额度用例", "body": "茶" * 320}
    for index in range(3):
        tea = create_tea(db)
        created = submission_service.create(
            db, user, {"type": "T1", "teaId": tea, "title": f"第{index + 1}篇", "body": "茶" * 320}
        )
        submitted = client.post(
            f"/api/v1/me/submissions/{created['id']}/submit", headers=headers
        )
        assert submitted.status_code == 200
    fourth_tea = create_tea(db)
    fourth = submission_service.create(
        db, user, {"type": "T1", "teaId": fourth_tea, **body}
    )
    blocked = client.post(f"/api/v1/me/submissions/{fourth['id']}/submit", headers=headers)
    assert blocked.status_code == 403
    assert blocked.json()["code"] == "MM-SUB-001"


def test_duplicate_report_over_http_returns_409(client, db):
    user = create_user(db)
    headers = auth_headers(user)
    payload = {
        "objectType": "comment",
        "objectId": 990000001,
        "reportType": "违规",
        "description": "评论含导流信息",
    }
    first = client.post("/api/v1/reports", json=payload, headers=headers)
    assert first.status_code == 200
    second = client.post("/api/v1/reports", json=payload, headers=headers)
    assert second.status_code == 409
    assert second.json()["code"] == "MM-GOV-001"


def test_over_frequency_returns_429(client):
    if not _redis_available():
        pytest.skip("Redis 不可用，限流无法验证")
    statuses = [client.post("/api/v1/auth/qrcode").status_code for _ in range(11)]
    assert statuses[:10] == [200] * 10
    assert statuses[10] == 429
    assert client.post("/api/v1/auth/qrcode").json()["code"] == "MM-SYS-002"


# ---------------- #7 隐私 ----------------

def test_responses_do_not_leak_openid_token_or_absolute_path(client, db):
    user = create_user(db)
    tea = create_tea(db)
    created = submission_service.create(
        db, user, {"type": "T1", "teaId": tea, "title": "隐私用例", "body": "茶" * 320}
    )
    snippets = [
        client.get("/api/v1/me/profile", headers=auth_headers(user)).text,
        client.get(f"/api/v1/me/submissions/{created['id']}", headers=auth_headers(user)).text,
        client.get(f"/api/v1/teas/{tea}").text,
    ]
    for text in snippets:
        assert "openid" not in text.lower()
        assert "Bearer " not in text
        assert "C:\\\\" not in text and "/Users/" not in text and "/d/" not in text


# ---------------- #8 审计 ----------------

def _ready_draft(db) -> int:
    category_id, _code, subcategory_id, _sub = create_isolated_category(db)
    tea_id = create_tea(db, status="draft", category_id=category_id, subcategory_id=subcategory_id)
    for seq in range(1, 5):
        add_image(db, tea_id, seq=seq, status="published")
    grant_five_dimensions(db, tea_id)
    return tea_id


def test_review_writes_audit_and_api_cannot_delete(client, db):
    tea_id = _ready_draft(db)
    admin_catalog_service.submit(db, tea_id)
    admin_catalog_service.review(db, tea_id, "approve", None, None)
    audit = (
        db.execute(
            select(AuditLog).where(AuditLog.action == "tea_review", AuditLog.object_id == tea_id)
        )
        .scalars()
        .first()
    )
    assert audit is not None
    assert json.loads(audit.after_state) == {"status": "published"}

    super_headers = auth_headers(create_user(db), role="SUPER")
    deleted = client.delete("/api/v1/admin/audit-logs", headers=super_headers)
    assert deleted.status_code == 405


# ---------------- #9 注销 ----------------

def test_deletion_cooling_blocks_writes_but_allows_reads(client, db):
    user = create_user(db)
    headers = auth_headers(user)
    assert client.post("/api/v1/me/deletion", headers=headers).status_code == 200

    # 注销申请会撤销旧令牌，重新签发后验证冷静期门禁
    cooling = auth_headers(user)
    tea = create_tea(db)
    blocked = client.post(
        "/api/v1/me/submissions",
        json={"type": "T1", "teaId": tea, "title": "冷静期投稿", "body": "茶" * 320},
        headers=cooling,
    )
    assert blocked.status_code == 403
    assert blocked.json()["code"] == "MM-AUTH-004"
    assert client.get("/api/v1/me/profile", headers=cooling).status_code == 200

    assert client.delete("/api/v1/me/deletion", headers=cooling).status_code == 200
    resumed = client.post(
        "/api/v1/me/submissions",
        json={"type": "T1", "teaId": tea, "title": "撤销后投稿", "body": "茶" * 320},
        headers=auth_headers(user),
    )
    assert resumed.status_code == 200


# ---------------- #10 备份（静态检查） --------------

def test_backup_script_and_restore_notes_exist():
    script = REPO_ROOT / "deploy" / "backup.sh"
    assert script.exists(), "deploy/backup.sh 缺失"
    content = script.read_text(encoding="utf-8")
    assert "mysqldump" in content
    assert "uploads" in content


def test_tea_status_after_submit_is_pending(db):
    """辅助断言：状态机入口未旁路（#8 审计前置条件）。"""
    tea_id = _ready_draft(db)
    admin_catalog_service.submit(db, tea_id)
    assert db.get(Tea, tea_id).status == "pending"
