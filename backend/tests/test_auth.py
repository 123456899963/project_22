"""认证模块测试（对齐 TEST_PLAN AUTH-01 ~ AUTH-09）

覆盖：注册、重复注册、登录、错误密码、未登录访问 /me、登出、用户名可用性。
测试数据使用带时间戳的用户名避免与种子数据冲突，用例结束后清理。
"""

import time

from fastapi.testclient import TestClient

from app.core.database import SessionLocal
from app.main import app
from app.repositories import user_repo

client = TestClient(app)


def _unique_username(prefix: str = "testuser") -> str:
    # 用户名仅允许中英数（API_CONTRACT §4.1.1），不得含下划线
    return f"{prefix}{int(time.time() * 1000) % 100000}"


def _cleanup_user(username: str) -> None:
    db = SessionLocal()
    try:
        user = user_repo.get_by_username(db, username)
        if user:
            db.delete(user)
            db.commit()
    finally:
        db.close()


# ===== AUTH-01 / AUTH-02：注册 =====


def test_register_success_returns_user_and_cookie():
    username = _unique_username()
    try:
        resp = client.post(
            "/api/v1/auth/register",
            json={"username": username, "password": "tea2026"},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["code"] == 0
        data = body["data"]
        assert data["username"] == username
        assert data["role"] == "user"
        assert "id" in data and isinstance(data["id"], int)
        assert "created_at" in data
        # 密码哈希永不返回
        assert "password" not in data and "password_hash" not in data
        # 注册成功下发会话 Cookie
        assert "tea_session" in resp.cookies
    finally:
        _cleanup_user(username)


def test_register_duplicate_username_returns_40910():
    username = _unique_username()
    try:
        client.post(
            "/api/v1/auth/register",
            json={"username": username, "password": "tea2026"},
        )
        resp = client.post(
            "/api/v1/auth/register",
            json={"username": username, "password": "another2026"},
        )
        assert resp.status_code == 409
        assert resp.json()["code"] == 40910
        assert resp.json()["data"] is None
    finally:
        _cleanup_user(username)


def test_register_invalid_username_format_returns_40000():
    # 含特殊字符
    resp = client.post(
        "/api/v1/auth/register",
        json={"username": "bad@user", "password": "tea2026"},
    )
    assert resp.status_code == 400
    assert resp.json()["code"] == 40000


def test_register_short_password_returns_40000():
    resp = client.post(
        "/api/v1/auth/register",
        json={"username": _unique_username("short"), "password": "123"},
    )
    assert resp.status_code == 400
    assert resp.json()["code"] == 40000


# ===== AUTH-04 / AUTH-05：登录 =====


def test_login_success_returns_user_and_cookie():
    username = _unique_username()
    try:
        client.post(
            "/api/v1/auth/register",
            json={"username": username, "password": "tea2026"},
        )
        resp = client.post(
            "/api/v1/auth/login",
            json={"username": username, "password": "tea2026"},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["code"] == 0
        assert body["data"]["username"] == username
        assert body["data"]["role"] == "user"
        assert "tea_session" in resp.cookies
    finally:
        _cleanup_user(username)


def test_login_wrong_password_returns_40110():
    username = _unique_username()
    try:
        client.post(
            "/api/v1/auth/register",
            json={"username": username, "password": "tea2026"},
        )
        resp = client.post(
            "/api/v1/auth/login",
            json={"username": username, "password": "wrongpass"},
        )
        assert resp.status_code == 401
        assert resp.json()["code"] == 40110
    finally:
        _cleanup_user(username)


def test_login_nonexistent_user_returns_40110():
    # 用户名不存在也返回 40110（不区分，SECURITY S-04）
    resp = client.post(
        "/api/v1/auth/login",
        json={"username": "definitely_not_exist_xyz", "password": "whatever"},
    )
    assert resp.status_code == 401
    assert resp.json()["code"] == 40110


# ===== AUTH-06 / AUTH-07：当前用户 =====


def test_me_without_login_returns_40100():
    # 使用新的 TestClient 确保不带 Cookie
    c = TestClient(app)
    resp = c.get("/api/v1/auth/me")
    assert resp.status_code == 401
    assert resp.json()["code"] == 40100


def test_me_with_login_returns_user():
    username = _unique_username()
    try:
        client.post(
            "/api/v1/auth/register",
            json={"username": username, "password": "tea2026"},
        )
        resp = client.get("/api/v1/auth/me")
        assert resp.status_code == 200
        body = resp.json()
        assert body["code"] == 0
        assert body["data"]["username"] == username
        assert body["data"]["role"] == "user"
    finally:
        _cleanup_user(username)


# ===== AUTH-08：登出 =====


def test_logout_clears_cookie():
    username = _unique_username()
    try:
        client.post(
            "/api/v1/auth/register",
            json={"username": username, "password": "tea2026"},
        )
        resp = client.post("/api/v1/auth/logout")
        assert resp.status_code == 200
        assert resp.json()["code"] == 0
        # 登出后 /me 应返回 401
        me_resp = client.get("/api/v1/auth/me")
        assert me_resp.status_code == 401
    finally:
        _cleanup_user(username)


# ===== AUTH-03：用户名可用性 =====


def test_username_availability_for_new_user():
    username = _unique_username("avail")
    resp = client.get("/api/v1/auth/username-availability", params={"username": username})
    assert resp.status_code == 200
    body = resp.json()
    assert body["code"] == 0
    assert body["data"]["available"] is True


def test_username_availability_for_existing_user():
    username = _unique_username("exist")
    try:
        client.post(
            "/api/v1/auth/register",
            json={"username": username, "password": "tea2026"},
        )
        resp = client.get("/api/v1/auth/username-availability", params={"username": username})
        assert resp.status_code == 200
        assert resp.json()["data"]["available"] is False
    finally:
        _cleanup_user(username)


# ===== S-01：密码以 bcrypt 哈希存储 =====


def test_password_is_bcrypt_hashed_in_db():
    username = _unique_username("hash")
    try:
        client.post(
            "/api/v1/auth/register",
            json={"username": username, "password": "tea2026"},
        )
        db = SessionLocal()
        try:
            user = user_repo.get_by_username(db, username)
            assert user is not None
            assert user.password_hash.startswith("$2b$10$")
        finally:
            db.close()
    finally:
        _cleanup_user(username)
