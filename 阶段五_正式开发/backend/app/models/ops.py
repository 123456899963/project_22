"""运营工具（M10）模型。"""

from datetime import datetime

from sqlalchemy import BigInteger, Boolean, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class ImportTask(Base):
    __tablename__ = "import_task"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    operator_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("user_identity.id"), nullable=False
    )
    file_name: Mapped[str] = mapped_column(String(200), nullable=False)
    file_path: Mapped[str | None] = mapped_column(String(300))
    status: Mapped[str] = mapped_column(String(24), nullable=False, default="uploading")
    total_rows: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    success_rows: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    error_rows: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    error_report_path: Mapped[str | None] = mapped_column(String(300))
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.now)
    started_at: Mapped[datetime | None] = mapped_column(DateTime)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime)


class ImportRowError(Base):
    __tablename__ = "import_row_error"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    task_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("import_task.id"), nullable=False)
    row_no: Mapped[int] = mapped_column(Integer, nullable=False)
    column_name: Mapped[str | None] = mapped_column(String(60))
    error_msg: Mapped[str] = mapped_column(String(300), nullable=False)


class SystemConfig(Base):
    __tablename__ = "system_config"

    config_key: Mapped[str] = mapped_column(String(64), primary_key=True)
    config_value: Mapped[str] = mapped_column(String(1000), nullable=False)
    value_type: Mapped[str] = mapped_column(String(16), nullable=False, default="string")
    editable: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    description: Mapped[str | None] = mapped_column(String(200))
    updated_by: Mapped[int | None] = mapped_column(BigInteger)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.now, onupdate=datetime.now
    )


class SystemConfigLog(Base):
    __tablename__ = "system_config_log"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    config_key: Mapped[str] = mapped_column(String(64), nullable=False)
    old_value: Mapped[str | None] = mapped_column(String(1000))
    new_value: Mapped[str] = mapped_column(String(1000), nullable=False)
    updated_by: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("user_identity.id"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.now)
