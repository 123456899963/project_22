"""用户管理后台路由（列出 + 变更角色）

路径前缀：/api/v1/admin（由 main.py 统一 include）。
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.auth_deps import get_admin_user
from app.core.database import get_db
from app.core.response import ok
from app.schemas.users_admin import AdminUserRoleUpdate
from app.services import users_admin

router = APIRouter(dependencies=[Depends(get_admin_user)])


@router.get("/users")
def list_users(
    role: str | None = Query(None, description="user / admin 筛选"),
    keyword: str | None = Query(None, description="用户名模糊搜索"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=50),
    db: Session = Depends(get_db),
):
    """GET /admin/users 用户列表（管理员只读）。"""
    data = users_admin.list_users(db, role=role, keyword=keyword, page=page, page_size=page_size)
    return ok(data.model_dump(mode="json"))


@router.patch("/users/{user_id}/role")
def update_role(
    user_id: int,
    payload: AdminUserRoleUpdate,
    db: Session = Depends(get_db),
):
    """PATCH /admin/users/{id}/role 变更用户角色。"""
    users_admin.update_user_role(db, user_id=user_id, role=payload.role)
    return ok()
