"""管理端图鉴媒体接口：列表、上传、删除（仅 admin|super）。"""

from typing import Optional

from fastapi import APIRouter, Depends, File, Form, UploadFile
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.response import ok
from app.core.security import Principal, admin_required, user_required
from app.services import media_service

router = APIRouter()


@router.get("/admin/teas/{tea_id}/media")
def list_media(
    tea_id: int,
    _: Principal = Depends(admin_required),
    db: Session = Depends(get_db),
):
    return ok(media_service.list_by_tea(db, tea_id))


@router.post("/admin/media")
async def upload_media(
    tea_id: int = Form(..., alias="teaId"),
    image_type: str = Form(..., alias="type"),
    file: UploadFile = File(...),
    seq: Optional[int] = Form(None),
    source_type: Optional[str] = Form(None, alias="sourceType"),
    rights_holder: Optional[str] = Form(None, alias="rightsHolder"),
    license_scope: Optional[str] = Form(None, alias="licenseScope"),
    license_cert_no: Optional[str] = Form(None, alias="licenseCertNo"),
    principal: Principal = Depends(admin_required),
    db: Session = Depends(get_db),
):
    content = await file.read()
    return ok(
        media_service.upload(
            db,
            tea_id,
            image_type,
            seq,
            file.filename,
            file.content_type,
            content,
            source_type,
            rights_holder,
            license_scope,
            license_cert_no,
            principal.id,
        )
    )


@router.post("/me/uploads")
async def upload_user_image(
    tea_id: int = Form(..., alias="teaId"),
    image_type: str = Form(..., alias="type"),
    file: UploadFile = File(...),
    principal: Principal = Depends(user_required),
    db: Session = Depends(get_db),
):
    content = await file.read()
    return ok(
        media_service.upload_user_shot(
            db, principal.id, tea_id, image_type, file.filename, file.content_type, content
        )
    )


@router.delete("/admin/media/{image_id}")
def delete_media(
    image_id: int,
    _: Principal = Depends(admin_required),
    db: Session = Depends(get_db),
):
    media_service.delete(db, image_id)
    return ok()
