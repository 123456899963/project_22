"""pytest 夹具：测试库隔离、TestClient、令牌与最小数据工厂。

前置：先执行 `backend/tests/prepare_test_db.py` 重建 mingmai_test。
测试库不可用时整组跳过并输出原因，不伪造通过。
"""

import os

# 必须在导入 app 之前覆盖配置（pydantic-settings 的环境变量优先级高于 .env）
os.environ["MM_DB_NAME"] = "mingmai_test"
os.environ["MM_REDIS_URL"] = "redis://127.0.0.1:6379/15"
os.environ["MM_STORAGE_DIR"] = "./data/test-uploads"
os.environ["MM_WECHAT_MOCK"] = "true"

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.core.db import SessionLocal, engine


def _db_ready() -> tuple[bool, str]:
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
            exists = conn.execute(
                text("SHOW TABLES LIKE 'tea'")
            ).first()
        if exists is None:
            return False, "mingmai_test 缺少表结构，请先执行 tests/prepare_test_db.py"
        return True, ""
    except Exception as exc:  # 连接失败即判定测试库不可用
        return False, f"测试库不可用：{exc}"


_DB_OK, _DB_REASON = _db_ready()


@pytest.fixture(scope="session", autouse=True)
def require_test_db() -> None:
    if not _DB_OK:
        pytest.skip(_DB_REASON, allow_module_level=True)


@pytest.fixture(scope="session")
def client() -> TestClient:
    from app.main import app

    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def db():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()
