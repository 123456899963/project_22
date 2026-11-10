"""baseline：现有 7 表基线（空操作）

Revision ID: 0001_baseline
Revises:
Create Date: 2026-11-09

说明：
- 本项目 Alembic 在 MVP 完成后才接管版本链（此前 versions/ 为空）。
- 基线结构（users / teas / tea_tips / collection_lists / favorite_items /
  share_tokens / operation_logs 共 7 张表）由 database/init.sql 建立，
  本迁移不重复执行任何 DDL，仅作为 Alembic 版本起点。
- 已按 init.sql 建库的环境：执行 `alembic stamp 0001_baseline` 标记基线。
- 全新环境：先执行 database/init.sql 建库建表与种子数据，再 stamp 本版本，
  之后一律 `alembic upgrade head` 应用增量（AGENTS.md §6：禁止手工 ALTER TABLE）。
"""

from collections.abc import Sequence

# revision identifiers, used by Alembic.
revision: str = "0001_baseline"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 空操作：基线结构由 database/init.sql 管理
    pass


def downgrade() -> None:
    # 空操作：基线不可降级（降级即删库，由人工执行）
    pass
