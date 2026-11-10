"""管理员后台业务层（PRD 模块 6 / API_CONTRACT §4.6）

- 权限由 Router 层 Depends(get_admin_user) 前置校验（SECURITY S-11）
- 新增/编辑/上下架/小贴士/上传与 operation_logs 同事务写入（S-28）
- id / is_active / favorite_count 永不从请求体读取（S-20）
- 上下架只改 is_active，不物理删除茶品、收藏与图片（FR-6.3）
"""

from pathlib import Path

from fastapi import UploadFile
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.response import InternalError, TeaGuideError, TeaNotFound
from app.repositories import admin_repo, tea_repo
from app.schemas.admin import (
    AdminStatsResponse,
    AdminTeaListItem,
    AdminTeaListResponse,
    CategoryDistribution,
    TipsResponse,
    ToggleResponse,
    UploadResult,
    VideoUploadResult,
)
from app.schemas.tea import (
    CATEGORY_VALUES,
    SORT_VALUES,
    TeaCreateRequest,
    TeaDetail,
    TeaUpdateRequest,
)
from app.services import upload as upload_service
from app.services._common import split_csv

DEFAULT_PAGE_SIZE = 12
MAX_PAGE_SIZE = 50
MAX_KEYWORD_LEN = 50

TIPS_FIELDS = ("tips_history", "tips_suitable", "tips_misconception", "tips_official_note")
TIPS_FIELD_TO_COLUMN = {
    "tips_history": "history",
    "tips_suitable": "suitable",
    "tips_misconception": "misconception",
    "tips_official_note": "official_note",
}


def list_teas(
    db: Session,
    *,
    category: str | None,
    keyword: str | None,
    is_active: bool | None,
    sort: str,
    page: int,
    page_size: int,
) -> AdminTeaListResponse:
    """后台茶品列表：包含下架茶品，支持状态筛选与分页（API_CONTRACT §4.6.1）。"""
    categories = split_csv(category)
    invalid = [item for item in categories if item not in CATEGORY_VALUES]
    if invalid:
        raise TeaGuideError(40000, "category 取值非法")
    if sort not in SORT_VALUES:
        raise TeaGuideError(40000, "sort 取值非法")

    normalized_keyword = (keyword or "").strip() or None
    if normalized_keyword and len(normalized_keyword) > MAX_KEYWORD_LEN:
        raise TeaGuideError(40000, "keyword 长度不能超过 50 字符")

    page = max(1, page)
    page_size = min(max(1, page_size), MAX_PAGE_SIZE)

    items, total = admin_repo.list_teas(
        db,
        categories=categories or None,
        keyword=normalized_keyword,
        is_active=is_active,
        sort=sort,
        offset=(page - 1) * page_size,
        limit=page_size,
    )
    return AdminTeaListResponse(
        items=[AdminTeaListItem.model_validate(item) for item in items],
        total=total,
        page=page,
        page_size=page_size,
    )


def get_tea(db: Session, tea_id: int) -> TeaDetail:
    """后台详情：下架茶品仍可编辑，故不返回 40401（API_CONTRACT §4.6.2）。"""
    tea = tea_repo.get_by_id(db, tea_id)
    if tea is None:
        raise TeaNotFound
    return TeaDetail.model_validate(tea)


def _tips_values_from_create(req: TeaCreateRequest) -> dict:
    values = {}
    for field, column in TIPS_FIELD_TO_COLUMN.items():
        value = getattr(req, field)
        if value is not None:
            values[column] = value
    return values


def create_tea(db: Session, *, admin_id: int, req: TeaCreateRequest) -> TeaDetail:
    fields = req.model_dump(exclude=set(TIPS_FIELDS))
    tea = admin_repo.create_tea(db, fields)
    tea_id = tea.id

    tips_values = _tips_values_from_create(req)
    if tips_values:
        admin_repo.create_tips(db, tea_id, tips_values)

    admin_repo.add_operation_log(
        db,
        user_id=admin_id,
        action="create_tea",
        target_id=tea_id,
        detail=f"新增茶品：{tea.name}",
    )
    db.commit()

    tea = tea_repo.get_by_id(db, tea_id)
    return TeaDetail.model_validate(tea)


def update_tea(db: Session, *, admin_id: int, tea_id: int, req: TeaUpdateRequest) -> TeaDetail:
    tea = tea_repo.get_by_id(db, tea_id)
    if tea is None:
        raise TeaNotFound

    # PUT 全量替换；id/is_active/favorite_count 不在 Schema 中，天然不可篡改
    admin_repo.update_tea(db, tea, req.model_dump())
    admin_repo.add_operation_log(
        db,
        user_id=admin_id,
        action="update_tea",
        target_id=tea_id,
        detail=f"编辑茶品：{tea.name}",
    )
    db.commit()

    tea = tea_repo.get_by_id(db, tea_id)
    return TeaDetail.model_validate(tea)


def toggle_tea(db: Session, *, admin_id: int, tea_id: int) -> ToggleResponse:
    tea = tea_repo.get_by_id(db, tea_id)
    if tea is None:
        raise TeaNotFound

    target = not tea.is_active
    admin_repo.set_active(db, tea, target)
    direction = "上架" if target else "下架"
    admin_repo.add_operation_log(
        db,
        user_id=admin_id,
        action="toggle_tea",
        target_id=tea_id,
        detail=f"{direction}茶品：{tea.name}",
    )
    db.commit()
    db.refresh(tea)

    return ToggleResponse(id=tea.id, is_active=tea.is_active, updated_at=tea.updated_at)


def update_tips(db: Session, *, admin_id: int, tea_id: int, req) -> TipsResponse:
    """省略字段保持原值；显式 null/纯空白清空该区块（API_CONTRACT §4.6.6）。"""
    tea = tea_repo.get_by_id(db, tea_id)
    if tea is None:
        raise TeaNotFound

    tips = admin_repo.get_tips(db, tea_id)
    provided = req.model_fields_set
    values: dict[str, str | None] = {}
    for field, column in TIPS_FIELD_TO_COLUMN.items():
        if field in provided:
            values[column] = getattr(req, field)
        else:
            values[column] = getattr(tips, column) if tips is not None else None

    if tips is None:
        if any(value is not None for value in values.values()):
            admin_repo.create_tips(db, tea_id, values)
    else:
        admin_repo.update_tips(db, tips, values)

    admin_repo.add_operation_log(
        db,
        user_id=admin_id,
        action="update_tea",
        target_id=tea_id,
        detail=f"更新小贴士：{tea.name}",
    )
    db.commit()

    response_values = {field: values[column] for field, column in TIPS_FIELD_TO_COLUMN.items()}
    return TipsResponse(tea_id=tea_id, **response_values)


def stats(db: Session) -> AdminStatsResponse:
    """仪表盘统计：含下架茶品，六大茶类固定顺序、缺失补 0。"""
    total, active, inactive = admin_repo.count_stats(db)
    category_map = admin_repo.count_by_category_all(db)
    distribution = [
        CategoryDistribution(category=category, count=category_map.get(category, 0))
        for category in CATEGORY_VALUES
    ]
    return AdminStatsResponse(
        total_count=total,
        active_count=active,
        inactive_count=inactive,
        category_distribution=distribution,
    )


async def upload_image(db: Session, *, admin_id: int, file: UploadFile) -> UploadResult:
    result = await upload_service.save_image(file)
    admin_repo.add_operation_log(
        db,
        user_id=admin_id,
        action="upload_image",
        target_id=None,
        detail=f"{result['original_filename']} / {result['size']} bytes",
    )
    try:
        db.commit()
    except Exception:
        db.rollback()
        # 日志失败时不留下孤儿文件，保持“无日志不落盘”的验收口径
        saved_path = Path(settings.TEA_UPLOAD_DIR) / result["url"].removeprefix("/uploads/")
        saved_path.unlink(missing_ok=True)
        raise InternalError

    return UploadResult(**result)


async def upload_video(db: Session, *, admin_id: int, file: UploadFile) -> VideoUploadResult:
    """A4' 视频上传（ADR-0003 S5）：MP4/MOV ≤50 MB，时长 ≤180 秒。"""
    result = await upload_service.save_video(file)
    admin_repo.add_operation_log(
        db,
        user_id=admin_id,
        action="upload_video",
        target_id=None,
        detail=f"{result['original_filename']} / {result['size']} bytes / {result['duration']}s",
    )
    try:
        db.commit()
    except Exception:
        db.rollback()
        saved_path = Path(settings.TEA_UPLOAD_DIR) / result["url"].removeprefix("/uploads/")
        saved_path.unlink(missing_ok=True)
        raise InternalError

    return VideoUploadResult(**result)
