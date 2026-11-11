"""用户统计与等级 Schema（S15 / API_CONTRACT §4.7.1 / §4.7.4）"""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, field_serializer

from app.schemas._common import iso_z


class LevelInfo(BaseModel):
    """等级信息：四档（茶客/茶友/茶人/茶师），按收藏数实时计算。"""

    name: str
    index: int  # 1-4
    next_name: str | None = None
    next_threshold: int | None = None
    remaining: int = 0


class CategoryDistributionItem(BaseModel):
    """收藏茶类分布项：category 为六大茶类枚举值，只统计上架茶。"""

    model_config = ConfigDict(extra="forbid")

    category: str
    count: int


class UserStats(BaseModel):
    model_config = ConfigDict(extra="forbid")

    favorite_count: int
    note_count: int
    share_count: int
    level: LevelInfo
    # 六大茶类固定顺序、缺失补 0；只统计上架茶，合计可能小于 favorite_count
    category_distribution: list[CategoryDistributionItem]


class NoteItem(BaseModel):
    """个人中心品鉴笔记条目（§4.7.4）：同一茶品跨清单只返回 1 条。"""

    model_config = ConfigDict(extra="forbid")

    tea_id: int
    name: str
    category: str
    origin: str
    main_image_url: str | None = None
    is_available: bool = True
    tasting_note: str
    list_id: int
    list_title: str
    favorited_at: datetime

    @field_serializer("favorited_at")
    def serialize_favorited_at(self, v: datetime) -> str:
        return iso_z(v)
