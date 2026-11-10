"""设置页 Schema（无表，纯运行时配置读写）"""

from pydantic import BaseModel, Field


class AdminSettingsItem(BaseModel):
    key: str
    value: str


class AdminSettingsList(BaseModel):
    items: list[AdminSettingsItem]


class AdminSettingsUpdatePayload(BaseModel):
    items: list[AdminSettingsItem] = Field(..., min_length=1)
