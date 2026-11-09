"""审核与治理接口（M08）：投稿/评论审核、举报申诉、处罚与用户管理。"""

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.response import ok, page_result
from app.core.security import Principal, admin_required, super_required, user_required
from app.services import moderation_service

router = APIRouter()


class ReviewRequest(BaseModel):
    decision: str
    reason: Optional[str] = None


class ReportCreateRequest(BaseModel):
    objectType: str
    objectId: int
    teaId: Optional[int] = None
    reportType: str
    description: str


class ReportHandleRequest(BaseModel):
    decision: str
    resultNote: str
    action: Optional[str] = None


class AppealCreateRequest(BaseModel):
    sanctionId: Optional[int] = None
    reason: str


class AppealReviewRequest(BaseModel):
    decision: str
    note: str


class SanctionCreateRequest(BaseModel):
    type: str
    reason: str
    endAt: Optional[datetime] = None


# ---------------- 投稿审核 ----------------

@router.get("/admin/submissions")
def list_submissions(
    sub_type: Optional[str] = Query(default=None, alias="type"),
    status: Optional[str] = None,
    overdue: bool = False,
    page: int = 1,
    size: int = 12,
    _: Principal = Depends(admin_required),
    db: Session = Depends(get_db),
):
    items, safe_page, safe_size, total = moderation_service.list_submissions(
        db, sub_type, status, overdue, page, size
    )
    return ok(page_result(items, safe_page, safe_size, total))


@router.get("/admin/submissions/{submission_id}")
def submission_detail(
    submission_id: int,
    _: Principal = Depends(admin_required),
    db: Session = Depends(get_db),
):
    return ok(moderation_service.submission_detail(db, submission_id))


@router.post("/admin/submissions/{submission_id}/review")
def review_submission(
    submission_id: int,
    payload: ReviewRequest,
    principal: Principal = Depends(admin_required),
    db: Session = Depends(get_db),
):
    moderation_service.review_submission(
        db, principal.id, submission_id, payload.decision, payload.reason
    )
    return ok()


# ---------------- 评论审核 ----------------

@router.get("/admin/comments")
def list_comments(
    status: Optional[str] = None,
    overdue: bool = False,
    page: int = 1,
    size: int = 12,
    _: Principal = Depends(admin_required),
    db: Session = Depends(get_db),
):
    items, safe_page, safe_size, total = moderation_service.list_comments(
        db, status, overdue, page, size
    )
    return ok(page_result(items, safe_page, safe_size, total))


@router.post("/admin/comments/{comment_id}/review")
def review_comment(
    comment_id: int,
    payload: ReviewRequest,
    principal: Principal = Depends(admin_required),
    db: Session = Depends(get_db),
):
    moderation_service.review_comment(db, principal.id, comment_id, payload.decision, payload.reason)
    return ok()


# ---------------- 举报与申诉 ----------------

@router.get("/admin/reports")
def list_reports(
    status: Optional[str] = None,
    object_type: Optional[str] = Query(default=None, alias="objectType"),
    overdue: bool = False,
    page: int = 1,
    size: int = 12,
    _: Principal = Depends(admin_required),
    db: Session = Depends(get_db),
):
    items, safe_page, safe_size, total = moderation_service.list_reports(
        db, status, object_type, overdue, page, size
    )
    return ok(page_result(items, safe_page, safe_size, total))


@router.get("/admin/reports/{report_id}")
def report_detail(
    report_id: int,
    _: Principal = Depends(admin_required),
    db: Session = Depends(get_db),
):
    return ok(moderation_service.report_detail(db, report_id))


@router.post("/admin/reports/{report_id}/handle")
def handle_report(
    report_id: int,
    payload: ReportHandleRequest,
    principal: Principal = Depends(admin_required),
    db: Session = Depends(get_db),
):
    moderation_service.handle_report(db, principal.id, report_id, payload)
    return ok()


@router.get("/admin/appeals")
def list_appeals(
    status: Optional[str] = None,
    page: int = 1,
    size: int = 12,
    _: Principal = Depends(admin_required),
    db: Session = Depends(get_db),
):
    items, safe_page, safe_size, total = moderation_service.list_appeals(db, status, page, size)
    return ok(page_result(items, safe_page, safe_size, total))


@router.post("/admin/appeals/{appeal_id}/review")
def review_appeal(
    appeal_id: int,
    payload: AppealReviewRequest,
    principal: Principal = Depends(super_required),
    db: Session = Depends(get_db),
):
    moderation_service.review_appeal(db, principal.id, appeal_id, payload)
    return ok()


# ---------------- 用户与处罚 ----------------

@router.get("/admin/users")
def list_users(
    keyword: Optional[str] = None,
    sanction_status: Optional[str] = Query(default=None, alias="sanctionStatus"),
    page: int = 1,
    size: int = 12,
    _: Principal = Depends(admin_required),
    db: Session = Depends(get_db),
):
    items, safe_page, safe_size, total = moderation_service.list_users(
        db, keyword, sanction_status, page, size
    )
    return ok(page_result(items, safe_page, safe_size, total))


@router.get("/admin/users/{user_id}/sanctions")
def list_sanctions(
    user_id: int,
    _: Principal = Depends(admin_required),
    db: Session = Depends(get_db),
):
    return ok(moderation_service.list_sanctions(db, user_id))


@router.post("/admin/users/{user_id}/sanctions")
def create_sanction(
    user_id: int,
    payload: SanctionCreateRequest,
    principal: Principal = Depends(admin_required),
    db: Session = Depends(get_db),
):
    return ok(
        moderation_service.create_sanction(
            db, principal.id, user_id, payload.type, payload.reason, payload.endAt
        )
    )


@router.post("/admin/users/{user_id}/sanctions/{sanction_id}/revoke")
def revoke_sanction(
    user_id: int,
    sanction_id: int,
    reason: Optional[str] = None,
    principal: Principal = Depends(admin_required),
    db: Session = Depends(get_db),
):
    moderation_service.revoke_sanction(db, principal.id, user_id, sanction_id, reason)
    return ok()


# ---------------- 用户侧举报与申诉 ----------------

@router.post("/reports")
def create_report(
    payload: ReportCreateRequest,
    principal: Principal = Depends(user_required),
    db: Session = Depends(get_db),
):
    return ok(moderation_service.create_report(db, principal.id, payload))


@router.post("/reports/{report_id}/appeal")
def create_appeal(
    report_id: int,
    payload: AppealCreateRequest,
    principal: Principal = Depends(user_required),
    db: Session = Depends(get_db),
):
    return ok(moderation_service.create_appeal(db, principal.id, report_id, payload))
