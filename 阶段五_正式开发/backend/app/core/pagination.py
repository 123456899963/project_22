"""分页参数：page ≥ 1，size 1–50（默认 12）。"""

from app.core.errors import BizException, ErrorCode


def normalize(page: int | None, size: int | None, default_size: int = 12) -> tuple[int, int]:
    safe_page = 1 if page is None or page < 1 else int(page)
    safe_size = default_size if size is None else int(size)
    if safe_size < 1 or safe_size > 50:
        raise BizException(ErrorCode.SYS_001, "分页 size 必须在 1–50 之间")
    return safe_page, safe_size
