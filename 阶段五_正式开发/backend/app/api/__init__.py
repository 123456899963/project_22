"""API 路由聚合：每个模块一个 APIRouter，路径沿用 /api/v1 前缀（由 main 挂载）。"""

from fastapi import APIRouter

from app.api import (
    account,
    admin_catalog,
    catalog,
    discovery,
    engagement,
    media,
    moderation,
    notification,
    ops,
    submission,
    tag,
    audit,
)

api_router = APIRouter()
api_router.include_router(account.router)
# engagement 先于 catalog 注册：/teas/compare 是静态路径，必须早于 /teas/{tea_id} 匹配
api_router.include_router(engagement.router)
api_router.include_router(catalog.router)
api_router.include_router(admin_catalog.router)
api_router.include_router(media.router)
api_router.include_router(tag.router)
api_router.include_router(discovery.router)
api_router.include_router(submission.router)
api_router.include_router(moderation.router)
api_router.include_router(notification.router)
api_router.include_router(ops.router)
api_router.include_router(audit.router)
