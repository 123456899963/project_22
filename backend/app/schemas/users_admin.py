"""用户管理 Schema（后台只读列表 + 角色变更）"""

from datetime import datetime

from pydantic import BaseModel, Field


class AdminUserItem(BaseModel):
    """后台用户列表项"""

    id: int
    username: str
    role: str  # "user" | "admin"
    created_at: datetime


class AdminUserListData(BaseModel):
    items: list[AdminUserItem]
    total: int
    page: int
    page_size: int


class AdminUserRoleUpdate(BaseModel):
    """变更用户角色（仅 admin 可做）"""

    role: str = Field(..., pattern="^(user|admin)$", description="目标角色")
