"""站内消息 180 天保留边界（M09 / TC-INT-015）。"""

from datetime import timedelta

from app.core.timeutil import now
from app.models.notification import Message
from app.services import message_service
from tests.factories import create_user


def _message(user_id: int, title: str, days_ago: int) -> Message:
    return Message(
        user_id=user_id,
        type="system",
        title=title,
        summary="保留期边界用例",
        created_at=now() - timedelta(days=days_ago),
    )


def test_purge_expired_removes_only_messages_older_than_retention(db):
    user = create_user(db)
    stale = _message(user, "超过 180 天", 181)
    fresh = _message(user, "未到保留期", 179)
    db.add_all([stale, fresh])
    db.commit()

    deleted = message_service.purge_expired(db)

    assert deleted >= 1
    assert db.get(Message, stale.id) is None
    assert db.get(Message, fresh.id) is not None


def test_retention_constant_matches_prd():
    assert message_service.RETENTION_DAYS == 180
