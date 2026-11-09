"""投稿 T1 品鉴长文 / T3 补图 / T4 纠错（M07）。

状态机：draft → pending → approved/rejected；rejected → pending（≤2 次）；二次驳回后由审核模块置 locked。
每日限 3 条；T4 并发由数据库生成列 pending_guard 唯一约束兜底。
对应 Java submission.service.SubmissionService / SubmissionStatsService。
"""

from typing import Optional

from sqlalchemy import delete as sa_delete
from sqlalchemy import func, insert, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.errors import BizException, ErrorCode
from app.core.pagination import normalize
from app.core.storage import storage_service
from app.core.timeutil import iso, now
from app.models.catalog import Tea
from app.models.media import MediaImage
from app.models.submission import Submission, SubmissionFieldDiff, SubmissionImage

DAILY_LIMIT = 3
MAX_RESUBMIT = 2
MAX_IMAGES = 5
MIN_BODY = 300
MAX_TITLE = 60
MAX_BODY = 20000
MAX_FIELD_KEY = 40
MAX_NEW_VALUE = 500
MIN_REASON = 20
MAX_REASON = 200
ANONYMOUS_NICKNAME = "匿名茶友"
TYPES = {"T1", "T3", "T4"}
STATUSES = {"draft", "pending", "approved", "rejected", "locked", "revised"}


# ---------------- 只读统计 ----------------

def count_submissions(db: Session, user_id: int) -> int:
    return int(
        db.execute(
            select(func.count())
            .select_from(Submission)
            .where(Submission.user_id == user_id, Submission.deleted_at.is_(None))
        ).scalar_one()
    )


def count_pending_submissions(db: Session) -> int:
    return int(
        db.execute(
            select(func.count())
            .select_from(Submission)
            .where(Submission.status == "pending", Submission.deleted_at.is_(None))
        ).scalar_one()
    )


def count_overdue_submissions(db: Session, before) -> int:
    return int(
        db.execute(
            select(func.count())
            .select_from(Submission)
            .where(
                Submission.status == "pending",
                Submission.submitted_at < before,
                Submission.deleted_at.is_(None),
            )
        ).scalar_one()
    )


# ---------------- 我的投稿 ----------------

def list_submissions(
    db: Session,
    user_id: int,
    type: Optional[str],
    status: Optional[str],
    page: int,
    size: int,
) -> tuple[list[dict], int]:
    safe_page, safe_size = normalize(page, size)
    stmt = select(Submission).where(
        Submission.user_id == user_id, Submission.deleted_at.is_(None)
    )
    if type is not None and type.strip():
        stmt = stmt.where(Submission.type == _require_type(type))
    if status is not None and status.strip():
        if status not in STATUSES:
            raise BizException(
                ErrorCode.SYS_001, "投稿状态只能是 draft/pending/approved/rejected/locked/revised"
            )
        stmt = stmt.where(Submission.status == status)
    stmt = stmt.order_by(Submission.created_at.desc(), Submission.id.desc())
    total = int(
        db.execute(select(func.count()).select_from(stmt.subquery())).scalar_one()
    )
    rows = db.execute(
        stmt.limit(safe_size).offset((safe_page - 1) * safe_size)
    ).scalars().all()
    names = _tea_names(db, [row.tea_id for row in rows])
    return [_to_item_view(row, names) for row in rows], total


def create(db: Session, user_id: int, payload: dict) -> dict:
    type = _require_type(payload.get("type"))
    tea_id = _require_tea(db, payload.get("teaId"))
    _validate_write(db, payload, type, True, user_id)
    current = now()
    license_granted = type == "T3" and payload.get("licenseGranted") is True
    result = db.execute(
        insert(Submission).values(
            user_id=user_id,
            type=type,
            tea_id=tea_id,
            correction_field_key=_trim_to_null(payload.get("correctionFieldKey")),
            title=_trim_to_null(payload.get("title")),
            body=_trim_to_null(payload.get("body")),
            anonymous=bool(payload.get("anonymous")),
            license_granted=license_granted,
            license_granted_at=current if license_granted else None,
            status="draft",
            resubmit_count=0,
            created_at=current,
            updated_at=current,
        )
    )
    submission_id = int(result.lastrowid)
    _replace_images(db, submission_id, payload.get("imageIds"))
    _replace_field_diff(db, submission_id, type, payload)
    db.flush()
    submission = db.get(Submission, submission_id)
    db.commit()
    return _to_item_view(submission, _tea_names(db, [tea_id]))


def update(db: Session, user_id: int, submission_id: int, payload: dict) -> dict:
    submission = _require_owned(db, user_id, submission_id)
    if submission.status not in ("draft", "rejected"):
        raise BizException(ErrorCode.SUB_004, "仅草稿或已驳回的投稿可修改")
    if payload.get("type") is not None and payload.get("type") != submission.type:
        raise BizException(ErrorCode.SYS_001, "投稿类型创建后不可修改")
    if payload.get("teaId") is not None and payload.get("teaId") != submission.tea_id:
        raise BizException(ErrorCode.SYS_001, "关联茶品创建后不可修改")
    _validate_write(db, payload, submission.type, False, user_id)

    if payload.get("title") is not None:
        submission.title = _trim_to_null(payload.get("title"))
    if payload.get("body") is not None:
        submission.body = _trim_to_null(payload.get("body"))
    if payload.get("anonymous") is not None:
        submission.anonymous = bool(payload.get("anonymous"))
    if submission.type == "T3" and payload.get("licenseGranted") is True:
        submission.license_granted = 1
        submission.license_granted_at = now()
    if submission.type == "T4" and payload.get("correctionFieldKey") is not None:
        submission.correction_field_key = _trim_to_null(payload.get("correctionFieldKey"))
    if payload.get("imageIds") is not None:
        _replace_images(db, submission.id, payload.get("imageIds"))
    if submission.type == "T4":
        _replace_field_diff(db, submission.id, submission.type, payload)
    db.flush()
    db.commit()
    return _to_item_view(submission, _tea_names(db, [submission.tea_id]))


def delete(db: Session, user_id: int, submission_id: int) -> None:
    submission = _require_owned(db, user_id, submission_id)
    if submission.status != "draft":
        raise BizException(ErrorCode.SUB_004, "仅草稿可删除")
    submission.deleted_at = now()
    db.commit()


def detail(db: Session, user_id: int, submission_id: int) -> dict:
    return _to_detail_view(db, _require_owned(db, user_id, submission_id))


def preview(db: Session, user_id: int, submission_id: int) -> dict:
    """草稿/审核中预览与详情同源，仅作者本人可见。"""
    return _to_detail_view(db, _require_owned(db, user_id, submission_id))


# ---------------- 提交与重提 ----------------

def submit(db: Session, user_id: int, submission_id: int) -> dict:
    submission = _require_owned(db, user_id, submission_id)
    if submission.status != "draft":
        raise BizException(ErrorCode.SUB_004, "仅草稿可编辑或提交")
    _require_quota(db, user_id)
    _validate_for_submit(db, submission)
    _require_no_duplicate(db, user_id, submission)
    submission.status = "pending"
    submission.submitted_at = now()
    _mark_pending(db, submission)
    return _to_item_view(submission, _tea_names(db, [submission.tea_id]))


def resubmit(db: Session, user_id: int, submission_id: int) -> dict:
    submission = _require_owned(db, user_id, submission_id)
    if submission.status == "locked":
        raise BizException(ErrorCode.SUB_004, "投稿已锁定，只能新建投稿")
    if submission.status != "rejected":
        raise BizException(ErrorCode.SUB_004, "仅驳回的投稿可重提")
    retried = submission.resubmit_count or 0
    if retried >= MAX_RESUBMIT:
        raise BizException(ErrorCode.SUB_003, "重提次数已达上限")
    _require_quota(db, user_id)
    _validate_for_submit(db, submission)
    _require_no_duplicate(db, user_id, submission)
    submission.resubmit_count = retried + 1
    submission.status = "pending"
    submission.reject_reason = None
    submission.submitted_at = now()
    _mark_pending(db, submission)
    return _to_item_view(submission, _tea_names(db, [submission.tea_id]))


def _mark_pending(db: Session, submission: Submission) -> None:
    try:
        db.flush()
        db.commit()
    except IntegrityError as exc:
        # uk_sub_pending_correction：同茶同字段已有待审核纠错
        db.rollback()
        raise BizException(
            ErrorCode.SUB_005, "该茶品该字段已有待审核纠错，请等待审核结果"
        ) from exc


# ---------------- 校验 ----------------

def _validate_write(
    db: Session, payload: dict, type: str, creating: bool, user_id: int
) -> None:
    title = _trim_to_null(payload.get("title"))
    if title is not None and len(title) > MAX_TITLE:
        raise BizException(ErrorCode.SYS_001, "标题不超过 60 字")
    body = payload.get("body")
    if type == "T1" and body is not None and len(body) > MAX_BODY:
        raise BizException(ErrorCode.SYS_001, "正文过长，请精简后再提交")
    if type == "T3" and creating and payload.get("licenseGranted") is not True:
        raise BizException(ErrorCode.SYS_001, "补图需勾选授权声明")
    if type == "T4":
        field_key = _trim_to_null(payload.get("correctionFieldKey"))
        if field_key is not None and len(field_key) > MAX_FIELD_KEY:
            raise BizException(ErrorCode.SYS_001, "纠错字段键过长")
        new_value = payload.get("newValue")
        if new_value is not None and len(new_value) > MAX_NEW_VALUE:
            raise BizException(ErrorCode.SYS_001, "修改内容不超过 500 字")
        reason = payload.get("reason")
        if reason is not None and len(reason) > MAX_REASON:
            raise BizException(ErrorCode.SYS_001, "修改理由不超过 200 字")
    _validate_images(db, payload.get("imageIds"), user_id)


def _validate_images(db: Session, image_ids: Optional[list[int]], user_id: int) -> None:
    if image_ids is None:
        return
    distinct = list(dict.fromkeys(image_ids))
    if len(distinct) > MAX_IMAGES:
        raise BizException(ErrorCode.SYS_001, "最多上传 5 张图片")
    for image_id in distinct:
        image = db.get(MediaImage, image_id)
        if image is None or image.deleted_at is not None:
            raise BizException(ErrorCode.SYS_001, "图片不存在或已删除")
        # 用户补图只能引用本人上传的图片，避免引用他人（含官方图鉴）素材
        if image.uploaded_by != user_id:
            raise BizException(ErrorCode.SYS_001, "图片不存在或已删除")


def _validate_for_submit(db: Session, submission: Submission) -> None:
    if submission.type == "T1":
        title = _trim_to_null(submission.title)
        if title is None:
            raise BizException(ErrorCode.SYS_001, "品鉴长文需填写标题")
        if len(title) > MAX_TITLE:
            raise BizException(ErrorCode.SYS_001, "标题不超过 60 字")
        body = (submission.body or "").strip()
        if len(body) < MIN_BODY:
            raise BizException(ErrorCode.SYS_001, "正文不少于 300 字")
    elif submission.type == "T3":
        count = int(
            db.execute(
                select(func.count())
                .select_from(SubmissionImage)
                .where(SubmissionImage.submission_id == submission.id)
            ).scalar_one()
        )
        if count < 1 or count > MAX_IMAGES:
            raise BizException(ErrorCode.SYS_001, "补图需上传 1–5 张图片")
    elif submission.type == "T4":
        diff = db.execute(
            select(SubmissionFieldDiff)
            .where(SubmissionFieldDiff.submission_id == submission.id)
            .limit(1)
        ).scalars().first()
        field_key = _trim_to_null(submission.correction_field_key)
        if field_key is None:
            raise BizException(ErrorCode.SYS_001, "请选择需要修改的字段")
        if diff is None or _trim_to_null(diff.new_value) is None:
            raise BizException(ErrorCode.SYS_001, "请填写修改后的内容")
        reason = _trim_to_null(diff.reason)
        if reason is None or len(reason) < MIN_REASON or len(reason) > MAX_REASON:
            raise BizException(ErrorCode.SYS_001, "修改理由需 20–200 字")
    else:
        raise BizException(ErrorCode.SYS_001, "投稿类型不合法")


def _require_no_duplicate(db: Session, user_id: int, submission: Submission) -> None:
    """查重：同用户对同茶品重复提交同类型且仍处于待审/已通过时，引导改用纠错或补图。"""
    duplicate = int(
        db.execute(
            select(func.count())
            .select_from(Submission)
            .where(
                Submission.user_id == user_id,
                Submission.tea_id == submission.tea_id,
                Submission.type == submission.type,
                Submission.id != submission.id,
                Submission.status.in_(("pending", "approved")),
                Submission.deleted_at.is_(None),
            )
        ).scalar_one()
    )
    if duplicate > 0:
        raise BizException(ErrorCode.SUB_002, "该茶品已有相似投稿，可改用纠错或补图")


def _require_quota(db: Session, user_id: int) -> int:
    """当日额度：以 submitted_at 当日计数为准（草稿不计）。"""
    today_start = now().replace(hour=0, minute=0, second=0, microsecond=0)
    count = int(
        db.execute(
            select(func.count())
            .select_from(Submission)
            .where(
                Submission.user_id == user_id,
                Submission.submitted_at >= today_start,
                Submission.deleted_at.is_(None),
            )
        ).scalar_one()
    )
    if count >= DAILY_LIMIT:
        raise BizException(ErrorCode.SUB_001, "今日投稿额度已满（3 条/日）")
    return count


# ---------------- 归属与类型 ----------------

def _require_owned(db: Session, user_id: int, submission_id: int) -> Submission:
    submission = db.get(Submission, submission_id)
    if (
        submission is None
        or submission.deleted_at is not None
        or submission.user_id != user_id
    ):
        raise BizException(ErrorCode.CATALOG_001, "投稿不存在")
    return submission


def _require_type(type: Optional[str]) -> str:
    if type is None or type not in TYPES:
        raise BizException(ErrorCode.SYS_001, "投稿类型只能是 T1/T3/T4")
    return type


def _require_tea(db: Session, tea_id: Optional[int]) -> int:
    if tea_id is None:
        raise BizException(ErrorCode.CATALOG_001, "关联茶品不存在或已下架")
    from app.services import catalog_service

    try:
        tea = catalog_service.get_tea_or_404(db, tea_id)
    except BizException as exc:
        raise BizException(ErrorCode.CATALOG_001, "关联茶品不存在或已下架") from exc
    if tea.deleted_at is not None or tea.status != "published":
        raise BizException(ErrorCode.CATALOG_001, "关联茶品不存在或已下架")
    return tea_id


# ---------------- 写入辅助 ----------------

def _replace_images(db: Session, submission_id: int, image_ids: Optional[list[int]]) -> None:
    db.execute(
        sa_delete(SubmissionImage).where(SubmissionImage.submission_id == submission_id)
    )
    if not image_ids:
        return
    for seq, image_id in enumerate(dict.fromkeys(image_ids), start=1):
        db.add(SubmissionImage(submission_id=submission_id, image_id=image_id, seq=seq))


def _replace_field_diff(
    db: Session, submission_id: int, type: str, payload: dict
) -> None:
    if type != "T4":
        return
    db.execute(
        sa_delete(SubmissionFieldDiff).where(
            SubmissionFieldDiff.submission_id == submission_id
        )
    )
    field_key = _trim_to_null(payload.get("correctionFieldKey"))
    if field_key is None:
        return
    db.add(
        SubmissionFieldDiff(
            submission_id=submission_id,
            field_key=field_key,
            new_value=_trim_to_null(payload.get("newValue")),
            reason=_trim_to_null(payload.get("reason")),
        )
    )


# ---------------- 视图 ----------------

def _to_item_view(submission: Submission, names: dict[int, str]) -> dict:
    return {
        "id": submission.id,
        "type": submission.type,
        "status": submission.status,
        "teaId": submission.tea_id,
        "teaName": names.get(submission.tea_id),
        "title": submission.title,
        "summary": _summary_of(submission),
        "retryCount": submission.resubmit_count or 0,
        "rejectReason": submission.reject_reason,
        "createdAt": iso(submission.created_at),
        "updatedAt": iso(submission.updated_at),
    }


def _to_detail_view(db: Session, submission: Submission) -> dict:
    images = []
    rows = db.execute(
        select(SubmissionImage)
        .where(SubmissionImage.submission_id == submission.id)
        .order_by(SubmissionImage.seq)
    ).scalars().all()
    for row in rows:
        item = _media_item(db, row.image_id)
        if item is not None:
            images.append(item)
    diff = db.execute(
        select(SubmissionFieldDiff)
        .where(SubmissionFieldDiff.submission_id == submission.id)
        .limit(1)
    ).scalars().first()
    nickname = ANONYMOUS_NICKNAME
    if not bool(submission.anonymous):
        profiles = _profiles(db, [submission.user_id])
        profile = profiles.get(submission.user_id) or {}
        nickname = profile.get("nickname") or "茶友"
    return {
        "id": submission.id,
        "type": submission.type,
        "status": submission.status,
        "teaId": submission.tea_id,
        "teaName": _tea_names(db, [submission.tea_id]).get(submission.tea_id),
        "title": submission.title,
        "summary": _summary_of(submission),
        "retryCount": submission.resubmit_count or 0,
        "rejectReason": submission.reject_reason,
        "createdAt": iso(submission.created_at),
        "updatedAt": iso(submission.updated_at),
        "body": submission.body,
        "images": images,
        "correctionFieldKey": diff.field_key
        if diff is not None
        else submission.correction_field_key,
        "newValue": diff.new_value if diff is not None else None,
        "reason": diff.reason if diff is not None else None,
        "anonymous": bool(submission.anonymous),
        "licenseGranted": bool(submission.license_granted),
        "nickname": nickname,
    }


def _media_item(db: Session, image_id: int) -> Optional[dict]:
    image = db.get(MediaImage, image_id)
    if image is None or image.deleted_at is not None:
        return None
    thumb = image.thumb_path or image.storage_path
    return {
        "id": image.id,
        "url": storage_service.url(image.storage_path),
        "thumbUrl": storage_service.url(thumb),
    }


def _profiles(db: Session, user_ids: list[int]) -> dict[int, dict]:
    from app.services import account_service

    return account_service.profiles_by_ids(db, user_ids)


def _tea_names(db: Session, tea_ids: list[Optional[int]]) -> dict[int, str]:
    ids = [tea_id for tea_id in dict.fromkeys(tea_ids) if tea_id is not None]
    if not ids:
        return {}
    rows = db.execute(select(Tea.id, Tea.name).where(Tea.id.in_(ids))).all()
    return {int(row[0]): row[1] for row in rows}


def _summary_of(submission: Submission) -> str:
    if submission.type == "T1":
        body = (submission.body or "").strip()
        return body if len(body) <= 60 else body[:60] + "…"
    if submission.type == "T3":
        return "补图投稿"
    field_key = submission.correction_field_key
    return "纠错投稿" if field_key is None else "纠错：" + field_key


def _trim_to_null(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    trimmed = value.strip()
    return trimmed or None
