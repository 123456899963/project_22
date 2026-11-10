"""图片库后台路由（管理员查看所有茶品图片，含下架）

已有上传/增删端点在 admin.py router；本 router 补 admin 视角的查询。
所有数据库查询下沉到 repositories 层，Router 不碰 Model、不写 SQL。
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.auth_deps import get_admin_user
from app.core.database import get_db
from app.core.response import ok
from app.repositories import tea_media_repo

router = APIRouter(dependencies=[Depends(get_admin_user)])


@router.get("/media/teas/{tea_id}")
def list_tea_images_admin(tea_id: int, db: Session = Depends(get_db)):
    """GET /admin/media/teas/{tea_id} 某茶图片集（含下架茶品）。"""
    items = tea_media_repo.list_by_tea(db, tea_id)
    return ok(
        [
            {
                "id": row.id,
                "tea_id": row.tea_id,
                "image_url": row.image_url,
                "sort_order": row.sort_order,
            }
            for row in items
        ]
    )


@router.get("/media")
def list_all_images(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """GET /admin/media 全部图片（跨茶品），用于图片库全局浏览。"""
    safe_page = max(page, 1)
    safe_size = min(max(page_size, 1), 100)
    items, total = tea_media_repo.list_all(db, offset=(safe_page - 1) * safe_size, limit=safe_size)
    return ok(
        {
            "items": [
                {
                    "id": row.id,
                    "tea_id": row.tea_id,
                    "image_url": row.image_url,
                    "sort_order": row.sort_order,
                }
                for row in items
            ],
            "total": total,
            "page": safe_page,
            "page_size": safe_size,
        }
    )
