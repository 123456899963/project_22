"""图鉴与媒体（M03）模型。"""

from datetime import date, datetime

from sqlalchemy import BigInteger, Boolean, Date, DateTime, ForeignKey, Integer, SmallInteger, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class MediaImage(Base):
    __tablename__ = "media_image"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    tea_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("tea.id"), nullable=False)
    image_type: Mapped[str] = mapped_column(String(16), nullable=False)
    seq: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=1)
    storage_path: Mapped[str] = mapped_column(String(300), nullable=False)
    thumb_path: Mapped[str | None] = mapped_column(String(300))
    display_path: Mapped[str | None] = mapped_column(String(300))
    original_name: Mapped[str | None] = mapped_column(String(200))
    mime: Mapped[str] = mapped_column(String(32), nullable=False)
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    width: Mapped[int | None] = mapped_column(SmallInteger)
    height: Mapped[int | None] = mapped_column(SmallInteger)
    source_type: Mapped[str] = mapped_column(String(16), nullable=False)
    rights_holder: Mapped[str | None] = mapped_column(String(100))
    license_scope: Mapped[str | None] = mapped_column(String(200))
    license_expire: Mapped[date | None] = mapped_column(Date)
    license_cert_no: Mapped[str | None] = mapped_column(String(80))
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="draft")
    uploaded_by: Mapped[int | None] = mapped_column(BigInteger)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.now, onupdate=datetime.now
    )
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime)


class GalleryUserShot(Base):
    __tablename__ = "gallery_user_shot"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    tea_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("tea.id"), nullable=False)
    submission_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    image_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("media_image.id"), nullable=False)
    author_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    anonymous: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    license_granted: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="candidate")
    adopted_by: Mapped[int | None] = mapped_column(BigInteger)
    adopted_at: Mapped[datetime | None] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.now)
