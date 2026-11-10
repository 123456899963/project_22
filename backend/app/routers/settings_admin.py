"""设置页后台路由（管理员查看 + 运行时可改项写入）"""

from fastapi import APIRouter, Depends

from app.core.auth_deps import get_admin_user
from app.core.response import ok
from app.schemas.settings import AdminSettingsUpdatePayload
from app.services import settings_admin

router = APIRouter(dependencies=[Depends(get_admin_user)])


@router.get("/settings")
def list_settings():
    """GET /admin/settings 返回全部配置项（区分可写/只读）。"""
    data = settings_admin.list_settings()
    return ok(data.model_dump(mode="json"))


@router.patch("/settings")
def update_settings(payload: AdminSettingsUpdatePayload):
    """PATCH /admin/settings 运行时改配置（仅白名单 key 生效）。"""
    settings_admin.update_settings(payload.items)
    return ok()
