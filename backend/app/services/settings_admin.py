"""设置页业务层（无表，从 config.py 读取 + 部分可写）

MVP 可写项：
- TEA_CORS_ORIGINS
- MAX_UPLOAD_SIZE_MB

不可写（敏感，需重启改 .env）：
- TEA_SECRET_KEY（安全红线）
- TEA_DB_*（数据库连接重启生效）
"""

from __future__ import annotations

from app.core.config import settings
from app.schemas.settings import AdminSettingsItem, AdminSettingsList

# 运行时可改的 key 白名单（对应 config.py 里能动态 reload 的字段）
_RUNTIME_SETTINGS: dict[str, str] = {
    "max_upload_size_mb": "图片上传上限（MB）",
    "max_video_size_mb": "视频上传上限（MB）",
    "max_request_body_mb": "请求体上限（MB）",
}

# 只读（仅供前端展示）
_READONLY_SETTINGS: dict[str, str] = {
    "tea_profile": "运行环境标识",
    "session_expire_days": "Cookie 有效期（天）",
}


def list_settings() -> AdminSettingsList:
    """返回全部配置项（区分可写/只读）。"""
    items: list[AdminSettingsItem] = []
    items.append(AdminSettingsItem(key="__readonly__", value="运行环境标识"))
    items.append(AdminSettingsItem(key="tea_profile", value=settings.TEA_PROFILE))
    items.append(
        AdminSettingsItem(key="session_expire_days", value=str(settings.SESSION_EXPIRE_DAYS))
    )
    items.append(AdminSettingsItem(key="__writable__", value="运行时可改（重启后恢复 .env 值）"))
    items.append(
        AdminSettingsItem(key="max_upload_size_mb", value=str(settings.MAX_UPLOAD_SIZE_MB))
    )
    items.append(AdminSettingsItem(key="max_video_size_mb", value=str(settings.MAX_VIDEO_SIZE_MB)))
    items.append(
        AdminSettingsItem(key="max_request_body_mb", value=str(settings.MAX_REQUEST_BODY_MB))
    )
    return AdminSettingsList(items=items)


def update_settings(items: list[AdminSettingsItem]) -> None:
    """运行时改配置（仅对白名单 key 生效，进程重启后恢复 .env 值）。"""
    for item in items:
        if item.key == "max_upload_size_mb":
            try:
                settings.MAX_UPLOAD_SIZE_MB = int(item.value)
            except ValueError:
                pass
        elif item.key == "max_video_size_mb":
            try:
                settings.MAX_VIDEO_SIZE_MB = int(item.value)
            except ValueError:
                pass
        elif item.key == "max_request_body_mb":
            try:
                settings.MAX_REQUEST_BODY_MB = int(item.value)
            except ValueError:
                pass
        # 其他 key 静默忽略（安全红线：不做热改）
