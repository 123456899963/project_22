"""FastAPI 应用入口：中间件、异常转换、静态资源、路由挂载。"""

import asyncio
import logging
import uuid

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import ValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api import api_router
from app.core import ratelimit
from app.core.config import settings
from app.core.db import engine
from app.core.errors import BizException, ErrorCode
from app.core.response import fail, ok, set_current_request, set_trace_id
from app.core.security import optional_principal

logger = logging.getLogger("mingmai")

app = FastAPI(title="茗脉 API", version="1.0.0", docs_url="/api/docs", openapi_url="/api/openapi.json")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "PUT", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["X-Request-Id"],
)


@app.middleware("http")
async def trace_and_auth(request: Request, call_next):
    request_id = request.headers.get("x-request-id") or uuid.uuid4().hex
    set_trace_id(request_id)
    set_current_request(request)
    if request.url.path.startswith("/api/"):
        optional_principal(request)
        limited = ratelimit.check(request)
        if limited is not None:
            limited.headers["X-Request-Id"] = request_id
            return limited
    response = await call_next(request)
    response.headers["X-Request-Id"] = request_id
    return response


@app.exception_handler(BizException)
async def handle_biz(_: Request, exc: BizException) -> JSONResponse:
    return JSONResponse(
        status_code=exc.spec.status,
        content=fail(exc.spec.code, exc.message, exc.details or None),
    )


@app.exception_handler(RequestValidationError)
async def handle_validation(_: Request, exc: RequestValidationError) -> JSONResponse:
    details = [
        {"field": ".".join(str(part) for part in item.get("loc", [])[1:]), "reason": item.get("msg", "")}
        for item in exc.errors()
    ]
    return JSONResponse(status_code=400, content=fail(ErrorCode.SYS_001.code, ErrorCode.SYS_001.message, details))


@app.exception_handler(ValidationError)
async def handle_pydantic(_: Request, exc: ValidationError) -> JSONResponse:
    details = [{"field": ".".join(str(p) for p in err.get("loc", [])), "reason": err.get("msg", "")} for err in exc.errors()]
    return JSONResponse(status_code=400, content=fail(ErrorCode.SYS_001.code, ErrorCode.SYS_001.message, details))


@app.exception_handler(StarletteHTTPException)
async def handle_http(_: Request, exc: StarletteHTTPException) -> JSONResponse:
    code = ErrorCode.AUTH_001 if exc.status_code == 401 else ErrorCode.SYS_001
    return JSONResponse(status_code=exc.status_code, content=fail(code.code, str(exc.detail), None))


@app.exception_handler(Exception)
async def handle_unknown(_: Request, exc: Exception) -> JSONResponse:
    logger.exception("unexpected error", exc_info=exc)
    return JSONResponse(
        status_code=500, content=fail(ErrorCode.SYS_003.code, ErrorCode.SYS_003.message, None)
    )


_message_cleanup_task: asyncio.Task | None = None


@app.on_event("startup")
async def on_startup() -> None:
    from app.services.moderation_service import register_account_status

    register_account_status()
    try:
        with engine.connect() as conn:
            conn.exec_driver_sql("SELECT 1")
    except Exception as exc:  # 数据库未就绪不阻断进程启动，健康检查会暴露状态
        logger.warning("database not ready: %s", exc)
    global _message_cleanup_task
    _message_cleanup_task = asyncio.create_task(_message_cleanup_loop())


@app.on_event("shutdown")
async def on_shutdown() -> None:
    if _message_cleanup_task is not None:
        _message_cleanup_task.cancel()


async def _message_cleanup_loop() -> None:
    """每 24 小时清理一次超过 180 天的站内消息（M09/PRD）。"""
    from app.core.db import SessionLocal
    from app.services import message_service

    while True:
        try:
            with SessionLocal() as db:
                deleted = message_service.purge_expired(db)
            if deleted:
                logger.info("message cleanup removed %s rows", deleted)
        except Exception as exc:  # 清理失败不影响主进程
            logger.warning("message cleanup failed: %s", exc)
        await asyncio.sleep(24 * 60 * 60)


@app.get("/actuator/health")
@app.get("/health")
def health() -> dict:
    return ok({"status": "UP", "profile": settings.profile})


app.include_router(api_router, prefix="/api/v1")

if settings.storage_dir:
    try:
        app.mount(settings.public_prefix, StaticFiles(directory=settings.storage_dir, check_dir=False), name="uploads")
    except Exception as exc:
        logger.warning("static mount skipped: %s", exc)
