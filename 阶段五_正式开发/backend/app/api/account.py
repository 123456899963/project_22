"""认证、账号与管理员白名单接口。"""

from typing import Optional

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.response import ok
from app.core.security import Principal, super_required, user_required
from app.services import account_service, auth_service, whitelist_service

router = APIRouter()


class WechatCallbackRequest(BaseModel):
    code: str = Field(min_length=1)
    state: str = Field(min_length=1)


class DevLoginRequest(BaseModel):
    openid: str = Field(min_length=1, max_length=64)
    nickname: str = Field(min_length=2, max_length=20)


class RefreshRequest(BaseModel):
    refreshToken: str = Field(min_length=1)


class LogoutRequest(BaseModel):
    refreshToken: Optional[str] = None


class ProfileUpdateRequest(BaseModel):
    nickname: Optional[str] = Field(default=None, min_length=2, max_length=20, description="昵称长度需为 2～20 字")
    avatarUrl: Optional[str] = Field(default=None, max_length=500)


class WhitelistCreateRequest(BaseModel):
    openid: str = Field(min_length=1, max_length=64)
    role: Optional[str] = None
    note: Optional[str] = Field(default=None, max_length=200)


# ---------------- 认证 ----------------

@router.post("/auth/qrcode")
def create_qrcode():
    return ok(auth_service.create_qr_code())


@router.get("/auth/qrcode/{ticket}")
def qrcode_status(ticket: str):
    return ok(auth_service.qr_status(ticket))


@router.post("/auth/wechat/callback")
def wechat_callback(payload: WechatCallbackRequest, db: Session = Depends(get_db)):
    return ok(auth_service.wechat_login(db, payload.code, payload.state))


@router.post("/auth/dev-login")
def dev_login(payload: DevLoginRequest, db: Session = Depends(get_db)):
    return ok(auth_service.dev_login(db, payload.openid, payload.nickname))


@router.post("/auth/refresh")
def refresh(payload: RefreshRequest, db: Session = Depends(get_db)):
    return ok(auth_service.refresh(db, payload.refreshToken))


@router.post("/auth/logout")
def logout(
    payload: Optional[LogoutRequest] = None,
    request: Request = None,  # type: ignore[assignment]
    _: Principal = Depends(user_required),
):
    auth_service.logout(payload.refreshToken if payload else None, getattr(request.state, "mm_jti", None))
    return ok()


# ---------------- 个人中心 ----------------

@router.get("/me/profile")
def my_profile(principal: Principal = Depends(user_required), db: Session = Depends(get_db)):
    return ok(account_service.get_profile(db, principal.id))


@router.patch("/me/profile")
def update_my_profile(
    payload: ProfileUpdateRequest,
    principal: Principal = Depends(user_required),
    db: Session = Depends(get_db),
):
    return ok(account_service.update_profile(db, principal.id, payload.nickname, payload.avatarUrl))


@router.get("/me/overview")
def my_overview(principal: Principal = Depends(user_required), db: Session = Depends(get_db)):
    return ok(account_service.overview(db, principal.id))


@router.post("/me/deletion")
def request_deletion(principal: Principal = Depends(user_required), db: Session = Depends(get_db)):
    return ok(account_service.request_deletion(db, principal.id))


@router.delete("/me/deletion")
def cancel_deletion(principal: Principal = Depends(user_required), db: Session = Depends(get_db)):
    account_service.cancel_deletion(db, principal.id)
    return ok()


# ---------------- 管理员白名单（仅超管） ----------------

@router.get("/admin/admins")
def list_admins(_: Principal = Depends(super_required), db: Session = Depends(get_db)):
    return ok(whitelist_service.list_whitelist(db))


@router.post("/admin/admins")
def add_admin(
    payload: WhitelistCreateRequest,
    principal: Principal = Depends(super_required),
    db: Session = Depends(get_db),
):
    return ok(whitelist_service.add(db, payload.openid, payload.role, payload.note, principal.id))


@router.delete("/admin/admins/{whitelist_id}")
def remove_admin(
    whitelist_id: int,
    principal: Principal = Depends(super_required),
    db: Session = Depends(get_db),
):
    whitelist_service.remove(db, whitelist_id, principal.id)
    return ok()

