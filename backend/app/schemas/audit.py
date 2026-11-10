"""审计日志 Schema（后端 → 前端 / 前端 → 后端 数据契约）

字段命名：snake_case（与数据库列名一致）。
"""

from datetime import datetime

from pydantic import BaseModel


class AuditLogItem(BaseModel):
    """单条审计日志（operation_logs 表的只读视图）"""

    id: int
    user_id: int | None = None
    username: str | None = None  # 左联 users 表查出用户名，方便前端展示
    action: str
    target_type: str | None = None
    target_id: int | None = None
    detail: str | None = None
    created_at: datetime


class AuditLogListData(BaseModel):
    """审计日志分页列表"""

    items: list[AuditLogItem]
    total: int
    page: int
    page_size: int
