"""Web 层：Envelope、traceId、鉴权门禁、公开读接口。"""

from tests.factories import auth_headers, create_user


def test_health_returns_envelope_and_request_id(client):
    response = client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["code"] == "OK"
    assert body["data"]["status"] == "UP"
    assert response.headers.get("X-Request-Id")


def test_home_returns_six_categories(client, db):
    response = client.get("/api/v1/home")
    assert response.status_code == 200
    body = response.json()
    assert body["code"] == "OK"
    codes = {category["code"] for category in body["data"]["categories"]}
    assert {"green", "white", "yellow", "oolong", "red", "dark"} <= codes
    assert body["data"]["identifyEntry"]


def test_me_endpoint_requires_login(client):
    response = client.get("/api/v1/me/favorites")
    assert response.status_code == 401
    assert response.json()["code"] == "MM-AUTH-001"


def test_normal_user_cannot_access_admin(client, db):
    user_id = create_user(db)
    response = client.get("/api/v1/admin/admins", headers=auth_headers(user_id, "USER"))
    assert response.status_code == 403
    assert response.json()["code"] == "MM-AUTH-003"


def test_missing_tea_returns_catalog_404(client):
    response = client.get("/api/v1/teas/999999999")
    assert response.status_code == 404
    assert response.json()["code"] == "MM-CATALOG-001"


def test_pagination_size_validation(client):
    response = client.get("/api/v1/teas", params={"size": 100})
    assert response.status_code == 400
    assert response.json()["code"] == "MM-SYS-001"
