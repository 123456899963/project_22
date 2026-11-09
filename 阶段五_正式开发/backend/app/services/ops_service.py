"""运营工具（M10）：工作台计数、系统配置、批量导入（CSV，单批 ≤500 行）。

对应原 Java ops 包：DashboardService / SettingsService；批量导入按
MODULE_DESIGN §M10 与 API_CONTRACT §5.5 实现（原 Java 仅定义契约未落实现）。
"""

import csv
import io
import json
import uuid
from datetime import timedelta
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Callable

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.audit import AuditService
from app.core.config import settings
from app.core.errors import BizException, ErrorCode
from app.core.timeutil import iso, now
from app.models.catalog import Tea, TeaCategory, TeaSubcategory
from app.models.engagement import Comment
from app.models.ops import ImportRowError, ImportTask, SystemConfig, SystemConfigLog
from app.models.submission import Submission
from app.services import moderation_service

MAX_IMPORT_ROWS = 500
MAX_IMPORT_BYTES = 20 * 1024 * 1024
CONFIG_TYPES = {"string", "int", "bool", "json"}

IMPORT_HEADERS = [
    "name",
    "categoryCode",
    "subcategoryCode",
    "productionYear",
    "originSummary",
    "qualityDesc",
    "waterTempMin",
    "waterTempMax",
    "ratioGrams",
    "ratioWaterMl",
    "vessel",
    "steepSecondsMin",
    "steepSecondsMax",
    "steepTimes",
]


# ---------------- 工作台 ----------------

def dashboard(db: Session) -> dict:
    deadline = now() - timedelta(hours=24)
    pending_teas = db.execute(
        select(func.count()).select_from(Tea).where(
            Tea.status == "pending", Tea.deleted_at.is_(None)
        )
    ).scalar_one()
    pending_submissions = db.execute(
        select(func.count()).select_from(Submission).where(
            Submission.status == "pending", Submission.deleted_at.is_(None)
        )
    ).scalar_one()
    overdue_submissions = db.execute(
        select(func.count()).select_from(Submission).where(
            Submission.status == "pending",
            Submission.submitted_at < deadline,
            Submission.deleted_at.is_(None),
        )
    ).scalar_one()
    overdue_comments = db.execute(
        select(func.count()).select_from(Comment).where(
            Comment.status == "pending",
            Comment.created_at < deadline,
            Comment.deleted_at.is_(None),
        )
    ).scalar_one()
    published_last_7_days = db.execute(
        select(func.count()).select_from(Tea).where(
            Tea.status == "published",
            Tea.published_at >= now() - timedelta(days=7),
            Tea.deleted_at.is_(None),
        )
    ).scalar_one()
    return {
        "pendingTeas": pending_teas,
        "pendingSubmissions": pending_submissions,
        "pendingReports": moderation_service.count_open_reports(db),
        "overdue": overdue_submissions
        + overdue_comments
        + moderation_service.count_overdue_reports(db),
        "publishedLast7Days": published_last_7_days,
    }


# ---------------- 系统配置 ----------------

def list_settings(db: Session) -> list[dict]:
    rows = (
        db.execute(select(SystemConfig).order_by(SystemConfig.config_key.asc()))
        .scalars()
        .all()
    )
    return [
        {
            "key": row.config_key,
            "value": row.config_value,
            "valueType": row.value_type,
            "editable": bool(row.editable),
            "description": row.description,
        }
        for row in rows
    ]


def update_settings(db: Session, operator_id: int, items: list[dict]) -> None:
    if not items:
        raise BizException(ErrorCode.SYS_001, "没有需要更新的配置")
    # 先整体校验，避免部分写入后因后项非法而留下半成品
    configs: list[tuple[SystemConfig, str]] = []
    for item in items:
        key = item.get("key")
        value = item.get("value")
        if key is None or value is None:
            raise BizException(ErrorCode.SYS_001, "配置键与值不能为空")
        config = db.get(SystemConfig, key)
        if config is None:
            raise BizException(ErrorCode.SYS_001, "配置项不存在：" + key)
        if not config.editable:
            raise BizException(ErrorCode.SYS_004, "配置项只读：" + key)
        _validate_config_value(config, value)
        configs.append((config, value))

    for config, value in configs:
        old_value = config.config_value
        config.config_value = value
        config.updated_by = operator_id
        config.updated_at = now()
        db.add(
            SystemConfigLog(
                config_key=config.config_key,
                old_value=old_value,
                new_value=value,
                updated_by=operator_id,
                created_at=now(),
            )
        )
        AuditService(db).record(
            "update_config", "config", None, config.config_key, old_value, value
        )
    db.commit()


def _validate_config_value(config: SystemConfig, value: str) -> None:
    if len(value) > 1000:
        raise BizException(ErrorCode.SYS_001, "配置值不超过 1000 字")
    value_type = config.value_type
    if value_type not in CONFIG_TYPES:
        raise BizException(ErrorCode.SYS_001, "配置类型不合法")
    if value_type == "int":
        try:
            int(value)
        except ValueError as exc:
            raise BizException(ErrorCode.SYS_001, "该项需为整数：" + config.config_key) from exc
    elif value_type == "bool":
        if value not in ("true", "false"):
            raise BizException(ErrorCode.SYS_001, "该项需为 true/false：" + config.config_key)
    elif value_type == "json":
        try:
            json.loads(value)
        except ValueError as exc:
            raise BizException(ErrorCode.SYS_001, "该项需为合法 JSON：" + config.config_key) from exc


# ---------------- 批量导入 ----------------

def template_csv() -> str:
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(IMPORT_HEADERS)
    return buffer.getvalue()


def create_import(
    db: Session, operator_id: int, filename: str | None, content: bytes
) -> dict:
    safe_name = Path(filename or "import.csv").name[:200]
    if len(content) > MAX_IMPORT_BYTES:
        raise BizException(ErrorCode.SYS_001, "文件超过 20MB")
    if not safe_name.lower().endswith(".csv"):
        raise BizException(ErrorCode.SYS_001, "仅支持 CSV 文件（V1 暂未提供 xlsx 解析）")

    task = ImportTask(
        operator_id=operator_id,
        file_name=safe_name,
        status="validating",
        total_rows=0,
        success_rows=0,
        error_rows=0,
    )
    db.add(task)
    db.flush()
    try:
        relative_path = _save_upload(task.id, safe_name, content)
        task.file_path = relative_path
        categories, subcategories = _load_taxonomy(db)
        rows = _parse_rows(content)
        if len(rows) > MAX_IMPORT_ROWS:
            raise BizException(ErrorCode.SYS_001, "单次导入不超过 500 行")
        errors = _validate_rows(db, rows, categories, subcategories)
        task.total_rows = len(rows)
        task.error_rows = len({item[0] for item in errors})
        task.success_rows = task.total_rows - task.error_rows
        if errors:
            task.status = "validation_failed"
            for row_no, column_name, message in errors:
                db.add(
                    ImportRowError(
                        task_id=task.id, row_no=row_no, column_name=column_name, error_msg=message
                    )
                )
            task.error_report_path = _write_error_report(task.id, errors)
        else:
            task.status = "ready"
        db.commit()
    except Exception:
        db.rollback()
        raise
    return _task_view(task)


def get_import(db: Session, task_id: int) -> dict:
    return _task_view(_require_task(db, task_id))


def list_import_errors(db: Session, task_id: int) -> list[dict]:
    _require_task(db, task_id)
    rows = (
        db.execute(
            select(ImportRowError)
            .where(ImportRowError.task_id == task_id)
            .order_by(ImportRowError.row_no.asc(), ImportRowError.id.asc())
        )
        .scalars()
        .all()
    )
    return [
        {"rowNo": row.row_no, "columnName": row.column_name, "errorMsg": row.error_msg}
        for row in rows
    ]


def confirm_import(db: Session, operator_id: int, task_id: int) -> dict:
    task = _require_task(db, task_id)
    if task.status != "ready":
        raise BizException(ErrorCode.CATALOG_002, "导入任务当前状态不允许确认")
    content = _read_upload(task.file_path)
    rows = _parse_rows(content)
    categories, subcategories = _load_taxonomy(db)
    errors = _validate_rows(db, rows, categories, subcategories)
    if errors:
        task.status = "validation_failed"
        task.error_rows = len({item[0] for item in errors})
        task.success_rows = task.total_rows - task.error_rows
        for row_no, column_name, message in errors:
            db.add(
                ImportRowError(
                    task_id=task.id, row_no=row_no, column_name=column_name, error_msg=message
                )
            )
        task.error_report_path = _write_error_report(task.id, errors)
        db.commit()
        raise BizException(ErrorCode.SYS_001, "导入校验未通过，请先修正错误行")

    before = task.status
    task.status = "importing"
    task.started_at = now()
    db.flush()
    try:
        for _, raw in rows:
            _upsert_tea(db, raw, categories, subcategories, operator_id)
        task.status = "completed"
        task.success_rows = task.total_rows
        task.error_rows = 0
        task.finished_at = now()
        db.flush()
        AuditService(db).record(
            "import", "import_task", task.id, task.file_name, before, task.status
        )
        db.commit()
    except Exception:
        db.rollback()
        _mark_import_failed(task_id)
        raise
    return _task_view(task)


def _mark_import_failed(task_id: int) -> None:
    from app.core.db import SessionLocal

    local = SessionLocal()
    try:
        task = local.get(ImportTask, task_id)
        if task is not None:
            task.status = "failed"
            task.finished_at = now()
            local.commit()
    finally:
        local.close()


def _require_task(db: Session, task_id: int) -> ImportTask:
    task = db.get(ImportTask, task_id)
    if task is None:
        raise BizException(ErrorCode.CATALOG_001, "导入任务不存在")
    return task


def _task_view(task: ImportTask) -> dict:
    return {
        "id": task.id,
        "fileName": task.file_name,
        "status": task.status,
        "totalRows": task.total_rows,
        "successRows": task.success_rows,
        "errorRows": task.error_rows,
        "errorReportPath": task.error_report_path,
        "createdAt": iso(task.created_at),
        "startedAt": iso(task.started_at),
        "finishedAt": iso(task.finished_at),
    }


def _save_upload(task_id: int, filename: str, content: bytes) -> str:
    base = Path(settings.storage_dir).resolve()
    relative = f"imports/{task_id}-{filename}"
    target = (base / relative).resolve()
    if base not in target.parents:
        raise BizException(ErrorCode.SYS_001, "非法存储路径")
    try:
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(content)
    except OSError as exc:
        raise BizException(ErrorCode.SYS_003, "文件保存失败") from exc
    return relative


def _read_upload(relative_path: str | None) -> bytes:
    if not relative_path:
        raise BizException(ErrorCode.SYS_001, "导入文件缺失")
    base = Path(settings.storage_dir).resolve()
    target = (base / relative_path).resolve()
    if base not in target.parents:
        raise BizException(ErrorCode.SYS_001, "非法存储路径")
    try:
        return target.read_bytes()
    except OSError as exc:
        raise BizException(ErrorCode.SYS_001, "导入文件已丢失，请重新上传") from exc


def _write_error_report(task_id: int, errors: list[tuple[int, str | None, str]]) -> str:
    base = Path(settings.storage_dir).resolve()
    relative = f"imports/{task_id}-errors.csv"
    target = (base / relative).resolve()
    try:
        target.parent.mkdir(parents=True, exist_ok=True)
        buffer = io.StringIO()
        writer = csv.writer(buffer)
        writer.writerow(["rowNo", "columnName", "errorMsg"])
        for row_no, column_name, message in errors:
            writer.writerow([row_no, column_name or "", message])
        target.write_text(buffer.getvalue(), encoding="utf-8-sig")
    except OSError:
        return ""
    return relative


def _parse_rows(content: bytes) -> list[tuple[int, dict[str, str]]]:
    try:
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise BizException(ErrorCode.SYS_001, "仅支持 UTF-8 编码的 CSV") from exc
    reader = csv.reader(io.StringIO(text))
    try:
        header = next(reader)
    except StopIteration:
        raise BizException(ErrorCode.SYS_001, "导入文件为空") from None
    header = [item.strip() for item in header]
    missing = [name for name in IMPORT_HEADERS if name not in header]
    if missing:
        raise BizException(ErrorCode.SYS_001, "模板列缺失：" + "、".join(missing))

    rows: list[tuple[int, dict[str, str]]] = []
    for index, values in enumerate(reader):
        raw = {
            header[pos].strip(): (values[pos].strip() if pos < len(values) else "")
            for pos in range(len(header))
        }
        if not any(raw.values()):
            continue
        rows.append((index + 2, raw))
    return rows


def _load_taxonomy(db: Session) -> tuple[dict[str, TeaCategory], dict[str, TeaSubcategory]]:
    categories = {
        row.code: row
        for row in db.execute(select(TeaCategory)).scalars().all()
    }
    subcategories = {
        row.code: row
        for row in db.execute(select(TeaSubcategory)).scalars().all()
    }
    return categories, subcategories


def _validate_rows(
    db: Session,
    rows: list[tuple[int, dict[str, str]]],
    categories: dict[str, TeaCategory],
    subcategories: dict[str, TeaSubcategory],
) -> list[tuple[int, str | None, str]]:
    errors: list[tuple[int, str | None, str]] = []
    for row_no, raw in rows:
        errors.extend(_validate_row(db, row_no, raw, categories, subcategories))
    return errors


def _validate_row(
    db: Session,
    row_no: int,
    raw: dict[str, str],
    categories: dict[str, TeaCategory],
    subcategories: dict[str, TeaSubcategory],
) -> list[tuple[int, str | None, str]]:
    errors: list[tuple[int, str | None, str]] = []

    def add(column: str, message: str) -> None:
        errors.append((row_no, column, message))

    name = raw.get("name", "")
    if not name:
        add("name", "茶名必填")
    elif len(name) > 80:
        add("name", "茶名不超过 80 字")

    category_code = raw.get("categoryCode", "")
    category = categories.get(category_code)
    if not category_code:
        add("categoryCode", "茶类编码必填")
    elif category is None:
        add("categoryCode", "茶类编码不存在：" + category_code)

    subcategory_code = raw.get("subcategoryCode", "")
    subcategory = subcategories.get(subcategory_code)
    if not subcategory_code:
        add("subcategoryCode", "亚类编码必填")
    elif subcategory is None:
        add("subcategoryCode", "亚类编码不存在：" + subcategory_code)
    elif category is not None and subcategory.category_id != category.id:
        add("subcategoryCode", "亚类不属于所选茶类")

    _check_int(raw, "productionYear", 1900, 2100, add)
    _check_int(raw, "waterTempMin", 0, 100, add)
    _check_int(raw, "waterTempMax", 0, 100, add)
    _check_int(raw, "ratioWaterMl", 1, 10000, add)
    _check_int(raw, "steepSecondsMin", 0, 3600, add)
    _check_int(raw, "steepSecondsMax", 0, 3600, add)
    _check_int(raw, "steepTimes", 0, 100, add)

    ratio_grams = raw.get("ratioGrams", "")
    if ratio_grams:
        try:
            parsed = Decimal(ratio_grams)
            if parsed <= 0 or parsed > Decimal("1000"):
                add("ratioGrams", "投茶量需在 0–1000 g 之间")
        except InvalidOperation:
            add("ratioGrams", "投茶量需为数字")

    origin = raw.get("originSummary", "")
    if len(origin) > 300:
        add("originSummary", "产地概述不超过 300 字")
    quality = raw.get("qualityDesc", "")
    if len(quality) > 500:
        add("qualityDesc", "品质描述不超过 500 字")
    vessel = raw.get("vessel", "")
    if len(vessel) > 32:
        add("vessel", "推荐器皿不超过 32 字")

    if name:
        existing = db.execute(
            select(Tea).where(Tea.name == name, Tea.deleted_at.is_(None)).limit(1)
        ).scalars().first()
        if existing is not None and existing.status != "draft":
            add("name", "同名茶品已存在且非草稿状态，不能覆盖")
    return errors


def _check_int(
    raw: dict[str, str],
    column: str,
    minimum: int,
    maximum: int,
    add: Callable[[str, str], None],
) -> None:
    value = raw.get(column, "")
    if not value:
        return
    try:
        parsed = int(value)
    except ValueError:
        add(column, "需为整数")
        return
    if parsed < minimum or parsed > maximum:
        add(column, f"需在 {minimum}–{maximum} 之间")


def _upsert_tea(
    db: Session,
    raw: dict[str, str],
    categories: dict[str, TeaCategory],
    subcategories: dict[str, TeaSubcategory],
    operator_id: int,
) -> None:
    category = categories[raw["categoryCode"]]
    subcategory = subcategories[raw["subcategoryCode"]]
    fields = {
        "origin_summary": raw.get("originSummary") or None,
        "quality_desc": raw.get("qualityDesc") or None,
        "water_temp_min": _as_int(raw.get("waterTempMin")),
        "water_temp_max": _as_int(raw.get("waterTempMax")),
        "ratio_grams": _as_decimal(raw.get("ratioGrams")),
        "ratio_water_ml": _as_int(raw.get("ratioWaterMl")),
        "vessel": raw.get("vessel") or None,
        "steep_seconds_min": _as_int(raw.get("steepSecondsMin")),
        "steep_seconds_max": _as_int(raw.get("steepSecondsMax")),
        "steep_times": _as_int(raw.get("steepTimes")),
        "production_year": _as_int(raw.get("productionYear")),
    }
    existing = db.execute(
        select(Tea).where(Tea.name == raw["name"], Tea.deleted_at.is_(None)).limit(1)
    ).scalars().first()
    if existing is not None:
        if existing.status != "draft":
            raise BizException(ErrorCode.SYS_001, "同名茶品已存在且非草稿状态，不能覆盖")
        existing.category_id = category.id
        existing.subcategory_id = subcategory.id
        for key, value in fields.items():
            setattr(existing, key, value)
        existing.version = (existing.version or 0) + 1
        existing.last_update_at = now()
    else:
        tea = Tea(
            tea_code=_generate_tea_code(),
            name=raw["name"],
            category_id=category.id,
            subcategory_id=subcategory.id,
            status="draft",
            image_count=0,
            gallery_ready=False,
            published_version=0,
            version=0,
            last_update_at=now(),
            created_by=operator_id,
            **fields,
        )
        db.add(tea)
    db.flush()


def _as_int(value: str | None) -> int | None:
    return int(value) if value else None


def _as_decimal(value: str | None) -> Decimal | None:
    if not value:
        return None
    try:
        return Decimal(value)
    except InvalidOperation:
        return None


def _generate_tea_code() -> str:
    return "T" + uuid.uuid4().hex[:16].upper()


# ---------------- 关于页（P18） ----------------

ABOUT_SECTIONS = [
    {"key": "about", "title": "关于茗脉", "content": "茗脉是六大茶类知识库与图鉴平台，按茶类、亚类、茶品组织内容，提供筛选、识茶自查与图鉴浏览。"},
    {"key": "agreement", "title": "用户协议", "content": "使用本站即表示同意遵守平台规则；用户投稿须保证内容真实并拥有相应授权。"},
    {"key": "privacy", "title": "隐私政策", "content": "平台仅收集提供服务所必需的信息，不向第三方出售或提供用户个人信息。"},
    {"key": "disclaimer", "title": "免责声明", "content": "本站内容为茶类知识整理与中性饮用描述，不构成任何功效、医疗或投资建议。"},
]


def about() -> dict:
    """关于页静态内容：无登录要求、不写审计。"""
    return {"title": "关于茗脉", "version": "1.0.0", "sections": ABOUT_SECTIONS}
