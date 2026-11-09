"""微信真实扫码登录换码：站点扫码必须走 sns/oauth2/access_token（安全 #1 认证链路）。"""

import pytest

from app.core.config import settings
from app.core.errors import BizException
from app.services import auth_service


class _FakeResponse:
    def __init__(self, payload: dict) -> None:
        self._payload = payload

    def json(self) -> dict:
        return self._payload


class _FakeClient:
    def __init__(self, payload: dict, calls: list) -> None:
        self._payload = payload
        self._calls = calls

    def __enter__(self) -> "_FakeClient":
        return self

    def __exit__(self, *_: object) -> bool:
        return False

    def get(self, url: str, params: dict | None = None) -> _FakeResponse:
        self._calls.append((url, params))
        return _FakeResponse(self._payload)


def _patch_http(monkeypatch: pytest.MonkeyPatch, payload: dict, calls: list) -> None:
    monkeypatch.setattr(auth_service.httpx, "Client", lambda timeout=10: _FakeClient(payload, calls))


def test_mock_mode_returns_mock_openid(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "wechat_mock", True)

    assert auth_service._resolve_openid("abc") == ("mock_abc", None)


def test_qr_code_exchanges_code_via_oauth2_endpoint(monkeypatch: pytest.MonkeyPatch) -> None:
    calls: list = []
    monkeypatch.setattr(settings, "wechat_mock", False)
    monkeypatch.setattr(settings, "wechat_app_id", "wx-appid")
    monkeypatch.setattr(settings, "wechat_app_secret", "wx-secret")
    _patch_http(monkeypatch, {"openid": "openid-1", "unionid": "union-1"}, calls)

    assert auth_service._resolve_openid("code-1") == ("openid-1", "union-1")

    url, params = calls[0]
    assert url.endswith("/sns/oauth2/access_token")
    assert params == {
        "appid": "wx-appid",
        "secret": "wx-secret",
        "code": "code-1",
        "grant_type": "authorization_code",
    }


def test_qr_code_rejects_when_app_credentials_missing(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "wechat_mock", False)
    monkeypatch.setattr(settings, "wechat_app_id", "")
    monkeypatch.setattr(settings, "wechat_app_secret", "")

    with pytest.raises(BizException) as raised:
        auth_service._resolve_openid("code-1")
    assert raised.value.spec.code == "MM-AUTH-006"


def test_qr_code_rejects_wechat_error_payload(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "wechat_mock", False)
    monkeypatch.setattr(settings, "wechat_app_id", "wx-appid")
    monkeypatch.setattr(settings, "wechat_app_secret", "wx-secret")
    _patch_http(monkeypatch, {"errcode": 40029, "errmsg": "invalid code"}, [])

    with pytest.raises(BizException) as raised:
        auth_service._resolve_openid("bad-code")
    assert raised.value.spec.code == "MM-AUTH-006"
