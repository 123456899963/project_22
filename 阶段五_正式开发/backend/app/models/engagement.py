"""用户互动（M06）模型。"""

from datetime import datetime

from sqlalchemy import BigInteger, DateTime, ForeignKey, Integer, SmallInteger, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class UserFavorite(Base):
    __tablename__ = "user_favorite"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("user_identity.id"), nullable=False)
    tea_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("tea.id"), nullable=False)
    fav_group: Mapped[str] = mapped_column(String(16), nullable=False, default="want")
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.now, onupdate=datetime.now
    )


class BrowseHistory(Base):
    __tablename__ = "browse_history"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("user_identity.id"), nullable=False)
    tea_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("tea.id"), nullable=False)
    viewed_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.now)


class CompareItem(Base):
    __tablename__ = "compare_item"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("user_identity.id"), nullable=False)
    tea_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("tea.id"), nullable=False)
    sort_order: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.now)


class Comment(Base):
    __tablename__ = "comment"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    tea_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("tea.id"), nullable=False)
    user_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("user_identity.id"), nullable=False)
    content: Mapped[str] = mapped_column(String(1000), nullable=False)
    image_id: Mapped[int | None] = mapped_column(BigInteger)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="pending")
    like_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    reject_reason: Mapped[str | None] = mapped_column(String(200))
    reviewed_by: Mapped[int | None] = mapped_column(BigInteger)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.now, onupdate=datetime.now
    )


class CommentLike(Base):
    __tablename__ = "comment_like"

    comment_id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    user_id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.now)
