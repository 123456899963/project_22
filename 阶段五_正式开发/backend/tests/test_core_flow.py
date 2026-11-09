"""核心链路 API 端到端：列表→详情→搜索→收藏→投稿→审核→上下架。"""

from sqlalchemy import select

from app.models.media import GalleryUserShot
from app.services import submission_service
from tests.factories import auth_headers, create_isolated_category, create_tea, create_user

PNG_1X1 = bytes.fromhex(
    "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489"
    "0000000a49444154789c6360000002000100ffff03000006000557bfabd4"
    "0000000049454e44ae426082"
)


def test_core_flow_from_discovery_to_moderation(client, db):
    user = create_user(db)
    headers = auth_headers(user)
    _category_id, _category_code, _sub_id, sub_code = create_isolated_category(db)
    tea_id = create_tea(db, name="核心链路茶", category_id=_category_id, subcategory_id=_sub_id)

    # 1 列表
    listed = client.get("/api/v1/teas", params={"subcategory": sub_code})
    assert listed.status_code == 200
    assert tea_id in [item["id"] for item in listed.json()["data"]["items"]]

    # 2 详情
    detail = client.get(f"/api/v1/teas/{tea_id}")
    assert detail.status_code == 200
    assert detail.json()["data"]["name"] == "核心链路茶"

    # 3 搜索
    found = client.get("/api/v1/search", params={"q": "核心链路茶"})
    assert found.status_code == 200
    assert tea_id in [item["id"] for item in found.json()["data"]["items"]]

    # 4 收藏
    assert (
        client.post(
            "/api/v1/me/favorites", json={"teaId": tea_id, "group": "want"}, headers=headers
        ).status_code
        == 200
    )
    favorites = client.get("/api/v1/me/favorites", headers=headers)
    assert tea_id in [item["teaId"] for item in favorites.json()["data"]["items"]]

    # 5 投稿（T3 补图 + 授权）
    upload = client.post(
        "/api/v1/me/uploads",
        data={"teaId": str(tea_id), "type": "dry"},
        files={"file": ("链路补图.png", PNG_1X1, "image/png")},
        headers=headers,
    )
    assert upload.status_code == 200
    image_id = upload.json()["data"]["id"]
    created = submission_service.create(
        db,
        user,
        {"type": "T3", "teaId": tea_id, "imageIds": [image_id], "licenseGranted": True},
    )
    submitted = client.post(f"/api/v1/me/submissions/{created['id']}/submit", headers=headers)
    assert submitted.status_code == 200

    # 6 审核通过，用户实拍入池
    admin_headers = auth_headers(create_user(db), role="ADMIN")
    reviewed = client.post(
        f"/api/v1/admin/submissions/{created['id']}/review",
        json={"decision": "approve"},
        headers=admin_headers,
    )
    assert reviewed.status_code == 200
    shot = (
        db.execute(
            select(GalleryUserShot).where(GalleryUserShot.submission_id == created["id"])
        )
        .scalars()
        .first()
    )
    assert shot is not None and shot.status == "candidate"
    assert client.get("/api/v1/gallery", params={"tab": "user"}).status_code == 200

    # 7 下架：游客不可见
    unpublished = client.post(
        f"/api/v1/admin/teas/{tea_id}/unpublish",
        json={"reason": "链路用例下架"},
        headers=admin_headers,
    )
    assert unpublished.status_code == 200
    hidden = client.get(f"/api/v1/teas/{tea_id}")
    assert hidden.status_code == 404
    assert hidden.json()["code"] == "MM-CATALOG-001"

    # 8 恢复上架
    republished = client.post(
        f"/api/v1/admin/teas/{tea_id}/publish",
        json={"reason": "链路用例恢复"},
        headers=admin_headers,
    )
    assert republished.status_code == 200
    assert client.get(f"/api/v1/teas/{tea_id}").status_code == 200
