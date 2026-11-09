"""核心纯函数：分页、错误码、时间格式、消息保留期。"""

import pytest

from app.core.errors import BizException, ErrorCode
from app.core.pagination import normalize
from app.core.timeutil import date_str, iso, now
from app.services.message_service import RETENTION_DAYS


def test_page_below_one_falls_back_to_first_page():
    assert normalize(0, 12) == (1, 12)
    assert normalize(None, None) == (1, 12)


def test_size_out_of_range_rejected():
    with pytest.raises(BizException) as exc:
        normalize(1, 0)
    assert exc.value.spec == ErrorCode.SYS_001
    with pytest.raises(BizException):
        normalize(1, 60)


def test_error_code_status_mapping():
    assert ErrorCode.AUTH_001.code == "MM-AUTH-001"
    assert ErrorCode.AUTH_001.status == 401
    assert ErrorCode.CATALOG_001.status == 404
    assert ErrorCode.CATALOG_002.status == 409
    assert ErrorCode.SUB_001.status == 403


def test_time_format_matches_contract():
    value = now()
    assert iso(value).endswith("+08:00")
    assert iso(value).startswith(value.strftime("%Y-%m-%dT%H:%M:%S"))
    assert date_str(value) == value.strftime("%Y-%m-%d")
    assert iso(None) is None


def test_message_retention_is_180_days():
    assert RETENTION_DAYS == 180
