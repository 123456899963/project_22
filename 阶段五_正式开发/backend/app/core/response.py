"""统一响应体 {code, message, data, traceId} 与统一分页 {items, page, size, total, hasMore}。"""

from contextvars import ContextVar
from typing import Any, Generic, TypeVar

T = TypeVar("T")

_trace_id: ContextVar[str] = ContextVar("trace_id", default="")
_current_request: ContextVar[Any] = ContextVar("current_request", default=None)


def set_trace_id(value: str) -> None:
    _trace_id.set(value)


def get_trace_id() -> str:
    return _trace_id.get()


def set_current_request(request: Any) -> None:
    _current_request.set(request)


def current_request() -> Any:
    """当前请求对象；定时任务等无请求场景返回 None。"""
    return _current_request.get()


def ok(data: Any = None) -> dict:
    return {"code": "OK", "message": "success", "data": data, "traceId": get_trace_id()}


def fail(code: str, message: str, details: Any = None) -> dict:
    # details 同时放在 data（历史 Java 口径）与 details（前端拦截器口径），避免两侧解析不一致
    return {
        "code": code,
        "message": message,
        "data": details,
        "details": details,
        "traceId": get_trace_id(),
    }


class PageResult(dict, Generic[T]):
    """分页结果；继承 dict 便于直接作为 data 返回。"""

    def __init__(self, items: list[T], page: int, size: int, total: int) -> None:
        has_more = page * size < total
        super().__init__(items=items, page=page, size=size, total=total, hasMore=has_more)


def page_result(items: list[Any], page: int, size: int, total: int) -> PageResult:
    return PageResult(items, page, size, total)
