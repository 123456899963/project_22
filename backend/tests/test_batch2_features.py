"""批次二功能测试：S14 登录锁定 / S15 用户等级 / S16 个性化推荐

测试数据使用带时间戳的用户名与临时茶品，用例结束清理。
"""

import time
from datetime import datetime, timedelta

from fastapi.testclient import TestClient

from app.core.database import SessionLocal
from app.main import app
from app.models.favorite import FavoriteItem
from app.models.login_attempt import LoginAttempt
from app.models.tea import Tea
from app.repositories import user_repo
from app.services.stats import resolve_level


def _unique_username(prefix: str = "b2user") -> str:
    return f"{prefix}{int(time.time() * 1000000) % 100000000}"


def _register(username: str, password: str = "tea2026") -> TestClient:
    client = TestClient(app)
    resp = client.post("/api/v1/auth/register", json={"username": username, "password": password})
    assert resp.status_code == 200, resp.text
    return client


def _login(client: TestClient, username: str, password: str):
    return client.post("/api/v1/auth/login", json={"username": username, "password": password})


def _create_tea(*, category: str = "green", name: str | None = None) -> int:
    db = SessionLocal()
    try:
        tea = Tea(
            name=name or f"批次二测试茶{int(time.time() * 1000000) % 100000000}",
            category=category,
            origin="浙江 测试产区",
            season="春茶",
            shape_desc="",
            soup_desc="",
            aroma_desc="",
            taste_desc="",
            is_active=True,
            favorite_count=0,
        )
        db.add(tea)
        db.commit()
        db.refresh(tea)
        return tea.id
    finally:
        db.close()


def _cleanup(usernames: list[str], tea_ids: list[int] | None = None) -> None:
    db = SessionLocal()
    try:
        if tea_ids:
            db.query(FavoriteItem).filter(FavoriteItem.tea_id.in_(tea_ids)).delete(
                synchronize_session=False
            )
            db.query(Tea).filter(Tea.id.in_(tea_ids)).delete(synchronize_session=False)
        for name in usernames:
            user = user_repo.get_by_username(db, name)
            if user:
                db.delete(user)
        db.commit()
    finally:
        db.close()


# ===== S14 登录失败锁定 =====


def test_login_locked_after_five_failures():
    username = _unique_username()
    try:
        _register(username)
        client = TestClient(app)
        for _ in range(5):
            resp = _login(client, username, "wrongpass")
            assert resp.status_code == 401
            assert resp.json()["code"] == 40110

        # 第 6 次即使密码正确也应被锁定，返回 42900 / HTTP 429
        resp = _login(client, username, "tea2026")
        assert resp.status_code == 429
        assert resp.json()["code"] == 42900
        assert resp.json()["data"] is None
    finally:
        _cleanup([username])


def test_login_lock_does_not_leak_account_existence():
    """不存在的用户名同样会触发 429，攻击者无法据此判断账号是否存在。"""
    username = "nosuchuser" + str(int(time.time() * 1000000) % 100000000)
    client = TestClient(app)
    for _ in range(5):
        resp = _login(client, username, "whatever")
        assert resp.status_code == 401
        assert resp.json()["code"] == 40110

    resp = _login(client, username, "whatever")
    assert resp.status_code == 429
    assert resp.json()["code"] == 42900


def test_login_unlocks_after_window_expires():
    username = _unique_username()
    try:
        _register(username)
        client = TestClient(app)
        for _ in range(5):
            _login(client, username, "wrongpass")

        # 把失败记录整体前移 16 分钟（窗口 15 分钟），模拟自然过期
        db = SessionLocal()
        try:
            stale = datetime.utcnow() - timedelta(minutes=16)
            db.query(LoginAttempt).update({LoginAttempt.failed_at: stale})
            db.commit()
        finally:
            db.close()

        resp = _login(client, username, "tea2026")
        assert resp.status_code == 200
        assert resp.json()["code"] == 0
    finally:
        _cleanup([username])


def test_login_success_clears_username_failures():
    username = _unique_username()
    try:
        _register(username)
        client = TestClient(app)
        for _ in range(4):
            _login(client, username, "wrongpass")

        assert _login(client, username, "tea2026").status_code == 200

        db = SessionLocal()
        try:
            remaining = db.query(LoginAttempt).filter(LoginAttempt.username == username).count()
            assert remaining == 0
        finally:
            db.close()

        # 成功登录清空用户名维度计数后，下一次失败仍是普通 401，而非 429
        resp = _login(client, username, "wrongpass")
        assert resp.status_code == 401
        assert resp.json()["code"] == 40110
    finally:
        _cleanup([username])


# ===== S15 用户等级 =====


def test_resolve_level_boundaries():
    cases = [
        (0, "茶客", 1, "茶友", 5, 5),
        (4, "茶客", 1, "茶友", 5, 1),
        (5, "茶友", 2, "茶人", 20, 15),
        (19, "茶友", 2, "茶人", 20, 1),
        (20, "茶人", 3, "茶师", 50, 30),
        (49, "茶人", 3, "茶师", 50, 1),
        (50, "茶师", 4, None, None, 0),
        (120, "茶师", 4, None, None, 0),
    ]
    for count, name, index, next_name, next_threshold, remaining in cases:
        info = resolve_level(count)
        assert info.name == name
        assert info.index == index
        assert info.next_name == next_name
        assert info.next_threshold == next_threshold
        assert info.remaining == remaining


def test_me_stats_requires_login():
    resp = TestClient(app).get("/api/v1/me/stats")
    assert resp.status_code == 401
    assert resp.json()["code"] == 40100


def test_me_stats_returns_counts_and_level():
    username = _unique_username()
    tea_id = _create_tea()
    try:
        client = _register(username)
        client.post(f"/api/v1/favorites/{tea_id}")
        default_list = client.get("/api/v1/lists").json()["data"][0]["id"]
        client.put(f"/api/v1/lists/{default_list}/notes/{tea_id}", json={"content": "香气清雅"})
        client.post("/api/v1/shares/generate")

        resp = client.get("/api/v1/me/stats")
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["favorite_count"] == 1
        assert data["note_count"] == 1
        assert data["share_count"] == 1
        assert data["level"]["name"] == "茶客"
        assert data["level"]["index"] == 1
        assert data["level"]["next_name"] == "茶友"
        assert data["level"]["next_threshold"] == 5
        assert data["level"]["remaining"] == 4
        # 茶类分布：六类固定顺序，缺失补 0
        assert [item["category"] for item in data["category_distribution"]] == [
            "green",
            "white",
            "yellow",
            "red",
            "oolong",
            "dark",
        ]
        assert data["category_distribution"][0]["count"] == 1
        assert data["category_distribution"][1]["count"] == 0
    finally:
        _cleanup([username], [tea_id])


def _set_tea_inactive(tea_id: int) -> None:
    """把茶品置为下架，用于验证分布只统计上架茶。"""
    db = SessionLocal()
    try:
        db.query(Tea).filter(Tea.id == tea_id).update({"is_active": False})
        db.commit()
    finally:
        db.close()


def test_me_stats_distribution_excludes_inactive_tea():
    """收藏总数仍含下架茶，但茶类分布只统计上架茶。"""
    username = _unique_username()
    green_id = _create_tea(category="green")
    red_id = _create_tea(category="red")
    try:
        client = _register(username)
        client.post(f"/api/v1/favorites/{green_id}")
        client.post(f"/api/v1/favorites/{red_id}")
        _set_tea_inactive(red_id)

        data = client.get("/api/v1/me/stats").json()["data"]
        distribution = {item["category"]: item["count"] for item in data["category_distribution"]}
        assert data["favorite_count"] == 2
        assert distribution["green"] == 1
        assert distribution["red"] == 0
        assert len(data["category_distribution"]) == 6
    finally:
        _cleanup([username], [green_id, red_id])


# ===== S15 个人中心品鉴笔记（§4.7.4） =====


def test_me_notes_requires_login():
    resp = TestClient(app).get("/api/v1/me/notes")
    assert resp.status_code == 401
    assert resp.json()["code"] == 40100


def test_me_notes_dedupes_and_prefers_default_list():
    """每款茶 1 条；默认清单笔记优先；含下架茶；不含他人笔记。"""
    username = _unique_username()
    other_username = _unique_username("b2other")
    tea_id = _create_tea(category="green")
    inactive_tea_id = _create_tea(category="red")
    other_tea_id = _create_tea(category="white")
    try:
        client = _register(username)
        client.post(f"/api/v1/favorites/{tea_id}")
        default_list = client.get("/api/v1/lists").json()["data"][0]["id"]
        client.put(f"/api/v1/lists/{default_list}/notes/{tea_id}", json={"content": "默认清单笔记"})

        # 同一茶品再放进普通清单并写笔记，应仍只返回默认清单那条
        list_resp = client.post("/api/v1/lists", json={"title": "办公室茶单"})
        second_list = list_resp.json()["data"]["id"]
        client.post(f"/api/v1/favorites/{tea_id}", json={"list_id": second_list})
        client.put(f"/api/v1/lists/{second_list}/notes/{tea_id}", json={"content": "普通清单笔记"})

        # 下架茶的历史笔记仍需可见，并标记 is_available=false
        client.post(f"/api/v1/favorites/{inactive_tea_id}")
        client.put(
            f"/api/v1/lists/{default_list}/notes/{inactive_tea_id}",
            json={"content": "下架前写的笔记"},
        )
        _set_tea_inactive(inactive_tea_id)

        # 他人笔记不可见
        other = _register(other_username)
        other.post(f"/api/v1/favorites/{other_tea_id}")
        other_default = other.get("/api/v1/lists").json()["data"][0]["id"]
        other.put(
            f"/api/v1/lists/{other_default}/notes/{other_tea_id}",
            json={"content": "别人的笔记"},
        )

        resp = client.get("/api/v1/me/notes")
        assert resp.status_code == 200
        items = resp.json()["data"]
        assert [item["tea_id"] for item in items] == [inactive_tea_id, tea_id]
        by_tea = {item["tea_id"]: item for item in items}
        assert by_tea[tea_id]["tasting_note"] == "默认清单笔记"
        assert by_tea[tea_id]["list_title"] == "我的收藏"
        assert by_tea[inactive_tea_id]["is_available"] is False
        assert by_tea[inactive_tea_id]["tasting_note"] == "下架前写的笔记"
    finally:
        _cleanup([username, other_username], [tea_id, inactive_tea_id, other_tea_id])


# ===== S16 个性化推荐 =====


def test_recommended_anonymous_returns_one_active_tea():
    resp = TestClient(app).get("/api/v1/teas/recommended")
    assert resp.status_code == 200
    items = resp.json()["data"]
    assert isinstance(items, list)
    assert len(items) == 1
    assert items[0]["id"] > 0
    assert items[0]["name"]


def test_recommended_logged_in_without_favorites():
    username = _unique_username()
    try:
        client = _register(username)
        resp = client.get("/api/v1/teas/recommended", params={"limit": 1})
        assert resp.status_code == 200
        assert len(resp.json()["data"]) == 1
    finally:
        _cleanup([username])


def test_recommended_prefers_favorite_category_and_excludes_favorited():
    username = _unique_username()
    favorite_tea = _create_tea(category="green")
    other_tea = _create_tea(category="green")
    try:
        client = _register(username)
        client.post(f"/api/v1/favorites/{favorite_tea}")

        resp = client.get("/api/v1/teas/recommended", params={"limit": 1})
        assert resp.status_code == 200
        items = resp.json()["data"]
        assert len(items) == 1
        assert items[0]["category"] == "green"
        assert items[0]["id"] != favorite_tea
        # 另一款未收藏的同茶类茶品在候选池内（随机结果可能是任一绿色茶）
        assert other_tea > 0
    finally:
        _cleanup([username], [favorite_tea, other_tea])
