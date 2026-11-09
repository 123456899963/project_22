"""茶品与分类（M02）模型。"""

from datetime import datetime
from decimal import Decimal

from sqlalchemy import BigInteger, Boolean, DateTime, ForeignKey, Integer, JSON, Numeric, SmallInteger, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class TeaCategory(Base):
    __tablename__ = "tea_category"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    code: Mapped[str] = mapped_column(String(32), nullable=False, unique=True)
    name: Mapped[str] = mapped_column(String(32), nullable=False)
    intro: Mapped[str | None] = mapped_column(String(200))
    sort_order: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=0)
    color_token: Mapped[str | None] = mapped_column(String(32))
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.now, onupdate=datetime.now
    )


class TeaSubcategory(Base):
    __tablename__ = "tea_subcategory"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    category_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("tea_category.id"), nullable=False)
    code: Mapped[str] = mapped_column(String(40), nullable=False)
    name: Mapped[str] = mapped_column(String(40), nullable=False)
    content_status: Mapped[str] = mapped_column(String(16), nullable=False, default="constructing")
    sort_order: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.now, onupdate=datetime.now
    )


class Tea(Base):
    __tablename__ = "tea"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    tea_code: Mapped[str] = mapped_column(String(40), nullable=False, unique=True)
    name: Mapped[str] = mapped_column(String(80), nullable=False)
    name_pinyin: Mapped[str | None] = mapped_column(String(120))
    name_initials: Mapped[str | None] = mapped_column(String(40))
    category_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("tea_category.id"), nullable=False)
    subcategory_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("tea_subcategory.id"), nullable=False)
    origin_summary: Mapped[str | None] = mapped_column(String(300))
    quality_desc: Mapped[str | None] = mapped_column(Text)
    water_temp_min: Mapped[int | None] = mapped_column(SmallInteger)
    water_temp_max: Mapped[int | None] = mapped_column(SmallInteger)
    ratio_grams: Mapped[Decimal | None] = mapped_column(Numeric(6, 2), default=Decimal("1.00"))
    ratio_water_ml: Mapped[int | None] = mapped_column(SmallInteger)
    vessel: Mapped[str | None] = mapped_column(String(32))
    steep_seconds_min: Mapped[int | None] = mapped_column(SmallInteger)
    steep_seconds_max: Mapped[int | None] = mapped_column(SmallInteger)
    steep_times: Mapped[int | None] = mapped_column(SmallInteger)
    production_year: Mapped[int | None] = mapped_column(SmallInteger)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="draft")
    image_count: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=0)
    gallery_ready: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    published_version: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime)
    published_at: Mapped[datetime | None] = mapped_column(DateTime)
    last_update_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.now)
    created_by: Mapped[int | None] = mapped_column(BigInteger)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.now, onupdate=datetime.now
    )
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime)


class TeaAlias(Base):
    __tablename__ = "tea_alias"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    tea_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("tea.id"), nullable=False)
    alias: Mapped[str] = mapped_column(String(60), nullable=False)
    pinyin: Mapped[str | None] = mapped_column(String(120))
    initials: Mapped[str | None] = mapped_column(String(40))
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.now)


class TeaGrade(Base):
    __tablename__ = "tea_grade"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    tea_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("tea.id"), nullable=False)
    grade: Mapped[str] = mapped_column(String(8), nullable=False)
    sort_order: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=0)


class TeaHarvestPeriod(Base):
    __tablename__ = "tea_harvest_period"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    tea_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("tea.id"), nullable=False)
    start_month: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    end_month: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    season_label: Mapped[str] = mapped_column(String(16), nullable=False)
    note: Mapped[str | None] = mapped_column(String(60))
    sort_order: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=0)


class TeaRegion(Base):
    __tablename__ = "tea_region"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    tea_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("tea.id"), nullable=False)
    region_name: Mapped[str] = mapped_column(String(60), nullable=False)
    region_type: Mapped[str] = mapped_column(String(16), nullable=False, default="primary")
    flavor_note: Mapped[str | None] = mapped_column(String(200))
    sort_order: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=0)


class TeaStandard(Base):
    __tablename__ = "tea_standard"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    tea_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("tea.id"), nullable=False)
    standard_no: Mapped[str] = mapped_column(String(60), nullable=False)
    standard_type: Mapped[str] = mapped_column(String(16), nullable=False, default="national")
    note: Mapped[str | None] = mapped_column(String(100))


class TeaSubcategoryExtra(Base):
    __tablename__ = "tea_subcategory_extra"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    tea_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("tea.id"), nullable=False)
    subcategory_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("tea_subcategory.id"), nullable=False
    )


class TeaTag(Base):
    __tablename__ = "tea_tag"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    tea_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("tea.id"), nullable=False)
    tag_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("tag.id"), nullable=False)


class TeaRevision(Base):
    __tablename__ = "tea_revision"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    tea_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("tea.id"), nullable=False)
    revision_no: Mapped[int] = mapped_column(Integer, nullable=False)
    source: Mapped[str] = mapped_column(String(16), nullable=False, default="admin_edit")
    submission_id: Mapped[int | None] = mapped_column(BigInteger)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="draft")
    snapshot: Mapped[dict] = mapped_column(JSON, nullable=False)
    pending_guard: Mapped[int | None] = mapped_column(BigInteger)  # 生成列，只读
    change_note: Mapped[str | None] = mapped_column(String(300))
    review_note: Mapped[str | None] = mapped_column(String(300))
    created_by: Mapped[int | None] = mapped_column(BigInteger)
    reviewed_by: Mapped[int | None] = mapped_column(BigInteger)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.now, onupdate=datetime.now
    )
