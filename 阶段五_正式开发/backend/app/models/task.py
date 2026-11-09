"""平台补偿任务（M11）模型。"""

from datetime import datetime

from sqlalchemy import BigInteger, DateTime, JSON, SmallInteger, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class TaskRetry(Base):
    __tablename__ = "task_retry"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    event_type: Mapped[str] = mapped_column(String(64), nullable=False)
    payload: Mapped[dict] = mapped_column(JSON, nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="pending")
    retry_count: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=0)
    max_retry: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=5)
    next_retry_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.now)
    last_error: Mapped[str | None] = mapped_column(String(500))
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.now, onupdate=datetime.now
    )
