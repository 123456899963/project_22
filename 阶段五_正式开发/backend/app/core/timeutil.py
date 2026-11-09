"""时间格式化：统一 ISO 8601 带 +08:00，日期 YYYY-MM-DD。"""

from datetime import datetime, timedelta, timezone

TZ = timezone(timedelta(hours=8))


def now() -> datetime:
    """数据库统一存本地时间（naive），与历史数据口径一致。"""
    return datetime.now(TZ).replace(tzinfo=None)


def iso(value: datetime | None) -> str | None:
    if value is None:
        return None
    return value.strftime("%Y-%m-%dT%H:%M:%S") + "+08:00"


def date_str(value) -> str | None:
    if value is None:
        return None
    return value.strftime("%Y-%m-%d")
