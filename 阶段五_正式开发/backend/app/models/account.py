"""账号与会话（M01）模型。"""

from datetime import datetime

from sqlalchemy import BigInteger, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class UserIdentity(Base):
    __tablename__ = "user_identity"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    openid: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    unionid: Mapped[str | None] = mapped_column(String(64))
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="active")
    registered_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.now)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.now, onupdate=datetime.now
    )


class UserProfile(Base):
    __tablename__ = "user_profile"

    user_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("user_identity.id"), primary_key=True
    )
    nickname: Mapped[str] = mapped_column(String(60), nullable=False, default="茶友")
    avatar_url: Mapped[str | None] = mapped_column(String(500))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.now, onupdate=datetime.now
    )


class AccountDeletionRequest(Base):
    __tablename__ = "account_deletion_request"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("user_identity.id"), nullable=False)
    requested_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.now)
    effective_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="pending")
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime)
    executed_at: Mapped[datetime | None] = mapped_column(DateTime)


class AdminWhitelist(Base):
    __tablename__ = "admin_whitelist"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    openid: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    user_id: Mapped[int | None] = mapped_column(BigInteger)
    role: Mapped[str] = mapped_column(String(16), nullable=False, default="admin")
    note: Mapped[str | None] = mapped_column(String(200))
    created_by: Mapped[int | None] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.now)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime)
