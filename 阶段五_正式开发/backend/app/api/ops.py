"""运营工具接口（M10）：工作台、系统配置、批量导入。"""

from typing import Optional

from fastapi import APIRouter, Depends, File, Response, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.response import ok
from app.core.security import Principal, admin_required, super_required
from app.services import ops_service

router = APIRouter()


class ConfigUpdateItem(BaseModel):
    key: str
    value: str


class ConfigUpdateRequest(BaseModel):
    items: list[ConfigUpdateItem]


@router.get("/pages/about")
def about_page():
    return ok(ops_service.about())


@router.get("/admin/dashboard")
def dashboard(_: Principal = Depends(admin_required), db: Session = Depends(get_db)):
    return ok(ops_service.dashboard(db))


@router.get("/admin/settings")
def list_settings(_: Principal = Depends(super_required), db: Session = Depends(get_db)):
    return ok(ops_service.list_settings(db))


@router.patch("/admin/settings")
def update_settings(
    payload: ConfigUpdateRequest,
    principal: Principal = Depends(super_required),
    db: Session = Depends(get_db),
):
    ops_service.update_settings(
        db, principal.id, [{"key": item.key, "value": item.value} for item in payload.items]
    )
    return ok()


@router.get("/admin/imports/template")
def import_template(_: Principal = Depends(admin_required)):
    return Response(
        content=ops_service.template_csv().encode("utf-8-sig"),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": "attachment; filename=tea-import-template.csv"},
    )


@router.post("/admin/imports")
def create_import(
    file: UploadFile = File(...),
    principal: Principal = Depends(admin_required),
    db: Session = Depends(get_db),
):
    content = file.file.read()
    return ok(ops_service.create_import(db, principal.id, file.filename, content))


@router.get("/admin/imports/{task_id}")
def get_import(
    task_id: int,
    _: Principal = Depends(admin_required),
    db: Session = Depends(get_db),
):
    return ok(ops_service.get_import(db, task_id))


@router.get("/admin/imports/{task_id}/errors")
def list_import_errors(
    task_id: int,
    _: Principal = Depends(admin_required),
    db: Session = Depends(get_db),
):
    return ok(ops_service.list_import_errors(db, task_id))


@router.post("/admin/imports/{task_id}/confirm")
def confirm_import(
    task_id: int,
    principal: Principal = Depends(admin_required),
    db: Session = Depends(get_db),
):
    return ok(ops_service.confirm_import(db, principal.id, task_id))
