"""投稿与修订（M07）模型。"""

from datetime import datetime

from sqlalchemy import BigInteger, DateTime, ForeignKey, SmallInteger, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class Submission(Base):
    __tablename__ = "submission"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("user_identity.id"), nullable=False)
    type: Mapped[str] = mapped_column(String(8), nullable=False)
    tea_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("tea.id"))
    correction_field_key: Mapped[str | None] = mapped_column(String(40))
    title: Mapped[str | None] = mapped_column(String(120))
    body: Mapped[str | None] = mapped_column(Text)
    anonymous: Mapped[bool] = mapped_column(SmallInteger, nullable=False, default=0)
    license_granted: Mapped[bool] = mapped_column(SmallInteger, nullable=False, default=0)
    license_granted_at: Mapped[datetime | None] = mapped_column(DateTime)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="draft")
    # 生成列，只读
    pending_guard: Mapped[str | None] = mapped_column(String(90))
    reject_reason: Mapped[str | None] = mapped_column(String(300))
    resubmit_count: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=0)
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime)
    reviewed_by: Mapped[int | None] = mapped_column(BigInteger)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime)
    locked_at: Mapped[datetime | None] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.now, onupdate=datetime.now
    )
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime)


class SubmissionImage(Base):
    __tablename__ = "submission_image"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    submission_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("submission.id"), nullable=False
    )
    image_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("media_image.id"), nullable=False)
    seq: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=1)


class SubmissionFieldDiff(Base):
    __tablename__ = "submission_field_diff"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    submission_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("submission.id"), nullable=False
    )
    field_key: Mapped[str] = mapped_column(String(40), nullable=False)
    old_value: Mapped[str | None] = mapped_column(String(500))
    new_value: Mapped[str | None] = mapped_column(String(500))
    reason: Mapped[str | None] = mapped_column(String(300))
