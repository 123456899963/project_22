"""权限矩阵逐格验证（API_CONTRACT §6）：4 角色 × 7 接口组。"""

import uuid

import pytest

from tests.factories import auth_headers, create_tea, create_user

ROLES = ("visitor", "user", "admin", "super")

# (组名, 方法, 路径, {角色: 期望状态码})
CASES = [
    ("公开读-home", "GET", "/api/v1/home", {"visitor": 200, "user": 200, "admin": 200, "super": 200}),
    ("公开读-teas", "GET", "/api/v1/teas", {"visitor": 200, "user": 200, "admin": 200, "super": 200}),
    ("公开读-search", "GET", "/api/v1/search", {"visitor": 200, "user": 200, "admin": 200, "super": 200}),
    ("公开读-gallery", "GET", "/api/v1/gallery", {"visitor": 200, "user": 200, "admin": 200, "super": 200}),
    ("公开读-about", "GET", "/api/v1/pages/about", {"visitor": 200, "user": 200, "admin": 200, "super": 200}),
    ("本人接口-me", "GET", "/api/v1/me/profile", {"visitor": 401, "user": 200, "admin": 200, "super": 200}),
    ("后台茶品", "GET", "/api/v1/admin/teas", {"visitor": 401, "user": 403, "admin": 200, "super": 200}),
    ("审计只读", "GET", "/api/v1/admin/audit-logs", {"visitor": 401, "user": 403, "admin": 200, "super": 200}),
    ("白名单仅超管", "GET", "/api/v1/admin/admins", {"visitor": 401, "user": 403, "admin": 403, "super": 200}),
]


def _headers(role: str, db) -> dict:
    if role == "visitor":
        return {}
    return auth_headers(create_user(db), role=role.upper())


@pytest.mark.parametrize("role", ROLES)
@pytest.mark.parametrize("name,method,path,expected", CASES, ids=[case[0] for case in CASES])
def test_read_matrix(client, db, role, name, method, path, expected):
    response = client.request(method, path, headers=_headers(role, db))
    assert response.status_code == expected[role], f"{name} 角色 {role} 期望 {expected[role]}"


@pytest.mark.parametrize("role", ROLES)
def test_submission_write_matrix(client, db, role):
    tea = create_tea(db, status="published")
    payload = {"type": "T1", "teaId": tea, "title": "矩阵投稿", "body": "茶" * 320}
    response = client.post("/api/v1/me/submissions", json=payload, headers=_headers(role, db))
    assert response.status_code == (401 if role == "visitor" else 200)


@pytest.mark.parametrize("role", ROLES)
def test_report_write_matrix(client, db, role):
    payload = {
        "objectType": "comment",
        "objectId": int(uuid.uuid4().int % 900000000) + 100000000,
        "reportType": "违规",
        "description": "权限矩阵举报用例",
    }
    response = client.post("/api/v1/reports", json=payload, headers=_headers(role, db))
    assert response.status_code == (401 if role == "visitor" else 200)
