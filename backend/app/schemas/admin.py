"""管理员后台 Schema（API_CONTRACT §4.6）

- 列表/统计/上下架/小贴士/上传的响应 DTO
- 请求校验在 schemas/tea.py 的 TeaCreateRequest / TeaUpdateRequest
- extra='forbid' 防止批量赋值（SECURITY S-20）
"""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, field_serializer, field_validator

from app.schemas._common import iso_z
from app.schemas.tea import _normalize_optional_text


class AdminTeaListItem(BaseModel):
    """后台列表条目（API_CONTRACT §4.6.1）：含下架茶品与 is_active。"""

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    category: str
    origin: str
    season: str | None = None
    main_image_url: str | None = None
    is_active: bool
    favorite_count: int = 0
    created_at: datetime
    updated_at: datetime

    @field_serializer("created_at", "updated_at")
    def serialize_datetime(self, value: datetime) -> str:
        return iso_z(value)


class AdminTeaListResponse(BaseModel):
    items: list[AdminTeaListItem]
    total: int
    page: int
    page_size: int


class TipsUpdateRequest(BaseModel):
    """小贴士编辑（API_CONTRACT §4.6.6）：省略=保持，null/纯空白=清空。"""

    model_config = ConfigDict(extra="forbid")

    tips_history: str | None = None
    tips_suitable: str | None = None
    tips_misconception: str | None = None
    tips_official_note: str | None = None

    @field_validator(
        "tips_history", "tips_suitable", "tips_misconception", "tips_official_note", mode="before"
    )
    @classmethod
    def _normalize(cls, value: Any) -> Any:
        return _normalize_optional_text(value)


class TipsResponse(BaseModel):
    tea_id: int
    tips_history: str | None = None
    tips_suitable: str | None = None
    tips_misconception: str | None = None
    tips_official_note: str | None = None


class ToggleResponse(BaseModel):
    id: int
    is_active: bool
    updated_at: datetime

    @field_serializer("updated_at")
    def serialize_datetime(self, value: datetime) -> str:
        return iso_z(value)


class CategoryDistribution(BaseModel):
    category: str
    count: int


class AdminStatsResponse(BaseModel):
    total_count: int
    active_count: int
    inactive_count: int
    category_distribution: list[CategoryDistribution]


class UploadResult(BaseModel):
    url: str
    original_filename: str
    size: int
    content_type: str


class VideoUploadResult(UploadResult):
    """视频上传结果（ADR-0003 S5）：duration 为服务端解析的秒数。"""

    duration: int
