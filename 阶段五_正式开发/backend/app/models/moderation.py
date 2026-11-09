"""审核与治理（M08）模型。"""

from datetime import datetime

from sqlalchemy import BigInteger, DateTime, ForeignKey, SmallInteger, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class Report(Base):
    __tablename__ = "report"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    reporter_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("user_identity.id"), nullable=False
    )
    object_type: Mapped[str] = mapped_column(String(16), nullable=False)
    object_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    tea_id: Mapped[int | None] = mapped_column(BigInteger)
    report_type: Mapped[str] = mapped_column(String(32), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(24), nullable=False, default="pending")
    first_response_at: Mapped[datetime | None] = mapped_column(DateTime)
    sla_deadline: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    handler_id: Mapped[int | None] = mapped_column(BigInteger)
    result_note: Mapped[str | None] = mapped_column(String(300))
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.now, onupdate=datetime.now
    )


class ReportEvidence(Base):
    __tablename__ = "report_evidence"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    report_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("report.id"), nullable=False)
    storage_path: Mapped[str] = mapped_column(String(300), nullable=False)
    seq: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=1)


class Sanction(Base):
    __tablename__ = "sanction"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("user_identity.id"), nullable=False)
    sanction_type: Mapped[str] = mapped_column(String(16), nullable=False)
    reason: Mapped[str] = mapped_column(String(300), nullable=False)
    start_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.now)
    end_at: Mapped[datetime | None] = mapped_column(DateTime)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="active")
    operator_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    revoked_by: Mapped[int | None] = mapped_column(BigInteger)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.now)


class Appeal(Base):
    __tablename__ = "appeal"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    report_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("report.id"))
    sanction_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("sanction.id"))
    appellant_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("user_identity.id"), nullable=False
    )
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="pending")
    reviewer_id: Mapped[int | None] = mapped_column(BigInteger)
    review_note: Mapped[str | None] = mapped_column(String(300))
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.now)
