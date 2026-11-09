"""ORM 模型：与 database/init.sql 的 38 张表一一对应。

字段命名沿用 snake_case 列名；不在此处建表（DDL 由 init.sql / 迁移脚本负责）。
"""

from app.models.account import AccountDeletionRequest, AdminWhitelist, UserIdentity, UserProfile
from app.models.audit import AuditLog
from app.models.catalog import (
    Tea,
    TeaAlias,
    TeaCategory,
    TeaGrade,
    TeaHarvestPeriod,
    TeaRegion,
    TeaRevision,
    TeaStandard,
    TeaSubcategory,
    TeaSubcategoryExtra,
    TeaTag,
)
from app.models.engagement import BrowseHistory, Comment, CommentLike, CompareItem, UserFavorite
from app.models.media import GalleryUserShot, MediaImage
from app.models.moderation import Appeal, Report, ReportEvidence, Sanction
from app.models.notification import Message
from app.models.ops import ImportRowError, ImportTask, SystemConfig, SystemConfigLog
from app.models.submission import Submission, SubmissionFieldDiff, SubmissionImage
from app.models.tag import Tag, TagRequest
from app.models.task import TaskRetry

__all__ = [
    "AccountDeletionRequest",
    "AdminWhitelist",
    "UserIdentity",
    "UserProfile",
    "AuditLog",
    "Tea",
    "TeaAlias",
    "TeaCategory",
    "TeaGrade",
    "TeaHarvestPeriod",
    "TeaRegion",
    "TeaRevision",
    "TeaStandard",
    "TeaSubcategory",
    "TeaSubcategoryExtra",
    "TeaTag",
    "BrowseHistory",
    "Comment",
    "CommentLike",
    "CompareItem",
    "UserFavorite",
    "GalleryUserShot",
    "MediaImage",
    "Appeal",
    "Report",
    "ReportEvidence",
    "Sanction",
    "Message",
    "ImportRowError",
    "ImportTask",
    "SystemConfig",
    "SystemConfigLog",
    "Submission",
    "SubmissionFieldDiff",
    "SubmissionImage",
    "Tag",
    "TagRequest",
    "TaskRetry",
]
