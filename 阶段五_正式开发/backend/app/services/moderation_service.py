"""审核与治理（M08）：投稿/评论审核、举报与申诉、处罚、账号状态覆写。

对应原 Java moderation 包：SubmissionReviewService / CommentReviewService /
ReportService / SanctionService / ModerationStatusAdapter。
"""

from datetime import datetime, timedelta
from typing import Any

from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.audit import AuditService
from app.core.errors import BizException, ErrorCode
from app.core.pagination import normalize
from app.core.security import register_status_provider, token_store
from app.core.timeutil import TZ, iso, now
from app.models.account import AccountDeletionRequest, UserIdentity, UserProfile
from app.models.catalog import Tea
from app.models.engagement import Comment
from app.models.media import GalleryUserShot
from app.models.moderation import Appeal, Report, ReportEvidence, Sanction
from app.models.submission import Submission, SubmissionFieldDiff, SubmissionImage
from app.services import account_service

SUBMISSION_TYPES = {"T1", "T3", "T4"}
OBJECT_TYPES = {"image", "comment", "user_shot"}
REPORT_TYPES = {"侵权", "不实", "违规", "其他"}
OPEN_STATUSES = {"pending", "processing"}
SANCTION_TYPES = {"mute", "ban"}
REVIEW_OVERDUE_HOURS = 24
SLA_HOURS = 48


# ---------------- 账号状态覆写（main.startup 注册） ----------------

def effective_status(db: Session, user_id: int | None) -> str | None:
    """封禁优先于禁言；注销冷静期内返回 deleting；均无则 None。"""
    if user_id is None:
        return None
    current = now()
    bans = db.execute(
        select(func.count()).select_from(Sanction).where(
            Sanction.user_id == user_id,
            Sanction.status == "active",
            Sanction.sanction_type == "ban",
            or_(Sanction.end_at.is_(None), Sanction.end_at > current),
        )
    ).scalar_one()
    if bans > 0:
        return "banned"
    mutes = db.execute(
        select(func.count()).select_from(Sanction).where(
            Sanction.user_id == user_id,
            Sanction.status == "active",
            Sanction.sanction_type == "mute",
            or_(Sanction.end_at.is_(None), Sanction.end_at > current),
        )
    ).scalar_one()
    if mutes > 0:
        return "muted"
    identity = db.get(UserIdentity, user_id)
    if identity is not None and identity.status == "deleting":
        return "deleting"
    pending = db.execute(
        select(func.count()).select_from(AccountDeletionRequest).where(
            AccountDeletionRequest.user_id == user_id,
            AccountDeletionRequest.status == "pending",
        )
    ).scalar_one()
    return "deleting" if pending > 0 else None


def register_account_status() -> None:
    register_status_provider(effective_status)


# ---------------- 通用只读辅助 ----------------

def _tea_names(db: Session, ids: list[int | None]) -> dict[int, str]:
    valid = [item for item in set(ids) if item is not None]
    if not valid:
        return {}
    rows = db.execute(select(Tea.id, Tea.name).where(Tea.id.in_(valid))).all()
    return {row.id: row.name for row in rows}


def _nickname(db: Session, user_id: int) -> str:
    profile = db.get(UserProfile, user_id)
    return profile.nickname if profile is not None else "茶友"


def _notify(
    db: Session,
    user_id: int,
    msg_type: str,
    title: str,
    summary: str | None,
    target_type: str,
    target_id: int,
) -> None:
    from app.services import message_service

    message_service.notify(db, user_id, msg_type, title, summary, target_type, target_id)


def _media_item(db: Session, image_id: int) -> dict | None:
    from app.services import media_service

    item = media_service.item(db, image_id)
    if item is None:
        return None
    return {
        "id": _field(item, "id"),
        "url": _field(item, "url"),
        "thumbUrl": _field(item, "thumbUrl", "thumb_url"),
    }


def _field(item: Any, *keys: str) -> Any:
    for key in keys:
        if isinstance(item, dict):
            if item.get(key) is not None:
                return item.get(key)
        else:
            value = getattr(item, key, None)
            if value is not None:
                return value
    return None


def _appeal_view(db: Session, row: Appeal) -> dict:
    return {
        "id": row.id,
        "appellantId": row.appellant_id,
        "appellantNickname": _nickname(db, row.appellant_id),
        "sanctionId": row.sanction_id,
        "reason": row.reason,
        "status": row.status,
        "reviewNote": row.review_note,
        "reviewedAt": iso(row.reviewed_at),
        "createdAt": iso(row.created_at),
    }


def _sanction_view(row: Sanction) -> dict:
    return {
        "id": row.id,
        "type": row.sanction_type,
        "reason": row.reason,
        "startAt": iso(row.start_at),
        "endAt": iso(row.end_at),
        "status": row.status,
        "createdAt": iso(row.created_at),
    }


# ---------------- 投稿审核 ----------------

def list_submissions(
    db: Session,
    sub_type: str | None,
    status: str | None,
    overdue: bool,
    page: int,
    size: int,
) -> tuple[list[dict], int, int, int]:
    page, size = normalize(page, size)
    stmt = select(Submission).where(Submission.deleted_at.is_(None))
    if sub_type and sub_type.strip():
        if sub_type.strip() not in SUBMISSION_TYPES:
            raise BizException(ErrorCode.SYS_001, "投稿类型只能是 T1/T3/T4")
        stmt = stmt.where(Submission.type == sub_type.strip())
    if status and status.strip():
        stmt = stmt.where(Submission.status == status.strip())
    deadline = now() - timedelta(hours=REVIEW_OVERDUE_HOURS)
    if overdue:
        stmt = stmt.where(Submission.status == "pending", Submission.submitted_at < deadline)
    total = db.execute(select(func.count()).select_from(stmt.subquery())).scalar_one()
    rows = (
        db.execute(
            stmt.order_by(Submission.submitted_at.asc(), Submission.id.asc())
            .limit(size)
            .offset((page - 1) * size)
        )
        .scalars()
        .all()
    )
    tea_names = _tea_names(db, [row.tea_id for row in rows])
    profiles = account_service.profiles_by_ids(db, [row.user_id for row in rows])
    items = []
    for row in rows:
        profile = profiles.get(row.user_id) or {}
        is_overdue = (
            row.status == "pending"
            and row.submitted_at is not None
            and row.submitted_at < deadline
        )
        items.append(
            {
                "id": row.id,
                "type": row.type,
                "status": row.status,
                "teaId": row.tea_id,
                "teaName": tea_names.get(row.tea_id),
                "userId": row.user_id,
                "authorNickname": profile.get("nickname") or "茶友",
                "title": row.title,
                "retryCount": row.resubmit_count or 0,
                "rejectReason": row.reject_reason,
                "overdue": is_overdue,
                "createdAt": iso(row.created_at),
                "updatedAt": iso(row.updated_at),
            }
        )
    return items, page, size, total


def submission_detail(db: Session, submission_id: int) -> dict:
    submission = _require_submission(db, submission_id)
    images = []
    rows = (
        db.execute(
            select(SubmissionImage)
            .where(SubmissionImage.submission_id == submission_id)
            .order_by(SubmissionImage.seq.asc())
        )
        .scalars()
        .all()
    )
    for row in rows:
        view = _media_item(db, row.image_id)
        if view is not None:
            images.append(view)
    diff = db.execute(
        select(SubmissionFieldDiff)
        .where(SubmissionFieldDiff.submission_id == submission_id)
        .limit(1)
    ).scalars().first()
    tea_names = _tea_names(db, [submission.tea_id])
    return {
        "id": submission.id,
        "type": submission.type,
        "status": submission.status,
        "teaId": submission.tea_id,
        "teaName": tea_names.get(submission.tea_id),
        "userId": submission.user_id,
        "nickname": _nickname(db, submission.user_id),
        "title": submission.title,
        "body": submission.body,
        "images": images,
        "correctionFieldKey": diff.field_key if diff is not None else submission.correction_field_key,
        "newValue": diff.new_value if diff is not None else None,
        "reason": diff.reason if diff is not None else None,
        "anonymous": bool(submission.anonymous),
        "retryCount": submission.resubmit_count or 0,
        "rejectReason": submission.reject_reason,
        "lastReviewReason": AuditService(db).latest_reason("review", "submission", submission_id),
        "createdAt": iso(submission.created_at),
    }


def review_submission(db: Session, operator_id: int, submission_id: int, decision: str, reason: str | None) -> None:
    submission = _require_submission(db, submission_id)
    if submission.status != "pending":
        raise BizException(ErrorCode.SUB_004, "仅待审核投稿可审核")
    before = submission.status
    note = reason.strip() if reason else None
    if decision == "reject":
        if not note or len(note) > 300:
            raise BizException(ErrorCode.SYS_001, "驳回理由必填且不超过 300 字")
        if (submission.resubmit_count or 0) >= 1:
            submission.status = "locked"
            submission.locked_at = now()
        else:
            submission.status = "rejected"
        submission.reject_reason = note
        _notify(db, submission.user_id, "review", "投稿未通过", note, "submission", submission.id)
    elif decision == "approve":
        if submission.type == "T4":
            diffs = (
                db.execute(
                    select(SubmissionFieldDiff).where(
                        SubmissionFieldDiff.submission_id == submission_id
                    )
                )
                .scalars()
                .all()
            )
            if not diffs:
                raise BizException(ErrorCode.SYS_001, "纠错内容缺失，无法采纳")
            from app.services import catalog_service

            catalog_service.apply_correction(db, submission_id, list(diffs), operator_id)
            submission.status = "revised"
        else:
            if submission.type == "T3":
                _publish_user_shots(db, submission)
            submission.status = "approved"
        _notify(
            db,
            submission.user_id,
            "correction",
            "投稿已通过",
            "你的" + _type_label(submission.type) + "已通过审核",
            "submission",
            submission.id,
        )
    else:
        raise BizException(ErrorCode.SYS_001, "decision 只能是 approve 或 reject")
    submission.reviewed_by = operator_id
    submission.reviewed_at = now()
    db.flush()
    AuditService(db).record("review", "submission", submission_id, note, before, submission.status)
    db.commit()


def _publish_user_shots(db: Session, submission: Submission) -> None:
    """T3 审核通过后，把附件登记为用户实拍候选；授权状态随投稿落库（DATA_MODEL gallery_user_shot）。"""
    rows = (
        db.execute(
            select(SubmissionImage).where(
                SubmissionImage.submission_id == submission.id
            )
        )
        .scalars()
        .all()
    )
    for row in rows:
        exists = db.execute(
            select(GalleryUserShot.id)
            .where(
                GalleryUserShot.submission_id == submission.id,
                GalleryUserShot.image_id == row.image_id,
            )
            .limit(1)
        ).scalars().first()
        if exists is not None:
            continue
        db.add(
            GalleryUserShot(
                tea_id=submission.tea_id,
                submission_id=submission.id,
                image_id=row.image_id,
                author_id=submission.user_id,
                anonymous=bool(submission.anonymous),
                license_granted=bool(submission.license_granted),
                status="candidate",
                created_at=now(),
            )
        )


def _require_submission(db: Session, submission_id: int) -> Submission:
    row = db.get(Submission, submission_id)
    if row is None or row.deleted_at is not None:
        raise BizException(ErrorCode.CATALOG_001, "投稿不存在")
    return row


def _type_label(sub_type: str) -> str:
    if sub_type == "T1":
        return "品鉴长文"
    if sub_type == "T3":
        return "补图投稿"
    return "纠错"


# ---------------- 评论审核 ----------------

def list_comments(
    db: Session, status: str | None, overdue: bool, page: int, size: int
) -> tuple[list[dict], int, int, int]:
    page, size = normalize(page, size)
    stmt = select(Comment).where(Comment.deleted_at.is_(None))
    if status and status.strip():
        stmt = stmt.where(Comment.status == status.strip())
    deadline = now() - timedelta(hours=REVIEW_OVERDUE_HOURS)
    if overdue:
        stmt = stmt.where(Comment.status == "pending", Comment.created_at < deadline)
    total = db.execute(select(func.count()).select_from(stmt.subquery())).scalar_one()
    rows = (
        db.execute(
            stmt.order_by(Comment.created_at.asc(), Comment.id.asc())
            .limit(size)
            .offset((page - 1) * size)
        )
        .scalars()
        .all()
    )
    tea_names = _tea_names(db, [row.tea_id for row in rows])
    profiles = account_service.profiles_by_ids(db, [row.user_id for row in rows])
    items = []
    for row in rows:
        profile = profiles.get(row.user_id) or {}
        items.append(
            {
                "id": row.id,
                "teaId": row.tea_id,
                "teaName": tea_names.get(row.tea_id),
                "content": row.content,
                "userId": row.user_id,
                "nickname": profile.get("nickname") or "茶友",
                "status": row.status,
                "rejectReason": row.reject_reason,
                "createdAt": iso(row.created_at),
            }
        )
    return items, page, size, total


def review_comment(db: Session, operator_id: int, comment_id: int, decision: str, reason: str | None) -> None:
    comment = db.get(Comment, comment_id)
    if comment is None or comment.deleted_at is not None:
        raise BizException(ErrorCode.CATALOG_001, "评论不存在")
    if comment.status != "pending":
        raise BizException(ErrorCode.CATALOG_002, "仅待审核评论可审核")
    before = comment.status
    note = reason.strip() if reason else None
    if decision == "approve":
        comment.status = "published"
        _notify(db, comment.user_id, "review", "评论已通过", "你的评论已展示", "comment", comment.id)
    elif decision == "reject":
        if not note or len(note) > 300:
            raise BizException(ErrorCode.SYS_001, "驳回理由必填且不超过 300 字")
        comment.status = "rejected"
        comment.reject_reason = note
        _notify(db, comment.user_id, "review", "评论未通过", note, "comment", comment.id)
    else:
        raise BizException(ErrorCode.SYS_001, "decision 只能是 approve 或 reject")
    comment.reviewed_by = operator_id
    comment.reviewed_at = now()
    db.flush()
    AuditService(db).record("review", "comment", comment_id, note, before, comment.status)
    db.commit()


# ---------------- 举报与申诉 ----------------

def create_report(db: Session, reporter_id: int, payload: Any) -> int:
    object_type = (payload.objectType or "").strip()
    if object_type not in OBJECT_TYPES:
        raise BizException(ErrorCode.SYS_001, "举报对象类型不合法")
    if payload.objectId is None:
        raise BizException(ErrorCode.SYS_001, "举报对象缺失")
    report_type = (payload.reportType or "").strip()
    if report_type not in REPORT_TYPES:
        raise BizException(ErrorCode.SYS_001, "举报类型不合法")
    description = (payload.description or "").strip()
    if not description or len(description) > 200:
        raise BizException(ErrorCode.SYS_001, "举报说明必填且不超过 200 字")

    duplicate = db.execute(
        select(func.count()).select_from(Report).where(
            Report.reporter_id == reporter_id,
            Report.object_type == object_type,
            Report.object_id == payload.objectId,
        )
    ).scalar_one()
    if duplicate > 0:
        raise BizException(ErrorCode.GOV_001, "你已举报过该内容，请等待处理")

    report = Report(
        reporter_id=reporter_id,
        object_type=object_type,
        object_id=payload.objectId,
        tea_id=payload.teaId,
        report_type=report_type,
        description=description,
        status="pending",
        sla_deadline=now() + timedelta(hours=SLA_HOURS),
    )
    db.add(report)
    try:
        db.flush()
    except IntegrityError as exc:
        db.rollback()
        raise BizException(ErrorCode.GOV_001, "你已举报过该内容，请等待处理") from exc
    _notify(db, reporter_id, "system", "举报已提交", "我们将在 48 小时内处理", "report", report.id)
    db.commit()
    return report.id


def list_reports(
    db: Session,
    status: str | None,
    object_type: str | None,
    overdue: bool,
    page: int,
    size: int,
) -> tuple[list[dict], int, int, int]:
    page, size = normalize(page, size)
    stmt = select(Report)
    if status and status.strip():
        stmt = stmt.where(Report.status == status.strip())
    if object_type and object_type.strip():
        stmt = stmt.where(Report.object_type == object_type.strip())
    deadline = now()
    if overdue:
        stmt = stmt.where(Report.status.in_(OPEN_STATUSES), Report.sla_deadline < deadline)
    total = db.execute(select(func.count()).select_from(stmt.subquery())).scalar_one()
    rows = (
        db.execute(
            stmt.order_by(Report.sla_deadline.asc(), Report.id.asc())
            .limit(size)
            .offset((page - 1) * size)
        )
        .scalars()
        .all()
    )
    return _report_items(db, rows, deadline), page, size, total


def _report_items(db: Session, rows: list[Report], deadline: datetime) -> list[dict]:
    tea_names = _tea_names(db, [row.tea_id for row in rows])
    profiles = account_service.profiles_by_ids(db, [row.reporter_id for row in rows])
    items = []
    for row in rows:
        profile = profiles.get(row.reporter_id) or {}
        items.append(
            {
                "id": row.id,
                "reporterId": row.reporter_id,
                "reporterNickname": profile.get("nickname") or "茶友",
                "objectType": row.object_type,
                "objectId": row.object_id,
                "teaId": row.tea_id,
                "teaName": tea_names.get(row.tea_id),
                "reportType": row.report_type,
                "description": row.description,
                "status": row.status,
                "slaDeadline": iso(row.sla_deadline),
                "overdue": row.status in OPEN_STATUSES
                and row.sla_deadline is not None
                and row.sla_deadline < deadline,
                "createdAt": iso(row.created_at),
            }
        )
    return items


def report_detail(db: Session, report_id: int) -> dict:
    report = _require_report(db, report_id)
    item = _report_items(db, [report], now())[0]
    evidence = [
        {"id": row.id, "url": _storage_url(row.storage_path), "seq": row.seq}
        for row in db.execute(
            select(ReportEvidence)
            .where(ReportEvidence.report_id == report_id)
            .order_by(ReportEvidence.seq.asc())
        )
        .scalars()
        .all()
    ]
    appeals = [
        _appeal_view(db, row)
        for row in db.execute(
            select(Appeal)
            .where(Appeal.report_id == report_id)
            .order_by(Appeal.created_at.desc())
        )
        .scalars()
        .all()
    ]
    return {
        "item": item,
        "resultNote": report.result_note,
        "handlerId": report.handler_id,
        "firstResponseAt": iso(report.first_response_at),
        "resolvedAt": iso(report.resolved_at),
        "evidence": evidence,
        "appeals": appeals,
    }


def _storage_url(path: str | None) -> str | None:
    if not path:
        return None
    from app.core.storage import storage_service

    return storage_service.url(path)


def handle_report(db: Session, operator_id: int, report_id: int, payload: Any) -> None:
    report = _require_report(db, report_id)
    if report.status not in OPEN_STATUSES:
        raise BizException(ErrorCode.CATALOG_002, "举报已处理")
    note = (payload.resultNote or "").strip()
    if not note or len(note) > 300:
        raise BizException(ErrorCode.SYS_001, "处理说明必填且不超过 300 字")
    before = report.status
    if report.first_response_at is None:
        report.first_response_at = now()
    report.handler_id = operator_id
    report.result_note = note
    report.resolved_at = now()
    if payload.decision == "valid":
        report.status = "resolved_valid"
        action = (payload.action or "").strip()
        if action:
            respondent = _respondent_of(db, report)
            if respondent is None:
                raise BizException(ErrorCode.SYS_001, "无法确定被举报人，不能附带处罚")
            _create_sanction(db, operator_id, respondent, action, note, None)
    elif payload.decision == "invalid":
        report.status = "resolved_invalid"
    else:
        raise BizException(ErrorCode.SYS_001, "decision 只能是 valid 或 invalid")
    db.flush()
    _notify(db, report.reporter_id, "report", "举报已处理", note, "report", report.id)
    AuditService(db).record("handle_report", "report", report_id, note, before, report.status)
    db.commit()


def _respondent_of(db: Session, report: Report) -> int | None:
    from app.services import engagement_service, media_service

    if report.object_type == "comment":
        return engagement_service.comment_owner(db, report.object_id)
    if report.object_type == "image":
        return media_service.image_owner(db, report.object_id)
    if report.object_type == "user_shot":
        return media_service.user_shot_owner(db, report.object_id)
    return None


def _require_report(db: Session, report_id: int) -> Report:
    report = db.get(Report, report_id)
    if report is None:
        raise BizException(ErrorCode.CATALOG_001, "举报不存在")
    return report


def create_appeal(db: Session, user_id: int, report_id: int, payload: Any) -> int:
    sanction_id = payload.sanctionId
    reason = (payload.reason or "").strip()
    if not reason or len(reason) > 1000:
        raise BizException(ErrorCode.SYS_001, "申诉理由必填且不超过 1000 字")
    if sanction_id is not None:
        sanction = db.get(Sanction, sanction_id)
        if sanction is None or sanction.user_id != user_id:
            raise BizException(ErrorCode.AUTH_003)
        if sanction.status != "active":
            raise BizException(ErrorCode.SYS_001, "处罚已失效，无需申诉")
    else:
        report = _require_report(db, report_id)
        if report.status != "resolved_valid":
            raise BizException(ErrorCode.CATALOG_002, "仅已处理为违规的举报可申诉")
        respondent = _respondent_of(db, report)
        if respondent is None or respondent != user_id:
            raise BizException(ErrorCode.AUTH_003)

    if sanction_id is not None:
        condition = Appeal.sanction_id == sanction_id
    else:
        condition = Appeal.report_id == report_id
    duplicate = db.execute(
        select(func.count()).select_from(Appeal).where(
            Appeal.appellant_id == user_id,
            condition,
        )
    ).scalar_one()
    if duplicate > 0:
        raise BizException(ErrorCode.GOV_002, "每案仅可申诉 1 次")

    appeal = Appeal(
        report_id=None if sanction_id is not None else report_id,
        sanction_id=sanction_id,
        appellant_id=user_id,
        reason=reason,
        status="pending",
    )
    db.add(appeal)
    db.flush()
    db.commit()
    return appeal.id


def list_appeals(
    db: Session, status: str | None, page: int, size: int
) -> tuple[list[dict], int, int, int]:
    page, size = normalize(page, size)
    stmt = select(Appeal)
    if status and status.strip():
        stmt = stmt.where(Appeal.status == status.strip())
    total = db.execute(select(func.count()).select_from(stmt.subquery())).scalar_one()
    rows = (
        db.execute(
            stmt.order_by(Appeal.created_at.asc())
            .limit(size)
            .offset((page - 1) * size)
        )
        .scalars()
        .all()
    )
    return [_appeal_view(db, row) for row in rows], page, size, total


def review_appeal(db: Session, reviewer_id: int, appeal_id: int, payload: Any) -> None:
    appeal = db.get(Appeal, appeal_id)
    if appeal is None:
        raise BizException(ErrorCode.CATALOG_001, "申诉不存在")
    if appeal.status != "pending":
        raise BizException(ErrorCode.GOV_002, "申诉已复核")
    note = (payload.note or "").strip()
    if not note or len(note) > 300:
        raise BizException(ErrorCode.SYS_001, "复核说明必填且不超过 300 字")
    if payload.decision == "uphold":
        appeal.status = "upheld"
        restore_comment_id = None
    elif payload.decision == "overturn":
        appeal.status = "overturned"
        restore_comment_id = None
        if appeal.sanction_id is not None:
            sanction = db.get(Sanction, appeal.sanction_id)
            if sanction is not None and sanction.status == "active":
                sanction.status = "revoked"
                sanction.revoked_by = reviewer_id
                sanction.revoked_at = now()
        if appeal.report_id is not None:
            report = db.get(Report, appeal.report_id)
            if report is not None:
                report.status = "resolved_invalid"
                report.result_note = "申诉成立：" + note
                if report.object_type == "comment":
                    restore_comment_id = report.object_id
    else:
        raise BizException(ErrorCode.SYS_001, "decision 只能是 uphold 或 overturn")
    appeal.reviewer_id = reviewer_id
    appeal.review_note = note
    appeal.reviewed_at = now()
    db.flush()
    _notify(
        db,
        appeal.appellant_id,
        "report",
        "申诉结果",
        "申诉成立：" + note if payload.decision == "overturn" else "申诉未通过：" + note,
        "appeal",
        appeal_id,
    )
    AuditService(db).record("review_appeal", "appeal", appeal_id, note, "pending", appeal.status)
    if restore_comment_id is not None:
        from app.services import engagement_service

        engagement_service.restore_comment(db, restore_comment_id)
    db.commit()


# ---------------- 处罚与用户管理 ----------------

def list_users(
    db: Session,
    keyword: str | None,
    sanction_status: str | None,
    page: int,
    size: int,
) -> tuple[list[dict], int, int, int]:
    page, size = normalize(page, size)
    rows, total = account_service.admin_search(db, keyword, page, size)
    statuses = _sanction_status_map(db, [row["id"] for row in rows])
    items = []
    for row in rows:
        items.append(
            {
                "id": row["id"],
                "nickname": row.get("nickname") or "茶友",
                "avatarUrl": row.get("avatarUrl"),
                "status": row.get("status"),
                "sanctionStatus": statuses.get(row["id"], "none"),
                "registeredAt": row.get("registeredAt"),
            }
        )
    filter_status = sanction_status.strip() if sanction_status else None
    if filter_status and filter_status != "none":
        filtered = [item for item in items if item["sanctionStatus"] == filter_status]
        return filtered, page, size, len(filtered)
    return items, page, size, total


def _sanction_status_map(db: Session, user_ids: list[int]) -> dict[int, str]:
    if not user_ids:
        return {}
    current = now()
    rows = db.execute(
        select(Sanction.user_id, Sanction.sanction_type)
        .where(
            Sanction.user_id.in_(user_ids),
            Sanction.status == "active",
            or_(Sanction.end_at.is_(None), Sanction.end_at > current),
        )
        .order_by(Sanction.created_at.asc())
    ).all()
    statuses: dict[int, str] = {}
    for row in rows:
        previous = statuses.get(row.user_id)
        if previous == "ban" or row.sanction_type == "ban":
            statuses[row.user_id] = "ban"
        else:
            statuses[row.user_id] = "mute"
    return statuses


def list_sanctions(db: Session, user_id: int) -> list[dict]:
    rows = (
        db.execute(
            select(Sanction)
            .where(Sanction.user_id == user_id)
            .order_by(Sanction.created_at.desc())
        )
        .scalars()
        .all()
    )
    return [_sanction_view(row) for row in rows]


def create_sanction(
    db: Session,
    operator_id: int,
    user_id: int,
    sanction_type: str,
    reason: str | None,
    end_at: datetime | None,
) -> dict:
    row = _create_sanction(db, operator_id, user_id, sanction_type, reason, end_at)
    db.commit()
    return _sanction_view(row)


def _create_sanction(
    db: Session,
    operator_id: int,
    user_id: int,
    sanction_type: str,
    reason: str | None,
    end_at: datetime | None,
) -> Sanction:
    if user_id == operator_id:
        raise BizException(ErrorCode.GOV_003)
    if sanction_type not in SANCTION_TYPES:
        raise BizException(ErrorCode.SYS_001, "处罚类型只能是 mute 或 ban")
    note = reason.strip() if reason else ""
    if not note or len(note) > 300:
        raise BizException(ErrorCode.SYS_001, "处罚理由必填且不超过 300 字")
    sanction = Sanction(
        user_id=user_id,
        sanction_type=sanction_type,
        reason=note,
        start_at=now(),
        end_at=_naive(end_at),
        status="active",
        operator_id=operator_id,
    )
    db.add(sanction)
    db.flush()
    if sanction_type == "ban":
        token_store.revoke_all_access(user_id)
    _notify(
        db,
        user_id,
        "system",
        "账号已封禁" if sanction_type == "ban" else "账号已禁言",
        note,
        "sanction",
        sanction.id,
    )
    AuditService(db).record(
        "sanction",
        "user",
        user_id,
        note,
        None,
        {"type": sanction_type, "endAt": iso(sanction.end_at) or "permanent"},
    )
    return sanction


def revoke_sanction(
    db: Session, operator_id: int, user_id: int, sanction_id: int, reason: str | None
) -> None:
    sanction = db.get(Sanction, sanction_id)
    if sanction is None or sanction.user_id != user_id:
        raise BizException(ErrorCode.CATALOG_001, "处罚记录不存在")
    if sanction.status != "active":
        raise BizException(ErrorCode.CATALOG_002, "处罚已失效或已解除")
    sanction.status = "revoked"
    sanction.revoked_by = operator_id
    sanction.revoked_at = now()
    note = reason.strip() if reason and reason.strip() else "管理员解除处罚"
    db.flush()
    _notify(db, user_id, "system", "处罚已解除", note, "sanction", sanction_id)
    AuditService(db).record("revoke_sanction", "user", user_id, note, "active", "revoked")
    db.commit()


def _naive(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is not None:
        return value.astimezone(TZ).replace(tzinfo=None)
    return value


# ---------------- 运营工作台统计（供 ops 复用） ----------------

def count_open_reports(db: Session) -> int:
    return db.execute(
        select(func.count()).select_from(Report).where(Report.status.in_(OPEN_STATUSES))
    ).scalar_one()


def count_overdue_reports(db: Session) -> int:
    return db.execute(
        select(func.count()).select_from(Report).where(
            Report.status.in_(OPEN_STATUSES),
            Report.sla_deadline < now(),
        )
    ).scalar_one()
