from datetime import datetime

from sqlalchemy import DateTime, Enum, String, text
from sqlalchemy.dialects.mysql import INTEGER as MySQLInteger
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class User(Base):
    """用户账号与角色（PRD §3.1 / §4.3）"""

    __tablename__ = "users"

    id: Mapped[int] = mapped_column(
        MySQLInteger(unsigned=True), primary_key=True, autoincrement=True
    )
    username: Mapped[str] = mapped_column(String(32), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(
        Enum("user", "admin", name="user_role"), nullable=False, default="user"
    )
    avatar_url: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.utcnow, server_default=text("CURRENT_TIMESTAMP")
    )

    # level 字段 MVP 不建，S15（等级展示）第二阶段再评估
