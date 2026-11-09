"""我的投稿接口（M07）：草稿增改删、提交、驳回重提与预览，全部要求本人。"""

from typing import Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.pagination import normalize
from app.core.response import ok, page_result
from app.core.security import Principal, user_required
from app.services import submission_service

router = APIRouter(tags=["submission"])


class SubmissionWriteRequest(BaseModel):
    type: Optional[str] = None
    teaId: Optional[int] = None
    title: Optional[str] = None
    body: Optional[str] = None
    imageIds: Optional[list[int]] = None
    licenseGranted: Optional[bool] = None
    correctionFieldKey: Optional[str] = None
    newValue: Optional[str] = None
    reason: Optional[str] = None
    anonymous: Optional[bool] = None


@router.get("/me/submissions")
def list_submissions(
    type: Optional[str] = Query(default=None),
    status: Optional[str] = Query(default=None),
    page: int = Query(default=1),
    size: int = Query(default=12),
    principal: Principal = Depends(user_required),
    db: Session = Depends(get_db),
):
    safe_page, safe_size = normalize(page, size)
    items, total = submission_service.list_submissions(
        db, principal.id, type, status, safe_page, safe_size
    )
    return ok(page_result(items, safe_page, safe_size, total))


@router.post("/me/submissions")
def create_submission(
    payload: SubmissionWriteRequest,
    principal: Principal = Depends(user_required),
    db: Session = Depends(get_db),
):
    return ok(submission_service.create(db, principal.id, payload.model_dump()))


@router.get("/me/submissions/{id}")
def submission_detail(
    id: int,
    principal: Principal = Depends(user_required),
    db: Session = Depends(get_db),
):
    return ok(submission_service.detail(db, principal.id, id))


@router.patch("/me/submissions/{id}")
def update_submission(
    id: int,
    payload: SubmissionWriteRequest,
    principal: Principal = Depends(user_required),
    db: Session = Depends(get_db),
):
    return ok(submission_service.update(db, principal.id, id, payload.model_dump()))


@router.delete("/me/submissions/{id}")
def delete_submission(
    id: int,
    principal: Principal = Depends(user_required),
    db: Session = Depends(get_db),
):
    submission_service.delete(db, principal.id, id)
    return ok()


@router.post("/me/submissions/{id}/submit")
def submit_submission(
    id: int,
    principal: Principal = Depends(user_required),
    db: Session = Depends(get_db),
):
    return ok(submission_service.submit(db, principal.id, id))


@router.post("/me/submissions/{id}/resubmit")
def resubmit_submission(
    id: int,
    principal: Principal = Depends(user_required),
    db: Session = Depends(get_db),
):
    return ok(submission_service.resubmit(db, principal.id, id))


@router.get("/me/submissions/{id}/preview")
def preview_submission(
    id: int,
    principal: Principal = Depends(user_required),
    db: Session = Depends(get_db),
):
    return ok(submission_service.preview(db, principal.id, id))
